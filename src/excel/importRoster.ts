// 名簿のブック（〈利用者さん〉か〈スタッフ〉のシート1枚）→ 今のデータに足す・直す（PRD D103〜D107。ADR-0020）。
// データは書き換えない（ADR-0006）：名簿を当てた新しい DemoData と件数を返し、画面が確かめてから store の update で入れる。
// 訪問（担当）・伝えた内容・パターン・相性などは base のまま（その人を指すものも残す）。最後は store の migrate（repair）を通す
import type { DemoData, ImportError, RosterImportResult, RosterKind, RosterMode } from '../contracts/data';
import type { Client, Staff, Terms } from '../contracts/documents';
import { STAGE_LABELS, withStage } from '../lib/clientStage';
import { nameKey } from '../lib/common';
import { isImportError, migrate } from '../store/persist';
import { loadWorkbook } from './reader';
import {
  openRoster,
  type Read,
  type RosterCtx,
  readClientRows,
  readStaffRows,
  rosterMatcher,
  same,
} from './rosterRows';

/** 確認に出す名前の数（「ほか」で省く） */
const ROSTER_NAMES_SHOWN = 3;

const nameOf = (p: Staff | Client) => ('name' in p ? p.name : p.displayName);

/**
 * 今のデータに当てる（更新は今の位置、新しい人は後ろ。総入れ替えならブックに無い人を終了・休止に）。
 * 当てたあとに名前が他の人と重なるなら行付きのエラーを積む（全角半角・空白だけの違いも同じ名前）
 */
function applyRoster(
  ctx: RosterCtx,
  reads: Read<Staff | Client>[],
  mode: RosterMode,
): { list: (Staff | Client)[]; retired: string[] } {
  const { base, kind } = ctx;
  const current: (Staff | Client)[] = kind === 'staff' ? base.staff : base.clients;
  const byRow = new Map<string, Read<Staff | Client>>();
  for (const x of reads) if (x.cur) byRow.set(x.cur.id, x);
  const retired: string[] = [];
  const list: (Staff | Client)[] = current.map((p) => {
    const x = byRow.get(p.id);
    if (x) return x.person;
    if (mode !== 'replace') return p;
    if (kind === 'staff') {
      const s = p as Staff;
      if (!s.active) return s;
      retired.push(s.name);
      return { ...s, active: false };
    }
    const c = p as Client;
    if (c.stage === 'ended') return c;
    retired.push(c.displayName);
    return withStage(c, 'ended');
  });
  for (const x of reads) if (!x.cur) list.push(x.person);

  const owner = new Map<string, Staff | Client>();
  for (const p of list) {
    const k = nameKey(nameOf(p));
    if (!owner.has(k)) owner.set(k, p);
  }
  for (const x of reads) {
    const o = owner.get(nameKey(nameOf(x.person)));
    if (o && o.id !== x.person.id)
      x.row.err(
        ctx.nameCol,
        `「${nameOf(x.person)}」は、いまの${ctx.term}の「${nameOf(o)}」と名前が重なります（ブックに無い人とも重ならないようにしてください）`,
      );
  }
  return { list, retired };
}

/** 件数は migrate（repair）のあとの結果を ID で引いて、今の人と比べる（repair で元に戻る違いは変更にしない） */
function countPeople(
  kind: RosterKind,
  reads: Read<Staff | Client>[],
  r: DemoData,
): { added: string[]; updated: string[]; unchanged: number } {
  const after = new Map<string, Staff | Client>(
    (kind === 'staff' ? r.staff : r.clients).map((p): [string, Staff | Client] => [p.id, p]),
  );
  const added: string[] = [];
  const updated: string[] = [];
  let unchanged = 0;
  for (const x of reads) {
    const got = after.get(x.person.id) ?? x.person;
    if (!x.cur) {
      // 利用中でない人だけ、段階（〈スタッフ〉は休止）を添える
      const note =
        'stage' in got
          ? got.stage === 'active'
            ? ''
            : `（${STAGE_LABELS[got.stage]}）`
          : got.active
            ? ''
            : '（休止）';
      added.push(`${nameOf(got)}${note}`);
    } else if (same(got, x.cur)) unchanged++;
    else updated.push(nameOf(got));
  }
  return { added, updated, unchanged };
}

/** 休止になった〈スタッフ〉を「担当できる人」から外す（repair）。外れる人・限らないに戻る人を確認に出す（StaffPage と同じ） */
function allowedChanges(
  kind: RosterKind,
  base: DemoData,
  r: DemoData,
): { allowedRemoved: string[]; allowedEmptied: string[] } {
  const allowedRemoved: string[] = [];
  const allowedEmptied: string[] = [];
  const clientAfter = new Map(r.clients.map((c) => [c.id, c]));
  for (const c of base.clients) {
    const got = clientAfter.get(c.id);
    // 〈利用者さん〉の名簿では、ブックで書いた担当できる人の違いは「更新」に数える（ここは〈スタッフ〉の休止で外れるものだけ）
    if (kind !== 'staff' || !got || c.allowedStaffIds.length === 0) continue;
    if (c.allowedStaffIds.some((id) => !got.allowedStaffIds.includes(id))) {
      allowedRemoved.push(c.displayName);
      if (got.allowedStaffIds.length === 0) allowedEmptied.push(c.displayName);
    }
  }
  return { allowedRemoved, allowedEmptied };
}

/**
 * 名簿のブック → 今のデータに当てた結果（PRD D103〜D107）。読めなければ、場所付きの日本語の ImportError（何も変えない）。
 * - シートは呼び方のシート名（personSheetNames）。全体のブックでも、その人のシートだけを読む
 * - 同じ人：ID が入っていれば ID で、空なら名前（全角半角・空白を同一視）で今のデータと突き合わせる。一致しなければ新しい人
 * - ブックに無い列は、更新する人では今の値のまま、新しい人では既定値（画面で足すときと同じ）
 * - 総入れ替え（mode 'replace'）：ブックに無い人を消さずに、〈利用者さん〉は段階「終了」、〈スタッフ〉は休止にする
 */
export async function importRoster(
  buf: ArrayBuffer,
  base: DemoData,
  kind: RosterKind,
  mode: RosterMode,
): Promise<RosterImportResult | ImportError> {
  const book = await loadWorkbook(buf);
  if ('code' in book) return book;
  const opened = openRoster(book, base, kind);
  if ('code' in opened) return opened;
  const { ctx, rows } = opened;
  const match = rosterMatcher(ctx);
  const reads: Read<Staff | Client>[] =
    kind === 'staff' ? readStaffRows(ctx, rows, match) : readClientRows(ctx, rows, match);
  if (ctx.errors.any) return ctx.errors.toError();

  const { list, retired } = applyRoster(ctx, reads, mode);
  if (ctx.errors.any) return ctx.errors.toError();

  const next: DemoData =
    kind === 'staff' ? { ...base, staff: list as Staff[] } : { ...base, clients: list as Client[] };
  const r = migrate(next);
  if (isImportError(r)) return { ...r, message: `読み込んだ内容に問題があります：${r.message}` };

  const { added, updated, unchanged } = countPeople(kind, reads, r);
  const { allowedRemoved, allowedEmptied } = allowedChanges(kind, base, r);
  // 最終勤務日が入った・変わった〈スタッフ〉（ADR-0015。担当の振り直しは〈スタッフ〉の画面から）
  const lastDaySet =
    kind === 'staff'
      ? r.staff
          .filter((s) => s.lastDay !== null && base.staff.find((b) => b.id === s.id)?.lastDay !== s.lastDay)
          .map((s) => s.name)
      : [];
  const activeBefore =
    kind === 'staff'
      ? base.staff.filter((s) => s.active).length
      : base.clients.filter((c) => c.stage !== 'ended').length;
  return { data: r, added, updated, unchanged, retired, allowedRemoved, allowedEmptied, lastDaySet, activeBefore };
}

/** 名前を3人まで「・」でつなぐ（多ければ「ほか」） */
const namesText = (xs: string[]) =>
  `${xs.slice(0, ROSTER_NAMES_SHOWN).join('・')}${xs.length > ROSTER_NAMES_SHOWN ? ' ほか' : ''}`;

/** 総入れ替えで、今の人（〈スタッフ〉は利用中、〈利用者さん〉は終了でない人）の半分を超える人を外すか（ファイルの取り違えの注意） */
export const rosterRetiresMost = (r: RosterImportResult): boolean =>
  r.retired.length > 0 && r.retired.length * 2 > r.activeBefore;

/**
 * 総入れ替えで今の人の半分を超える人を外すときの強い注意（確認の文の先頭に出す。PRD D106）。当たらなければ null
 */
export function rosterWarning(r: RosterImportResult, kind: RosterKind, terms: Terms): string | null {
  if (!rosterRetiresMost(r)) return null;
  return kind === 'staff'
    ? `注意：${terms.staff}の半分を超える ${r.retired.length}人を休止にします。ファイルを取り違えていないか確かめてください。`
    : `注意：${terms.client}（終了でない人）の半分を超える ${r.retired.length}人を終了にします。ファイルを取り違えていないか確かめてください。`;
}

/**
 * 確認の文（PRD D106・D107）：件数の行（「追加 2人（A・B）・更新 1人（C）・変更なし 5人・終了にする 1人（D）」）、
 * 〈スタッフ〉を休止にして「担当できる人」から外れる〈利用者さん〉があればその文（StaffPage の休止と同じ言い方。名前は全員）
 */
export function rosterSummary(r: RosterImportResult, kind: RosterKind, terms: Terms): string {
  const shown = (xs: string[]) => (xs.length === 0 ? '' : `（${namesText(xs)}）`);
  const retire = kind === 'staff' ? '休止にする' : '終了にする';
  const lines: string[] = [];
  lines.push(
    [
      `追加 ${r.added.length}人${shown(r.added)}`,
      `更新 ${r.updated.length}人${shown(r.updated)}`,
      `変更なし ${r.unchanged}人`,
      `${retire} ${r.retired.length}人${shown(r.retired)}`,
    ].join('・'),
  );
  if (r.allowedRemoved.length > 0) {
    lines.push(
      `休止にする${terms.staff}を、${r.allowedRemoved.join('・')}の「担当できる人」から外します。${
        r.allowedEmptied.length > 0
          ? `${r.allowedEmptied.join('・')}は担当できる人がいなくなり、だれでも担当できるようになります（必要なら${terms.client}の画面で選び直してください）。`
          : ''
      }あとで利用中に戻しても、担当できる人には戻りません。`,
    );
  }
  return lines.join('\n');
}

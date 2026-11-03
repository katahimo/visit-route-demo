// 「欠勤・キャンセル」の欄（PRD D167〜D172・D414。ADR-0082）の段・選択肢・文を決める純粋関数。
// 計算（振り直し）は足さない：見込みは lib/planReassign の absencePreviewOf、振り直しは日の画面の今の仕組みを呼ぶだけ。データは書き換えない
import type { Absence } from '../contracts/documents';
import type { ReassignDiff, ReassignTarget } from '../contracts/reassign';
import { type Slot, slotsText } from '../domain/availability';
import { absenceError, absenceText } from './absences';

/** 休み・キャンセルを選ぶ：〈スタッフ〉が休む／〈利用者さん〉がキャンセル */
export type SuddenKind = 'staff' | 'client';
/** 段（1：休み・キャンセルを選ぶ（選ぶと見込みとおすすめ）2：連絡・確定。PRD D414） */
export type SuddenStep = 1 | 2;

/** 段の見出し */
export const SUDDEN_HEADINGS: Record<SuddenStep, string> = { 1: '休み・キャンセルを選ぶ', 2: '変更を伝えて確定する' };

/** URL の `?do=` で欄を開く値（「欠勤・キャンセルを登録」の入口。PRD D172） */
export const SUDDEN_DO = 'absence';

/** 欠勤の欄の入力（終日／時間帯・開始・終了（空＝始業から・終業まで）・メモ） */
export type AbsenceDraft = { allDay: boolean; from: string; to: string; note: string };

/** 欠勤の時間の選び方（終日／午前だけ／午後だけ（境12:00）／時間帯。PRD D26・D414） */
export type AbsenceTime = 'allDay' | 'am' | 'pm' | 'range';

/** 時間の選び方の名前（並びは選ぶボタンの順） */
export const ABSENCE_TIMES: readonly { key: AbsenceTime; label: string }[] = [
  { key: 'allDay', label: '終日' },
  { key: 'am', label: '午前だけ' },
  { key: 'pm', label: '午後だけ' },
  { key: 'range', label: '時間帯' },
];

/** 入力から今の選び方（午前だけ＝始業から12:00まで・午後だけ＝12:00から終業まで。ほかは時間帯） */
export function absenceTimeOf(d: AbsenceDraft): AbsenceTime {
  if (d.allDay) return 'allDay';
  if (d.from === '' && d.to === '12:00') return 'am';
  if (d.from === '12:00' && d.to === '') return 'pm';
  return 'range';
}

/** 選び方を押したときの入力（時間帯は今の開始・終了を残す。メモは変えない） */
export function draftOfTime(d: AbsenceDraft, t: AbsenceTime): AbsenceDraft {
  switch (t) {
    case 'allDay':
      return { ...d, allDay: true };
    case 'am':
      return { ...d, allDay: false, from: '', to: '12:00' };
    case 'pm':
      return { ...d, allDay: false, from: '12:00', to: '' };
    case 'range':
      return { ...d, allDay: false };
    default: {
      const _: never = t;
      return _;
    }
  }
}

/** 入力の初期値（登録済みの欠勤があればその値） */
export function draftOf(existing: Absence | null): AbsenceDraft {
  return {
    allDay: existing ? existing.from === null && existing.to === null : true,
    from: existing?.from ?? '',
    to: existing?.to ?? '',
    note: existing?.note ?? '',
  };
}

/** 入力から欠勤（id は登録済みならその id、無ければ仮の id。登録するときに呼ぶ側で振る） */
export function absenceOfDraft(d: AbsenceDraft, staffId: string, date: string, existing: Absence | null): Absence {
  return {
    id: existing?.id ?? `${staffId}-${date}`,
    staffId,
    date,
    from: d.allDay || d.from === '' ? null : d.from,
    to: d.allDay || d.to === '' ? null : d.to,
    note: d.note,
  };
}

/** 入力の誤り（終日なら無し。時間帯で開始も終了も空なら「開始か終了を選んでください」） */
export function draftError(d: AbsenceDraft): string | null {
  if (d.allDay) return null;
  const a = absenceOfDraft(d, '', '', null);
  return absenceError(a) ?? (a.from === null && a.to === null ? '開始か終了を選んでください' : null);
}

/** 休む人の選択肢 */
export type StaffChoice = { id: string; label: string; absent: boolean };

/**
 * 休む人の選択肢：その日にもともと働く人（欠勤を差し引く前の稼働時間帯がある人）だけを、渡した順に。
 * 文は「名前（9:00〜17:00・訪問 N件）」、欠勤があれば後ろに「・欠勤（終日）」など
 */
export function staffChoices(
  staff: readonly { id: string; name: string }[],
  slotsOf: ReadonlyMap<string, { baseSlots: Slot[]; absence: Absence | null }>,
  visitCount: (id: string) => number,
): StaffChoice[] {
  const out: StaffChoice[] = [];
  for (const s of staff) {
    const av = slotsOf.get(s.id);
    if (!av || av.baseSlots.length === 0) continue;
    const parts = [slotsText(av.baseSlots), `訪問 ${visitCount(s.id)}件`];
    if (av.absence) parts.push(absenceText(av.absence, av.baseSlots));
    out.push({ id: s.id, label: `${s.name}（${parts.join('・')}）`, absent: !!av.absence });
  }
  return out;
}

/** キャンセルの訪問の選択肢 */
export type VisitChoice = { id: string; label: string };

/** キャンセルの訪問の選択肢：時刻の早い順（同じなら名前）。文は「9:00〜10:00 名前（担当：〇〇さん／担当なし）」 */
export function visitChoices(
  visits: readonly { id: string; earliestStart: string; clientId: string }[],
  clientName: (id: string) => string,
  window: (id: string) => string,
  ownerName: (visitId: string) => string | null,
): VisitChoice[] {
  return [...visits]
    .sort(
      (a, b) =>
        a.earliestStart.localeCompare(b.earliestStart) ||
        clientName(a.clientId).localeCompare(clientName(b.clientId), 'ja'),
    )
    .map((v) => {
      const who = ownerName(v.id);
      return {
        id: v.id,
        label: `${window(v.id)} ${clientName(v.clientId)}（${who ? `担当：${who}さん` : '担当なし'}）`,
      };
    });
}

/** 影響の見出しと内訳（振り直す訪問＝欠勤で入らなくなる訪問） */
export function impactText(targets: readonly Pick<ReassignTarget, 'reason'>[]): { title: string; detail: string } {
  const n = (r: ReassignTarget['reason']) => targets.filter((x) => x.reason === r).length;
  if (targets.length === 0)
    return { title: '入らなくなる訪問はありません', detail: '欠勤の時間と重なる訪問はありません' };
  const parts = [`欠勤と重なる ${n('absence')}件`, `間に合わない ${n('unreachable')}件`];
  if (n('notAllowed') > 0) parts.push(`ほかの必須の条件 ${n('notAllowed')}件`);
  return { title: `入らなくなる訪問 ${targets.length}件`, detail: parts.join('・') };
}

/**
 * 見込みの1行（1段目の読み上げの小さな欄に出す。PRD D414）。見込みが無い（人・時間を選んでいない・入力の誤り）なら空。
 * 見込みを作れなかった・担当のある訪問が無い日・入らなくなる訪問の件数のどれか
 */
export function previewLine(
  preview: { hasBase: boolean; targets: readonly Pick<ReassignTarget, 'reason'>[] } | null | undefined,
  running: boolean,
): string {
  if (preview === undefined) return '';
  if (preview === null) return '見込みを出せませんでした';
  if (!preview.hasBase) return noPlanText(running);
  return impactText(preview.targets).title;
}

/**
 * ［この案で決める］を押せない理由（押せれば null）。入力の誤り → 計算中 → 見込みを出せない → 案が無い の順。
 * 案が無い日は欠勤だけ登録できる（PRD D26・D169）
 */
export function reassignBlocked(i: {
  error: string | null;
  running: boolean;
  hasPreview: boolean;
  hasBase: boolean;
}): string | null {
  if (i.error) return i.error;
  if (i.running) return '計算中は押せません（終わるまで待ってください）';
  if (!i.hasPreview) return '見込みを出せませんでした';
  if (!i.hasBase) return 'この日はまだ担当のある訪問がありません。欠勤だけ登録できます';
  return null;
}

/** 1段目の主ボタン（下の帯の濃い朱）と、メモの Enter でする操作：reassign＝［この案で決める］・saveOnly＝［欠勤だけ登録］・null＝何もしない */
export type SuddenPrimary = 'reassign' | 'saveOnly' | null;

/**
 * 1段目の主ボタンが何か（〈スタッフ〉が休むのとき。PRD D251・D414）。担当のある訪問がある日（hasBase）は［この案で決める］、
 * 人を選んでいて担当のある訪問が無い日（見込みを出せない日も）は［欠勤だけ登録］
 */
export function suddenPrimary(i: { kind: SuddenKind | null; staffId: string; hasBase: boolean }): SuddenPrimary {
  if (i.kind !== 'staff') return null;
  if (i.hasBase) return 'reassign';
  return i.staffId ? 'saveOnly' : null;
}

/**
 * 担当のある訪問が無い日の1段目の文。計算中（AI で組んでいる）なら、終わると振り直せると書く
 */
export function noPlanText(running: boolean): string {
  return running
    ? '担当を組んでいます。終わると振り直せます'
    : 'この日はまだ担当のある訪問がありません。欠勤だけ登録できます';
}

/** 案B を勧めるか（担当のある日で、案A では入らない見込みがある）。勧めるときは主ボタン［この案で決める］で案B も作る（PRD D264） */
export function recommendAnneal(i: { hasBase: boolean; unplacedA: number }): boolean {
  return i.hasBase && i.unplacedA > 0;
}

/** 当日キャンセルの影響の文（担当の名前が無ければ担当なし） */
export function cancelImpact(i: {
  owner: string | null;
  sameDay: boolean;
  clientWord: string;
  hasPlan: boolean;
}): string[] {
  const out = [
    i.owner
      ? `担当の${i.owner}さんの予定からこの訪問が外れ、その時間が空きます。ほかの訪問の担当・順番・時刻は変えません`
      : 'この訪問はまだ担当が決まっていません。ほかの訪問は変わりません',
  ];
  out.push(
    i.sameDay
      ? `当日キャンセルは、月の予定と${i.clientWord}ごとの月の集計に回数が出ます（請求はしません）`
      : 'ふつうの取り消しは回数に数えません',
  );
  return out;
}

/** 2段目の確定の文（伝えた状態：none＝まだ伝えていない・told＝伝えた・changed＝伝えたあとに変わった。confirmStep が false なら変更ありの案内だけ） */
export function confirmNote(state: 'none' | 'told' | 'changed', confirmStep = true): string {
  // expert 切（ADR-0073）：確定の段階が無いので、決まったあとの変更（変更あり）のときだけ連絡の一覧への案内を出す
  if (!confirmStep)
    return state === 'changed'
      ? '決まったあとに変わった訪問があります（変更あり）。連絡したら、日の予定の連絡の一覧で「連絡した」を押してください'
      : '';
  if (state === 'told') return '今の担当は伝えた内容と同じです（確定済み）';
  if (state === 'changed')
    return '伝えたあとに変わった訪問があります（未連絡の変更）。連絡してから「確定」を押してください';
  return 'まだ確定していません。連絡したら「確定」を押してください';
}

/** 欠勤の短い文（段階の見出し・知らせ）：「〇〇さん 欠勤（終日）」 */
export function absenceSummary(name: string, a: Pick<Absence, 'from' | 'to'>, slots: Slot[]): string {
  return `${name}さん ${absenceText(a, slots)}`;
}

/** 担当が移る訪問の1行（ReassignMoves） */
export type ReassignMoveRow = { visitId: string; from: string | null; to: string | null };

/**
 * 担当が移る訪問の一覧の行（純粋関数）：担当が変わった訪問と入らなくなった訪問を、訪問の文（時刻から始まる）の順に。
 * 同じ訪問は1行
 */
export function reassignMoveRows(diff: ReassignDiff, visitLabel: (id: string) => string): ReassignMoveRow[] {
  const rows = new Map<string, ReassignMoveRow>();
  for (const m of diff.moved) rows.set(m.visitId, { visitId: m.visitId, from: m.from, to: m.to });
  for (const id of diff.unplaced) if (!rows.has(id)) rows.set(id, { visitId: id, from: null, to: null });
  return [...rows.values()].sort((a, b) => visitLabel(a.visitId).localeCompare(visitLabel(b.visitId), 'ja'));
}

// 〈利用者さん〉の画面の節の編集（PRD D308・D311。ADR-0014〜0017・0052）：節と保存する項目・変更があるかの判定・
// 保存の前の検査と組み立て・保存したデータ（終了にしたら繰り返しを昨日で終わらせる）
import type { DemoData } from '../contracts/data';
import type { Client, Staff, Terms } from '../contracts/documents';
import { addDays } from '../domain/time';
import { nameTaken } from './common';
import { normalizeEmail } from './mailto';
import { type ClientTab, mergeFields, pickFields } from './personPage';
import { keepStorePlace } from './placeAll';
import { normalizePostalCode } from './postalCode';
import { isDirty } from './viewMode';
import { endPatternOp } from './visitOps';

/** 節と、その節で保存する項目（ほかの節の項目を古い入力で上書きしない） */
export const CLIENT_SECTIONS = {
  basic: ['displayName', 'kana', 'note', 'color'],
  stage: ['stage', 'tentative', 'active', 'referrer'],
  place: ['place'],
  traits: ['traits'],
  rules: ['entryNote', 'keyNote', 'parkingNote', 'cautionNote'],
  staffing: ['allowedStaffIds'],
  conds: ['requirements', 'preferences'],
} as const satisfies Record<string, readonly (keyof Client)[]>;
export type ClientSecKey = keyof typeof CLIENT_SECTIONS;
/** 節のあるタブ */
export const CLIENT_SECTION_TAB: Record<ClientSecKey, ClientTab> = {
  basic: 'basic',
  stage: 'basic',
  place: 'basic',
  traits: 'basic',
  rules: 'basic',
  staffing: 'staffing',
  conds: 'staffing',
};
const ALL_FIELDS = [...new Set(Object.values(CLIENT_SECTIONS).flat())] as (keyof Client)[];

/** 直している節（new は新しい人の全部の項目） */
export type ClientEdit = {
  key: ClientSecKey | 'new';
  form: Client;
  limit: boolean;
  openedLimit: boolean;
  opened: Client;
};

type StaffLike = Pick<Staff, 'id' | 'active'>;

const isActiveStaff = (staff: readonly StaffLike[], sid: string) => staff.some((s) => s.id === sid && s.active);

/** 担当できる人を限っているか（利用中の人が1人でも入っていれば限る） */
export function limitOfClient(c: Client, staff: readonly StaffLike[]): boolean {
  return c.allowedStaffIds.some((sid) => isActiveStaff(staff, sid));
}

/** 保存した中身で節を開く */
export function openClientEdit(key: ClientSecKey, saved: Client, staff: readonly StaffLike[]): ClientEdit {
  const lim = limitOfClient(saved, staff);
  return { key, form: structuredClone(saved), limit: lim, openedLimit: lim, opened: structuredClone(saved) };
}

/** 新しい人の節（全部の項目） */
export function newClientEdit(form: Client): ClientEdit {
  return { key: 'new', form, limit: false, openedLimit: false, opened: structuredClone(form) };
}

/** 担当できる人は保存のときと同じ値（限らなければ空、限るなら利用中の人だけ）にそろえて比べる */
function allowedAsSaved(c: Client, lim: boolean, staff: readonly StaffLike[]): string[] {
  return lim ? c.allowedStaffIds.filter((sid) => isActiveStaff(staff, sid)) : [];
}

/** 直している節に変更があるか（節の項目だけを保存した中身と比べる。新しい人は開いたときと比べる） */
export function clientSectionDirty(
  edit: ClientEdit | null,
  saved: Client | undefined,
  staff: readonly StaffLike[],
): boolean {
  if (!edit) return false;
  if (edit.key === 'new') return isDirty(edit.form, edit.opened);
  if (!saved) return true;
  const keys = CLIENT_SECTIONS[edit.key];
  if (edit.key === 'staffing')
    return isDirty(
      { ...pickFields(edit.form, keys), allowedStaffIds: allowedAsSaved(edit.form, edit.limit, staff) },
      { ...pickFields(saved, keys), allowedStaffIds: allowedAsSaved(saved, edit.openedLimit, staff) },
    );
  return isDirty(pickFields(edit.form, keys), pickFields(saved, keys));
}

/** 保存の前の検査の誤り（field は誤った入力欄） */
export type ClientSaveError = { text: string; field?: string };

/**
 * 保存する中身を組み立てる（節の項目だけを保存した中身に重ねる。新しい人は全部）。検査するのは直している節の項目だけ
 * （ほかの節の古い値で保存を止めない）。段階に合わせた予定の対象・仮押さえ（withStage）と契約の検査は呼ぶ側
 */
export function clientSaveDraft(input: {
  edit: ClientEdit;
  saved: Client | undefined;
  staff: readonly StaffLike[];
  allowedOn: boolean;
  clients: Client[];
  terms: Terms;
}): { ok: true; draft: Client } | { ok: false; error: ClientSaveError } {
  const { edit, saved, staff, allowedOn, clients, terms } = input;
  const key = edit.key;
  const keys: readonly (keyof Client)[] = key === 'new' ? ALL_FIELDS : CLIENT_SECTIONS[key];
  const touches = (k: keyof Client) => keys.includes(k);
  const base = key === 'new' || !saved ? edit.form : mergeFields(saved, edit.form, keys);
  // 担当を限るなら利用中の人を1人以上（休止中の人は数えない。保存時に外す。ADR-0014）。切っていれば今の値のまま
  const allowed =
    key !== 'staffing' || !allowedOn
      ? base.allowedStaffIds
      : edit.limit
        ? base.allowedStaffIds.filter((sid) => isActiveStaff(staff, sid))
        : [];
  if (key === 'staffing' && allowedOn && edit.limit && allowed.length === 0)
    return {
      ok: false,
      error: { text: `担当できる${terms.staff}を1人以上選ぶか、「担当できる人を限る」を外してください` },
    };
  // 郵便番号はハイフン・全角を受けて7桁に直す（ADR-0016）。直せなければ保存しない
  const postalCode = touches('place') ? normalizePostalCode(base.place.postalCode) : base.place.postalCode;
  if (postalCode === null)
    return {
      ok: false,
      error: { text: '郵便番号は7桁の数字で入れてください（ハイフンは有っても無くても構いません。空でも構いません）' },
    };
  // 紹介元のメールアドレス（任意。ADR-0017）
  const referrerEmail = touches('referrer') ? normalizeEmail(base.referrer.email) : base.referrer.email;
  if (referrerEmail === null)
    return {
      ok: false,
      error: {
        text: '紹介元のメールアドレスの形ではありません（例 name@example.com）。空でも構いません',
        field: 'referrer',
      },
    };
  // 同じ名前は保存しない（Excel では名前で人を引くため。ADR-0006）
  if (touches('displayName') && nameTaken(clients, (x) => x.displayName, base.displayName, base.id))
    return {
      ok: false,
      error: {
        text: `「${base.displayName.trim()}」と同じ名前の${terms.client}がいます。名前を変えてください`,
        field: 'displayName',
      },
    };
  return {
    ok: true,
    draft: {
      ...base,
      allowedStaffIds: allowed,
      referrer: { ...base.referrer, email: referrerEmail },
      // 節を開いた後に「まとめて地図に置く」が書いた位置・住所は、節で触っていなければ残す（ADR-0016）
      place: {
        ...(key === 'place' || key === 'new'
          ? keepStorePlace(edit.form.place, edit.opened.place, saved?.place)
          : base.place),
        postalCode,
      },
    },
  };
}

/**
 * 〈利用者さん〉を保存したデータ（いなければ足す）。ending（終了にした）なら続いている繰り返しを昨日で終わらせる
 * （今日より前の回は人の画面・月の予定に残す。ADR-0053）
 */
export function saveClientData(d: DemoData, c: Client, ending: boolean, today: string): DemoData {
  let out: DemoData = {
    ...d,
    clients: d.clients.some((x) => x.id === c.id) ? d.clients.map((x) => (x.id === c.id ? c : x)) : [...d.clients, c],
  };
  if (ending)
    for (const p of out.patterns)
      if (p.clientId === c.id && (p.to === null || p.to >= today))
        out = endPatternOp(out, p.id, addDays(today, -1), today).data;
  return out;
}

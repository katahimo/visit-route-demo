// 読み込む欄の取り違え：名簿の欄に予約の CSV・もう一方の名簿の CSV を、予約の欄に名簿の CSV を選んだとき、
// 名前の重なりなどの分かりにくい誤りや「列名から読んだ名簿」として読む前に、どの欄で読むファイルかを伝える（PRD D443）。純粋関数
import type { RosterKind } from '../contracts/data';
import type { Terms } from '../contracts/documents';
import { readBookingForm } from './bookingForms';
import { ROSTER_FORMS, type RosterForm } from './rosterForms';

/** 列名で見分ける名簿の形（列名から読む暫定の形は、ほかの CSV にも当たるので除く） */
const SPECIFIC_ROSTER_FORMS: readonly RosterForm[] = ROSTER_FORMS.filter((f) => !f.id.startsWith('generic'));

/** 形を見分けるだけ（今日・項目は見分けに使わない） */
const DETECT_ENV = { today: '0000-00-00', items: [] };

/** 見分けた名簿の形（kind の名簿のどれか。無ければ null） */
function specificRosterForm(table: readonly (readonly string[])[], kinds: readonly RosterKind[]): RosterForm | null {
  return SPECIFIC_ROSTER_FORMS.find((f) => kinds.includes(f.kind) && f.toRoster(table, DETECT_ENV) !== null) ?? null;
}

const termOf = (terms: Pick<Terms, 'staff' | 'client'>, kind: RosterKind) =>
  kind === 'staff' ? terms.staff : terms.client;

/**
 * 名簿（kind）の欄に選んだ CSV が、ほかの欄で読むファイルなら、どの欄で読むかの文。kind の名簿の形として見分けられれば null。
 * 予約の CSV は「予約の CSV」の欄、もう一方の名簿の形はその名簿の欄へ案内する
 */
export function rosterWrongPlace(
  table: readonly (readonly string[])[],
  kind: RosterKind,
  terms: Pick<Terms, 'staff' | 'client'>,
): string | null {
  if (specificRosterForm(table, [kind])) return null;
  const other: RosterKind = kind === 'staff' ? 'client' : 'staff';
  const form = specificRosterForm(table, [other]);
  if (form)
    return `このファイルは「${form.label}」の CSV（${termOf(terms, other)}の名簿）です。${termOf(terms, other)}の名簿の欄で読み込んでください`;
  const booking = readBookingForm(table);
  if (booking)
    return `このファイルは「${booking.form.label}」の CSV（予約）です。「予約の CSV」の欄（登録の案内の③・設定 › データ）で読み込んでください`;
  return null;
}

/** 予約の欄に選んだ CSV が名簿の形なら、どの名簿の欄で読むかの文（無ければ null） */
export function bookingWrongPlace(
  table: readonly (readonly string[])[],
  terms: Pick<Terms, 'staff' | 'client'>,
): string | null {
  const form = specificRosterForm(table, ['client', 'staff']);
  return form
    ? `このファイルは「${form.label}」の CSV（${termOf(terms, form.kind)}の名簿）です。${termOf(terms, form.kind)}の名簿の欄で読み込んでください`
    : null;
}

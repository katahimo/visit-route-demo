// 週の予定の画面（pages/WeekPage.tsx と区画の部品 pages/weekParts.tsx・weekTimeline.tsx・weekTables.tsx）の表示の純粋関数：
// URL の選択の読み方・週を選ぶ欄の週・日の見出しの件数・時間軸に出す帯・表のマスの札と文。データは書き換えない
import type { Staff, Terms, VisitType } from '../contracts/documents';
import { clockTime, dateText } from './dateText';
import { typeOf } from './patternText';
import { TIMELINE_CLIENT_MAX } from './timelineClients';
import { type Band, type ClientWeekItem, type WeekCell, type WeekDay, weekDates } from './week';
import { weekDayCountText } from './weekPrep';

/** 時間軸の見る人（〈スタッフ〉／〈利用者さん〉） */
export type WeekBy = 'staff' | 'client';

/** 選んだ人（URL の値。null＝全員、空なら []＝だれも選ばない） */
export const selectionOf = (raw: string | null): string[] | null =>
  raw === null ? null : raw.split(',').filter(Boolean);

/** 種類なしの帯の色（月の種類の積み上げと同じ） */
export const NO_TYPE_COLOR = '#cfc4bb';

/** 札の頭文字（表のマスの小さな札。PRD D342） */
export const initialOf = (name: string): string => Array.from(name.trim())[0] ?? '？';

/** 時間軸の上限の文（呼び方は org.terms から作る） */
export const timelineClientMaxText = (client: string): string =>
  `時間軸は${TIMELINE_CLIENT_MAX}人まで。表（${client}×曜日）なら絞り込んだ全員を見られます`;

/** 「9:00〜10:00」 */
export const clockSpan = (start: number, end: number): string => `${clockTime(start)}〜${clockTime(end)}`;

/** 週を選ぶ欄の週（データの日付と今の週を含む週の月曜。日付の順。PRD D347） */
export function weekOptionsOf(dataDates: readonly string[], start: string): { value: string; text: string }[] {
  const starts = [...new Set([...dataDates, start].map((d) => weekDates(d)[0]!))].sort();
  return starts.map((s) => {
    const w = weekDates(s);
    return { value: s, text: `${dateText(s)}〜${dateText(w[6]!)}` };
  });
}

/** 日の見出しの件数（PRD D314）：休み（ADR-0013）のため無しの訪問を除いた件数と、そのうち担当なしの数（版2） */
export function dayHeadOf(day: WeekDay): { unassigned: number; countText: string } {
  const live = day.bands.filter((b) => !b.leave);
  const unassigned = live.filter((b) => b.staffId === null).length;
  return { unassigned, countText: weekDayCountText({ count: live.length, unassigned }) };
}

/** 案のある（休みでない帯がある）日（空の画面の判定。PRD D176） */
export const visitDaysOf = (days: readonly WeekDay[]): string[] =>
  days.filter((d) => d.bands.some((b) => !b.leave)).map((d) => d.date);

/**
 * 時間軸に出す帯の判定：〈利用者さん〉で見るなら選んだ〈利用者さん〉の帯だけ、〈スタッフ〉で見るなら選んだ〈スタッフ〉の帯
 * （全員＝staffSel が null なら担当なしも）
 */
export function timelineBandFilter(x: {
  by: WeekBy;
  staffSel: readonly string[] | null;
  clientIds: readonly string[];
  clientOf: (visitId: string) => string | undefined;
}): (b: Band) => boolean {
  const staffSet = x.staffSel ? new Set(x.staffSel) : null;
  const clientSet = new Set(x.clientIds);
  return (b) => {
    if (x.by === 'client') return clientSet.has(x.clientOf(b.visitId) ?? '');
    return !staffSet || (b.staffId !== null && staffSet.has(b.staffId));
  };
}

/** 時間軸でだれも選んでいないときの文（選んでいれば null） */
export function timelineNoneText(
  x: { by: WeekBy; staffSel: readonly string[] | null; picked: number; shown: number; weekChips: number },
  terms: Pick<Terms, 'staff' | 'client'>,
): string | null {
  if (x.by === 'client') {
    if (x.shown > 0) return null;
    return x.weekChips === 0 && x.picked === 0
      ? `この週に訪問がある${terms.client}はいません。「ほかの人を探す」で選んでください（${TIMELINE_CLIENT_MAX}人まで）。`
      : `${terms.client}を選んでいません。上のチップで選ぶか「先頭${TIMELINE_CLIENT_MAX}人に戻す」を押してください（${TIMELINE_CLIENT_MAX}人まで）。`;
  }
  if (x.staffSel?.length !== 0) return null;
  return `${terms.staff}をだれも選んでいません。上のチップで選ぶか「全員」を押してください。`;
}

/** ドラッグ中の「担当できる〈スタッフ〉」の行の文（ドラッグしていなければ案内） */
export function allowedStaffText(
  allowed: ReadonlySet<string> | null,
  activeStaff: readonly Pick<Staff, 'id' | 'name'>[],
  staffTerm: string,
): string {
  if (!allowed) return `ドラッグ中は、ここに担当できる${staffTerm}を出します`;
  const names =
    allowed.size === 0
      ? 'いません'
      : activeStaff
          .filter((s) => allowed.has(s.id))
          .map((s) => s.name)
          .join('・');
  return `担当できる${staffTerm}：${names}`;
}

/** 〈スタッフ〉×曜日の表のマスの訪問（キー「担当|日」。休み・担当なしを除く。時刻の順。PRD D340） */
export function staffCellBands(days: readonly WeekDay[]): Map<string, Band[]> {
  const out = new Map<string, Band[]>();
  for (const d of days)
    for (const b of d.bands) {
      if (b.staffId === null || b.leave) continue;
      const k = `${b.staffId}|${b.date}`;
      const list = out.get(k);
      if (list) list.push(b);
      else out.set(k, [b]);
    }
  for (const list of out.values()) list.sort((a, b) => a.start - b.start);
  return out;
}

/**
 * 〈スタッフ〉×曜日の表のマスの文（PRD D76）：休みの文（終日休みの人に訪問が残った日は件数も）と、title・読み上げの内訳
 * （休みでなければ件数・稼働・移動・種類ごとの件数）
 */
export function staffCellTexts(
  c: Pick<WeekCell, 'off' | 'count' | 'hours' | 'travel' | 'types'>,
  visitTypes: readonly VisitType[],
): { offText: string; detail: string } {
  const typesText = c.types.map((t) => `${typeOf(visitTypes, t.typeId)?.name ?? '種類なし'} ${t.count}件`).join('・');
  const offText = c.count > 0 ? `休み（訪問 ${c.count}件）` : '休み';
  const detail = c.off
    ? offText
    : [`訪問 ${c.count}件`, `稼働 ${c.hours}時間`, `移動 ${c.travel}分`, ...(typesText ? [typesText] : [])].join('・');
  return { offText, detail };
}

/** 平均との差の文（「+2件」「−1件」「±0件」） */
export const diffText = (diff: number): string => `${diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : '±0'}件`;

/** 〈利用者さん〉×曜日の表の訪問の状態の文（取り消し・当日キャンセル・休み。ふつうは null） */
export const itemStateText = (it: Pick<ClientWeekItem, 'cancelled' | 'sameDay' | 'leave'>): string | null =>
  it.cancelled ? (it.sameDay ? '当日キャンセル' : '取り消し') : it.leave ? '休みのため無し' : null;

/** 札・帯の読み上げの終わり（選択中か・押すと欄） */
export const pressText = (selected: boolean): string => `${selected ? '（選択中）' : ''}（押すと訪問の詳細）`;

/** 帯・札の読み上げ：「9:00 本文・見た目の文（選択中）（押すと訪問の詳細）」 */
export const visitAriaLabel = (start: number, body: string, lookText: string | undefined, selected: boolean): string =>
  `${clockTime(start)} ${body}${lookText ? `・${lookText}` : ''}${pressText(selected)}`;

/** 帯・札の title：「9:00〜10:00 本文（見た目の文）」 */
export const visitTitle = (start: number, end: number, body: string, lookText: string | undefined): string =>
  `${clockSpan(start, end)} ${body}${lookText ? `（${lookText}）` : ''}`;

/** 〈利用者さん〉×曜日の表の札の文：「9:00〜10:00 種類・担当の文・見た目の文」 */
export const clientItemText = (
  it: Pick<ClientWeekItem, 'start' | 'end'>,
  typeName: string | undefined,
  markText: string,
  lookText: string | undefined,
): string =>
  `${clockSpan(it.start, it.end)} ${typeName ? `${typeName}・` : ''}${markText}${lookText ? `・${lookText}` : ''}`;

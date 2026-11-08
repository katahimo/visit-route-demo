// 〈利用者さん〉の移動時間（片道・分）と遠方（出張）（PRD D429。ADR-0096）：場所への入れ方・入力の読み方・短い文。純粋関数
import { type ClientPlace, TRAVEL_MINUTES_MAX } from '../contracts/documents';
import { clockTime } from './dateText';

type TravelPart = Pick<ClientPlace, 'travelMinutes' | 'farTrip'>;

/** 移動時間（片道・分。null＝距離から見積もる）と遠方（出張）の印を場所に入れる（無い・false は項目ごと消す。保存データに空の項目を残さない） */
export function withTravel<P extends object>(
  place: P & TravelPart,
  minutes: number | null,
  farTrip: boolean,
): Omit<P, keyof TravelPart> & TravelPart {
  const { travelMinutes: _m, farTrip: _f, ...rest } = place;
  return {
    ...rest,
    ...(minutes === null ? {} : { travelMinutes: minutes }),
    ...(farTrip ? { farTrip: true } : {}),
  };
}

/**
 * 入力欄の文字 → 移動時間（片道・分）。空は null（距離から見積もる）。全角の数字も受ける。数でなければ NaN
 * （正しいかは保存の前に travelMinutesError で確かめる）
 */
export function travelMinutesInput(text: string): number | null {
  const t = text.normalize('NFKC').trim();
  if (t === '') return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

/** 移動時間（片道・分）の誤りの文（無い・1〜上限の整数なら null） */
export function travelMinutesError(n: number | undefined): string | null {
  if (n === undefined || (Number.isInteger(n) && n >= 1 && n <= TRAVEL_MINUTES_MAX)) return null;
  return `移動時間（片道）は1〜${TRAVEL_MINUTES_MAX}の整数（分）で入れてください。空なら距離から見積もります`;
}

/** 移動の短い文（「遠方（出張）・移動 片道180分」）。どちらも無ければ ''（距離から見積もる） */
export function travelNote(place: TravelPart): string {
  return [
    place.farTrip === true ? '遠方（出張）' : null,
    place.travelMinutes !== undefined ? `移動 片道${place.travelMinutes}分` : null,
  ]
    .filter(Boolean)
    .join('・');
}

/**
 * 家を出る時刻の目安（遠方（出張）で移動時間を決めた〈利用者さん〉だけ）：開始（0時からの分）− 移動時間。
 * 0時より前なら「前日」を付ける。当てはまらなければ ''
 */
export function leaveHomeText(place: TravelPart, start: number | null): string {
  if (place.farTrip !== true || place.travelMinutes === undefined || start === null) return '';
  const at = start - place.travelMinutes;
  return at < 0 ? `家を出る目安 前日${clockTime(at + 24 * 60)}` : `家を出る目安 ${clockTime(at)}`;
}

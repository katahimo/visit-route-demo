// 〈利用者さん〉の期間つきの訪問先（住所2。PRD D439。ADR-0105）の列の読み書き：全体のブック（bookPeople）・名簿（rosterRows）・書き出し（exportPersonTables）で同じ
import type { ClientPlace2, Place } from '../contracts/documents';
import { CLIENT_PLACE2_COLS as P2 } from './layout';
import { type Row, readPostal } from './reader';

/** 書き出す住所2 の列の値（clientExportCols の CLIENT_PLACE2_COLS の並び。住所2 なしは空） */
export function place2Cells(p2: ClientPlace2 | undefined): (string | number | null)[] {
  if (!p2) return ['', '', null, null, '', ''];
  return [p2.address, p2.postalCode, p2.lat, p2.lng, p2.from, p2.to];
}

/** 期間の日付の列（空は ''。読めなければ行付きで止めて null） */
function termDate(r: Row, h: string): string | null {
  return r.text(h) === '' ? '' : r.date(h);
}

/** 住所2 なしを表す書き方（NFKC・空白を詰め、末尾の句点を除いて比べる）。住所として位置を探すと別の地名に当たる（「なし」→高梨川） */
const NO_PLACE2_TEXTS: readonly string[] = ['なし', '無し', 'ナシ', '無', '特になし', '特に無し', '同上'];

/** 住所2 の欄の値が空か「なし」などの住所2 なしの書き方か（ー・- などの線1つも） */
export function isNoPlace2Text(text: string): boolean {
  const t = text
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[。.]+$/, '');
  return t === '' || NO_PLACE2_TEXTS.includes(t) || /^[-‐‑‒–—―−ー]+$/.test(t);
}

/**
 * 住所2 の列を読む。「住所2」が空・「なし」など（isNoPlace2Text）なら undefined（住所2 なし）。誤りがあれば行付きで止めて null。
 * cur（今の住所2）と住所が同じなら、空の緯度・経度・郵便番号は今の値のまま（違えば空。古い住所の位置を付けない）
 */
export function readPlace2(r: Row, cur?: ClientPlace2): ClientPlace2 | undefined | null {
  const address = r.optional(P2.address, 200);
  if (isNoPlace2Text(address)) return undefined;
  const same = cur !== undefined && sameAddress(cur.address, address);
  const postal = r.text(P2.postal) === '' ? (same ? cur.postalCode : '') : readPostal(r, P2.postal);
  const lat = r.num(P2.lat, { min: -90, max: 90 });
  const lng = r.num(P2.lng, { min: -180, max: 180 });
  const from = termDate(r, P2.from);
  const to = termDate(r, P2.to);
  if (postal === null || lat === undefined || lng === undefined || from === null || to === null) return null;
  if (from !== '' && to !== '' && to < from) return r.err(P2.to, '開始日より前の日付です');
  const keepPos = lat === null && lng === null && same;
  return {
    address,
    postalCode: postal,
    lat: keepPos ? cur.lat : lat,
    lng: keepPos ? cur.lng : lng,
    from,
    to,
  };
}

/** 同じ住所か（前後・途中の空白と全角半角の違いは同じとみる） */
export const sameAddress = (a: string, b: string): boolean => {
  const key = (s: string) => s.normalize('NFKC').replace(/\s+/g, '');
  return key(a) === key(b);
};

/**
 * 住所の位置が住所2 の位置と同じで、住所が住所2 と違うなら、住所の位置を空にする。
 * 予約システムの顧客の CSV の「緯度・経度」は住所2 の位置で、以前は住所の位置として読んでいたため（ADR-0105）
 */
export function withoutPlace2Pin<P extends Place>(place: P, p2: ClientPlace2 | undefined): P {
  if (!p2 || place.lat === null || place.lng === null) return place;
  if (place.lat !== p2.lat || place.lng !== p2.lng || sameAddress(place.address, p2.address)) return place;
  return { ...place, lat: null, lng: null };
}

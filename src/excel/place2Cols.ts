// 〈利用者さん〉の期間つきの訪問先（住所2。PRD D439。ADR-0105）の列の読み書き：全体のブック（bookPeople）・名簿（rosterRows）・書き出し（exportPersonTables）で同じ
import type { ClientPlace2 } from '../contracts/documents';
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

/**
 * 住所2 の列を読む。「住所2」が空なら undefined（住所2 なし）。誤りがあれば行付きで止めて null。
 * cur（今の住所2）と住所が同じなら、空の緯度・経度・郵便番号は今の値のまま（違えば空。古い住所の位置を付けない）
 */
export function readPlace2(r: Row, cur?: ClientPlace2): ClientPlace2 | undefined | null {
  const address = r.optional(P2.address, 200);
  if (address === '') return undefined;
  const same = cur !== undefined && cur.address === address;
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

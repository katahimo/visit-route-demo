// 期間つきの訪問先（住所2。デモ独自。PoC本体には無い。PRD D439。ADR-0105）：その日の訪問先の場所を決める。
// 「その日の訪問先が住所か住所2か」を決めるのはこのファイルだけ（compile・画面・メール・道順で同じ判定）
import type { Client, ClientPlace, ClientPlace2 } from '../contracts/documents';

/** 住所2 がその日（YYYY-MM-DD）の訪問先か（期間の両端を含む。空の端は限らない） */
export function place2On(p2: Pick<ClientPlace2, 'from' | 'to'> | undefined, date: string): boolean {
  if (p2 === undefined) return false;
  return (p2.from === '' || p2.from <= date) && (p2.to === '' || date <= p2.to);
}

/**
 * その日の訪問先の場所。住所2 の期間内なら住所2（移動時間・遠方は住所のものなので付けない）、ほかは住所（place）
 */
export function placeOn(c: Pick<Client, 'place' | 'place2'>, date: string): ClientPlace {
  const p2 = c.place2;
  if (p2 === undefined || !place2On(p2, date)) return c.place;
  return { address: p2.address, lat: p2.lat, lng: p2.lng, postalCode: p2.postalCode };
}

/** その日の訪問先に置き換えた〈利用者さん〉（住所2 の期間外・住所2 なしならそのまま同じもの） */
export function clientOn<C extends Pick<Client, 'place' | 'place2'>>(c: C, date: string): C {
  const place = placeOn(c, date);
  return place === c.place ? c : { ...c, place };
}

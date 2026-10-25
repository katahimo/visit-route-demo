import { useEffect, useRef, useState } from 'react';
import type { Place } from '../contracts/documents';
import {
  applyFoundAddress,
  busyStatus,
  failStatus,
  type LookupBusy,
  type LookupStatus,
  nextUndoAddress,
  pinStatus,
  sameQuery,
} from '../lib/addressLookup';
import { hasLocation } from '../lib/common';
import { type GeoHit, lookupPostalCode, type PostalHit, searchAddress } from '../lib/geocode';
import { normalizePostalCode } from '../lib/postalCode';

type Options<T extends Place> = {
  value: T;
  onChange: (p: T) => void;
  /** 郵便番号の欄の値。渡さなければ中だけで持つ（保存しない） */
  postalCode?: string;
  onPostalCodeChange?: (code: string) => void;
};

/**
 * 住所の入力（AddressField）の状態と処理：郵便番号の欄・探している最中の印・状態・候補・「元に戻す」の先。
 * 待っている間に入力・画面が変わっても最新の値と書き先に書く（描いたときの値に頼らない）。欄を閉じたら呼び出しを止める
 */
export function useAddressLookup<T extends Place>({ value, onChange, postalCode, onPostalCodeChange }: Options<T>) {
  const [ownPostal, setOwnPostal] = useState('');
  const postalText = postalCode ?? ownPostal;
  const [busy, setBusyState] = useState<LookupBusy>(null);
  // 連打しても1回だけ呼ぶ（描き直しを待たずに止める）
  const busyRef = useRef<LookupBusy>(null);
  const setBusy = (b: LookupBusy) => {
    busyRef.current = b;
    setBusyState(b);
  };
  const [status, setStatus] = useState<LookupStatus>(null);
  const [postalHits, setPostalHits] = useState<PostalHit[]>([]);
  const [geoHits, setGeoHits] = useState<GeoHit[]>([]);
  /**
   * 住所を探して最初に置き換える前の住所（「元に戻す」の先）。候補を選び直しても上書きせず、新しく「住所を探す」を押したときだけ消す。
   * '' は空から入れた（戻す先が空なので「元に戻す」は出さない）
   */
  const [undoAddress, setUndoAddress] = useState<string | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const latestPostal = useRef(postalText);
  latestPostal.current = postalText;
  const emit = useRef(onChange);
  emit.current = onChange;
  const emitPostal = useRef(onPostalCodeChange);
  emitPostal.current = onPostalCodeChange;
  const put = (p: T) => {
    latest.current = p;
    emit.current(p);
  };
  const setPostal = (code: string) => {
    latestPostal.current = code;
    if (postalCode === undefined) setOwnPostal(code);
    emitPostal.current?.(code);
  };
  const ctrl = useRef<AbortController | null>(null);
  // 欄を閉じたら呼び出しを止める
  useEffect(() => () => ctrl.current?.abort(), []);

  /** 欄を書き換えたら、探している途中の呼び出しを止める（古い応答で上書きしない） */
  const cancel = () => {
    if (!busyRef.current) return;
    ctrl.current?.abort();
    ctrl.current = null;
    setBusy(null);
    setStatus(null);
  };

  const begin = (what: 'postal' | 'address') => {
    ctrl.current?.abort();
    ctrl.current = new AbortController();
    setBusy(what);
    setStatus(busyStatus(what));
    return ctrl.current.signal;
  };

  /** 見つけた住所を入れる。いまの住所が見つけた住所で始まるなら（番地まで書いてあれば）そのまま。ピンは消さない */
  const putAddress = (found: string) => {
    const r = applyFoundAddress(latest.current.address, found, hasLocation(latest.current));
    if (r.replace) {
      const before = latest.current.address;
      setUndoAddress((prev) => nextUndoAddress(prev, before));
      put({ ...latest.current, address: r.address });
    }
    setStatus(r.status);
  };

  const putPin = (hit: GeoHit) => {
    put({ ...latest.current, lat: hit.lat, lng: hit.lng });
    setStatus(pinStatus(hit));
  };

  const findAddress = async () => {
    const sent = normalizePostalCode(latestPostal.current);
    if (busyRef.current || !sent) return;
    const signal = begin('postal');
    setPostalHits([]);
    setUndoAddress(null);
    const r = await lookupPostalCode(sent, { signal });
    if (signal.aborted) return;
    setBusy(null);
    // 念のため：待っている間に郵便番号が変わっていたら使わない
    if (!sameQuery('postal', sent, latestPostal.current)) {
      setStatus(null);
      return;
    }
    if (!r.ok) {
      setStatus(failStatus(r.reason, 'postal'));
      return;
    }
    // 郵便番号は7桁に直して残す
    if (latestPostal.current !== sent) setPostal(sent);
    putAddress(r.hits[0].address);
    setPostalHits(r.hits.length > 1 ? r.hits : []);
  };

  const findPin = async () => {
    const sent = latest.current.address.trim();
    if (busyRef.current || sent === '') return;
    const signal = begin('address');
    setGeoHits([]);
    const r = await searchAddress(sent, { signal });
    if (signal.aborted) return;
    setBusy(null);
    // 念のため：待っている間に住所が変わっていたら使わない
    if (!sameQuery('address', sent, latest.current.address)) {
      setStatus(null);
      return;
    }
    if (!r.ok) {
      setStatus(failStatus(r.reason, 'address'));
      return;
    }
    putPin(r.hits[0]);
    setGeoHits(r.hits.length > 1 ? r.hits : []);
  };

  /** 「住所を元に戻す」：探す前の住所に戻し、状態の表示を消す */
  const undo = (before: string) => {
    put({ ...latest.current, address: before });
    setUndoAddress(null);
    setStatus(null);
  };

  return {
    postalText,
    busy,
    status,
    postalHits,
    geoHits,
    undoAddress,
    cancel,
    setPostal,
    putAddress,
    putPin,
    findAddress,
    findPin,
    undo,
  };
}

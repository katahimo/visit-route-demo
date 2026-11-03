// 位置の無い〈利用者さん〉をまとめて地図に置く処理（PRD D89・D90・D329・D399。ADR-0016・ADR-0076）：対象を数え（lib/placeAll）、
// 1人ずつ順に外部の検索を呼び、置けた人は1人ごとに store の update(fn) で書く。止める・画面を離れたら止めて知らせも出さない。
// 一覧の画面が持ち、まとめて置く欄（PlaceAllPanel）と名簿を読み込んだあとの導線の両方に渡す
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Client } from '../contracts/documents';
import { lookupPostalCode, searchAddress } from '../lib/geocode';
import { type PlaceAllResult, placeAll, placeAllTargets, sleep, withFoundPlace } from '../lib/placeAll';
import { useDemoData } from '../store';
import { useToast } from './Toast';

export function usePlaceAllRun(clients: Client[]) {
  const { update } = useDemoData();
  const { targets, skipped } = useMemo(() => placeAllTargets(clients), [clients]);
  const toast = useToast();
  const [running, setRunning] = useState(false);
  /** 今回の対象の数（押したときの） */
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<PlaceAllResult[]>([]);
  const [stopped, setStopped] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  /** 画面を離れたら止め、知らせも出さない */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      ctrl.current?.abort();
    };
  }, []);

  const run = async () => {
    if (running || targets.length === 0) return;
    const c = new AbortController();
    ctrl.current = c;
    const list = targets;
    setRunning(true);
    setStopped(false);
    setTotal(list.length);
    setResults([]);
    let placed = 0;
    // 1回の「まとめて探す」は全体の「元に戻す」の1手（PRD D329）
    const group = {};
    const r = await placeAll(list, {
      search: searchAddress,
      lookup: lookupPostalCode,
      wait: sleep,
      signal: c.signal,
      onResult: (x) => {
        setResults((prev) => [...prev, x]);
        if (x.ok) {
          placed += 1;
          update((d) => withFoundPlace(d, x.clientId, x.from, x), '住所をまとめて探す', { group });
        } else if (x.foundAddress !== null) {
          // 郵便番号で住所は見つかったが位置が見つからない人は、住所だけ書く
          const address = x.foundAddress;
          update(
            (d) => withFoundPlace(d, x.clientId, x.from, { lat: null, lng: null, address }),
            '住所をまとめて探す',
            {
              group,
            },
          );
        }
      },
    });
    if (!alive.current || ctrl.current !== c) return;
    setRunning(false);
    setStopped(r.stopped);
    toast(r.stopped ? `止めました（${placed}人を地図に置きました）` : `${placed}人を地図に置きました`);
  };
  /** 止める（今の1人の検索を取り消す） */
  const stop = () => ctrl.current?.abort();

  return { targets, skipped, running, total, results, stopped, run, stop };
}

export type PlaceAllRun = ReturnType<typeof usePlaceAllRun>;

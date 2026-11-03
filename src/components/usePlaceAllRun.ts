// 位置の無い人をまとめて地図に置く処理（PRD D89・D90・D329・D427。ADR-0016・ADR-0094）：〈利用者さん〉の場所と
// 〈スタッフ〉の自宅のどちらにも使う。対象を数え（lib/placeAll）、1人ずつ順に外部の検索を呼び、置けた人は1人ごとに
// store の update(fn) で書く。止める・画面を離れたら止めて知らせも出さない。
// 一覧の画面・登録の案内が持ち、まとめて置く欄（PlaceAllPanel）・名簿を読み込んだあと・一覧の行の［住所から探す］に渡す
import { useEffect, useMemo, useRef, useState } from 'react';
import { lookupPostalCode, searchAddress } from '../lib/geocode';
import { type PlaceAllResult, type PlaceKind, placeAll, placeAllTargets, sleep, withFoundPlace } from '../lib/placeAll';
import { useDemoData } from '../store';
import { useToast } from './Toast';

export function usePlaceAllRun(kind: PlaceKind) {
  const { data, update } = useDemoData();
  const { targets, skipped } = useMemo(() => placeAllTargets(data, kind), [data, kind]);
  // 名簿を読み込んだ直後に呼ばれても、いまのデータで数える（古い描画の run を呼ばれても）
  const latest = useRef(data);
  latest.current = data;
  const toast = useToast();
  const [running, setRunning] = useState(false);
  const busy = useRef(false);
  /** 今回の対象の数（押したときの） */
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<PlaceAllResult[]>([]);
  const [stopped, setStopped] = useState(false);
  /** 一度でも探したか（ボタンを「続きを探す」にする） */
  const [tried, setTried] = useState(false);
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

  /** まとめて置く。ids を渡せばその人だけ（一覧の行の［住所から探す］） */
  const run = async (ids?: readonly string[]) => {
    if (busy.current) return;
    const all = placeAllTargets(latest.current, kind).targets;
    const list = ids ? all.filter((p) => ids.includes(p.id)) : all;
    if (list.length === 0) return;
    busy.current = true;
    const c = new AbortController();
    ctrl.current = c;
    setRunning(true);
    setStopped(false);
    setTried(true);
    setTotal(list.length);
    setResults([]);
    let placed = 0;
    // 1回の「まとめて探す」は全体の「元に戻す」の1手（PRD D329）
    const group = {};
    const write = (x: PlaceAllResult, found: { lat: number | null; lng: number | null; address: string }) =>
      update((d) => withFoundPlace(d, kind, x.personId, x.from, found), '住所をまとめて探す', { group });
    const r = await placeAll(list, {
      search: searchAddress,
      lookup: lookupPostalCode,
      wait: sleep,
      signal: c.signal,
      onResult: (x) => {
        setResults((prev) => [...prev, x]);
        if (x.ok) {
          placed += 1;
          write(x, x);
        } else if (x.foundAddress !== null) {
          // 郵便番号で住所は見つかったが位置が見つからない人は、住所だけ書く
          write(x, { lat: null, lng: null, address: x.foundAddress });
        }
      },
    });
    if (ctrl.current === c) busy.current = false;
    if (!alive.current || ctrl.current !== c) return;
    setRunning(false);
    setStopped(r.stopped);
    toast(r.stopped ? `止めました（${placed}人を地図に置きました）` : `${placed}人を地図に置きました`);
  };
  /** 止める（今の1人の検索を取り消す） */
  const stop = () => ctrl.current?.abort();

  return { kind, targets, skipped, running, total, results, stopped, tried, run, stop };
}

export type PlaceAllRun = ReturnType<typeof usePlaceAllRun>;

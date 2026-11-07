// 位置の無い人をまとめて地図に置く処理（PRD D89・D90・D329・D427。ADR-0016・ADR-0094）：〈利用者さん〉の場所と
// 〈スタッフ〉の自宅のどちらにも使う。対象を数え（lib/placeAll）、1人ずつ順に外部の検索を呼び、置けた人は1人ごとに
// store の update(fn) で書く。止める・画面を離れたら止めて知らせも出さない。
// 一覧の画面・登録の案内が持ち、まとめて置く欄（PlaceAllPanel）・名簿を読み込んだあと・一覧の行の［住所から探す］に渡す。
// 走っている最中に名簿を読み込んだら、終わったあと残り（新しく入った人）を続けて探す（lib/placeRunQueue の予約）。
// lane を渡すと、ほかの種類の置く処理と1本の列に並べる（登録の案内。外部の検索は同時に1本）。
// まとめて探し終えて位置を入れた人がいれば、担当なし・要対応を自動で組む（探しているあいだは位置が変わり続け、読み込みのあとの自動の組みが
// 「組み始めたときと違う日」として飛ばすので、位置がそろってから組み直す。PRD D442）
import { useEffect, useMemo, useRef, useState } from 'react';
import { jstDate } from '../domain/time';
import { requestBandArrange } from '../lib/autoArrangeBatch';
import { lookupPostalCode, searchAddress } from '../lib/geocode';
import { type PlaceAllResult, type PlaceKind, placeAll, placeAllTargets, sleep, withFoundPlace } from '../lib/placeAll';
import { createPlaceLane, createPlaceRunGate, type PlaceLane } from '../lib/placeRunQueue';
import { useDemoData } from '../store';
import { useToast } from './Toast';

export function usePlaceAllRun(kind: PlaceKind, lane?: PlaceLane) {
  const { data, update, replacedCount } = useDemoData();
  /** データを丸ごと差し替えた回数（探すあいだに読み込み・直前の状態に戻すなどがあったら、あとで組まない） */
  const replacedNow = useRef(replacedCount);
  replacedNow.current = replacedCount;
  const { targets, skipped } = useMemo(() => placeAllTargets(data, kind), [data, kind]);
  // 名簿を読み込んだ直後に呼ばれても、いまのデータで数える（古い描画の run を呼ばれても）
  const latest = useRef(data);
  latest.current = data;
  const toast = useToast();
  /** 走っている（ほかの種類が終わるのを待っている間も） */
  const [running, setRunning] = useState(false);
  /** ほかの種類の置く処理が終わるのを待っている */
  const [waiting, setWaiting] = useState(false);
  const gate = useRef(createPlaceRunGate());
  const ownLane = useRef<PlaceLane | null>(null);
  ownLane.current ??= createPlaceLane();
  /** 今回の対象の数（押したときの。続けて探した分も足す） */
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

  /** 1回分を置く。done はこの続きで探し終えた人（見つからなかった人を続きで探し直さない）。対象がいなければ null */
  const batch = async (
    c: AbortController,
    ids: readonly string[] | undefined,
    done: Set<string>,
    onPlaced: () => void,
  ) => {
    if (c.signal.aborted) return null;
    const all = placeAllTargets(latest.current, kind).targets.filter((p) => !done.has(p.id));
    const list = ids ? all.filter((p) => ids.includes(p.id)) : all;
    if (list.length === 0) return null;
    for (const p of list) done.add(p.id);
    setWaiting(false);
    setTried(true);
    setTotal((n) => n + list.length);
    // 1回の「まとめて探す」は全体の「元に戻す」の1手（PRD D329）
    const group = {};
    const write = (x: PlaceAllResult, found: { lat: number | null; lng: number | null; address: string }) =>
      update((d) => withFoundPlace(d, kind, x.personId, x.from, found), '住所をまとめて探す', { group });
    return placeAll(list, {
      search: searchAddress,
      lookup: lookupPostalCode,
      wait: sleep,
      signal: c.signal,
      onResult: (x) => {
        setResults((prev) => [...prev, x]);
        if (x.ok) {
          onPlaced();
          write(x, x);
        } else if (x.foundAddress !== null) {
          // 郵便番号で住所は見つかったが位置が見つからない人は、住所だけ書く
          write(x, { lat: null, lng: null, address: x.foundAddress });
        }
      },
    });
  };

  /** まとめて置く。ids を渡せばその人だけ（一覧の行の［住所から探す］）。走っている最中なら終わったあと残りを続けて探す */
  const run = async (ids?: readonly string[]) => {
    const has = placeAllTargets(latest.current, kind).targets.some((p) => !ids || ids.includes(p.id));
    if (!has || !gate.current.request()) return;
    const c = new AbortController();
    ctrl.current = c;
    const q = lane ?? ownLane.current!;
    const done = new Set<string>();
    let placed = 0;
    let any = false;
    let pick = ids;
    const replacedAtStart = replacedNow.current;
    setRunning(true);
    setStopped(false);
    setTotal(0);
    setResults([]);
    do {
      setWaiting(q.busy());
      const onPlaced = () => {
        placed += 1;
      };
      const once = await q.run(() => batch(c, pick, done, onPlaced), c.signal);
      if (once) any = true;
      pick = undefined;
    } while (gate.current.finish(c.signal.aborted));
    // まとめて探して位置を入れた人がいれば、その位置で担当なし・要対応を組む（止めた・画面を離れて止まったときも、入れたぶんで組む。
    // 1人だけ探す行の［住所から探す］と、探すあいだにデータを丸ごと差し替えたときは組まない。組む対象が無ければ何もしない）
    if (placed > 0 && ids === undefined && replacedNow.current === replacedAtStart)
      requestBandArrange(latest.current, jstDate(Date.now()));
    if (!alive.current || ctrl.current !== c) return;
    setRunning(false);
    setWaiting(false);
    if (!any) return;
    setStopped(c.signal.aborted);
    toast(
      c.signal.aborted ? `止めました（${placed}人の緯度・経度を入れました）` : `${placed}人の緯度・経度を入れました`,
    );
  };
  /** 止める（今の1人の検索を取り消す。待っている間なら待つのをやめる） */
  const stop = () => ctrl.current?.abort();

  return { kind, targets, skipped, running, waiting, total, results, stopped, tried, run, stop };
}

export type PlaceAllRun = ReturnType<typeof usePlaceAllRun>;

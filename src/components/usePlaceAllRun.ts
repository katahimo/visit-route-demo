// 位置の無い人をまとめて地図に置く処理（PRD D89・D90・D329・D427・D445。ADR-0016・ADR-0094）を画面から使う手：〈利用者さん〉の場所と
// 〈スタッフ〉の自宅のどちらにも使う。計算と進み具合はアプリで1つの入れ物（lib/placeRunner）が持ち、画面を移っても続ける。
// ここは対象を数え（lib/placeAll）、依頼・止める・進み具合を画面に渡すだけ。
// 一覧の画面・登録の案内が使い、まとめて置く欄（PlaceAllPanel）・名簿を読み込んだあと・一覧の行の［住所から探す］に渡す
import { useMemo } from 'react';
import { type PlaceKind, placeAllTargets } from '../lib/placeAll';
import { placeRunner } from '../lib/placeRunner';
import { useDemoData } from '../store';
import { useValueStore } from './valueStore';

export function usePlaceAllRun(kind: PlaceKind) {
  const { data } = useDemoData();
  const { targets, skipped } = useMemo(() => placeAllTargets(data, kind), [data, kind]);
  const s = useValueStore(placeRunner.state[kind]);
  return {
    kind,
    targets,
    skipped,
    running: s.running,
    waiting: s.waiting,
    total: s.total,
    results: s.results,
    stopped: s.stopped,
    tried: s.tried,
    /** まとめて置く。ids を渡せばその人だけ（一覧の行の［住所から探す］）。走っている最中なら終わったあと残りを続けて探す */
    run: (ids?: readonly string[]) => placeRunner.run(kind, ids),
    /** 止める（今の1人の検索を取り消す。待っている間なら待つのをやめる） */
    stop: () => placeRunner.stop(kind),
  };
}

export type PlaceAllRun = ReturnType<typeof usePlaceAllRun>;

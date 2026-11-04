// 道路の所要の表（PRD D436。ADR-0101）を取る・消す。通信は lib/roadTable の fetchRoadTable の1か所で、押したときだけ呼ぶ
import { useEffect, useRef, useState } from 'react';
import { fetchRoadTable, ROAD_FAIL_TEXT, roadPointsOf } from '../lib/roadTable';
import { useDemoData } from '../store';

export function useRoadTable() {
  const { data, update } = useDemoData();
  /** 取っている途中の進み（null＝取っていない） */
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  // 画面を離れたら止める
  useEffect(() => () => ctrl.current?.abort(), []);

  /** 今の地点で表を取り直す。うまくいけば表を置き換え、だめなら失敗の文を返す（表はそのまま） */
  const fetchNow = async (): Promise<{ ok: true; count: number } | { ok: false; message: string }> => {
    const points = roadPointsOf(data);
    const c = new AbortController();
    ctrl.current = c;
    setProgress({ done: 0, total: 1 });
    try {
      const r = await fetchRoadTable(points, {
        signal: c.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      if (!r.ok) return { ok: false, message: ROAD_FAIL_TEXT[r.reason] };
      update((d) => ({ ...d, roads: r.table }), '道のりを取得する');
      return { ok: true, count: r.table.points.length };
    } finally {
      ctrl.current = null;
      setProgress(null);
    }
  };

  /** 表を消す（車の移動は直線距離からの見積もりに戻る） */
  const clear = () =>
    update((d) => {
      const { roads: _roads, ...rest } = d;
      return rest;
    }, '道路の移動時間を消す');

  /** 取っている途中で止める（表はそのまま。途中までの分は保存しない） */
  const stop = () => ctrl.current?.abort();

  return { table: data.roads, points: roadPointsOf(data), progress, fetchNow, clear, stop };
}

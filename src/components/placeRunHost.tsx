import { Loader2 } from 'lucide-react';
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';
import { jstDate } from '../domain/time';
import { autoArrangeIdle, requestBandArrange } from '../lib/autoArrangeBatch';
import { type PlaceRunDone, placeRunner, placeRunText } from '../lib/placeRunner';
import { useDemoData } from '../store';
import { useToast } from './Toast';
import { useValueStore } from './valueStore';
import './batchBand.css';

/**
 * 住所から位置をまとめて探す処理（lib/placeRunner。PRD D427・D445）に store の data と update をつなぎ、終わったら知らせる。
 * App の直下に1つ（画面を移っても探し続ける）。データを丸ごと差し替えたら止め、あとで組まない。
 * 探し終えたら位置のそろったデータで担当なし・要対応を自動で組む（requestBandArrange）
 */
export function PlaceRunHost(): ReactNode {
  const { data, update, replacedCount } = useDemoData();
  const latest = useRef(data);
  useLayoutEffect(() => {
    latest.current = data;
  }, [data]);
  useEffect(
    () =>
      placeRunner.connect({
        get: () => latest.current,
        update: (fn, label, opts) => update(fn, label, opts),
        arrange: (d) => requestBandArrange(d, jstDate(Date.now())),
        today: () => jstDate(Date.now()),
        settle: (signal) => autoArrangeIdle(signal),
      }),
    [update],
  );
  const lastReplaced = useRef(replacedCount);
  useLayoutEffect(() => {
    if (replacedCount === lastReplaced.current) return;
    lastReplaced.current = replacedCount;
    placeRunner.abort();
  }, [replacedCount]);
  const toast = useToast();
  const done = useValueStore(placeRunner.done);
  const shown = useRef<PlaceRunDone | null>(done);
  useEffect(() => {
    if (!done || done === shown.current) return;
    shown.current = done;
    toast(
      done.stopped
        ? `止めました（${done.placed}人の緯度・経度を入れました）`
        : `${done.placed}人の緯度・経度を入れました`,
    );
  }, [done, toast]);
  return null;
}

/** 上の帯の進み具合（住所の検索）：「お客様の緯度・経度を探しています 120/400人［止める］」。画面を移っても出す（PRD D445） */
export function PlaceRunBand(): ReactNode {
  const { data } = useDemoData();
  const client = useValueStore(placeRunner.state.client);
  const staff = useValueStore(placeRunner.state.staff);
  const kind = client.running && !client.waiting ? 'client' : staff.running && !staff.waiting ? 'staff' : null;
  if (!kind) return null;
  const s = kind === 'client' ? client : staff;
  const who = kind === 'client' ? data.org.terms.client : data.org.terms.staff;
  return (
    <section className="batch-band" aria-label="住所から緯度・経度を探す進み具合" data-testid="place-band">
      <Loader2 size={16} className="batch-band-spin" aria-hidden="true" />
      <output className="batch-band-text" data-testid="place-band-text">
        {placeRunText(who, s)}
      </output>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => placeRunner.stop(kind)}
        data-testid="place-band-stop"
      >
        止める
      </button>
    </section>
  );
}

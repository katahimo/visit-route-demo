import { Loader2 } from 'lucide-react';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { jstDate } from '../domain/time';
import { autoArrange, autoBandText, autoDoneText, requestBandArrange } from '../lib/autoArrangeBatch';
import { useDemoData } from '../store';
import { useToast } from './Toast';
import { useUndoAction } from './undo';
import { useValueStore } from './valueStore';
import './batchBand.css';

/** 計算が長引いたときだけ帯を出す（ms。短い計算で帯がちらつかないように） */
export const AUTO_BAND_DELAY_MS = 600;

/**
 * 自動の組み（lib/autoArrangeBatch。ADR-0072 第2段）に store の data と update をつなぎ、終わったら知らせる（PRD D405）。
 * App の直下に1つ。外れると計算を捨てる。データを丸ごと差し替えたら（読み込み・初期状態に戻す・直前の状態に戻す・別のタブの変更）
 * 待たせている依頼ごと捨てる（古いデータから作った結果を新しいデータに書かない）。
 * 終わったら「N件の担当を組みました」と［元に戻す］（書いたのが1手なので全体の履歴の1手戻す。要対応の組み直しだけで書かなかったときは出さない）。提案の帯は出さない。
 * デモを作った直後（store の startArrange。PRD D409）は、要対応の帯の［要対応を組む］と同じ依頼を1回出す
 */
export function AutoArrangeHost(): ReactNode {
  const { data, update, replacedCount, startArrange, takeStartArrange } = useDemoData();
  const latest = useRef(data);
  // 描いたデータを計算が読む（組んでいる間の編集も次の日から入れる）
  useLayoutEffect(() => {
    latest.current = data;
  }, [data]);
  useEffect(() => {
    return autoArrange.connect({ get: () => latest.current, update });
  }, [update]);
  // 差し替えた回数が変わったら捨てる（描く前に）
  const lastReplaced = useRef(replacedCount);
  useLayoutEffect(() => {
    if (replacedCount === lastReplaced.current) return;
    lastReplaced.current = replacedCount;
    autoArrange.abort();
  }, [replacedCount]);
  // デモを作った直後の1回（差し替えで捨てたあと、描いた新しいデータで依頼する。同じ印で二度出さない）。
  // 後片付けで「出した」を忘れる：開発中の StrictMode は効果を付け直し、つなぎ直し（上の connect）で1回目の計算を捨てるので、
  // 2回目の付け直しで依頼し直す（印を消したあとの描き直しでは startArrange が null になり出さない）
  const taken = useRef<object | null>(null);
  useEffect(() => {
    if (!startArrange || taken.current === startArrange) return;
    taken.current = startArrange;
    takeStartArrange(startArrange);
    requestBandArrange(latest.current, jstDate(Date.now()));
    return () => {
      taken.current = null;
    };
  }, [startArrange, takeStartArrange]);
  const toast = useToast();
  const undo = useUndoAction();
  const done = useValueStore(autoArrange.done);
  /** 知らせた終わり（描き直し・付け直しで同じ知らせを二度出さない。つないだときにあった古い知らせも出さない） */
  const shown = useRef(done);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 終わった知らせが変わったときだけ
  useEffect(() => {
    if (!done || done === shown.current) return;
    shown.current = done;
    // 要対応の組み直しだけで何も書かなかったときは知らせない（autoDoneText が null）
    const text = autoDoneText(done, latest.current.org.terms.staff);
    if (text !== null) toast(text, done.written > 0 ? { action: undo } : undefined);
  }, [done]);
  return null;
}

/**
 * 上の帯の進み具合（自動の組み）：「担当を自動で組んでいます 3/10日」。計算が AUTO_BAND_DELAY_MS 以上続いたときだけ出す
 * （保存のたびに一瞬出てちらつかないように）。見た目・場所は担当を組むの帯（BatchBand）と同じ
 */
export function AutoArrangeBand(): ReactNode {
  const run = useValueStore(autoArrange.run);
  const running = run !== null;
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!running) {
      setLate(false);
      return;
    }
    const t = setTimeout(() => setLate(true), AUTO_BAND_DELAY_MS);
    return () => clearTimeout(t);
  }, [running]);
  if (!run || !late) return null;
  return (
    <section className="batch-band" aria-label="自動で担当を組む進み具合" data-testid="auto-band">
      <Loader2 size={16} className="batch-band-spin" aria-hidden="true" />
      <output className="batch-band-text" data-testid="auto-band-text">
        {autoBandText(run)}
      </output>
    </section>
  );
}

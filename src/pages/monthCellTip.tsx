// 月のマスの読み方の吹き出し（PRD D177）。文は日のマス（DayCell）が lib/monthGuide の置き場に日付で置き、ここは日付で引く
import { type RefObject, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { TipBubble } from '../components/Term';
import type { TipStore } from '../lib/monthGuide';

/** マウスを重ねてから読み方を出すまで（ms。マスの上を通り過ぎるだけでは出さない） */
const TIP_SHOW_MS = 300;
/** マスから離れてから読み方を消すまで（ms。隣のマスへ移るときにちらつかない） */
const TIP_HIDE_MS = 120;

/**
 * 月のマスの読み方の吹き出し（PRD D177）。マスにマウスを重ねる（少し止まったら）・キーボードでフォーカスする（:focus-visible）と、
 * そのマスの日付・状態の文と、出ている印の読み方（lib/monthGuide。マスの data-guide）を、マスの下（入らなければ上）に出す。
 * Esc・離れる・フォーカスが外れると消す。吹き出しはマウスを受けない（下のマスを隠して押せなくしない）。タッチでは出さない（押すと日の画面）
 */
export function MonthCellTip({ gridRef, tipStore }: { gridRef: RefObject<HTMLElement | null>; tipStore: TipStore }) {
  const tipId = `month-cell-tip-${useId().replace(/:/g, '')}`;
  /**
   * 出しているマス。日付で持つ（描き直しでマスの要素が替わっても閉じない）。by：出したきっかけ。
   * キーボードで出しているあいだはマウスの出入りを見ない（止まったマウスの上で表が描き直されると、動かしていなくても出入りが起きる）
   */
  const [at, setAt] = useState<{ date: string; by: 'pointer' | 'focus' } | null>(null);
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: 表の要素に1回だけ付ける
  useEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    const cellOf = (t: EventTarget | null): HTMLElement | null =>
      t instanceof Element ? (t.closest('[data-tip]') as HTMLElement | null) : null;
    const dateOf = (t: EventTarget | null): string | null => cellOf(t)?.dataset.date ?? null;
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const d = dateOf(e.target);
      if (!d) return;
      setAt((cur) => {
        if (cur?.by === 'focus') return cur;
        clear();
        // すでに出ていれば隣のマスへすぐ移す
        if (cur) return cur.date === d ? cur : { date: d, by: 'pointer' };
        timer.current = window.setTimeout(() => setAt({ date: d, by: 'pointer' }), TIP_SHOW_MS);
        return cur;
      });
    };
    const out = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const d = dateOf(e.target);
      // 同じ日のマスの中（描き直して替わった要素も）へ移るだけなら消さない
      if (d && dateOf(e.relatedTarget) === d) return;
      setAt((cur) => {
        if (cur?.by === 'focus') return cur;
        clear();
        timer.current = window.setTimeout(() => setAt(null), TIP_HIDE_MS);
        return cur;
      });
    };
    const focusIn = (e: FocusEvent) => {
      const c = cellOf(e.target);
      const d = c?.dataset.date;
      clear();
      setAt(c?.matches(':focus-visible') && d ? { date: d, by: 'focus' } : null);
    };
    const focusOut = () => {
      clear();
      setAt(null);
    };
    root.addEventListener('pointerover', over);
    root.addEventListener('pointerout', out);
    root.addEventListener('focusin', focusIn);
    root.addEventListener('focusout', focusOut);
    return () => {
      clear();
      root.removeEventListener('pointerover', over);
      root.removeEventListener('pointerout', out);
      root.removeEventListener('focusin', focusIn);
      root.removeEventListener('focusout', focusOut);
    };
  }, []);
  // 出ている間の Esc は読み方を消すだけ（ほかの欄の Esc は出ていないときだけ届く）
  useEffect(() => {
    if (!at) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      setAt(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [at]);
  // 文は日付で引く（描画中に DOM の data-* を読まない。休みを切り替えたら新しい文）
  const date = at?.date ?? null;
  const tip = useSyncExternalStore(tipStore.subscribe, () => (date ? tipStore.get(date) : null));
  // 置く先は日付でいまのマスを引く（描き直しで要素が替わっても同じ日のマス）
  const cellAt = () =>
    date ? (gridRef.current?.querySelector<HTMLElement>(`[data-tip][data-date="${date}"]`) ?? null) : null;
  return (
    <TipBubble
      id={tipId}
      anchor={cellAt}
      open={!!tip && !!cellAt()}
      className="is-passive month-cell-tip"
      testId="month-cell-tip"
    >
      {tip && (
        <>
          <strong>{tip.head}</strong>
          <span>{tip.text}</span>
          <strong className="month-cell-tip-sub">このマスの読み方</strong>
          <ul>
            {tip.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </>
      )}
    </TipBubble>
  );
}

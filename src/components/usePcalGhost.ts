import { type PointerEvent, useRef, useState } from 'react';
import { slotMinuteAt } from '../lib/personCalendar';
import { slotOf } from '../lib/personPage';
import { DAY_END } from '../lib/spans';

/** 押している間の範囲（a は押した枠、b は今の枠。どちらも15分の枠の始まり） */
type PcalGhost = { date: string; a: number; b: number };

/**
 * 予定のカレンダー（PersonCalendar）の時間軸の空き枠から足す（押す・縦にドラッグ）。離すと onPick（開始・所要）。
 * 足せるのは editable で今日以降の列だけ。回の上を押したときは足さない
 */
export function usePcalGhost({
  editable,
  today,
  onPick,
}: {
  editable: boolean;
  today: string;
  onPick: (date: string, start: number, duration: number) => void;
}) {
  const [ghost, setGhostState] = useState<PcalGhost | null>(null);
  /** 押している間の範囲（描き直しを待たずに離したときも読めるよう、state と同じ値を持つ） */
  const ghostRef = useRef<PcalGhost | null>(null);
  const setGhost = (g: PcalGhost | null) => {
    ghostRef.current = g;
    setGhostState(g);
  };
  const minuteAt = (e: PointerEvent<HTMLElement>) =>
    slotMinuteAt(e.clientY - e.currentTarget.getBoundingClientRect().top);
  const onPointerDown = (e: PointerEvent<HTMLElement>, date: string) => {
    if (!editable || e.button !== 0 || date < today) return;
    if ((e.target as Element).closest('.pcal-item')) return;
    const m = minuteAt(e);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setGhost({ date, a: m, b: m });
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const g = ghostRef.current;
    if (!g) return;
    // 押した枠（15分）と今の枠。同じ枠の中で動いただけなら押しただけと同じ
    const m = minuteAt(e);
    if (m !== g.b) setGhost({ ...g, b: m });
  };
  const onPointerUp = () => {
    const g = ghostRef.current;
    if (!g) return;
    const { start, duration } = slotOf(g.a, g.b);
    setGhost(null);
    onPick(g.date, start, Math.min(duration, DAY_END - start));
  };
  const onPointerCancel = () => setGhost(null);
  return { ghost, onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

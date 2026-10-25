// 日ごとのリスト（スマホ）の押し方の処理：長押しで複数選択・左右のスワイプで前後の日・動いたら押したことにしない
import { type PointerEvent as ReactPointerEvent, useRef } from 'react';
import { isSwipe, movedFar } from '../lib/swipe';
import { LONG_PRESS_MS, type VisitRowData } from './visitParts';

type PressRow = Pick<VisitRowData, 'visitId'> & { selectable: boolean };

export function useDayListPress<R extends PressRow>({
  selecting,
  onSelecting,
  onToggle,
  onOpen,
  onPrev,
  onNext,
}: {
  selecting: boolean;
  onSelecting: (on: boolean) => void;
  onToggle: (visitId: string) => void;
  onOpen: (visitId: string) => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  /** 押し始め（長押し・スワイプ・押したことにしないの判定） */
  const press = useRef<{
    x: number;
    y: number;
    id: string | null;
    timer: ReturnType<typeof setTimeout> | null;
    long: boolean;
    moved: boolean;
    /** マウスか（スワイプはタッチ・ペンだけ。マウスで文字をなぞったときに日を送らない） */
    mouse: boolean;
  } | null>(null);
  const clearTimer = () => {
    const p = press.current;
    if (p?.timer) clearTimeout(p.timer);
    if (p) p.timer = null;
  };
  const onDown = (e: ReactPointerEvent, row: R | null) => {
    if (e.button !== 0) return;
    clearTimer();
    const p = {
      x: e.clientX,
      y: e.clientY,
      id: row?.visitId ?? null,
      timer: null,
      long: false,
      moved: false,
      mouse: e.pointerType === 'mouse',
    } as NonNullable<typeof press.current>;
    if (row?.selectable) {
      p.timer = setTimeout(() => {
        p.timer = null;
        p.long = true;
        onSelecting(true);
        onToggle(row.visitId);
      }, LONG_PRESS_MS);
    }
    press.current = p;
  };
  const onMove = (e: ReactPointerEvent) => {
    const p = press.current;
    if (!p) return;
    if (movedFar(e.clientX - p.x, e.clientY - p.y)) {
      p.moved = true;
      clearTimer();
    }
  };
  const onUp = (e: ReactPointerEvent) => {
    const p = press.current;
    clearTimer();
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.mouse && isSwipe(dx, dy)) {
      p.moved = true;
      if (dx < 0) onNext?.();
      else onPrev?.();
    }
    // 続く click（同じ行）は印を読むので、そのあとで消す（行の外で離したときに古い印を残さない）
    setTimeout(() => {
      if (press.current === p) press.current = null;
    }, 0);
  };
  /** 行を押した（長押し・スワイプのあとの click は捨てる） */
  const onRowClick = (row: R) => {
    const p = press.current;
    press.current = null;
    if (p && p.id === row.visitId && (p.long || p.moved)) return;
    if (selecting) {
      if (row.selectable) onToggle(row.visitId);
      return;
    }
    onOpen(row.visitId);
  };
  return { onDown, onMove, onUp, onCancel: clearTimer, onRowClick };
}

// 表を矢印で動く位置の計算（PRD D420）
import { describe, expect, it } from 'vitest';
import { clampGridPos, GRID_PAGE, moveGridPos } from './gridFocus';

const size = { rows: 20, cols: 8 };

describe('moveGridPos', () => {
  it('矢印で1つ動き、端で止まる', () => {
    expect(moveGridPos({ row: 3, col: 2 }, 'ArrowDown', false, size)).toEqual({ row: 4, col: 2 });
    expect(moveGridPos({ row: 3, col: 2 }, 'ArrowRight', false, size)).toEqual({ row: 3, col: 3 });
    expect(moveGridPos({ row: 19, col: 7 }, 'ArrowDown', false, size)).toEqual({ row: 19, col: 7 });
    expect(moveGridPos({ row: 19, col: 7 }, 'ArrowRight', false, size)).toEqual({ row: 19, col: 7 });
  });

  it('上は見出しの行、左は名前の列まで。角には入らない', () => {
    expect(moveGridPos({ row: 0, col: 2 }, 'ArrowUp', false, size)).toEqual({ row: -1, col: 2 });
    expect(moveGridPos({ row: 5, col: 0 }, 'ArrowLeft', false, size)).toEqual({ row: 5, col: -1 });
    expect(moveGridPos({ row: -1, col: 0 }, 'ArrowLeft', false, size)).toEqual({ row: -1, col: 0 });
    expect(moveGridPos({ row: 0, col: -1 }, 'ArrowUp', false, size)).toEqual({ row: 0, col: -1 });
  });

  it('Home・End は行の先頭・最後、Ctrl を付けると最初・最後のマス', () => {
    expect(moveGridPos({ row: 4, col: 5 }, 'Home', false, size)).toEqual({ row: 4, col: -1 });
    expect(moveGridPos({ row: -1, col: 5 }, 'Home', false, size)).toEqual({ row: -1, col: 0 });
    expect(moveGridPos({ row: 4, col: 1 }, 'End', false, size)).toEqual({ row: 4, col: 7 });
    expect(moveGridPos({ row: 4, col: 5 }, 'Home', true, size)).toEqual({ row: 0, col: 0 });
    expect(moveGridPos({ row: 4, col: 5 }, 'End', true, size)).toEqual({ row: 19, col: 7 });
  });

  it('PageUp・PageDown は GRID_PAGE 行ずつ（名前の列では見出しの行へ上がらない）', () => {
    expect(moveGridPos({ row: 2, col: 1 }, 'PageDown', false, size)).toEqual({ row: 2 + GRID_PAGE, col: 1 });
    expect(moveGridPos({ row: 15, col: 1 }, 'PageDown', false, size)).toEqual({ row: 19, col: 1 });
    expect(moveGridPos({ row: 3, col: 1 }, 'PageUp', false, size)).toEqual({ row: -1, col: 1 });
    expect(moveGridPos({ row: 3, col: -1 }, 'PageUp', false, size)).toEqual({ row: 0, col: -1 });
  });

  it('ほかのキーは動かない（null）', () => {
    expect(moveGridPos({ row: 3, col: 2 }, 'Enter', false, size)).toBeNull();
    expect(moveGridPos({ row: 3, col: 2 }, 'a', false, size)).toBeNull();
  });
});

describe('clampGridPos', () => {
  it('行・列が減ったら表の中に収める。角は見出しの行の先頭へ', () => {
    expect(clampGridPos({ row: 30, col: 9 }, size)).toEqual({ row: 19, col: 7 });
    expect(clampGridPos({ row: -1, col: -1 }, size)).toEqual({ row: -1, col: 0 });
    expect(clampGridPos({ row: 2, col: 3 }, size)).toEqual({ row: 2, col: 3 });
  });

  it('表が空なら null', () => {
    expect(clampGridPos({ row: 0, col: 0 }, { rows: 0, cols: 8 })).toBeNull();
    expect(clampGridPos({ row: 0, col: 0 }, { rows: 3, cols: 0 })).toBeNull();
  });
});

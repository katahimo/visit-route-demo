// 見出しの行と見出しの列のある表を、1つの Tab の止まり所で矢印で動く（WAI-ARIA の grid。相性の表。PRD D420）ときの位置の計算。
// 位置は行・列の番号で持つ：row −1 は見出しの行、col −1 は見出しの列（名前）。左上の角（−1, −1）には止まらない
/** 表の中の位置（row −1＝見出しの行、col −1＝見出しの列） */
export type GridPos = { row: number; col: number };

/** 表の大きさ（見出しを除いた行・列の数） */
export type GridSize = { rows: number; cols: number };

/** PageUp・PageDown で動く行の数 */
export const GRID_PAGE = 10;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** 位置を表の中に収める（絞り込みで行・列が減ったとき）。角（−1, −1）は見出しの行の先頭の列へ。表が空なら null */
export function clampGridPos(pos: GridPos, size: GridSize): GridPos | null {
  if (size.rows === 0 || size.cols === 0) return null;
  const row = clamp(pos.row, -1, size.rows - 1);
  const col = clamp(pos.col, -1, size.cols - 1);
  return row === -1 && col === -1 ? { row: -1, col: 0 } : { row, col };
}

/**
 * キーで動いた先の位置（動かないキーなら null）。↑↓←→ は1つ（端で止まる）、Home・End は行の先頭（見出しの列）・最後、
 * Ctrl＋Home・End は最初・最後のマス、PageUp・PageDown は GRID_PAGE 行。角（−1, −1）には入らない
 */
export function moveGridPos(pos: GridPos, key: string, ctrl: boolean, size: GridSize): GridPos | null {
  const last = { row: size.rows - 1, col: size.cols - 1 };
  const next = (() => {
    switch (key) {
      case 'ArrowUp':
        return { row: pos.row - 1, col: pos.col };
      case 'ArrowDown':
        return { row: pos.row + 1, col: pos.col };
      case 'ArrowLeft':
        return { row: pos.row, col: pos.col - 1 };
      case 'ArrowRight':
        return { row: pos.row, col: pos.col + 1 };
      case 'Home':
        return ctrl ? { row: 0, col: 0 } : { row: pos.row, col: pos.row === -1 ? 0 : -1 };
      case 'End':
        return ctrl ? last : { row: pos.row, col: last.col };
      case 'PageUp':
        return { row: Math.max(pos.row - GRID_PAGE, pos.col === -1 ? 0 : -1), col: pos.col };
      case 'PageDown':
        return { row: pos.row + GRID_PAGE, col: pos.col };
      default:
        return null;
    }
  })();
  if (!next) return null;
  // 角へは入らない（その手前で止まる）
  if (next.row === -1 && next.col === -1) return pos;
  return clampGridPos(next, size);
}

// 「変更あり」の印のクリックの見分け（札のクリックの中で呼ぶ。印を押したときだけ日付を返し、札の選択は呼ぶ側が飛ばす。ADR-0073）
import { describe, expect, it } from 'vitest';
import { toldDateOf } from './openTold';

const target = (date: string | null) => ({
  closest: (sel: string) => (sel === '[data-told-date]' && date !== null ? { getAttribute: () => date } : null),
});

describe('toldDateOf', () => {
  it('印（data-told-date）の中のクリックなら、その日付', () => {
    expect(toldDateOf(target('2026-10-21'))).toBe('2026-10-21');
  });
  it('印の外のクリック・要素でない対象は null（札の選択・開くはそのまま）', () => {
    expect(toldDateOf(target(null))).toBeNull();
    expect(toldDateOf(null)).toBeNull();
    expect(toldDateOf({})).toBeNull();
  });
});

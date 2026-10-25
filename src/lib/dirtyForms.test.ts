import { describe, expect, it } from 'vitest';
import { hasDirtyForm, markDirtyForm, OTHER_TAB_DIRTY_TEXT, OTHER_TAB_TEXT, otherTabText } from './dirtyForms';

describe('dirtyForms', () => {
  it('数えた欄がすべて外れるまで「変更がある」。同じ欄を2回外しても数はずれない', () => {
    expect(hasDirtyForm()).toBe(false);
    const a = markDirtyForm();
    const b = markDirtyForm();
    expect(hasDirtyForm()).toBe(true);
    a();
    a();
    expect(hasDirtyForm()).toBe(true);
    b();
    expect(hasDirtyForm()).toBe(false);
  });
  it('別のタブの変更の知らせの文', () => {
    expect(otherTabText(false)).toBe(OTHER_TAB_TEXT);
    expect(otherTabText(true)).toBe(OTHER_TAB_DIRTY_TEXT);
  });
});

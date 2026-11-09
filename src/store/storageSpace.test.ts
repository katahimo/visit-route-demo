import { describe, expect, it } from 'vitest';
import { isOwnStorageKey, ownKeyOf, prefixOf, spaceOf } from './storageSpace';

describe('spaceOf', () => {
  it('space の値を返す', () => {
    expect(spaceOf('?space=slides')).toBe('slides');
    expect(spaceOf('?a=1&space=demo-2')).toBe('demo-2');
  });
  it('無い・空・使えない文字は null', () => {
    expect(spaceOf('')).toBeNull();
    expect(spaceOf('?space=')).toBeNull();
    expect(spaceOf('?space=Slides')).toBeNull();
    expect(spaceOf('?space=a_b')).toBeNull();
    expect(spaceOf('?space=a:b')).toBeNull();
    expect(spaceOf('?other=slides')).toBeNull();
  });
});

describe('prefixOf', () => {
  it('vrdemo:space:<space>: の形', () => {
    expect(prefixOf('slides')).toBe('vrdemo:space:slides:');
  });
});

describe('storage イベントのキー（普段の領域）', () => {
  it('接頭辞付きは無視し、ふつうのキーと null でないものは自分のもの', () => {
    expect(isOwnStorageKey('vrdemo:space:slides:x')).toBe(false);
    expect(isOwnStorageKey('visit-route-demo:data')).toBe(true);
    expect(isOwnStorageKey(null)).toBe(false);
    expect(ownKeyOf('abc')).toBe('abc');
  });
});

// zip のファイルを開く（PRD D440。ADR-0107）
import { describe, expect, it } from 'vitest';
import { isZip, readZip, ZIP_ERRORS } from './zipRead';
import { makeZip } from './zipRead.testkit';

describe('readZip', () => {
  it('無圧縮とデフレートの中身・日本語の名前を読み、フォルダは除く', async () => {
    const zip = makeZip([
      { name: 'a/', data: '' },
      { name: 'a/佐藤.ics', data: 'BEGIN:VCALENDAR\nあいう', deflate: true },
      { name: 'b.txt', data: 'plain' },
    ]);
    expect(isZip(zip)).toBe(true);
    const entries = await readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(['a/佐藤.ics', 'b.txt']);
    expect(new TextDecoder().decode(entries[0]!.bytes)).toBe('BEGIN:VCALENDAR\nあいう');
    expect(new TextDecoder().decode(entries[1]!.bytes)).toBe('plain');
  });
  it('zip でなければ読めない理由', async () => {
    expect(isZip(new TextEncoder().encode('BEGIN:VCALENDAR'))).toBe(false);
    await expect(readZip(new TextEncoder().encode('not a zip file at all, really'))).rejects.toThrow(ZIP_ERRORS.notZip);
  });
});

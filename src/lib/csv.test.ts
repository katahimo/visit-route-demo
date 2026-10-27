// CSV の文字と表の変換（ADR-0068）
import { describe, expect, it } from 'vitest';
import { CSV_BOM, decodeText, parseCsv, toCsv, unguardCell } from './csv';

/** テストのための Shift_JIS・EUC-JP の書き方（TextDecoder で2バイトの並びを全部読んで逆引きを作る） */
function legacyEncoder(label: 'shift_jis' | 'euc-jp'): (s: string) => Uint8Array {
  const dec = new TextDecoder(label);
  const map = new Map<string, number[]>();
  const leads = label === 'shift_jis' ? [...range(0x81, 0x9f), ...range(0xe0, 0xfc)] : range(0xa1, 0xfe);
  const trails = label === 'shift_jis' ? range(0x40, 0xfc) : range(0xa1, 0xfe);
  for (const a of leads)
    for (const b of trails) {
      const ch = dec.decode(new Uint8Array([a, b]));
      if (ch.length === 1 && ch !== '�' && !map.has(ch)) map.set(ch, [a, b]);
    }
  // Shift_JIS の半角カナは1バイト（0xA1〜0xDF）
  if (label === 'shift_jis') for (const a of range(0xa1, 0xdf)) map.set(dec.decode(new Uint8Array([a])), [a]);
  return (s) => {
    const out: number[] = [];
    for (const ch of s) {
      const code = ch.charCodeAt(0);
      if (code < 0x80) out.push(code);
      else {
        const bytes = map.get(ch);
        if (!bytes) throw new Error(`${ch} を書けない`);
        out.push(...bytes);
      }
    }
    return new Uint8Array(out);
  };
}
function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const SAMPLE = 'ID,表示名,住所\r\nc1,山田 花子,札幌市中央区北1条西2丁目\r\n';

describe('decodeText（文字コードの見分け）', () => {
  it('BOM 付きの UTF-8 は BOM を落とす', () => {
    const r = decodeText(new TextEncoder().encode(CSV_BOM + SAMPLE));
    expect(r).toEqual({ text: SAMPLE, encoding: 'UTF-8' });
  });
  it('BOM の無い UTF-8', () => {
    expect(decodeText(new TextEncoder().encode(SAMPLE))).toEqual({ text: SAMPLE, encoding: 'UTF-8' });
  });
  it('Shift_JIS（Excel の「CSV（コンマ区切り）」の保存）', () => {
    expect(decodeText(legacyEncoder('shift_jis')(SAMPLE))).toEqual({ text: SAMPLE, encoding: 'Shift_JIS' });
  });
  it('Shift_JIS の半角カナだけの値でも、漢字の見出しがあれば EUC-JP と取り違えない', () => {
    const text = '名前,よみ\r\n山田,ﾔﾏﾀﾞ ﾊﾅｺ\r\n';
    expect(decodeText(legacyEncoder('shift_jis')(text))).toEqual({ text, encoding: 'Shift_JIS' });
  });
  it('EUC-JP', () => {
    expect(decodeText(legacyEncoder('euc-jp')(SAMPLE))).toEqual({ text: SAMPLE, encoding: 'EUC-JP' });
  });
  it('BOM 付きの UTF-16（Excel の「Unicode テキスト」の保存）', () => {
    const le = [0xff, 0xfe];
    for (const ch of SAMPLE) le.push(ch.charCodeAt(0) & 0xff, ch.charCodeAt(0) >> 8);
    expect(decodeText(new Uint8Array(le))).toEqual({ text: SAMPLE, encoding: 'UTF-16LE' });
  });
});

describe('parseCsv・toCsv', () => {
  it('引用符の中の区切り・改行・「""」を読み、最後の空行は落とす', () => {
    expect(parseCsv('a,"b,c","d\r\ne","f""g"\r\n,x\r\n')).toEqual([
      ['a', 'b,c', 'd\ne', 'f"g'],
      ['', 'x'],
    ]);
  });
  it('改行が LF・CR だけでも読む', () => {
    expect(parseCsv('a,b\nc,d\re,f')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ]);
  });
  it('1行目にタブが多ければタブ区切り（値の中のカンマはそのまま）', () => {
    expect(parseCsv('名前\t住所\n山田\t北1条,西2丁目\n')).toEqual([
      ['名前', '住所'],
      ['山田', '北1条,西2丁目'],
    ]);
  });
  it("数式と読まれる先頭（= + - @）には「'」を付け、unguardCell で外す（数は付けない）", () => {
    const text = toCsv([['=HYPERLINK("x")', '-鍵はポスト', '+1', '-1.5', '@a', "'通常"]]);
    const cells = parseCsv(text)[0]!;
    expect(cells).toEqual(['\'=HYPERLINK("x")', "'-鍵はポスト", '+1', '-1.5', "'@a", "'通常"]);
    expect(cells.map(unguardCell)).toEqual(['=HYPERLINK("x")', '-鍵はポスト', '+1', '-1.5', '@a', "'通常"]);
  });
  it('書いて読むと同じに戻る（null は空、数は文字）', () => {
    const rows = [
      ['名前', 'メモ', '数'],
      ['山田', '1行目\n2行目', 3],
      ['"引用"', 'a,b', null],
      [' 前後の空白 ', '', 0],
    ];
    const text = toCsv(rows);
    expect(text.endsWith('\r\n')).toBe(true);
    expect(parseCsv(text)).toEqual(rows.map((r) => r.map((v) => (v === null ? '' : String(v)))));
  });
});

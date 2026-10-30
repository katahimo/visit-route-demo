// CSV の test の共通の部品（csv.test.ts・excel/ledgerCsv.test.ts）。check:code の対象外

/** テストのための Shift_JIS・EUC-JP の書き方（TextDecoder で2バイトの並びを全部読んで逆引きを作る） */
export function legacyEncoder(label: 'shift_jis' | 'euc-jp'): (s: string) => Uint8Array {
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

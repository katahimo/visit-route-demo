// テスト用に zip を作る（無圧縮かデフレート。CRC は読む側で見ないので 0）
import { deflateRawSync } from 'node:zlib';

/** declaredSize は中央ディレクトリに書く展開後の大きさ（偽りの申告を試す）。encrypted は暗号化の印 */
export function makeZip(
  files: { name: string; data: string; deflate?: boolean; declaredSize?: number; encrypted?: boolean }[],
): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const cens: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const raw = enc.encode(f.data);
    const body = f.deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const loc = new Uint8Array(30 + name.length);
    const lv = new DataView(loc.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, f.deflate ? 8 : 0, true);
    lv.setUint32(18, body.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    loc.set(name, 30);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(8, f.encrypted ? 0x0801 : 0x0800, true);
    cv.setUint16(10, f.deflate ? 8 : 0, true);
    cv.setUint32(20, body.length, true);
    cv.setUint32(24, f.declaredSize ?? raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    locals.push(loc, body);
    cens.push(cen);
    offset += loc.length + body.length;
  }
  const cenSize = cens.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, offset, true);
  const parts = [...locals, ...cens, end];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

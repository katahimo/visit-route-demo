// zip のファイルを開く（Google カレンダーの書き出し（スタッフごとの .ics を zip にまとめたもの）を読む。PRD D440。ADR-0107）。
// 中央ディレクトリから名前と位置を読み、無圧縮（0）とデフレート（8）だけを開く。デフレートはブラウザ標準の
// DecompressionStream('deflate-raw')（外へは送らない。ライブラリは足さない）。暗号化・zip64・分割は読まない。
// データは書き換えない

/** zip の中の1ファイル（フォルダは除く） */
export type ZipEntry = { name: string; bytes: Uint8Array };

/** 読めない理由 */
export const ZIP_ERRORS = {
  notZip: 'zip のファイルとして読めません',
  tooBig: 'zip の中身が大きすぎます',
  encrypted: '暗号化された zip は読めません',
  method: 'この圧縮の形は読めません',
} as const;

/** 開く上限：ファイルの数・展開した合計（バイト）。カレンダーの書き出しには十分な大きさ */
export const ZIP_MAX_ENTRIES = 500;
export const ZIP_MAX_BYTES = 50 * 1024 * 1024;

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

/** 読めないときに投げる（message は ZIP_ERRORS の文） */
export class ZipReadError extends Error {}

/** 中央ディレクトリの終わりの位置（後ろから探す。コメントは最大 65535 バイト） */
function findEnd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= min; i--) if (view.getUint32(i, true) === EOCD_SIG) return i;
  throw new ZipReadError(ZIP_ERRORS.notZip);
}

/** デフレートを開く（DecompressionStream。上限を超えたら止める） */
async function inflate(data: Uint8Array, limit: number): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new ZipReadError(ZIP_ERRORS.tooBig);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/** zip の中のファイル（中央ディレクトリの順。フォルダは除く）。読めなければ ZipReadError。maxBytes は開いた合計の上限 */
export async function readZip(bytes: Uint8Array, maxBytes: number = ZIP_MAX_BYTES): Promise<ZipEntry[]> {
  if (bytes.byteLength < 22) throw new ZipReadError(ZIP_ERRORS.notZip);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEnd(view);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  if (count > ZIP_MAX_ENTRIES) throw new ZipReadError(ZIP_ERRORS.tooBig);
  const utf8 = new TextDecoder('utf-8');
  const out: ZipEntry[] = [];
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.byteLength || view.getUint32(at, true) !== CEN_SIG) throw new ZipReadError(ZIP_ERRORS.notZip);
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const packed = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extraLen = view.getUint16(at + 30, true);
    const commentLen = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = utf8.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;
    if (flags & 1) throw new ZipReadError(ZIP_ERRORS.encrypted);
    if (local + 30 > bytes.byteLength || view.getUint32(local, true) !== LOC_SIG)
      throw new ZipReadError(ZIP_ERRORS.notZip);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + packed > bytes.byteLength) throw new ZipReadError(ZIP_ERRORS.notZip);
    const data = bytes.subarray(start, start + packed);
    // 上限は実際に開いた大きさで数える（中央ディレクトリの申告は信じない）
    let body: Uint8Array;
    if (method === 0) {
      if (packed !== size) throw new ZipReadError(ZIP_ERRORS.notZip);
      body = data.slice();
    } else if (method === 8) body = await inflate(data, maxBytes - total);
    else throw new ZipReadError(ZIP_ERRORS.method);
    total += body.byteLength;
    if (total > maxBytes) throw new ZipReadError(ZIP_ERRORS.tooBig);
    out.push({ name, bytes: body });
  }
  return out;
}

/** zip のファイルか（先頭が PK\x03\x04 か、空の zip の PK\x05\x06） */
export function isZip(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5);
}

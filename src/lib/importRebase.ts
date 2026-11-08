// 読み込みの読み直し（PRD D442 の続き）：ファイルを読んでから入れるまでのあいだに、ほかの手（名簿を読み込んだあとの
// 住所からの位置の検索など）でデータが変わったとき、同じファイルを今のデータで読み直す。確かめた内容（件数・名前など、
// data を除いた結果）が同じなら、読み直した結果を入れてよい。違えば入れない（確かめていない内容を入れない）。純粋関数と小さな手
import type { DemoData, ImportError } from '../contracts/data';

/** 読み直す回数の上限（そのあいだもデータが変わり続けたら諦める） */
const MAX_REREAD = 3;

/** data を除いた結果が同じか（確かめた件数・名前・注意が同じ） */
export function sameOutcome<T extends { data: DemoData }>(a: T, b: T): boolean {
  return JSON.stringify({ ...a, data: null }) === JSON.stringify({ ...b, data: null });
}

/**
 * base で読んだ結果 r を、今のデータ（now()）に当て直す。base のままなら r をそのまま返す。
 * 変わっていたら reread で読み直し、確かめた内容と同じなら読み直した結果（とその基のデータ）を返す。
 * 読めない・内容が違う・読み直すあいだも変わり続けたら null
 */
export async function rebaseImport<T extends { data: DemoData }>(
  base: DemoData,
  r: T,
  now: () => DemoData,
  reread: (d: DemoData) => Promise<T | ImportError> | T | ImportError,
): Promise<{ base: DemoData; r: T } | null> {
  let cur = { base, r };
  for (let i = 0; i <= MAX_REREAD; i++) {
    const d = now();
    if (d === cur.base) return cur;
    if (i === MAX_REREAD) return null;
    const again = await reread(d);
    if ('code' in again || !sameOutcome(r, again)) return null;
    cur = { base: d, r: again };
  }
  return null;
}

import { describe, expect, it } from 'vitest';
import type { ReloadFile } from '../store';
import { reloadOnStale } from './useReloadResume';

const STALE = new TypeError('Failed to fetch dynamically imported module: https://x/assets/index-abc.js');
const file = new File([new Uint8Array([1, 2, 3])], '顧客.csv', { type: 'text/csv' });

function spy(stashOk = true) {
  const st = { stashed: [] as ReloadFile[], reloads: 0 };
  const deps = {
    stash: (f: ReloadFile) => {
      st.stashed.push(f);
      return stashOk;
    },
    reload: () => {
      st.reloads++;
    },
  };
  return { st, deps };
}

describe('reloadOnStale（古い版の部品で読めなかったときの読み直し）', () => {
  it('古い版の失敗なら、ファイルと選びを控えて1回読み直す', async () => {
    const { st, deps } = spy();
    expect(await reloadOnStale(STALE, { target: 'roster-client', file, option: 'replace', resumed: false }, deps)).toBe(
      true,
    );
    expect(st.reloads).toBe(1);
    expect(st.stashed[0]).toMatchObject({
      target: 'roster-client',
      option: 'replace',
      name: '顧客.csv',
      type: 'text/csv',
    });
    expect(Array.from(st.stashed[0]!.bytes)).toEqual([1, 2, 3]);
  });
  it('読み直したあとの続き（2回目）・ほかの誤り・控えられないときは読み直さない', async () => {
    for (const [e, resumed, ok] of [
      [STALE, true, true],
      [new Error('列がありません'), false, true],
      [STALE, false, false],
    ] as const) {
      const { st, deps } = spy(ok);
      expect(await reloadOnStale(e, { target: 'workbook', file, resumed }, deps)).toBe(false);
      expect(st.reloads).toBe(0);
    }
  });
});

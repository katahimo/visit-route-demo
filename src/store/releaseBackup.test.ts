// 更新前の控え（PRD D483〜D485。ADR-0122）：まだ見ていない更新があるとき、開いた時点のデータを1世代の控えに残す
import { beforeEach, describe, expect, it } from 'vitest';
import { type DemoData, STORAGE_KEY } from '../contracts/data';
import { LATEST_RELEASE } from '../lib/releaseNotes';
import { createDemoData } from '../seed';
import {
  exportPrevious,
  FEATURES_START_ALL,
  FEATURES_START_KEY,
  isReleaseBackup,
  keepBeforeRelease,
  keepPrevious,
  loadWithStatus,
  PREV_INFO_KEY,
  PREV_KEY,
  previousInfo,
  RELEASE_BACKUP_REASON,
  readPrevious,
  swapPrevious,
} from './index';
import { SEEN_RELEASE_KEY } from './start';

/** 環境は node なので localStorage の簡単なモック。quota の間は PREV_KEY を書けない（容量超過） */
function mockStorage(quota: { prev: boolean }) {
  const m = new Map<string, string>();
  const ls = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (quota.prev && k === PREV_KEY) throw new DOMException('full', 'QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
  return m;
}

let mem: Map<string, string>;
const quota = { prev: false };
beforeEach(() => {
  quota.prev = false;
  mem = mockStorage(quota);
});

const saved = (seed = 1) => {
  const d = { ...createDemoData('2026-10-12'), seed };
  mem.set(STORAGE_KEY, JSON.stringify(d));
  return d;
};

describe('開いたときに更新前の控えを残す（PRD D483）', () => {
  it('まだ見ていない更新があれば、開いた時点のデータを更新の id と時刻つきで控える', () => {
    saved(7);
    const r = loadWithStatus();
    expect(r.releaseNotes.length).toBeGreaterThan(0);
    expect(r.releaseBackup).toMatchObject({ kept: true, release: LATEST_RELEASE });
    const info = previousInfo();
    expect(info?.release).toBe(LATEST_RELEASE);
    expect(info?.reason).toBe(RELEASE_BACKUP_REASON);
    expect((readPrevious() as DemoData).seed).toBe(7);
    expect(isReleaseBackup(LATEST_RELEASE)).toBe(true);
  });
  it('見たことのある版・印「all」・初めて開いたときは控えない', () => {
    saved();
    mem.set(SEEN_RELEASE_KEY, LATEST_RELEASE);
    expect(loadWithStatus().releaseBackup).toBeNull();
    mem.delete(SEEN_RELEASE_KEY);
    mem.set(FEATURES_START_KEY, FEATURES_START_ALL);
    expect(loadWithStatus().releaseBackup).toBeNull();
    mem.delete(FEATURES_START_KEY);
    mem.delete(STORAGE_KEY);
    expect(loadWithStatus().releaseBackup).toBeNull();
    expect(mem.has(PREV_KEY)).toBe(false);
  });
  it('読み直しても同じ更新の控えは時刻を変えない（最初に残したもの）', () => {
    saved();
    const a = keepBeforeRelease(createDemoData('2026-10-12'), LATEST_RELEASE, 1000);
    const b = keepBeforeRelease(createDemoData('2026-10-12'), LATEST_RELEASE, 2000);
    expect(a).toEqual({ kept: true, at: 1000, release: LATEST_RELEASE });
    expect(b).toEqual({ kept: true, at: 1000, release: LATEST_RELEASE });
  });
  it('前の更新の控えや別の操作の控えは上書きする（1世代）', () => {
    keepPrevious(createDemoData('2026-10-12'), '初期状態に戻す', 500);
    const r = keepBeforeRelease({ ...createDemoData('2026-10-12'), seed: 9 }, '2099-01-01', 1000);
    expect(r).toEqual({ kept: true, at: 1000, release: '2099-01-01' });
    expect(previousInfo()).toEqual({ at: 1000, reason: RELEASE_BACKUP_REASON, release: '2099-01-01' });
  });
  it('容量が足りなければ残せなかった理由を返し、今のデータには触らない', () => {
    const d = saved(3);
    const before = mem.get(STORAGE_KEY);
    quota.prev = true;
    const r = loadWithStatus();
    expect(r.releaseBackup).toEqual({ kept: false, why: '控えを残せません：容量不足' });
    expect(mem.get(STORAGE_KEY)).toBe(before);
    expect(r.data.seed).toBe(d.seed);
    expect(mem.has(PREV_INFO_KEY)).toBe(false);
  });
});

describe('更新前の控えに戻す・書き出す（PRD D485）', () => {
  it('戻すと今のデータが控えに回る（もう一度戻せる。更新の印は外れる）', () => {
    keepBeforeRelease({ ...createDemoData('2026-10-12'), seed: 1 }, LATEST_RELEASE, 1000);
    const r = swapPrevious({ ...createDemoData('2026-10-12'), seed: 2 }, 2000);
    expect('data' in r && r.data.seed).toBe(1);
    expect((readPrevious() as DemoData).seed).toBe(2);
    expect(previousInfo()?.release).toBeUndefined();
  });
  it('控えを JSON のファイルにできる（無ければ null）', async () => {
    expect(exportPrevious()).toBeNull();
    keepBeforeRelease({ ...createDemoData('2026-10-12'), seed: 5 }, LATEST_RELEASE, 1000);
    const b = exportPrevious();
    expect(b).toBeInstanceOf(Blob);
    expect(JSON.parse(await (b as Blob).text()).seed).toBe(5);
  });
});

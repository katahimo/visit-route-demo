// 更新前の控え（PRD D483〜D485・D488。ADR-0122）：まだ見ていない更新があるとき、開いた時点のデータ（読んだ元の文字）を
// 1世代の控えとは別のキーに残す。1世代の控え（初期状態に戻す・読み込み・最初の設定をやり直すの前）には触らない
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type DemoData, STORAGE_KEY } from '../contracts/data';
import { LATEST_RELEASE } from '../lib/releaseNotes';
import { createDemoData } from '../seed';
import {
  exportReleasePrevious,
  FEATURES_START_ALL,
  FEATURES_START_KEY,
  flushSave,
  keepBeforeRelease,
  keepPrevious,
  loadWithStatus,
  PREV_INFO_KEY,
  PREV_KEY,
  previousInfo,
  RELEASE_PREV_INFO_KEY,
  RELEASE_PREV_KEY,
  RELEASE_RESTORE_REASON,
  readPrevious,
  releaseBackupHolds,
  releasePreviousInfo,
  restoreReleasePrevious,
  save,
} from './index';
import { SEEN_RELEASE_KEY } from './start';

/** 環境は node なので localStorage の簡単なモック。full(key, value) が true の書き込みは容量超過にする */
function mockStorage(full: { at: (k: string, v: string) => boolean }) {
  const m = new Map<string, string>();
  const ls = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (full.at(k, v)) throw new DOMException('full', 'QuotaExceededError');
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
const full = { at: (_k: string, _v: string) => false };
beforeEach(() => {
  full.at = () => false;
  mem = mockStorage(full);
});

const demo = (seed: number): DemoData => ({ ...createDemoData('2026-10-12'), seed });
const saved = (seed = 1) => {
  const d = demo(seed);
  mem.set(STORAGE_KEY, JSON.stringify(d));
  return d;
};
const seedOf = (text: string | undefined) => (JSON.parse(text ?? '{}') as DemoData).seed;

describe('開いたときに更新前の控えを残す（PRD D483）', () => {
  it('まだ見ていない更新があれば、開いた時点のデータを更新の id と時刻つきで別のキーに控える', () => {
    saved(7);
    const r = loadWithStatus();
    expect(r.releaseNotes.length).toBeGreaterThan(0);
    expect(r.releaseBackup).toMatchObject({ kept: true, release: LATEST_RELEASE });
    expect(releasePreviousInfo()?.release).toBe(LATEST_RELEASE);
    expect(seedOf(mem.get(RELEASE_PREV_KEY))).toBe(7);
    // 1世代の控えは作らない
    expect(mem.has(PREV_KEY)).toBe(false);
  });

  it('前からある1世代の控え（うっかり初期状態に戻す前の本物のデータ）を、開いただけで上書きしない', () => {
    keepPrevious(demo(42), '初期状態に戻す', 500);
    saved(7);
    loadWithStatus();
    expect((readPrevious() as DemoData).seed).toBe(42);
    expect(previousInfo()).toEqual({ at: 500, reason: '初期状態に戻す' });
    expect(seedOf(mem.get(RELEASE_PREV_KEY))).toBe(7);
  });

  it('控えは読んだ元の文字のまま（migrate・repair を通す前）', () => {
    const text = `${JSON.stringify(demo(3))}\n`;
    mem.set(STORAGE_KEY, text);
    loadWithStatus();
    expect(mem.get(RELEASE_PREV_KEY)).toBe(text);
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
    expect(mem.has(RELEASE_PREV_KEY)).toBe(false);
  });

  it('読み直しても同じ更新の控えは時刻を変えない（最初に残したもの）', () => {
    const a = keepBeforeRelease(JSON.stringify(demo(1)), LATEST_RELEASE, 1000);
    const b = keepBeforeRelease(JSON.stringify(demo(2)), LATEST_RELEASE, 2000);
    expect(a).toEqual({ kept: true, at: 1000, release: LATEST_RELEASE });
    expect(b).toEqual({ kept: true, at: 1000, release: LATEST_RELEASE });
    expect(seedOf(mem.get(RELEASE_PREV_KEY))).toBe(1);
  });

  it('前の更新の控えは、次の更新の控えで置き換える（1世代の控えには触らない）', () => {
    keepPrevious(demo(42), '初期状態に戻す', 500);
    keepBeforeRelease(JSON.stringify(demo(8)), '2000-01-01', 800);
    const r = keepBeforeRelease(JSON.stringify(demo(9)), '2099-01-01', 1000);
    expect(r).toEqual({ kept: true, at: 1000, release: '2099-01-01' });
    expect(releasePreviousInfo()).toEqual({ at: 1000, release: '2099-01-01' });
    expect(previousInfo()).toEqual({ at: 500, reason: '初期状態に戻す' });
  });
});

describe('容量が足りないとき（PRD D488）', () => {
  it('更新前の控えを書けなければ理由を返し、今のデータ・1世代の控え・古い更新前の控えには触らない', () => {
    keepPrevious(demo(42), '初期状態に戻す', 500);
    keepBeforeRelease(JSON.stringify(demo(8)), '2000-01-01', 800);
    const d = saved(3);
    const before = new Map(mem);
    // 新しい控え（seed 3）だけが入らない（古い控えを捨てても足りない）
    full.at = (k, v) => k === RELEASE_PREV_KEY && seedOf(v) === 3;
    const r = loadWithStatus();
    expect(r.releaseBackup).toEqual({ kept: false, why: '控えを残せません：容量不足' });
    expect(r.data.seed).toBe(d.seed);
    expect(mem.get(STORAGE_KEY)).toBe(before.get(STORAGE_KEY));
    expect(mem.get(PREV_KEY)).toBe(before.get(PREV_KEY));
    expect(mem.get(PREV_INFO_KEY)).toBe(before.get(PREV_INFO_KEY));
    expect(mem.get(RELEASE_PREV_KEY)).toBe(before.get(RELEASE_PREV_KEY));
    expect(mem.get(RELEASE_PREV_INFO_KEY)).toBe(before.get(RELEASE_PREV_INFO_KEY));
  });

  it('古い更新前の控えが場所を取っているときは、それを捨てて1回だけ試し直す', () => {
    keepPrevious(demo(42), '初期状態に戻す', 500);
    keepBeforeRelease(JSON.stringify(demo(8)), '2000-01-01', 800);
    full.at = (k) => k === RELEASE_PREV_KEY && mem.has(RELEASE_PREV_KEY);
    expect(keepBeforeRelease(JSON.stringify(demo(9)), LATEST_RELEASE, 1000)).toMatchObject({ kept: true });
    expect(seedOf(mem.get(RELEASE_PREV_KEY))).toBe(9);
    expect((readPrevious() as DemoData).seed).toBe(42);
  });

  it('1世代の控えを書けないときは、前の世代を戻して返す（cancel を呼ばなくても消えない）', () => {
    keepPrevious(demo(42), '初期状態に戻す', 500);
    // 新しい控え（seed 3）だけが入らない
    full.at = (k, v) => k === PREV_KEY && seedOf(v) === 3;
    const k = keepPrevious(demo(3), '控えの読み込み', 900);
    expect(k.kept).toBe(false);
    expect(k.why).toBe('控えを残せません：容量不足');
    expect((readPrevious() as DemoData).seed).toBe(42);
    expect(previousInfo()).toEqual({ at: 500, reason: '初期状態に戻す' });
  });

  it('本体の保存が容量超過なら、1世代の控え → 更新前の控えの順に捨てて書く（いまのデータが先）', () => {
    keepPrevious(demo(42), '初期状態に戻す', 500);
    keepBeforeRelease(JSON.stringify(demo(8)), LATEST_RELEASE, 800);
    full.at = (k) => k === STORAGE_KEY && (mem.has(PREV_KEY) || mem.has(RELEASE_PREV_KEY));
    const onError = vi.fn();
    save(demo(5), onError);
    flushSave();
    expect(onError).toHaveBeenCalledWith(null, true, true);
    expect(seedOf(mem.get(STORAGE_KEY))).toBe(5);
  });
});

describe('更新前の控えに戻す・書き出す（PRD D485）', () => {
  it('戻すと今のデータが1世代の控えに回り、更新前の控えは残る', () => {
    keepBeforeRelease(JSON.stringify(demo(1)), LATEST_RELEASE, 1000);
    const r = restoreReleasePrevious(demo(2), 2000);
    expect('data' in r && r.data.seed).toBe(1);
    expect((readPrevious() as DemoData).seed).toBe(2);
    expect(previousInfo()).toEqual({ at: 2000, reason: RELEASE_RESTORE_REASON });
    expect(releasePreviousInfo()).toEqual({ at: 1000, release: LATEST_RELEASE });
  });

  it('今のデータを1世代の控えに残せなければ戻さない（1世代の控えも元のまま）', () => {
    keepPrevious(demo(42), '初期状態に戻す', 500);
    keepBeforeRelease(JSON.stringify(demo(1)), LATEST_RELEASE, 1000);
    full.at = (k, v) => k === PREV_KEY && seedOf(v) === 2;
    const r = restoreReleasePrevious(demo(2), 2000);
    expect('error' in r).toBe(true);
    expect((readPrevious() as DemoData).seed).toBe(42);
  });

  it('戻すときは今の読み込みと同じく migrate・repair を通る（読めなければ戻さない）', () => {
    mem.set(RELEASE_PREV_KEY, '{"version":1}');
    mem.set(RELEASE_PREV_INFO_KEY, JSON.stringify({ at: 1000, release: LATEST_RELEASE }));
    const r = restoreReleasePrevious(demo(2), 2000);
    expect('error' in r).toBe(true);
    expect(mem.has(PREV_KEY)).toBe(false);
  });

  it('控えを元の文字のままファイルにできる（無ければ null）', async () => {
    expect(exportReleasePrevious()).toBeNull();
    const text = JSON.stringify(demo(5));
    keepBeforeRelease(text, LATEST_RELEASE, 1000);
    const b = exportReleasePrevious();
    expect(b).toBeInstanceOf(Blob);
    expect(await (b as Blob).text()).toBe(text);
  });
});

describe('更新の画面で作り直すときの控え（startFirstRun）', () => {
  it('今のデータが更新前の控えと同じなら真（1世代の控えに残さない）、違えば偽（別のタブで直した分を残す）', () => {
    saved(7);
    const r = loadWithStatus();
    expect(releaseBackupHolds(r.data)).toBe(true);
    expect(releaseBackupHolds({ ...r.data, seed: 99 })).toBe(false);
    mem.delete(RELEASE_PREV_KEY);
    expect(releaseBackupHolds(r.data)).toBe(false);
  });
});

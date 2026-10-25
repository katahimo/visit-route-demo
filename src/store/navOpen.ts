// メニューの畳める項目の開け閉め（PRD D349）を覚える。この端末に残す（左のメニューと引き出しで1つ）。
// DemoData とは別のキー（データの版・書き出し・読み込み・初期状態に戻すに入れない）。
// localStorage を触るのは store の中だけ（AGENTS.md）。使えないブラウザでも、開いている間は覚える

/** localStorage のキー（DemoData の STORAGE_KEY とは別） */
export const NAV_OPEN_KEY = 'visit-route-demo:nav-open';

type KeyStore = Pick<Storage, 'getItem' | 'setItem'>;
/** 項目のキー → 開いているか */
export type NavOpen = Record<string, boolean>;

/**
 * 覚える先を差し替えられる形（テスト用）。getStorage が null や例外なら、開いている間だけ覚える。
 * read は同じ文字なら同じ物を返す（useSyncExternalStore で描き直さない）
 */
export function createNavOpenMemory(getStorage: () => KeyStore | null) {
  const listeners = new Set<() => void>();
  /** 覚えた開け閉め（読めなければ空） */
  let cache: { raw: string | null; value: NavOpen } = { raw: null, value: {} };
  const read = (): NavOpen => {
    let raw: string | null = null;
    try {
      raw = getStorage()?.getItem(NAV_OPEN_KEY) ?? null;
    } catch {
      return cache.value;
    }
    if (raw === cache.raw) return cache.value;
    let value: NavOpen = {};
    try {
      const v = JSON.parse(raw ?? '{}');
      if (v && typeof v === 'object') value = v;
    } catch {
      // 読めなければ既定
    }
    cache = { raw, value };
    return value;
  };
  return {
    read,
    /** 今覚えている値（読み直さない。useSyncExternalStore のサーバー側の値） */
    cached: (): NavOpen => cache.value,
    /** 項目の開け閉めを覚えて、読む側に知らせる */
    write(key: string, open: boolean): void {
      const next = { ...read(), [key]: open };
      try {
        const s = getStorage();
        if (!s) throw new Error('no storage');
        s.setItem(NAV_OPEN_KEY, JSON.stringify(next));
      } catch {
        cache = { raw: cache.raw, value: next };
      }
      for (const fn of listeners) fn();
    },
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

/** 画面全体で1つ（このブラウザの localStorage） */
export const navOpenMemory = createNavOpenMemory(() => globalThis.localStorage ?? null);

// 最後に AI で組んだときの基本情報の鍵（ADR-0067。lib/arrangeBasis の basisKey）を覚える。
// DemoData とは別のキー（データの版・書き出し・読み込み・初期状態に戻すに入れない）。値は短い鍵だけで、個人の情報は持たない。
// localStorage を触るのは store の中だけ（AGENTS.md）。使えないブラウザでも、開いている間は覚える

/** localStorage のキー（DemoData の STORAGE_KEY とは別） */
export const ARRANGE_BASIS_KEY = 'vrdemo:arrange:basis';

type KeyStore = Pick<Storage, 'getItem' | 'setItem'>;

/** 覚える先を差し替えられる形（テスト用）。getStorage が null や例外なら、開いている間だけ覚える */
export function createArrangeBasisMemory(getStorage: () => KeyStore | null) {
  let here: string | null = null;
  const listeners = new Set<() => void>();
  const store = (): KeyStore | null => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  };
  return {
    /** 最後に組んだときの鍵（まだ組んでいなければ null） */
    get(): string | null {
      if (here !== null) return here;
      try {
        return store()?.getItem(ARRANGE_BASIS_KEY) ?? null;
      } catch {
        return null;
      }
    },
    /** 組んだときの鍵を覚える */
    save(key: string): void {
      here = key;
      for (const fn of listeners) fn();
      try {
        store()?.setItem(ARRANGE_BASIS_KEY, key);
      } catch {
        // 保存できなくても、開いている間は覚える
      }
    },
    /** 覚え直したら知らせる（画面が読み直すため。戻り値は取り消し） */
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

/** 画面全体で1つ（このブラウザの localStorage） */
export const arrangeBasisMemory = createArrangeBasisMemory(() => globalThis.localStorage ?? null);

// 画面への意見の置き場所（PRD D449。ADR-0114）。画像が大きいので localStorage ではなく IndexedDB に置く。
// DemoData とは別（データの版・控え・初期状態に戻すに入れない。backup.ts と同じ扱い）。領域（?space=）ごとに別の DB。
// IndexedDB が使えないブラウザでは、開いている間だけ覚える（volatile が true）
import type { FeedbackItem } from '../contracts/feedback';
import { currentSpace } from './storageSpace';

const STORE = 'items';

const isItem = (x: unknown): x is FeedbackItem => {
  const v = x as Partial<FeedbackItem> | null;
  return (
    !!v &&
    typeof v.id === 'string' &&
    typeof v.at === 'number' &&
    typeof v.comment === 'string' &&
    (v.image === null || typeof v.image === 'string')
  );
};

const done = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB'));
  });

/** 書き込みはトランザクションの確定で終わる（put が成功しても、確定の時点で容量不足などで取り消されることがある） */
const committed = (t: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onabort = () => reject(t.error ?? new Error('IndexedDB の書き込みが取り消されました'));
    t.onerror = () => reject(t.error ?? new Error('IndexedDB'));
  });

function openDb(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  const req = factory.open(name, 1);
  req.onupgradeneeded = () => {
    if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
  };
  return done(req);
}

/** 置き場所を差し替えられる形（テスト用）。getFactory が null・例外・開けないなら、開いている間だけ覚える */
export function createFeedbackStore(getFactory: () => IDBFactory | null, dbName: string) {
  const memory = new Map<string, FeedbackItem>();
  let volatile = false;
  let count = 0;
  let db: Promise<IDBDatabase | null> | null = null;
  const listeners = new Set<() => void>();
  const open = (): Promise<IDBDatabase | null> => {
    db ??= (async () => {
      try {
        const f = getFactory();
        if (f) return await openDb(f, dbName);
      } catch {
        // 下で開いている間だけ覚える
      }
      volatile = true;
      return null;
    })();
    return db;
  };
  /** 読む（IndexedDB が使えなければ null） */
  const read = async <T>(run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> => {
    const d = await open();
    return d ? done(run(d.transaction(STORE, 'readonly').objectStore(STORE))) : null;
  };
  /** 1つのトランザクションで書き、確定を待つ（IndexedDB が使えなければ偽） */
  const write = async (run: (s: IDBObjectStore) => void): Promise<boolean> => {
    const d = await open();
    if (!d) return false;
    const t = d.transaction(STORE, 'readwrite');
    run(t.objectStore(STORE));
    await committed(t);
    return true;
  };
  const setCount = (n: number) => {
    if (n === count) return;
    count = n;
    for (const fn of listeners) fn();
  };
  const list = async (): Promise<FeedbackItem[]> => {
    const all = (await read((s) => s.getAll())) ?? [...memory.values()];
    const items = all.filter(isItem).sort((a, b) => a.at - b.at);
    setCount(items.length);
    return items;
  };
  /** 件数だけ読み直す（画像は読まない） */
  const refresh = async (): Promise<number> => {
    const n = (await read((s) => s.count())) ?? memory.size;
    setCount(n);
    return n;
  };
  return {
    /** 残したご意見（古い順） */
    list,
    /** 件数を読み直す（開いたとき） */
    refresh,
    /** 1件残す（置けなければ例外。確定の時点の容量不足も含む） */
    async add(item: FeedbackItem): Promise<void> {
      if (!(await write((s) => s.put(item)))) memory.set(item.id, item);
      await refresh();
    },
    /** 選んだご意見を消す（1つのトランザクションで） */
    async remove(ids: readonly string[]): Promise<void> {
      const stored = await write((s) => {
        for (const id of ids) s.delete(id);
      });
      if (!stored) for (const id of ids) memory.delete(id);
      await refresh();
    },
    /** 件数（最後に読んだとき。変わったら subscribe の関数を呼ぶ） */
    count: (): number => count,
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** 開いている間しか覚えられないか（IndexedDB が使えない） */
    volatile: (): boolean => volatile,
  };
}

/** 画面全体で1つ（このブラウザの IndexedDB） */
export const feedbackStore = createFeedbackStore(
  () => (typeof indexedDB === 'undefined' ? null : indexedDB),
  currentSpace === null ? 'vrdemo-feedback' : `vrdemo-feedback-${currentSpace}`,
);

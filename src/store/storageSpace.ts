// 保存領域の分け方（ADR-0112）。説明用のスライドが iframe で `?space=slides` 付きでアプリを開くとき、
// 普段のデータ（localStorage・sessionStorage）を壊さないよう、キーに接頭辞を付けて別の領域として読み書きする。
// location.search は起動時に1度だけ読む。localStorage・sessionStorage を直接触らず、ここの appLocalStorage・appSessionStorage を使う

/** キーの接頭辞の共通の頭（普段のアプリは、この頭のキーを持たない） */
export const SPACE_PREFIX_HEAD = 'vrdemo:space:';

/** URL のクエリ（`?space=slides` など）から領域の名前を取る。英小文字・数字・ハイフンだけ許し、他は null */
export function spaceOf(search: string): string | null {
  const v = new URLSearchParams(search).get('space');
  return v !== null && /^[a-z0-9-]+$/.test(v) ? v : null;
}

/** 領域のキーの接頭辞 */
export function prefixOf(space: string): string {
  return `${SPACE_PREFIX_HEAD}${space}:`;
}

/** 接頭辞のキーだけを見せる Storage の包み（ほかのキーは読まず・書かず・消さない） */
function prefixed(base: Storage, prefix: string): Storage {
  const mine = (): string[] => {
    const keys: string[] = [];
    for (let i = 0; i < base.length; i++) {
      const k = base.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    return keys;
  };
  return {
    get length() {
      return mine().length;
    },
    key: (index) => mine()[index]?.slice(prefix.length) ?? null,
    getItem: (key) => base.getItem(prefix + key),
    setItem: (key, value) => base.setItem(prefix + key, value),
    removeItem: (key) => base.removeItem(prefix + key),
    clear: () => {
      for (const k of mine()) base.removeItem(k);
    },
  };
}

const readSearch = (): string => {
  try {
    return globalThis.location?.search ?? '';
  } catch {
    return '';
  }
};

/** 今の領域（起動時に1度だけ決める。null なら普段の領域） */
export const currentSpace: string | null = spaceOf(readSearch());

/** 領域のキーの接頭辞（普段の領域は null） */
export const currentPrefix: string | null = currentSpace === null ? null : prefixOf(currentSpace);

function resolve(pick: () => Storage | undefined): Storage | null {
  try {
    const base = pick();
    if (!base) return null;
    return currentPrefix === null ? base : prefixed(base, currentPrefix);
  } catch {
    return null;
  }
}

/** アプリの localStorage（領域があれば接頭辞付きの包み。使えない環境では null） */
export function appLocalStorage(): Storage | null {
  return resolve(() => globalThis.localStorage);
}

/** アプリの sessionStorage（領域があれば接頭辞付きの包み。使えない環境では null） */
export function appSessionStorage(): Storage | null {
  return resolve(() => globalThis.sessionStorage);
}

/** storage イベントのキーが、今の領域のものか（領域のときは接頭辞付きだけ、普段は接頭辞付きを無視）。キーが無い（clear）は false */
export function isOwnStorageKey(key: string | null): boolean {
  if (key === null) return false;
  return currentPrefix === null ? !key.startsWith(SPACE_PREFIX_HEAD) : key.startsWith(currentPrefix);
}

/** storage イベントのキーから接頭辞を外す（領域のとき）。普段はそのまま */
export function ownKeyOf(key: string): string {
  return currentPrefix !== null && key.startsWith(currentPrefix) ? key.slice(currentPrefix.length) : key;
}

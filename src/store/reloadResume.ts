// 読み直しをまたいで、選んだファイルを1つだけ控える（sessionStorage。タブを閉じれば消える）。
// 画面を開いたあとに新しい版が公開され、Excel の部品を読めなかったとき、画面が自動で読み直してから同じファイルで読み込みを続けるために使う。
// 控えは読み直した先の画面が1回だけ取り出す（取り出したら消す）。DemoData とは別。データの版・書き出し・初期状態に戻すに入れない
import { appSessionStorage } from './storageSpace';

/** 控えのキー */
export const RELOAD_FILE_KEY = 'vrdemo:reload:file';

/**
 * 控えの期限（ミリ秒）。読み直した直後に同じ欄が開かなかったとき（引き出しが閉じた・別の画面へ移った）に、
 * あとで開いた欄が古いファイルを勝手に読み始めないよう、期限を過ぎた控えは捨てる
 */
export const RELOAD_FILE_TTL_MS = 60_000;

/** 控えるファイルの大きさの上限（base64 にすると約 4/3 倍。sessionStorage の 5MB に収める） */
export const RELOAD_FILE_MAX_BYTES = 2_000_000;

/** 控えたファイル */
export interface ReloadFile {
  /** 読み込む欄（例：'roster-client'）。読み直した先で、この欄だけが取り出す */
  target: string;
  /** 欄ごとの選び（例：名簿の読み込み方）。無ければ空 */
  option: string;
  name: string;
  type: string;
  bytes: Uint8Array<ArrayBuffer>;
}

type FileStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const sessionStore = (): FileStore | null => appSessionStorage();

/** バイト列 → base64（大きい配列でも引数の数の上限に当たらないよう、区切って文字にする） */
function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** ファイルを控える。大きすぎる・書けなければ false（控えは残さない） */
export function stashReloadFile(
  f: ReloadFile,
  getStorage: () => FileStore | null = sessionStore,
  now: number = Date.now(),
): boolean {
  if (f.bytes.length > RELOAD_FILE_MAX_BYTES) return false;
  try {
    const store = getStorage();
    if (!store) return false;
    const { bytes, ...rest } = f;
    store.setItem(RELOAD_FILE_KEY, JSON.stringify({ ...rest, at: now, b64: toBase64(bytes) }));
    return true;
  } catch {
    try {
      getStorage()?.removeItem(RELOAD_FILE_KEY);
    } catch {
      // 消せなくても続ける
    }
    return false;
  }
}

/**
 * target の欄の控えを取り出して消す（無い・ほかの欄の控え・期限切れ・壊れていれば null）。
 * ほかの欄の控えは期限内なら残し、期限切れ・壊れた控えは消す
 */
export function takeReloadFile(
  target: string,
  getStorage: () => FileStore | null = sessionStore,
  now: number = Date.now(),
): Omit<ReloadFile, 'target'> | null {
  try {
    const store = getStorage();
    const raw = store?.getItem(RELOAD_FILE_KEY);
    if (!store || !raw) return null;
    let v: Partial<Record<'target' | 'option' | 'name' | 'type' | 'b64' | 'at', unknown>>;
    try {
      v = JSON.parse(raw);
    } catch {
      store.removeItem(RELOAD_FILE_KEY);
      return null;
    }
    const fresh = typeof v.at === 'number' && now - v.at >= 0 && now - v.at <= RELOAD_FILE_TTL_MS;
    if (!fresh) {
      store.removeItem(RELOAD_FILE_KEY);
      return null;
    }
    if (v.target !== target) return null;
    store.removeItem(RELOAD_FILE_KEY);
    if (typeof v.name !== 'string' || typeof v.b64 !== 'string') return null;
    return {
      option: typeof v.option === 'string' ? v.option : '',
      name: v.name,
      type: typeof v.type === 'string' ? v.type : '',
      bytes: fromBase64(v.b64),
    };
  } catch {
    return null;
  }
}

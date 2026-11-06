// 初めて開いたとき（保存データが無い）に最初の2問を出さず、今までの初期データ＋すべて入で始める印（PRD D379。ADR-0045・ADR-0073）。
// DemoData とは別のキーに「all」と書いてあれば、2問を出さず、すべて入（{}）の今の初期データで始める
// （e2e の共通の部品 scripts/lib/startFeatures.cjs と、全機能を見せたいデモの前準備のため。値は印だけで個人の情報は持たない）。
// localStorage を触るのは store の中だけ（AGENTS.md）。読めなければ印なし（2問を出す）
// デモを作った直後に要対応を組む印（PRD D409。要対応の帯の［要対応を組む］と同じ依頼）もここに置く（sessionStorage。読み直しをまたいで、組み終える前に消さない）

import type { FirstRunBooking, FirstRunStart } from '../lib/firstRun';
import { compareRelease } from '../lib/releaseNotes';

/** localStorage のキー（DemoData の STORAGE_KEY とは別。データの版・書き出し・初期状態に戻すに入れない） */
export const FEATURES_START_KEY = 'vrdemo:features:start';
/** 「2問を出さず、すべて入で始める」の印 */
export const FEATURES_START_ALL = 'all';

type KeyStore = Pick<Storage, 'getItem'>;

/** 印「all」があるか（あれば初めて開いたときに2問を出さず、今の初期データ＋すべて入で始める） */
export function startsWithAll(getStorage: () => KeyStore | null = () => globalThis.localStorage ?? null): boolean {
  try {
    return getStorage()?.getItem(FEATURES_START_KEY) === FEATURES_START_ALL;
  } catch {
    return false;
  }
}

/** 最後の問2の答え（単発／定期）の印のキー（DemoData とは別。初期状態に戻すが「デモ×その答え」で作り直すための印。個人の情報は持たない） */
export const LAST_BOOKING_KEY = 'vrdemo:booking:last';

type BookingStore = Pick<Storage, 'getItem' | 'setItem'>;
const BOOKINGS = ['oneOff', 'regular'] as const;

/** 最後の問2の答えを残す（書けなくても続ける） */
export function rememberBooking(
  booking: FirstRunBooking,
  getStorage: () => BookingStore | null = () => globalThis.localStorage ?? null,
): void {
  try {
    getStorage()?.setItem(LAST_BOOKING_KEY, booking);
  } catch {
    // 書けなくても続ける（印が無ければ定期）
  }
}

/** 最後の問2の答え。印が無い・読めない・知らない値なら null（呼ぶ側は定期として扱う） */
export function lastBooking(
  getStorage: () => KeyStore | null = () => globalThis.localStorage ?? null,
): FirstRunBooking | null {
  try {
    const v = getStorage()?.getItem(LAST_BOOKING_KEY);
    return BOOKINGS.find((b) => b === v) ?? null;
  } catch {
    return null;
  }
}

/** デモを作った操作：最初の2問の「はじめる」（やり直しも）・例外の画面の初期状態に戻す */
export type DemoStart = { kind: 'answer'; start: FirstRunStart } | { kind: 'reset' };

/**
 * デモを作った直後に、今日〜翌月末の要対応（担当なし・間に合わない・重なり・休みの人）を1回自動で組むか（PRD D409。ADR-0079）。
 * 「デモで試す」で始めたとき・初期状態に戻したときだけ組む。「自分のデータで始める」と、印「all」があるときは組まない
 */
export function arrangesAfterStart(s: DemoStart, all: boolean = startsWithAll()): boolean {
  if (all) return false;
  switch (s.kind) {
    case 'answer':
      return s.start === 'demo';
    case 'reset':
      return true;
    default: {
      const _: never = s;
      return _;
    }
  }
}

/**
 * デモを作った直後に要対応を組む印のキー（sessionStorage。PRD D409。ADR-0079）。
 * 初期状態に戻す（設定・例外の画面のどちらの入口からでも）・最初の2問の「デモで試す」で書き、
 * store の起動時と作り直した直後に読み、組む依頼を出した画面が消す（読み直しをはさんでも1回だけ組む）
 */
export const ARRANGE_PENDING_KEY = 'vrdemo:arrange:pending';

type PendingStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const sessionStore = (): PendingStore | null => globalThis.sessionStorage ?? null;

/** デモを作ったら、組むときだけ組む印を書く（組まないときは消す。書けなくても続ける） */
export function markArrangeAfterStart(
  s: DemoStart,
  all: boolean = startsWithAll(),
  getStorage: () => PendingStore | null = sessionStore,
): void {
  try {
    if (arrangesAfterStart(s, all)) getStorage()?.setItem(ARRANGE_PENDING_KEY, '1');
    else getStorage()?.removeItem(ARRANGE_PENDING_KEY);
  } catch {
    // 書けなければ組まない
  }
}

/** 組む印があるか（読むだけ。消すのは clearArrangePending） */
export function arrangePending(getStorage: () => PendingStore | null = sessionStore): boolean {
  try {
    return getStorage()?.getItem(ARRANGE_PENDING_KEY) === '1';
  } catch {
    return false;
  }
}

/** 組む依頼を出したら印を消す（二度組まない） */
export function clearArrangePending(getStorage: () => PendingStore | null = sessionStore): void {
  try {
    getStorage()?.removeItem(ARRANGE_PENDING_KEY);
  } catch {
    // 消せなくても続ける
  }
}

/**
 * 最後に見たデモの更新の印のキー（PRD D437。ADR-0102。DemoData とは別。データの版・書き出し・初期状態に戻すに入れない。
 * 値は更新の id（lib/releaseNotes）だけで個人の情報は持たない）。最初の2問・更新の知らせに答えたとき・知らせを出さずに開いたときに書く
 */
export const SEEN_RELEASE_KEY = 'vrdemo:release:seen';

/** 最後に見た更新の id。印が無い・読めないなら null */
export function seenRelease(getStorage: () => KeyStore | null = () => globalThis.localStorage ?? null): string | null {
  try {
    return getStorage()?.getItem(SEEN_RELEASE_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * 見た更新の id を残す（書けなくても続ける。書けなければ次に開いたときもう一度知らせる）。
 * 今の印より新しいときだけ書く（古い版を開いたままのタブが、新しい版で見た印を古くしない）
 */
export function rememberRelease(
  id: string,
  getStorage: () => BookingStore | null = () => globalThis.localStorage ?? null,
): void {
  try {
    const s = getStorage();
    const cur = s?.getItem(SEEN_RELEASE_KEY) ?? null;
    if (cur !== null && compareRelease(id, cur) <= 0) return;
    s?.setItem(SEEN_RELEASE_KEY, id);
  } catch {
    // 書けなくても続ける
  }
}

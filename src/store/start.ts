// 初めて開いたとき（保存データが無い）に最初の2問を出さず、今までの初期データ＋すべて入で始める印（PRD D379。ADR-0045・ADR-0073）。
// DemoData とは別のキーに「all」と書いてあれば、2問を出さず、すべて入（{}）の今の初期データで始める
// （e2e の共通の部品 scripts/lib/startFeatures.cjs と、全機能を見せたいデモの前準備のため。値は印だけで個人の情報は持たない）。
// localStorage を触るのは store の中だけ（AGENTS.md）。読めなければ印なし（2問を出す）

import type { FirstRunBooking, FirstRunStart } from '../lib/firstRun';

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

/** デモを作った操作：最初の2問の「はじめる」（やり直しも）・デモの初期状態に戻す */
export type DemoStart = { kind: 'answer'; start: FirstRunStart } | { kind: 'reset' };

/**
 * デモを作った直後に、今日〜翌月末の担当なしを1回自動で組むか（PRD D409。ADR-0079）。
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

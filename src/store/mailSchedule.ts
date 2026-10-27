// メールの予約送信（PRD D366〜D369。ADR-0069）の接続の設定（GAS の URL・合言葉・送る時刻）と、日付ごとに預けた記録を覚える。
// この端末に残す。DemoData とは別のキー（データの版・書き出し・読み込み・初期状態に戻すに入れない。合言葉をファイルに出さない）。
// localStorage を触るのは store の中だけ（AGENTS.md）。使えないブラウザでも、開いている間は覚える
import { EMPTY_SETTINGS, type MailReservation, type MailScheduleSettings } from '../lib/mailSchedule';

/** localStorage のキー（DemoData の STORAGE_KEY とは別） */
export const MAIL_SCHEDULE_KEY = 'visit-route-demo:mail-schedule';

type KeyStore = Pick<Storage, 'getItem' | 'setItem'>;
/** 覚えるもの：設定と、訪問の日 → 預けた記録 */
export type MailScheduleState = { settings: MailScheduleSettings; reservations: Record<string, MailReservation> };

const EMPTY: MailScheduleState = { settings: EMPTY_SETTINGS, reservations: {} };
/** 預けた記録を残す数（古い日から捨てる） */
const KEEP_RESERVATIONS = 60;

const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 読んだ値を形に合わせる（知らない項目・形の違う値は捨てる） */
function parse(raw: string | null): MailScheduleState {
  let v: unknown;
  try {
    v = JSON.parse(raw ?? 'null');
  } catch {
    return EMPTY;
  }
  if (!isObj(v)) return EMPTY;
  const s = isObj(v.settings) ? v.settings : {};
  const settings = {
    url: str(s.url, ''),
    token: str(s.token, ''),
    sendTime: str(s.sendTime, EMPTY_SETTINGS.sendTime),
  };
  const reservations: Record<string, MailReservation> = {};
  if (isObj(v.reservations)) {
    for (const [date, r] of Object.entries(v.reservations)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isObj(r)) continue;
      if (typeof r.sendAt === 'string' && typeof r.count === 'number' && typeof r.at === 'number')
        reservations[date] = { sendAt: r.sendAt, count: r.count, at: r.at };
    }
  }
  return { settings, reservations };
}

/** 預けた記録を新しい日から KEEP_RESERVATIONS 件に絞る */
function trim(rs: Record<string, MailReservation>): Record<string, MailReservation> {
  const dates = Object.keys(rs).sort().reverse().slice(0, KEEP_RESERVATIONS);
  return Object.fromEntries(dates.map((d) => [d, rs[d] as MailReservation]));
}

/**
 * 覚える先を差し替えられる形（テスト用）。getStorage が null や例外なら、開いている間だけ覚える。
 * read は同じ文字なら同じ物を返す（useSyncExternalStore で描き直さない）
 */
export function createMailScheduleMemory(getStorage: () => KeyStore | null) {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: MailScheduleState } = { raw: null, value: EMPTY };
  const read = (): MailScheduleState => {
    let raw: string | null = null;
    try {
      raw = getStorage()?.getItem(MAIL_SCHEDULE_KEY) ?? null;
    } catch {
      return cache.value;
    }
    if (raw === cache.raw) return cache.value;
    cache = { raw, value: parse(raw) };
    return cache.value;
  };
  const write = (next: MailScheduleState) => {
    try {
      const s = getStorage();
      if (!s) throw new Error('no storage');
      s.setItem(MAIL_SCHEDULE_KEY, JSON.stringify(next));
    } catch {
      cache = { raw: cache.raw, value: next };
    }
    for (const fn of listeners) fn();
  };
  return {
    read,
    /** 今覚えている値（読み直さない。useSyncExternalStore のサーバー側の値） */
    cached: (): MailScheduleState => cache.value,
    /** 設定を書く（空の設定を書けば、預けた記録も消す） */
    setSettings(settings: MailScheduleSettings): void {
      const empty = settings.url === '' && settings.token === '';
      write({ settings, reservations: empty ? {} : read().reservations });
    },
    /** 預けた記録を書く（null なら消す） */
    setReservation(date: string, r: MailReservation | null): void {
      const { [date]: _, ...rest } = read().reservations;
      write({ ...read(), reservations: trim(r ? { ...rest, [date]: r } : rest) });
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
export const mailScheduleMemory = createMailScheduleMemory(() => globalThis.localStorage ?? null);

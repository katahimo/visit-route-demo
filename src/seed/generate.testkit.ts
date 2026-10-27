// パターンにする前の訪問の規則（テストで使う。初期の訪問は定期パターンから展開する。ADR-0012。seed/patterns.ts）
import type { Visit } from '../contracts/documents';
import { hhmmToMinutes, minutesToHhmm, weekday } from '../domain/time';
import { dayNumber } from './generate';
import { CLIENT_SEEDS } from './people';

const isWeekend = (date: string) => weekday(date) === 0 || weekday(date) === 6;
const shiftBy = (hhmm: string, min: number) => minutesToHhmm(hhmmToMinutes(hhmm) + min);

/**
 * その日の訪問（同じ日なら毎回同じ）。平日は訪問先から日ごとに3か所前後が休み、土日は印のある訪問先。
 * 時間に幅のある訪問は日ごとに 0〜60分ずらす（いまのデモデータは全員が時刻ちょうどなので、ずらさない）。
 * 初期の訪問は定期パターンから展開する（ADR-0012。seed/patterns.ts）。これはパターンにする前の規則で、
 * 展開した訪問と同じになることをテストで確かめるために残す
 */
export function visitsOf(date: string, clientIds: Set<string>): Visit[] {
  const n = dayNumber(date);
  return CLIENT_SEEDS.map((c, i) => ({ c, i }))
    .filter(({ c }) => clientIds.has(c.id))
    .filter(({ c, i }) => (isWeekend(date) ? c.weekend : (i + n) % 7 !== 0))
    .map(({ c }) => {
      const [kind, e, l, mins] = c.slot;
      const d = kind === 'window' ? (n % 3) * 30 : 0;
      return {
        id: `${date}_${c.id}`,
        date,
        clientId: c.id,
        windowKind: kind,
        earliestStart: shiftBy(e, d),
        latestStart: shiftBy(l, d),
        durationMinutes: mins,
        staffId: null,
        start: null,
        pinned: false,
        cancelled: false,
        note: '',
        typeId: null,
        pattern: null,
        cancelKind: null,
      };
    })
    .sort((a, b) => a.earliestStart.localeCompare(b.earliestStart));
}

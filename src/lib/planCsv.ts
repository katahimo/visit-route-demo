// 予定の CSV（ADR-0090。PRD D423）の画面の決まり：書き出す月・単発の訪問の選び方・ファイル名・ボタンの文。純粋関数
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import { monthDates, ymOf } from './ym';

/** 書き出す月の初日と末日（見ている日の月） */
export function planCsvRange(shown: string): { ym: string; from: string; to: string } {
  const ym = ymOf(shown);
  const days = monthDates(ym);
  return { ym, from: days[0] ?? `${ym}-01`, to: days[days.length - 1] ?? `${ym}-01` };
}

/** from〜to（両端を含む）の単発の訪問（繰り返しの回は除く）。日付・開始・名前の順 */
export function oneOffVisitsIn(data: Pick<DemoData, 'visits' | 'clients'>, from: string, to: string): Visit[] {
  const name = new Map(data.clients.map((c) => [c.id, c.displayName]));
  return data.visits
    .filter((v) => v.pattern === null && v.date >= from && v.date <= to)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.earliestStart.localeCompare(b.earliestStart) ||
        (name.get(a.clientId) ?? '').localeCompare(name.get(b.clientId) ?? '', 'ja'),
    );
}

/** 書き出しのファイル名（staff-assign-demo-visits-2026-11.csv） */
export const planCsvFileName = (ym: string): string => `staff-assign-demo-visits-${ym}.csv`;

/** テンプレートのファイル名 */
export const PLAN_CSV_TEMPLATE_NAME = 'staff-assign-demo-visits-template.csv';

/** 書き出しのボタンの文（「11月の単発の訪問を書き出す（3件）」） */
export const planCsvExportLabel = (ym: string, count: number): string =>
  `${Number(ym.slice(5, 7))}月の単発の訪問を書き出す（${count}件）`;

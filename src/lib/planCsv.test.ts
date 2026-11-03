// 予定の CSV の画面の決まり（ADR-0090）
import { describe, expect, it } from 'vitest';
import { PLAN_CSV_TEMPLATE_NAME, planCsvExportLabel, planCsvFileName, planCsvRange } from './planCsv';

describe('予定の CSV の画面の決まり', () => {
  it('見ている日の月の初日と末日', () => {
    expect(planCsvRange('2026-02-14')).toEqual({ ym: '2026-02', from: '2026-02-01', to: '2026-02-28' });
    expect(planCsvRange('2028-02-01')).toMatchObject({ to: '2028-02-29' });
  });
  it('ファイル名とボタンの文', () => {
    expect(planCsvFileName('2026-11')).toBe('staff-assign-demo-visits-2026-11.csv');
    expect(PLAN_CSV_TEMPLATE_NAME).toBe('staff-assign-demo-visits-template.csv');
    expect(planCsvExportLabel('2026-01', 3)).toBe('1月の単発の訪問を書き出す（3件）');
  });
});

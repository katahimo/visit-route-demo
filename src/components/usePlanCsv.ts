// 予定の CSV（ADR-0090。PRD D423）の欄の状態と処理：テンプレート・見ている月の単発の訪問の書き出しと、読み込み（useBookingImport）。
// 書き出しの部品（excel/visitCsv）は ExcelJS を使わず軽いので、そのまま読み込む。データを書くのは読み込みの store の update だけ
import { useState } from 'react';
import { exportVisitsCsv, visitCsvTemplate } from '../excel/visitCsv';
import { formError } from '../lib/common';
import { saveBlob } from '../lib/download';
import {
  oneOffVisitsIn,
  PLAN_CSV_TEMPLATE_NAME,
  planCsvExportLabel,
  planCsvFileName,
  planCsvRange,
} from '../lib/planCsv';
import { useDemoData } from '../store';
import { useDay } from './day';
import { useToast } from './Toast';
import { useBookingImport } from './useBookingImport';

/** onImported：読み込んで入れたあとに呼ぶ（引き出しを閉じる） */
export function usePlanCsv(onImported: () => void) {
  const { data } = useDemoData();
  const { date: shown } = useDay();
  const toast = useToast();
  const booking = useBookingImport(onImported, 'bookings-plan');
  const [error, setError] = useState<string | null>(null);
  const range = planCsvRange(shown);
  const count = oneOffVisitsIn(data, range.from, range.to).length;

  const save = (make: () => Blob, name: string, done: string) => {
    setError(null);
    try {
      saveBlob(make(), name);
      toast(done);
    } catch (e) {
      setError(`書き出せませんでした（${formError(e)}）`);
    }
  };

  return {
    exportLabel: planCsvExportLabel(range.ym, count),
    count,
    busy: booking.busy,
    error: error ?? booking.error,
    template: () => save(visitCsvTemplate, PLAN_CSV_TEMPLATE_NAME, 'テンプレートを書き出しました'),
    exportMonth: () =>
      save(
        () => exportVisitsCsv(data, range.from, range.to),
        planCsvFileName(range.ym),
        `単発の訪問 ${count}件を書き出しました`,
      ),
    load: (file: File) => {
      setError(null);
      void booking.load(file);
    },
  };
}

// 予定の CSV（ADR-0090。PRD D423）の欄の状態と処理：テンプレート・見ている月の単発の訪問の書き出しと、読み込み（useBookingImport）。
// 書き出しの部品（excel/visitCsv）は ExcelJS を使わず軽いので、そのまま読み込む。データを書くのは読み込みの store の update だけ
import { exportVisitsCsv } from '../excel/visitCsv';
import { oneOffVisitsIn, planCsvExportLabel, planCsvFileName, planCsvRange } from '../lib/planCsv';
import { useDemoData } from '../store';
import { useDay } from './day';
import { useBookingImport } from './useBookingImport';
import { useSaveFile } from './useSaveFile';
import { useVisitCsvTemplate } from './useVisitCsvTemplate';

/** onImported：読み込んで入れたあとに呼ぶ（引き出しを閉じる） */
export function usePlanCsv(onImported: () => void) {
  const { data } = useDemoData();
  const { date: shown } = useDay();
  const booking = useBookingImport(onImported, 'bookings-plan');
  const { save, error, setError } = useSaveFile();
  const tpl = useVisitCsvTemplate();
  const range = planCsvRange(shown);
  const count = oneOffVisitsIn(data, range.from, range.to).length;

  return {
    exportLabel: planCsvExportLabel(range.ym, count),
    count,
    busy: booking.busy,
    error: error ?? tpl.error ?? booking.error,
    template: tpl.template,
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

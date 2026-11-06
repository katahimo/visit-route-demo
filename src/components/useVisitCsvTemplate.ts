// 予定の CSV のテンプレート（列名の行だけ。ADR-0090）をダウンロードする。予約の CSV の欄と「予約を追加」の引き出しで共通
import { visitCsvTemplate } from '../excel/visitCsv';
import { PLAN_CSV_TEMPLATE_NAME } from '../lib/planCsv';
import { useSaveFile } from './useSaveFile';

export function useVisitCsvTemplate() {
  const { save, error } = useSaveFile();
  return {
    template: () => save(visitCsvTemplate, PLAN_CSV_TEMPLATE_NAME, '予定の CSV のテンプレートをダウンロードしました'),
    error,
  };
}

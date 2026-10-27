// データの画面の Excel の欄（ADR-0006。PRD D103）：全体のブック（すべてのシート）の書き出し・読み込み。
// 名簿（〈利用者さん〉・〈スタッフ〉の一覧だけ）は各一覧の名簿の欄（ADR-0068）。ExcelJS は重いので、押したときだけ読み込む
import { useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { jstDate } from '../domain/time';
import { formError, isStaleBuild } from '../lib/common';
import { EXCEL_STALE_TEXT, excelFileName, keepNote, keptSuffix, workbookCountsText } from '../lib/dataScreen';
import { saveBlob } from '../lib/download';
import { canKeepPrevious, type ExportKind, isImportError, useDemoData } from '../store';

export function useDataExcel(x: { markExported: (kind: ExportKind) => void }) {
  const { data, replace, keepPrevious } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setError(null);
    setBusy(true);
    try {
      const { exportWorkbook } = await import('../excel');
      saveBlob(await exportWorkbook(data), excelFileName(jstDate(Date.now())));
      // 全体の Excel も書き出した日に数える
      x.markExported('excel');
      toast('Excel に書き出しました');
    } catch (e) {
      setError(isStaleBuild(e) ? EXCEL_STALE_TEXT : `書き出せませんでした（${formError(e)}）`);
    } finally {
      setBusy(false);
    }
  };

  const load = async (file: File) => {
    setError(null);
    try {
      setBusy(true);
      // 先に読んで検査し、通ったら件数を見せて確かめる（取り消しならデータは変えない）
      const { importWorkbook } = await import('../excel');
      const r = await importWorkbook(await file.arrayBuffer(), data);
      if (isImportError(r)) {
        setError(`読み込めませんでした（いまのデータはそのままです）\n${r.message}`);
        return;
      }
      const ok = await confirmDialog({
        title: `「${file.name}」でデータを置き換えますか？`,
        body: `「${file.name}」の内容（${workbookCountsText(r)}）で、いまのデータをすべて置き換えます。訪問の担当と確定（伝えた内容）も消えます。\n${keepNote(canKeepPrevious())}`,
        confirmLabel: 'すべて置き換える',
        tone: 'danger',
      });
      if (!ok) return;
      // 置き換える前に、いまのデータを1世代だけ控える（確認で OK になってから。PRD D227）
      const keep = keepPrevious('Excel 全体の読み込み');
      replace(r);
      toast(`Excel を読み込みました${keptSuffix(keep)}`);
    } catch (e) {
      setError(
        isStaleBuild(e) ? EXCEL_STALE_TEXT : `読み込めませんでした：${formError(e)}（いまのデータはそのままです）`,
      );
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, download, load };
}

export type DataExcel = ReturnType<typeof useDataExcel>;

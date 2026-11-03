// 名簿の欄（ADR-0068。〈利用者さん〉一覧・〈スタッフ〉一覧）の状態と処理：読み込み方の選び、
// Excel・CSV への書き出しと、Excel のブックか CSV の読み込み。ExcelJS は重いので、押したときだけ読み込む
import { useState } from 'react';
import type { RosterKind, RosterMode, RosterSource } from '../contracts/data';
import { jstDate } from '../domain/time';
import { formError, isStaleBuild } from '../lib/common';
import { EXCEL_STALE_TEXT, rosterFileName, rosterIsEmpty } from '../lib/dataScreen';
import { saveBlob } from '../lib/download';
import { useDemoData } from '../store';
import { useToast } from './Toast';
import { useFeature } from './useFeature';
import { useRosterImport } from './useRosterImport';

/** onPlace は名簿が入ったあと、位置の無い人を自動でまとめて置き始める（PRD D427。郵便番号・住所の検索が切なら undefined） */
export function useRosterCard(kind: RosterKind, onPlace?: () => void) {
  const { data } = useDemoData();
  const toast = useToast();
  const offboardOn = useFeature('offboard');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 名簿の読み込み方（PRD D104）：追加・更新（既定）か総入れ替え */
  const [rosterMode, setRosterMode] = useState<RosterMode>('merge');
  const term = kind === 'staff' ? data.org.terms.staff : data.org.terms.client;
  /** 一覧が0人か（書き出しは列名だけのテンプレートになる。読み込み方は選ばせず追加・更新） */
  const empty = rosterIsEmpty(data, kind);
  // 0人の間は選ばせないので既定に戻す（人が入って選択肢が出たとき、前の総入れ替えが残らないように）
  if (empty && rosterMode !== 'merge') setRosterMode('merge');
  const loadRoster = useRosterImport({ rosterMode: empty ? 'merge' : rosterMode, offboardOn, setError, onPlace });

  /**
   * 名簿を Excel のブックか CSV（BOM 付きの UTF-8）で書き出す。名簿だけの書き出しは「最後に書き出した日」に数えない。
   * 0人なら列名だけのテンプレート（書き足して読み込む）
   */
  const download = async (format: RosterSource['format']) => {
    setError(null);
    setBusy(true);
    try {
      const { exportRosterCsv, exportRosterWorkbook } = await import('../excel');
      const blob = format === 'csv' ? exportRosterCsv(data, kind) : await exportRosterWorkbook(data, kind);
      saveBlob(blob, rosterFileName(kind, format, jstDate(Date.now()), empty));
      const label = format === 'csv' ? 'CSV' : 'Excel';
      toast(
        empty
          ? `${term}の名簿のテンプレート（${label}）をダウンロードしました`
          : `${term}の名簿を ${label} に書き出しました`,
      );
    } catch (e) {
      setError(isStaleBuild(e) ? EXCEL_STALE_TEXT : `書き出せませんでした（${formError(e)}）`);
    } finally {
      setBusy(false);
    }
  };

  /** 先に読んで検査し、通ったら件数を見せて確かめる（取り消しならデータは変えない） */
  const load = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      await loadRoster(file, kind);
    } catch (e) {
      setError(
        isStaleBuild(e) ? EXCEL_STALE_TEXT : `読み込めませんでした：${formError(e)}（いまのデータはそのままです）`,
      );
    } finally {
      setBusy(false);
    }
  };

  return { kind, term, empty, rosterMode, setRosterMode, busy, error, download, load };
}

export type RosterCardModel = ReturnType<typeof useRosterCard>;

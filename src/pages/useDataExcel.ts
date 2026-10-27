// データの画面の Excel の欄（ADR-0006・ADR-0020。PRD D103・D104・D209）：対象（全体・名簿）と読み込み方の選び、
// 書き出し・読み込み、最終勤務日の知らせ。ExcelJS は重いので、押したときだけ読み込む
import { useRef, useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import type { RosterKind, RosterMode } from '../contracts/data';
import { jstDate } from '../domain/time';
import { formError, isStaleBuild } from '../lib/common';
import {
  EXCEL_STALE_TEXT,
  excelFileName,
  keepNote,
  keptSuffix,
  otherOrgOf,
  withoutOrgState,
  workbookConfirmBody,
  workbookCountsText,
} from '../lib/dataScreen';
import { saveBlob } from '../lib/download';
import type { LastDayPerson } from '../lib/personLinks';
import { canKeepPrevious, type ExportKind, isImportError, useDemoData } from '../store';
import { useDataRoster } from './useDataRoster';

export function useDataExcel(x: { markExported: (kind: ExportKind) => void }) {
  const { data, replace, keepPrevious } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Excel の対象（PRD D103）：全体（すべてのシート。今まで）か、〈利用者さん〉・〈スタッフ〉の名簿 */
  const [kind, setKindState] = useState<'all' | RosterKind>('all');
  /** 名簿の読み込み方（PRD D104）：追加・更新（既定）か総入れ替え */
  const [rosterMode, setRosterMode] = useState<RosterMode>('merge');
  /**
   * 名簿の読み込みで最終勤務日が入った〈スタッフ〉の知らせ（PRD D209）。名前とその人の画面へのリンクを出す。
   * 画面の中の状態で保存しない（閉じる・次の読み込み・画面を移るで消える）
   */
  const [lastDay, setLastDay] = useState<LastDayPerson[] | null>(null);
  /** 知らせを閉じたらフォーカスを戻す先（Excel の欄） */
  const cardRef = useRef<HTMLElement>(null);
  const loadRoster = useDataRoster({ rosterMode, setError, setLastDay });
  const rosterTerm = kind === 'staff' ? data.org.terms.staff : data.org.terms.client;

  const setKind = (k: 'all' | RosterKind) => {
    // 種類を切り替えたら、前の名簿の知らせは消す（PRD D209）
    if (k !== kind) setLastDay(null);
    setKindState(k);
  };
  const closeLastDay = () => {
    setLastDay(null);
    cardRef.current?.focus();
  };

  const download = async () => {
    setError(null);
    setBusy(true);
    try {
      const { exportRosterWorkbook, exportWorkbook } = await import('../excel');
      if (kind === 'all') {
        saveBlob(await exportWorkbook(data), excelFileName(kind, jstDate(Date.now())));
        // 全体の Excel も書き出した日に数える（名簿だけは数えない）
        x.markExported('excel');
        toast('Excel に書き出しました');
      } else {
        saveBlob(await exportRosterWorkbook(data, kind), excelFileName(kind, jstDate(Date.now())));
        toast(`${rosterTerm}の名簿を Excel に書き出しました`);
      }
    } catch (e) {
      setError(isStaleBuild(e) ? EXCEL_STALE_TEXT : `書き出せませんでした（${formError(e)}）`);
    } finally {
      setBusy(false);
    }
  };

  const load = async (file: File) => {
    setError(null);
    setLastDay(null);
    try {
      setBusy(true);
      // 先に読んで検査し、通ったら件数を見せて確かめる（取り消しならデータは変えない）
      if (kind !== 'all') {
        await loadRoster(file, kind);
        return;
      }
      const { importWorkbook } = await import('../excel');
      const r = await importWorkbook(await file.arrayBuffer(), data);
      if (isImportError(r)) {
        setError(`読み込めませんでした（いまのデータはそのままです）\n${r.message}`);
        return;
      }
      // 事業所名が違えば別の事業所のブックとして知らせ、いまの事業所の運用の記録は持ち込まない
      const otherOrg = otherOrgOf(data, r);
      const ok = await confirmDialog({
        title: otherOrg
          ? `別の事業所の「${file.name}」でデータを置き換えますか？`
          : `「${file.name}」でデータを置き換えますか？`,
        body: workbookConfirmBody({
          fileName: file.name,
          counts: workbookCountsText(r),
          otherOrg,
          keep: keepNote(canKeepPrevious()),
        }),
        confirmLabel: 'すべて置き換える',
        tone: 'danger',
      });
      if (!ok) return;
      // 置き換える前に、いまのデータを1世代だけ控える（確認で OK になってから。PRD D227）
      const keep = keepPrevious('Excel 全体の読み込み');
      setLastDay(null);
      replace(otherOrg ? withoutOrgState(r) : r);
      toast(`Excel を読み込みました${keptSuffix(keep)}`);
    } catch (e) {
      setError(
        isStaleBuild(e) ? EXCEL_STALE_TEXT : `読み込めませんでした：${formError(e)}（いまのデータはそのままです）`,
      );
    } finally {
      setBusy(false);
    }
  };

  return {
    kind,
    setKind,
    rosterMode,
    setRosterMode,
    rosterTerm,
    busy,
    error,
    lastDay,
    clearLastDay: () => setLastDay(null),
    closeLastDay,
    cardRef,
    download,
    load,
  };
}

export type DataExcel = ReturnType<typeof useDataExcel>;

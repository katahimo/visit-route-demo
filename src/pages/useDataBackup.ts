// データの画面の控え（JSON）と、データを丸ごと戻す操作（PRD D2・D3・D23・D227）：
// 最後に書き出した日・書き出し・読み込み、初期状態に戻す・直前の状態に戻す・更新前の控えに戻す（ADR-0122）。置き換える前に確かめ、1世代の控えを残す
import { useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useBackupDownload } from '../components/useBackupDownload';
import type { ImportError } from '../contracts/data';
import { jstDate } from '../domain/time';
import { previousText, releaseRestoreBody } from '../lib/backupReminder';
import { attempt, formError } from '../lib/common';
import { keepNote, keptSuffix } from '../lib/dataScreen';
import { backupFileName, saveBlob } from '../lib/download';
import {
  backupMemory,
  canKeepPrevious,
  type ExportKind,
  exportPrevious,
  exportReleasePrevious,
  importJson,
  useDemoData,
} from '../store';

/** 最後に書き出した日（PRD D227。このブラウザの記録で、データには入れない） */
export function useLastExport() {
  const [last, setLast] = useState(() => backupMemory.lastExport());
  const mark = (kind: ExportKind) => {
    backupMemory.markExported(kind, jstDate(Date.now()));
    setLast(backupMemory.lastExport());
  };
  return { last, mark };
}

/** 控え（JSON）の書き出し・読み込み */
export function useDataBackup(x: { markExported: (kind: ExportKind) => void }) {
  const { replace, keepPrevious } = useDemoData();
  const downloadBackup = useBackupDownload();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    setError(null);
    const r = downloadBackup();
    if ('error' in r) {
      setError(r.error);
      return;
    }
    x.markExported('json');
    toast('書き出しました');
  };

  const load = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const r = importJson(text);
      if ('code' in r) {
        setError(`読み込めませんでした：${r.message}（いまのデータはそのままです）`);
        return;
      }
      const ok = await confirmDialog({
        title: `「${file.name}」でデータを置き換えますか？`,
        body: `「${file.name}」の内容で、いまのデータをすべて置き換えます。\n${keepNote(canKeepPrevious())}`,
        confirmLabel: 'すべて置き換える',
        tone: 'danger',
      });
      if (!ok) return;
      const keep = keepPrevious('控えの読み込み');
      replace(r);
      toast(`読み込みました${keptSuffix(keep)}`);
    } catch (e) {
      setError(`読み込めませんでした：${formError(e)}（いまのデータはそのままです）`);
    }
  };

  return { error, download, load };
}

/** 直前の状態に戻す・更新前の控えに戻す（確認つき）と、控えのファイルへの書き出し */
export function useDataRestore() {
  const { restorePrevious, previous, restoreReleasePrevious, releasePrevious } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();

  /**
   * 直前の状態に戻す（PRD D227）：控えと入れ替える（いまのデータは控えに回り、もう一度戻せる。
   * いまのデータを控えに残せなければ戻さない。store の swapPrevious）
   */
  const doRestore = async () => {
    if (!previous) return;
    const ok = await confirmDialog({
      title: '直前の状態に戻しますか？',
      body: `${previousText(previous)}。いまのデータは控えと入れ替わり、もう一度「直前の状態に戻す」で戻せます。`,
      confirmLabel: '直前の状態に戻す',
      tone: 'danger',
    });
    if (!ok) return;
    const err = restorePrevious();
    toast(err ?? '直前の状態に戻しました');
  };

  /**
   * 更新前の控えに戻す（PRD D485。ADR-0122）：いまのデータは直前の状態の控えに回り（今ある直前の状態の控えは置き換わる）、
   * 更新前の控えは残る。いまのデータを控えに残せなければ戻さない（store の restoreReleasePrevious）
   */
  const doRestoreRelease = async () => {
    if (!releasePrevious) return;
    const ok = await confirmDialog({
      title: '更新前の控えに戻しますか？',
      body: releaseRestoreBody(releasePrevious, previous),
      confirmLabel: 'この控えに戻す',
      tone: 'danger',
    });
    if (!ok) return;
    const err = restoreReleasePrevious();
    toast(err ?? '更新前の控えに戻しました');
  };

  /** 控えをファイルに書き出す（ファイル名は控えを残した日と -previous・-release） */
  const exportWith = (make: () => Blob | ImportError | null, at: number, kind: 'previous' | 'release') => {
    const r = attempt(make);
    const blob = r.value;
    if (!(blob instanceof Blob)) {
      toast(`書き出せませんでした（${blob ? blob.message : (r.error ?? '控えがありません')}）`);
      return;
    }
    const name = backupFileName(jstDate(at), kind);
    saveBlob(blob, name);
    toast(`控えを書き出しました（${name}）`);
  };
  /** 1世代の控え（控えの JSON と同じ形） */
  const exportPrev = () => {
    if (previous) exportWith(exportPrevious, previous.at, 'previous');
  };
  /** 更新前の控え（開いたときに読んだ元の文字のまま） */
  const exportRelease = () => {
    if (releasePrevious) exportWith(exportReleasePrevious, releasePrevious.at, 'release');
  };

  return { doRestore, doRestoreRelease, exportPrev, exportRelease };
}

// データの画面の控え（JSON）と、データを丸ごと戻す操作（PRD D2・D3・D23・D227）：
// 最後に書き出した日・書き出し・読み込み、初期状態に戻す・直前の状態に戻す。置き換える前に確かめ、1世代の控えを残す
import { useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { jstDate } from '../domain/time';
import { previousText } from '../lib/backupReminder';
import { attempt, formError } from '../lib/common';
import { keepNote, keptSuffix } from '../lib/dataScreen';
import { backupFileName, saveBlob } from '../lib/download';
import { backupMemory, canKeepPrevious, type ExportKind, exportJson, importJson, useDemoData } from '../store';

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
  const { data, replace, keepPrevious } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [error, setError] = useState<string | null>(null);

  const download = () => {
    setError(null);
    const r = attempt(() => exportJson(data));
    if (!r.value) {
      setError(`書き出せませんでした（${r.error}）`);
      return;
    }
    saveBlob(r.value, backupFileName(jstDate(Date.now())));
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

/** 初期状態に戻す・直前の状態に戻す（どちらも確認つき） */
export function useDataRestore() {
  const { reset, keepPrevious, restorePrevious, previous } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();

  const doReset = async () => {
    const ok = await confirmDialog({
      title: 'データを初期状態に戻しますか？',
      body: `データをデモの初期状態に戻します。いまの変更はすべて消えます。管理者設定の機能の入り切りは、そのままです。\n${keepNote(canKeepPrevious())}`,
      confirmLabel: '消して初期状態に戻す',
      tone: 'danger',
    });
    if (!ok) return;
    // 確認で OK になってから控えを残す（確認中に閉じても控えは残らない。PRD D227）
    const keep = keepPrevious('初期状態に戻す');
    reset();
    toast(`初期状態に戻しました${keptSuffix(keep)}`);
  };

  /** 直前の状態に戻す（PRD D227）：控えと入れ替える */
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
    if (err) {
      toast(err);
      return;
    }
    toast('直前の状態に戻しました');
  };

  return { doReset, doRestore };
}

import { jstDate } from '../domain/time';
import { attempt } from '../lib/common';
import { backupFileName, saveBlob } from '../lib/download';
import { backupMemory, exportJson, useDemoData } from '../store';

/** 控えの書き出しの結果：書き出したファイル名か、書き出せなかった理由 */
export type BackupDownload = { name: string } | { error: string };

/**
 * 今のデータの控え（JSON）をファイルに書き出す（PRD D3・D227）。書き出したら「最後に書き出した日」に数える。
 * データの画面の「ファイルに書き出す」と、最初の設定の作り直す前の控え（PRD D448）で使う
 */
export function useBackupDownload(): () => BackupDownload {
  const { latest } = useDemoData();
  return () => {
    const r = attempt(() => exportJson(latest.current));
    if (!r.value) return { error: `書き出せませんでした（${r.error}）` };
    const date = jstDate(Date.now());
    const name = backupFileName(date);
    saveBlob(r.value, name);
    backupMemory.markExported('json', date);
    return { name };
  };
}

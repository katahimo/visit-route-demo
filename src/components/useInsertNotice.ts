import { useState } from 'react';
import { mdText } from '../lib/dateText';
import { insertIntoPlan } from '../lib/weekOps';
import { useDemoData } from '../store';
import { useToast } from './Toast';

/** ドラッグで日時を動かし、担当を選ばずに保存した回の知らせ（動かした回に担当が無いとき） */
export type InsertNotice = { date: string; visitId: string; label: string; error: string | null };

/**
 * 「空き時間に入れる」の知らせの状態と処理（週の予定・〈利用者さん〉の画面のカレンダーで同じ）。
 * 見せ方（帯の文言・ボタン）は画面ごと。入る人がいないときの理由の文・トーストの担当の名前は画面から渡す
 */
export function useInsertNotice({
  failText,
  staffName,
}: {
  /** 空き時間に入る人がいないときに知らせに出す理由 */
  failText: string;
  /** トーストに出す担当の名前 */
  staffName: (staffId: string) => string;
}) {
  const { data, update } = useDemoData();
  const toast = useToast();
  const [notice, setNotice] = useState<InsertNotice | null>(null);
  /** 動かした回の知らせを出す */
  const show = (r: { date: string; visitId: string; label: string }) =>
    setNotice({ date: r.date, visitId: r.visitId, label: r.label, error: null });
  const clear = () => setNotice(null);
  /** 新しい日の担当の並びの空き時間に入れる（入る人がいなければ知らせに理由を出す） */
  const insert = () => {
    if (!notice) return;
    const r = insertIntoPlan(data, notice.date, notice.visitId);
    if (!r.staffId) {
      setNotice({ ...notice, error: failText });
      return;
    }
    update((d) => insertIntoPlan(d, notice.date, notice.visitId).data, '空き時間に入れる');
    toast(`${mdText(notice.date)} の空き時間に入れました（担当：${staffName(r.staffId)}）`);
    setNotice(null);
  };
  return { notice, show, clear, insert };
}
export type InsertNoticeFlow = ReturnType<typeof useInsertNotice>;

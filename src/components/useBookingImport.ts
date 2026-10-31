// 予約の CSV の読み込み（ADR-0075。PRD D398。データの画面の「予約の CSV」から）：ほかのソフトの予約の CSV を読んで、
// 件数（追加・更新・変更なし・入れなかった予約）を見せて確かめてから、store の update で訪問（単発・担当なし）として入れる。
// 入ったかは次の描画で data を見て決める（入らなければ成功と言わず、残した控えを前の世代に戻す。useRosterImport と同じ）
import { useEffect, useRef, useState } from 'react';
import type { DemoData } from '../contracts/data';
import { bookingConfirmBody, bookingDoneText, bookingHasChanges, bookingProblems } from '../lib/bookingScreen';
import { canKeepPrevious, type PreviousKeep, useDemoData } from '../store';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';

export function useBookingImport() {
  const { data, update, keepPrevious } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(data);
  latest.current = data;
  const pending = useRef<{ base: DemoData; next: DemoData; done: string; keep: PreviousKeep } | null>(null);
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    if (data === p.next) {
      pending.current = null;
      toast(p.done);
    } else if (data !== p.base) {
      pending.current = null;
      p.keep.cancel();
      setError(
        '読み込みのあいだにデータが変わったので入れませんでした（いまのデータはそのままです）。もう一度読み込んでください',
      );
    }
  }, [data, toast]);

  const load = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const base = data;
      const { importBookings } = await import('../excel');
      const r = importBookings(await file.arrayBuffer(), base);
      if ('code' in r) {
        setError(`読み込めませんでした（いまのデータはそのままです）\n${r.message}`);
        return;
      }
      const clientTerm = base.org.terms.client;
      if (!bookingHasChanges(r)) {
        setError(
          [`入れる予約はありませんでした（変更なし ${r.unchanged}件）`, ...bookingProblems(r, clientTerm)].join('\n'),
        );
        return;
      }
      const changed = () =>
        setError('読み込みのあいだにデータが変わりました。もう一度読み込んでください（いまのデータはそのままです）');
      if (latest.current !== base) return changed();
      const ok = await confirmDialog({
        title: '予約を読み込みますか？',
        body: bookingConfirmBody({ fileName: file.name, r, clientTerm, keep: canKeepPrevious() }),
        confirmLabel: '予約を読み込む',
      });
      if (!ok) return;
      if (latest.current !== base) return changed();
      const keep = keepPrevious('予約の読み込み');
      pending.current = { base, next: r.data, done: bookingDoneText(r, keep), keep };
      update((d) => (d === base ? r.data : d), '予約の読み込み', { tell: false });
    } finally {
      setBusy(false);
    }
  };
  return { load, error, busy };
}

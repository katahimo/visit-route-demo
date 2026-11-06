// 「休みのカレンダーを取り込む」の欄（PRD D440。ADR-0107）の状態と処理：選んだファイル（zip か .ics）を読み（lib/calendarFile）、
// 今のデータに照らした入れ替えの一覧（lib/calendarOff）を出し、［入れ替える（N件）］で欠勤を入れる・直す・外すを1回の update で書く
// （元に戻せる。PRD D441。ADR-0108）。振り直さない
import { useMemo, useState } from 'react';
import { jstDate } from '../domain/time';
import { requestImportArrange } from '../lib/autoArrangeBatch';
import { readCalendarFile } from '../lib/calendarFile';
import { applyCalendarOff, calendarOffRows, calOffDoneText } from '../lib/calendarOff';
import type { IcsCalendar } from '../lib/icsRead';
import { careCountOn } from '../lib/pasteRows';
import { useDemoData } from '../store';
import { useToast } from './Toast';
import { useUndoAction } from './undo';

export function useCalendarOff(onClose: () => void) {
  const { data, update } = useDemoData();
  const toast = useToast();
  const undoAction = useUndoAction();
  const today = jstDate(Date.now());
  const [calendars, setCalendars] = useState<IcsCalendar[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const read = useMemo(
    () => (calendars === null ? null : calendarOffRows(data, calendars, today)),
    [data, calendars, today],
  );
  const rows = read?.rows ?? [];

  const pick = async (file: File) => {
    setReading(true);
    setError(null);
    try {
      const r = await readCalendarFile(new Uint8Array(await file.arrayBuffer()));
      setCalendars(r.error === null ? r.calendars : null);
      setError(r.error);
    } catch {
      setCalendars(null);
      setError('ファイルを読めませんでした');
    } finally {
      setReading(false);
    }
  };

  const save = () => {
    if (rows.length === 0) return;
    const next = applyCalendarOff(data, rows);
    const care = careCountOn(
      next,
      rows.map((r) => r.date),
      today,
    );
    update((d) => (d === data ? next : applyCalendarOff(d, rows)), '休みのカレンダーを取り込む');
    toast(calOffDoneText(rows, care), { action: undoAction });
    onClose();
    // 休みの人の訪問・担当なしを自動で組む（PRD D442）
    requestImportArrange(data, next, today);
  };

  return {
    pick,
    reading,
    error,
    rows,
    summary: read?.summary ?? null,
    count: rows.length,
    terms: data.org.terms,
    save,
  };
}

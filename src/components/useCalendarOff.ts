// 「休みのカレンダーを取り込む」の欄（PRD D440。ADR-0107）の状態と処理：選んだファイル（zip か .ics）を読み（lib/calendarFile）、
// 今のデータに照らした一覧（lib/calendarOff）とチェックを持ち、［N件を反映する］で欠勤を入れる・直す・外すを1回の update で書く（元に戻せる）。
// 振り直さない
import { useMemo, useState } from 'react';
import { jstDate } from '../domain/time';
import { readCalendarFile } from '../lib/calendarFile';
import { applyCalendarOff, type CalOffRow, calendarOffRows, calOffDoneText } from '../lib/calendarOff';
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
  const [unchecked, setUnchecked] = useState<ReadonlySet<string>>(() => new Set());
  const read = useMemo(
    () => (calendars === null ? null : calendarOffRows(data, calendars, today)),
    [data, calendars, today],
  );
  const rows = read?.rows ?? [];
  const picked = rows.filter((r) => r.kind !== 'skip' && !unchecked.has(r.key));

  const pick = async (file: File) => {
    setReading(true);
    setError(null);
    try {
      const r = await readCalendarFile(new Uint8Array(await file.arrayBuffer()));
      setCalendars(r.error === null ? r.calendars : null);
      setError(r.error);
      setUnchecked(new Set());
    } catch {
      setCalendars(null);
      setError('ファイルを読めませんでした');
    } finally {
      setReading(false);
    }
  };

  const save = () => {
    if (picked.length === 0) return;
    const next = applyCalendarOff(data, picked);
    const care = careCountOn(
      next,
      picked.map((r) => r.date),
      today,
    );
    update((d) => applyCalendarOff(d, picked), '休みのカレンダーを取り込む');
    toast(calOffDoneText(picked, care), { action: undoAction });
    onClose();
  };

  const toggle = (r: CalOffRow) => {
    if (r.kind === 'skip') return;
    setUnchecked((s) => {
      const next = new Set(s);
      if (next.has(r.key)) next.delete(r.key);
      else next.add(r.key);
      return next;
    });
  };

  return {
    pick,
    reading,
    error,
    rows,
    summary: read?.summary ?? null,
    checked: (r: CalOffRow) => r.kind !== 'skip' && !unchecked.has(r.key),
    toggle,
    count: picked.length,
    terms: data.org.terms,
    save,
  };
}

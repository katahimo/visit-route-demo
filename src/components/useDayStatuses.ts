import { useMemo } from 'react';
import type { DemoData } from '../contracts/data';
import { createDayStatusMemo, type DayStatuses } from '../lib/dayStatuses';
import type { CompileInput } from '../matching';

/** 日ごとの覚え（モジュールに置き、画面を移っても消えない） */
const memo = createDayStatusMemo();

/**
 * 日ごとの状態（月のマスの色・要対応・今月の準備と同じ数え方。lib/dayStatuses）。
 * 月の予定・週の予定・要対応の帯で共通。日付・compile が読むデータ・伝えた内容で覚える（8人・約17件／日の一月で 500ms 以内）
 */
export function useDayStatuses(data: DemoData, compileInput: CompileInput, days: readonly string[]): DayStatuses {
  return useMemo(() => memo.statusesOf(data.snapshots, compileInput, days), [days, compileInput, data.snapshots]);
}

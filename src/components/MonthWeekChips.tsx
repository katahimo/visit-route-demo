// 毎月の第N（ADR-0013・0083）のチップ 第1〜第5（複数選べる）。〈利用者さん〉の繰り返しの欄（pages/patternsForm）と
// 「予定を入れる」の引き出し（AddPlanPanel）で共通。囲み（fieldset・見出し・誤りの印）は使う側が持つ
import { toggleNumber } from '../lib/patternForm';
import './weekdayToggles.css';

export function MonthWeekChips({
  weeks,
  onChange,
  disabled = false,
}: {
  /** 選んでいる第N（1〜5） */
  weeks: readonly number[];
  onChange: (weeks: number[]) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`weekday-toggle month-week-toggle${weeks.includes(n) ? ' is-on' : ''}`}
          aria-pressed={weeks.includes(n)}
          disabled={disabled}
          title={n === 5 ? '第5の曜日がある月だけ' : undefined}
          onClick={() => onChange(toggleNumber(weeks, n))}
        >
          第{n}
        </button>
      ))}
    </>
  );
}

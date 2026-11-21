import { useMemo } from 'react';
import type { VacancyResult } from '../contracts/vacancy';
import { vacancyStrip } from '../lib/vacancyStrip';

// 空き状況の「週の空きの帯」（PRD D472。ADR-0119）：答えのカードの下に常に出す。曜日ごとに1本の帯、30分ごとの区画を
// 人数の段階の色（components/glance.css の lv-*）で塗る。色だけにせず、区画の数字・△・？と行の右の文（印・時刻・人数）も出す

/** 帯の下の読み方（1行。印と色の凡例は「詳しく ▾」の中の1か所） */
const STRIP_NOTE = '濃い緑ほど受けられる人数が多い時刻です。区画の数字は人数、△ は週による、灰は受けられません。';

export function VacancyStripBox({
  result,
  answerResult,
  weekdays,
}: {
  result: VacancyResult;
  answerResult: VacancyResult | null;
  weekdays: readonly number[];
}) {
  const strip = useMemo(() => vacancyStrip(result, answerResult, weekdays), [result, answerResult, weekdays]);
  if (result.times.length === 0) return null;
  const cols = { gridTemplateColumns: `repeat(${result.times.length}, minmax(0, 1fr))` };
  return (
    <div className="vacancy-strip" data-testid="vacancy-strip">
      <p className="vacancy-strip-title">曜日ごとの空き（開始時刻）</p>
      <div className="vacancy-strip-axis" aria-hidden="true">
        <span />
        <span className="vacancy-strip-ticks" style={cols}>
          {strip.ticks.map((t) => (
            <span key={t.index} style={{ gridColumn: `${t.index + 1} / span 6` }}>
              {t.label}
            </span>
          ))}
        </span>
        <span />
      </div>
      <ul className="vacancy-strip-rows" aria-label="曜日ごとの空き">
        {strip.rows.map((r) => (
          <li
            key={r.weekday}
            className={`vacancy-strip-row${r.wished ? '' : ' is-unwished'}`}
            data-testid="vacancy-strip-row"
            data-weekday={r.weekday}
            data-verdict={r.verdict}
          >
            <span className="vacancy-strip-day">{r.dayLabel}</span>
            <span className="vacancy-strip-bar" style={cols} aria-hidden="true">
              {r.segments.map((s) => (
                <span
                  key={s.start}
                  className={`vacancy-strip-seg ${s.level ? `lv-${s.level}` : 'is-none'}${s.inRange ? '' : ' is-out'}`}
                  title={s.label}
                  data-testid="vacancy-strip-seg"
                  data-start={s.start}
                >
                  {s.face}
                </span>
              ))}
            </span>
            <span className="vacancy-strip-text" data-testid="vacancy-strip-text">
              {r.text}
              {!r.wished && <span className="sr-only">（希望の曜日ではありません）</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="sub vacancy-strip-note">{STRIP_NOTE}</p>
    </div>
  );
}

import { type ReactNode, type RefObject, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { EdgeScroll } from '../components/EdgeScroll';
import { LevelLegend } from '../components/glance';
import { Term } from '../components/Term';
import type { VisitType } from '../contracts/documents';
import type { VacancyCell, VacancyResult } from '../contracts/vacancy';
import { minutesToHhmm } from '../domain/time';
import { WEEKDAY_LABELS } from '../lib/common';
import { clockTime, dateText, mdText, monthLabel } from '../lib/dateText';
import { type InquiryDayMark, type InquiryRow, inquiryDayLevel, vacancyLevel } from '../lib/glance';
import { unassignedHref } from '../lib/links';
import { WEEKDAY_ORDER } from '../lib/standard';
import { type AnswerCard, cellFace, markLegend, VACANCY_MARK, VACANCY_MARK_TEXT } from '../lib/vacancyView';
import { ymOf } from '../lib/ym';

// 空き状況の画面（VacancyPage）の小さい部品：段階の番号・畳む印・週ごとのマス・答えのカード・注意・凡例・表

/** 表の行の並び（月〜日） */
export const ROW_WEEKDAYS = WEEKDAY_ORDER;

export const MARK = VACANCY_MARK;
export const VERDICT_TEXT = VACANCY_MARK_TEXT;

/** 畳む欄の「開く ▾」「畳む ▴」（見た目だけ。読み上げの名前に入れない。開いているかは details が伝える） */
export function FoldMark() {
  return (
    <span className="vacancy-fold-mark" aria-hidden="true">
      <span className="when-closed">開く ▾</span>
      <span className="when-open">畳む ▴</span>
    </span>
  );
}

/** 段階の番号の丸（PRD D184。読み上げは見出しの文に「1.」を入れる） */
export function StepNo({ n }: { n: number }) {
  return (
    <span className="vacancy-step-no">
      {n}
      <span className="sr-only">.</span>
    </span>
  );
}

/** 空き状況の表の凡例（PRD D78。どの週でも受けられる人数の段階） */
const VACANCY_LEGEND: [string, string][] = [
  ['none', '0人（受けられない）'],
  ['partial', '0人の週がある'],
  ['one', '1人'],
  ['two', '2人'],
  ['three', '3人'],
  ['many', '4人以上'],
  ['unknown', '数えられない'],
];

/** 案の無い日の注意に並べる日付の数（それより多ければ「ほか N日」） */
const NOPLAN_SHOWN = 6;

const DAY_MARK: Record<InquiryDayMark, string> = { ok: '○', ng: '×', unknown: '？' };
const DAY_TEXT: Record<InquiryDayMark, string> = {
  ok: '受けられる',
  ng: '受けられない',
  unknown: '数えられない日',
};

/**
 * 問い合わせの試算の週ごとのマス（PRD D79）：希望の曜日×週。マスは ○×？ とその日の一番多い人数、色は空き状況の表と同じ。
 * 行の頭にその曜日の判定（○△×？）
 */
export function InquiryWeeks({ rows, exact }: { rows: InquiryRow[]; exact: boolean }) {
  if (rows.every((r) => r.days.length === 0)) return null;
  // 読み方は表の凡例（1か所。PRD D258）
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="vacancy-scroll">
        <table className="inquiry-weeks" data-testid="inquiry-weeks">
          <caption className="sr-only">希望の曜日と週ごとの、希望の時間帯に受けられるか</caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.weekday}>
                <th scope="row">
                  {WEEKDAY_LABELS[r.weekday]} {MARK[r.verdict]}
                  {r.start !== null && <small> {clockTime(r.start)}〜</small>}
                  <span className="sr-only">（{VERDICT_TEXT[r.verdict]}）</span>
                </th>
                {r.days.map((x) => {
                  const label = `${dateText(x.date)}${r.start !== null ? ` ${clockTime(r.start)}から` : ''}：${DAY_MARK[x.mark]} ${DAY_TEXT[x.mark]}${
                    x.mark === 'ok' ? `（${exact ? '' : '約'}${x.best}人）` : ''
                  }`;
                  return (
                    <td key={x.date}>
                      <span
                        className={`inquiry-day lv-${inquiryDayLevel(x)}`}
                        title={label}
                        data-testid="inquiry-day"
                        data-mark={x.mark}
                      >
                        <span className="inquiry-day-mark" aria-hidden="true">
                          {DAY_MARK[x.mark]}
                          {x.mark === 'ok' ? (
                            <small>
                              {' '}
                              {exact ? '' : '約'}
                              {x.best}
                            </small>
                          ) : null}
                        </span>
                        <span className="inquiry-day-date" aria-hidden="true">
                          {mdText(x.date)}
                        </span>
                        <span className="sr-only">{label}</span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 答え（PRD D258・D412）：結果の一番上のカード。受けられるか・曜日と開始の時間・人数。children に答える文と［要約をコピー］ */
export function AnswerBox({ answer, children }: { answer: AnswerCard; children?: ReactNode }) {
  return (
    <div className={`vacancy-answer is-${answer.tone}`} data-testid="vacancy-answer" data-tone={answer.tone}>
      {/* 条件を変えると答えが変わるので読み上げる（role="status"。ボタンは入れない） */}
      {/* biome-ignore lint/a11y/useSemanticElements: 中に段落があるので output ではなく div */}
      <div role="status" className="vacancy-answer-status">
        <p className="vacancy-answer-main">
          <strong className="vacancy-answer-head">{answer.head}</strong>
          {answer.body && <span className="vacancy-answer-body">：{answer.body}</span>}
        </p>
        <p className="sub vacancy-answer-note">{answer.note}</p>
      </div>
      {children}
    </div>
  );
}

/** 数えなかった日・担当なしの訪問がある日の注意はここ1か所（PRD D176）。担当なしは担当を組むの画面か日の予定で入れる（PRD D328） */
export function NoPlanNote({ noPlan, missing }: { noPlan: string[]; missing: string[] }) {
  if (noPlan.length === 0 && missing.length === 0) return null;
  return (
    <div className="vacancy-noplan" data-testid="vacancy-noplan">
      <p>
        {noPlan.length > 0 ? (
          <>
            計算できなかった日（{noPlan.length}日：{noPlan.slice(0, NOPLAN_SHOWN).map(mdText).join('・')}
            {noPlan.length > NOPLAN_SHOWN ? ` ほか${noPlan.length - NOPLAN_SHOWN}日` : ''}
            ）は数えていません（表は「？」、案内文にも載せません）。
          </>
        ) : null}
        {missing.length > 0
          ? `担当なしの訪問がある日が${missing.length}日あります（担当を入れると、空きが減ることがあります）。`
          : ''}
      </p>
      {missing.length > 0 ? (
        <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Link
            className="btn btn-small"
            to={`/arrange?ym=${ymOf(missing[0]!)}`}
            data-testid="vacancy-noplan-arrange"
            data-count={missing.length}
          >
            担当を組むで組む
          </Link>
          <Link className="btn btn-small btn-text" to={unassignedHref(missing[0]!)} data-testid="vacancy-noplan-open">
            担当なしの訪問を見る（{mdText(missing[0]!)}）
          </Link>
        </span>
      ) : (
        // 今日より前の日だけ・確定した日だけのときは、月の予定で見る
        <Link
          className="btn btn-small btn-text"
          to={`/month?ym=${ymOf(noPlan[0]!)}`}
          data-testid="vacancy-noplan-month"
        >
          {monthLabel(noPlan[0]!)}の予定を見る
        </Link>
      )}
    </div>
  );
}

/** 凡例はここ1か所（PRD D258）：印（○△×？）・色（人数の段階）・数字の読み方。週ごとのマスも同じ印と色 */
export function VacancyLegendBox({ exact, vType }: { exact: boolean; vType: VisitType | null }) {
  return (
    <div className="vacancy-legend-box" data-testid="vacancy-legend">
      <ul className="vacancy-legend" data-testid="vacancy-mark-legend" aria-label="マスの読み方">
        {markLegend(exact).map((x) => (
          <li key={x.verdict} className="vacancy-legend-item">
            <span className={`vacancy-legend-face is-${x.verdict}`} aria-hidden="true">
              <b>{x.mark}</b>
              {x.sample && <small>{x.sample}</small>}
            </span>
            <span>
              <span className="sr-only">{x.mark}：</span>
              {x.text}
            </span>
          </li>
        ))}
      </ul>
      <LevelLegend items={VACANCY_LEGEND} />
      <p className="sub vacancy-legend-note">
        ○ の数字は
        <Term k="vacancyCount" testId="term-vacancy-count" />
        {exact ? (
          ''
        ) : (
          <>
            （場所が無いので
            <Term k="vacancyEstimate" testId="term-vacancy-estimate" />）
          </>
        )}
        。色はどの週でも受けられる人数の段階です。上の週ごとのマスも同じ印と色で、行の頭はその曜日に一番良い開始時刻です。マスを押すと日付ごとの人を見られます。
        {vType && ` 種類「${vType.name}」の担当に必要な条件を満たす人だけを数えます。`}
      </p>
    </div>
  );
}

/** 曜日×開始時刻の表（行＝曜日（月〜日）、列＝開始時刻）。マスを押すと日付ごとの人 */
export function VacancyGrid({
  result,
  staffWord,
  picked,
  onPick,
  gridRef,
}: {
  result: VacancyResult;
  staffWord: string;
  picked: VacancyCell | null;
  onPick: (c: VacancyCell) => void;
  gridRef: RefObject<HTMLDivElement | null>;
}) {
  const cellOf = useMemo(() => {
    const m = new Map<string, VacancyCell>();
    for (const c of result.cells) m.set(`${c.weekday}-${c.start}`, c);
    return m;
  }, [result]);
  return (
    <EdgeScroll className="vacancy-scroll" scrollRef={gridRef}>
      <table className="vacancy-grid" data-testid="vacancy-grid">
        <caption className="sr-only">
          曜日と開始時刻ごとの、受けられる{staffWord}の人数（○ どの週も受けられる・△ 受けられない週がある・×
          受けられない・？ 数えられない日）
        </caption>
        <thead>
          <tr>
            <th scope="col" className="vacancy-corner">
              曜日＼開始
            </th>
            {result.times.map((t) => (
              <th key={t} scope="col" className={t % 60 === 0 ? 'is-hour' : ''} data-start={minutesToHhmm(t)}>
                {clockTime(t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROW_WEEKDAYS.map((wd) => (
            <tr key={wd}>
              <th scope="row" className={wd === 0 ? 'is-sun' : wd === 6 ? 'is-sat' : ''}>
                {WEEKDAY_LABELS[wd]}
              </th>
              {result.times.map((t) => {
                const c = cellOf.get(`${wd}-${t}`);
                if (!c) return <td key={t} />;
                const f = cellFace(c, result.exact, `${WEEKDAY_LABELS[wd]} ${clockTime(t)}から`);
                return (
                  <td key={t}>
                    <button
                      type="button"
                      className={`vacancy-cell is-${f.verdict} lv-${vacancyLevel(c)}${picked === c ? ' is-picked' : ''}`}
                      data-testid="vacancy-cell"
                      data-weekday={wd}
                      data-start={minutesToHhmm(t)}
                      data-verdict={f.verdict}
                      aria-label={f.label}
                      title={f.label}
                      onClick={() => onPick(c)}
                    >
                      <span className="vacancy-mark" aria-hidden="true">
                        {f.mark}
                      </span>
                      <span className="vacancy-count" aria-hidden="true">
                        {f.sub}
                      </span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </EdgeScroll>
  );
}

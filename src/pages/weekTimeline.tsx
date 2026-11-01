import type { RefObject } from 'react';
import type { useVisitItem, VisitDrag } from '../components/visitParts';
import { DropShadow, VisitMarks } from '../components/visitParts';
import type { Visit } from '../contracts/documents';
import { weekday } from '../domain/time';
import { colorOf } from '../lib/colors';
import { clockTime, dateText } from '../lib/dateText';
import { typeOf } from '../lib/patternText';
import { DAY_END, DAY_START } from '../lib/spans';
import type { VisitLook } from '../lib/visitLook';
import { type Band, canMoveVisit, laneLayout, snapMinutes, type WeekDay } from '../lib/week';
import { dayHeadOf, visitAriaLabel, visitTitle } from '../lib/weekScreen';
import type { WeekModel } from './useWeekModel';
import type { WeekVisits } from './useWeekVisits';

// 週の予定（pages/WeekPage.tsx）の時間軸（月〜日 × 07:00〜20:00。訪問の帯を種類の色で。ドラッグ・キーボードで日時を動かす）

/** 1分あたりの高さ（px） */
const PX_PER_MIN = 0.8;
const HOURS = Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, i) => DAY_START + i * 60);

/** 時間軸の枠：日の見出し（押すとその日の予定）・時刻の目盛り・日ごとの列 */
export function WeekTimeline({
  model,
  visits,
  today,
  by,
  show,
  noneText,
  boxRef,
  onOpenDay,
}: {
  model: WeekModel;
  visits: WeekVisits;
  today: string;
  /** 帯の縁の色を担当（staff）・〈利用者さん〉（client）のどちらにするか */
  by: 'staff' | 'client';
  /** 出す帯（選んだ人の帯だけ） */
  show: (b: Band) => boolean;
  /** だれも選んでいないときの文（選んでいれば null） */
  noneText: string | null;
  /** 横に巻く箱（狭い画面で今日の列を見せる） */
  boxRef: RefObject<HTMLDivElement | null>;
  onOpenDay: (d: string) => void;
}) {
  const { data, days, visitById, clientById, colorOfStaff, clientName, staffName } = model;
  return (
    <div className="card week-card" ref={boxRef}>
      {noneText !== null && (
        <p className="sub" data-testid="week-none">
          {noneText}
        </p>
      )}
      <div className="week-grid" data-testid="week-grid">
        <div className="week-corner" />
        {days.map((day) => {
          const wd = weekday(day.date);
          /** 担当なしの訪問（PRD D314。版2） */
          const { unassigned, countText } = dayHeadOf(day);
          return (
            <button
              key={day.date}
              type="button"
              className={`week-day-head${day.date === today ? ' is-today' : ''}${wd === 0 ? ' is-sun' : wd === 6 ? ' is-sat' : ''}`}
              onClick={() => onOpenDay(day.date)}
              aria-label={`${dateText(day.date)}の予定を開く（${countText}）`}
              data-testid="week-day-head"
            >
              <strong>{dateText(day.date)}</strong>
              <span
                className={`sub${unassigned > 0 ? ' week-day-unmade' : ''}`}
                data-testid="week-day-count"
                data-unassigned={unassigned}
              >
                {countText}
              </span>
            </button>
          );
        })}
        <div className="week-gutter" style={{ height: (DAY_END - DAY_START) * PX_PER_MIN }}>
          {HOURS.map((h) => (
            <span key={h} className="week-hour" style={{ top: (h - DAY_START) * PX_PER_MIN }}>
              {clockTime(h)}
            </span>
          ))}
        </div>
        {days.map((day) => (
          <DayColumn
            key={day.date}
            day={day}
            today={today}
            show={show}
            drag={visits.drag}
            visitById={visitById}
            bandLabel={(b) => {
              const v = visitById.get(b.visitId);
              // 担当の無い帯は「担当なし」（要対応。PRD D228）
              return { client: clientName(v), staff: b.staffId === null ? '担当なし' : staffName(b.staffId) };
            }}
            typeColor={(v) => {
              const t = typeOf(data.visitTypes, v?.typeId);
              return t ? colorOf(t.color) : null;
            }}
            edgeColor={(b) => {
              if (by === 'client') {
                const c = clientById.get(visitById.get(b.visitId)?.clientId ?? '');
                return c ? colorOf(c.color) : null;
              }
              return b.staffId ? (colorOfStaff.get(b.staffId) ?? null) : null;
            }}
            lookOf={visits.lookOf}
            isMulti={visits.multi.has}
            itemProps={visits.itemProps}
          />
        ))}
      </div>
    </div>
  );
}

/** 時間軸の1日の列（帯・ドラッグの受け口） */
function DayColumn({
  day,
  today,
  show,
  drag,
  visitById,
  bandLabel,
  typeColor,
  edgeColor,
  lookOf,
  isMulti,
  itemProps,
}: {
  day: WeekDay;
  /** 今日（今日より前の帯はドラッグできない） */
  today: string;
  /** 出す帯（選んだ人の帯だけ） */
  show: (b: Band) => boolean;
  /** ドラッグ（共通の判定。lib/visitDrop） */
  drag: VisitDrag;
  visitById: Map<string, Visit>;
  bandLabel: (b: Band) => { client: string; staff: string };
  typeColor: (v: Visit | undefined) => string | null;
  /** 帯の縁の色（担当・〈利用者さん〉の色） */
  edgeColor: (b: Band) => string | null;
  /** 帯の見た目（要対応・資格✗／限✗・未連絡の変更・ピンなど。lib/visitLook） */
  lookOf: (visitId: string) => VisitLook | undefined;
  /** 複数選択で選んでいるか（Shift・Ctrl＋クリック、Shift／Ctrl＋Enter。PRD D330） */
  isMulti: (visitId: string) => boolean;
  /** 押し方（選ぶ・開く・キーで動かす。components/visitParts の useVisitItem） */
  itemProps: ReturnType<typeof useVisitItem>;
}) {
  const bands = day.bands.filter(show);
  const lanes = laneLayout(bands.map((b) => ({ id: b.visitId, start: b.start, end: b.end })));
  const top = (m: number) => (Math.min(Math.max(m, DAY_START), DAY_END) - DAY_START) * PX_PER_MIN;
  const key = `t|${day.date}`;
  const hov = drag.hover?.key === key ? drag.hover : null;
  const minutes = drag.dragId ? (visitById.get(drag.dragId)?.durationMinutes ?? 60) : 60;
  const hovStart = hov ? (hov.verdict.ok ? hov.verdict.start : (hov.target.start ?? DAY_START)) : 0;
  return (
    <section
      className="week-col"
      style={{ height: (DAY_END - DAY_START) * PX_PER_MIN }}
      {...drag.target(key, (e) => ({
        date: day.date,
        start: snapMinutes(
          DAY_START + (e.clientY - e.currentTarget.getBoundingClientRect().top - drag.offset()) / PX_PER_MIN,
        ),
      }))}
      aria-label={`${dateText(day.date)}の訪問`}
      data-date={day.date}
      data-testid="week-col"
    >
      {hov && (
        <DropShadow
          hover={hov}
          className="week-drop"
          testId="week-drop"
          style={{ top: top(hovStart), height: Math.max(32, minutes * PX_PER_MIN) }}
        />
      )}
      {bands.map((b) => {
        const v = visitById.get(b.visitId);
        const l = lanes.get(b.visitId) ?? { lane: 0, lanes: 1 };
        const edge = edgeColor(b);
        const look = lookOf(b.visitId);
        const bad = look?.tone === 'issue' || look?.tone === 'unassigned';
        const { client } = bandLabel(b);
        // 〈利用者さん〉の休み（ADR-0013）の訪問は薄く「休み」と出し、動かさない
        const staff = b.leave ? '休みのため無し' : bandLabel(b).staff;
        const color = b.leave ? null : typeColor(v);
        const h = Math.max(18, (Math.min(b.end, DAY_END) - Math.max(b.start, DAY_START)) * PX_PER_MIN);
        // 今日より前の訪問は動かさない（ドラッグ・キー・選ぶを止める）
        const movable = canMoveVisit(b.date, today) && !b.leave;
        const on = isMulti(b.visitId);
        return (
          <button
            key={b.visitId}
            type="button"
            className={`week-band${b.leave ? ' is-leave' : b.staffId === null ? ' is-unassigned' : ''}${bad && b.staffId !== null ? ' is-unfit' : ''}${on ? ' is-multi' : ''}`}
            style={{
              top: top(b.start),
              height: h,
              left: `calc(${(l.lane / l.lanes) * 100}% + 2px)`,
              width: `calc(${100 / l.lanes}% - 4px)`,
              background: color ?? undefined,
              borderColor: !bad && b.staffId !== null && edge ? edge : undefined,
            }}
            title={visitTitle(b.start, b.end, `${client}・${staff}`, look?.text)}
            aria-label={visitAriaLabel(b.start, `${client}・${staff}`, look?.text, on)}
            {...drag.source(b.visitId, movable)}
            {...itemProps(b.visitId, { selectable: movable, movable, selected: on })}
            data-testid="week-band"
            data-visit={b.visitId}
            data-size="l"
            data-marks={look?.kinds ?? ''}
          >
            <span className="week-band-time">
              {clockTime(b.start)}
              <VisitMarks look={look} size={10} className="week-band-marks" />
            </span>
            <span className="week-band-client">{client}</span>
            <span className="week-band-staff">{staff}</span>
          </button>
        );
      })}
    </section>
  );
}

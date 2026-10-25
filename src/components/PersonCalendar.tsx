import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { minutesToHhmm } from '../domain/time';
import { dateText } from '../lib/dateText';
import { calListDays, dropBox, ghostBox, itemBox, PCAL_HEIGHT, PCAL_HOURS, pcalY } from '../lib/personCalendar';
import { monthWeeksMon } from '../lib/personPage';
import { DAY_START } from '../lib/spans';
import { laneLayout, weekDates } from '../lib/week';
import { ymOf } from '../lib/ym';
import { PcalDayHead, PcalItemButton, PcalItemRow, PcalNotes, PcalTail, PcalToolbar } from './personCalendarParts';
import { type PersonCalendarFlow, type PersonCalendarProps, usePersonCalendar } from './usePersonCalendar';
import { DropShadow } from './visitParts';
import './personCalendar.css';

/**
 * 〈利用者さん〉・〈スタッフ〉の画面の予定のカレンダー（PRD D309・D310。ADR-0052）。
 * 週（時間軸）と月（マス）。回を押すと訪問の詳細の欄（VisitPanel）。〈利用者さん〉では、広い画面で空き枠を押す（縦にドラッグで所要の長さ）と
 * その〈利用者さん〉を入れた新しい訪問の欄、回をドラッグで別の日時へ（落とした日時で欄が開き、繰り返しの回は範囲を選んで保存。週の予定と同じ）。
 * 狭い画面（600px 以下）は日ごとのリスト（追加・移動はしない。見る・取り消す・担当替えは欄で）。データは書かない（書くのは欄）。
 * 状態と処理は usePersonCalendar、回の文・位置の計算は lib/personCalendar、部品は personCalendarParts
 */
export function PersonCalendar({
  dayNote,
  aside,
  ...props
}: PersonCalendarProps & {
  /** 日の見出しに添える印（休み・欠勤など） */
  dayNote?: (date: string) => ReactNode;
  /** 道具の行の右に置くもの */
  aside?: ReactNode;
}) {
  const { view, anchor, onChange, highlight = null } = props;
  const cal = usePersonCalendar(props);
  const { multi } = cal;
  const head = (
    <>
      <PcalToolbar
        view={view}
        anchor={anchor}
        today={cal.today}
        onChange={onChange}
        addDate={cal.addDate}
        onAdd={(d) => cal.openNew(d, 9 * 60, 60)}
        editable={cal.editable}
        narrow={cal.narrow}
        selecting={cal.selecting}
        onSelecting={(on) => {
          cal.setSelecting(on);
          if (!on) multi.clear();
        }}
        canSelect={cal.items.some(cal.item.selectable)}
        aside={aside}
      />
      <PcalNotes notice={cal.notice} highlight={highlight} hlCount={cal.hlCount} editable={cal.editable} />
    </>
  );
  const tail = <PcalTail multi={multi} dates={cal.dates} editable={cal.editable} onMoved={cal.onKeyMoved} />;
  const parts = { cal, view, anchor, dayNote, head, tail };
  if (cal.narrow) return <PcalListView {...parts} />;
  if (view === 'month') return <PcalMonthView {...parts} />;
  return <PcalWeekView {...parts} />;
}

/** 見せ方ごとの部品に渡すもの（head は道具の行と知らせ、tail は選んだ回の帯） */
type ViewParts = {
  cal: PersonCalendarFlow;
  view: PersonCalendarProps['view'];
  anchor: string;
  dayNote?: (date: string) => ReactNode;
  head: ReactNode;
  tail: ReactNode;
};

/** 狭い画面：日ごとのリスト */
function PcalListView({ cal, view, anchor, dayNote, head, tail }: ViewParts) {
  return (
    <div className="pcal is-list" data-testid="pcal" data-view={view} data-layout="list">
      {head}
      <ul className="pcal-list" data-testid="pcal-list">
        {calListDays(view, anchor, cal.dates, cal.byDate, cal.today).map((d) => {
          const list = cal.byDate.get(d) ?? [];
          return (
            <li key={d} className="pcal-list-day" data-date={d} data-testid="pcal-day">
              <PcalDayHead date={d} today={cal.today} dayNote={dayNote} />
              {list.length === 0 ? (
                <span className="sub">訪問なし</span>
              ) : (
                <ul className="vrow-list pcal-list-items">
                  {list.map((it) => (
                    <li key={it.visit.id}>
                      <PcalItemRow kit={cal.item} it={it} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {view === 'month' && cal.items.length === 0 && <p className="sub">この月の訪問はありません。</p>}
      {tail}
    </div>
  );
}

/** 月（マス） */
function PcalMonthView({ cal, anchor, dayNote, head, tail }: ViewParts) {
  const { today, drag } = cal;
  const ym = ymOf(anchor);
  return (
    <div className="pcal" data-testid="pcal" data-view="month" data-layout="month">
      {head}
      <div className="pcal-month">
        {monthWeeksMon(ym).map((week) => (
          <div key={week[0]} className="pcal-month-row">
            {week.map((d) => {
              const list = cal.byDate.get(d) ?? [];
              const out = ymOf(d) !== ym;
              const hov = drag.hover?.key === `m|${d}` ? drag.hover : null;
              return (
                <section
                  key={d}
                  aria-label={`${dateText(d)}の訪問`}
                  className={`pcal-cell${out ? ' is-out' : ''}${d === today ? ' is-today' : ''}${d < today ? ' is-past' : ''}${hov?.verdict.ok ? ' is-drop' : ''}`}
                  {...drag.target(`m|${d}`, () => ({ date: d, start: null }))}
                  data-testid="pcal-cell"
                  data-date={d}
                >
                  <span className="pcal-cell-head">
                    <span className="pcal-cell-day">{Number(d.slice(8, 10))}</span>
                    {dayNote?.(d)}
                    {cal.editable && d >= today && (
                      <button
                        type="button"
                        className="pcal-cell-add"
                        onClick={() => cal.openNew(d, 9 * 60, 60)}
                        aria-label={`${dateText(d)}に訪問を足す`}
                        title={`${dateText(d)}に訪問を足す`}
                        data-testid="pcal-cell-add"
                      >
                        <Plus size={12} aria-hidden="true" />
                      </button>
                    )}
                  </span>
                  <span className="pcal-cell-items">
                    {list.map((it) => (
                      <PcalItemButton key={it.visit.id} kit={cal.item} it={it} compact />
                    ))}
                  </span>
                  {hov && <DropShadow hover={hov} className="pcal-cdrop" time={false} />}
                </section>
              );
            })}
          </div>
        ))}
      </div>
      {tail}
    </div>
  );
}

/** 週（時間軸） */
function PcalWeekView({ cal, anchor, dayNote, head, tail }: ViewParts) {
  return (
    <div className="pcal" data-testid="pcal" data-view="week" data-layout="week">
      {head}
      <div className="pcal-week">
        <div className="pcal-week-head" aria-hidden="true" />
        {weekDates(anchor).map((d) => (
          <div key={d} className="pcal-week-head" data-date={d}>
            <PcalDayHead date={d} today={cal.today} dayNote={dayNote} />
          </div>
        ))}
        <div className="pcal-gutter" style={{ height: PCAL_HEIGHT }} aria-hidden="true">
          {PCAL_HOURS.map((h) => (
            <span key={h} className="pcal-hour" style={{ top: pcalY(h) }}>
              {minutesToHhmm(h)}
            </span>
          ))}
        </div>
        {weekDates(anchor).map((d) => (
          <PcalWeekCol key={d} cal={cal} date={d} />
        ))}
      </div>
      <p className="sub pcal-legend">
        {cal.isClient
          ? `印は担当の${cal.terms.staff}（その日の今の担当）。「変」はこの回だけ変えた回です。`
          : `この人が担当する訪問（その日の今の担当）。「変」はこの回だけ変えた回です。`}
      </p>
      {tail}
    </div>
  );
}

/** 週の時間軸の1日の列（落とし先の影・空き枠を押している間の範囲・回の札） */
function PcalWeekCol({ cal, date: d }: { cal: PersonCalendarFlow; date: string }) {
  const { today, drag, ghost: g } = cal;
  const list = cal.byDate.get(d) ?? [];
  const lanes = laneLayout(list.map((it) => ({ id: it.visit.id, start: it.start, end: it.end })));
  const ghost = g.ghost;
  return (
    <section
      className={`pcal-col${d < today ? ' is-past' : ''}${cal.editable && d >= today ? ' can-add' : ''}`}
      style={{ height: PCAL_HEIGHT }}
      aria-label={`${dateText(d)}の訪問`}
      {...cal.colTarget(d)}
      onPointerDown={(e) => g.onPointerDown(e, d)}
      onPointerMove={g.onPointerMove}
      onPointerUp={g.onPointerUp}
      onPointerCancel={g.onPointerCancel}
      data-testid="pcal-col"
      data-date={d}
    >
      {drag.hover?.key === `w|${d}` && (
        <DropShadow
          hover={drag.hover}
          className="pcal-drop"
          style={dropBox(
            drag.hover.verdict.ok ? drag.hover.verdict.start : (drag.hover.target.start ?? DAY_START),
            cal.visitById.get(drag.dragId ?? '')?.durationMinutes ?? 60,
          )}
        />
      )}
      {ghost?.date === d && (
        <div className="pcal-ghost" style={ghostBox(ghost.a, ghost.b)} aria-hidden="true" data-testid="pcal-ghost">
          {minutesToHhmm(Math.min(ghost.a, ghost.b))}
        </div>
      )}
      {list.map((it) => (
        <PcalItemButton
          key={it.visit.id}
          kit={cal.item}
          it={it}
          style={itemBox(it, lanes.get(it.visit.id) ?? { lane: 0, lanes: 1 })}
        />
      ))}
    </section>
  );
}

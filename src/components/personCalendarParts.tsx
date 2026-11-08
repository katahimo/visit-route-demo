import {
  CalendarClock,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { dateText, mdText } from '../lib/dateText';
import { typeOf } from '../lib/patternText';
import { calHlClass, calItemText, calRowOf, calShortWho } from '../lib/personCalendar';
import { type CalItem, type CalView, calTitle, shiftAnchor } from '../lib/personPage';
import { StaffMark } from './StaffMark';
import { SelectionBar } from './scheduleParts';
import { WithIcon } from './ui';
import { UndoButtons } from './undo';
import type { InsertNoticeFlow } from './useInsertNotice';
import type { PcalItemKit } from './usePersonCalendar';
import { KeyMoveBand } from './visitKeys';
import { SelectToggle, VisitMarks, VisitRow, type VisitSelection } from './visitParts';
import { TypeDot } from './visitType';

// 予定のカレンダー（PersonCalendar）の見た目の部品：回の札・行、日の見出し、道具の行、知らせ、選んだ回の帯

/** 回の札（週の時間軸・月のマス。押すと訪問の詳細、〈利用者さん〉の広い画面ではドラッグで動かす） */
export function PcalItemButton({
  kit: k,
  it,
  style,
  compact = false,
}: {
  kit: PcalItemKit;
  it: CalItem;
  style?: CSSProperties;
  compact?: boolean;
}) {
  const look = k.lookOf(it.visit.id);
  const on = k.multi.has(it.visit.id);
  const label = calItemText(it, k.text);
  const t = typeOf(k.text.visitTypes, it.visit.typeId);
  return (
    <button
      type="button"
      className={`pcal-item${compact ? ' is-compact' : ''} is-${it.state}${calHlClass(it, k.highlight)}${look?.tone === 'issue' ? ' is-issue' : ''}${on ? ' is-multi' : ''}`}
      style={style}
      {...k.drag.source(it.visit.id, k.movable(it))}
      {...k.itemProps(it.visit.id, {
        selectable: k.selectable(it),
        movable: !k.narrow && k.selectable(it),
        selected: on,
      })}
      title={`${label}${look?.text ? `（${look.text}）` : ''}`}
      aria-label={`${label}${look?.text ? `・${look.text}` : ''}${on ? '（選択中）' : ''}（押すと訪問の詳細）`}
      data-testid="pcal-visit"
      data-visit={it.visit.id}
      data-date={it.visit.date}
      data-state={it.state}
      data-pattern={it.visit.pattern?.id ?? ''}
      data-size="l"
      data-marks={look?.kinds ?? ''}
    >
      <span className="pcal-item-time">
        {t ? <TypeDot type={t} size={8} /> : null}
        {it.visit.earliestStart}
        <VisitMarks look={look} size={10} />
      </span>
      <span className="pcal-item-who">
        {k.text.isClient && it.staffId ? <StaffMark staff={k.text.staffById.get(it.staffId)} size="xs" /> : null}
        {calShortWho(it, k.text)}
      </span>
    </button>
  );
}

/** 2段目（狭い画面）の日ごとのリストの行（日の予定のスマホの日ごとのリストと同じ VisitRow） */
export function PcalItemRow({ kit: k, it }: { kit: PcalItemKit; it: CalItem }) {
  const on = k.multi.has(it.visit.id);
  return (
    <VisitRow
      row={{ ...calRowOf(it, k.text), look: k.lookOf(it.visit.id) }}
      selecting={k.selecting}
      selected={on}
      testId="pcal-visit"
      extraClass={`pcal-row is-${it.state}${calHlClass(it, k.highlight)}`}
      props={{
        ...k.itemProps(it.visit.id, { selectable: k.selectable(it), movable: false, selected: on }),
        'data-date': it.visit.date,
        'data-state': it.state,
        'data-pattern': it.visit.pattern?.id ?? '',
      }}
    />
  );
}

/** 日の見出し（日付と、休み・欠勤などの印） */
export function PcalDayHead({
  date: d,
  today,
  dayNote,
}: {
  date: string;
  today: string;
  dayNote?: (date: string) => ReactNode;
}) {
  return (
    <span className="pcal-day-head">
      <span className={`pcal-day-date${d === today ? ' is-today' : ''}`}>{dateText(d)}</span>
      {dayNote?.(d)}
    </span>
  );
}

/** 選んだ回の帯と、キーで動かした先の読み上げ・繰り返しの回の範囲の帯（日・週・月と同じ） */
export function PcalTail({
  multi,
  dates,
  editable,
  onMoved,
}: {
  multi: VisitSelection;
  dates: readonly string[];
  editable: boolean;
  onMoved: (r: { visitId: string; date: string }) => void;
}) {
  return (
    <>
      <SelectionBar ids={multi.ids} onClear={multi.clear} dates={dates} shift={editable} />
      <KeyMoveBand onMoved={onMoved} />
    </>
  );
}

/** 道具の行：前後の期間・今日・週と月・訪問を足す・元に戻す（狭い画面は「選ぶ」）・右に置くもの */
export function PcalToolbar({
  view,
  anchor,
  today,
  onChange,
  addDate,
  onAdd,
  editable,
  narrow,
  selecting,
  onSelecting,
  canSelect,
  aside,
}: {
  view: CalView;
  anchor: string;
  today: string;
  onChange: (next: { view: CalView; anchor: string }) => void;
  /** 「訪問を足す」の日（期間が今日より前なら null） */
  addDate: string | null;
  onAdd: (date: string) => void;
  editable: boolean;
  narrow: boolean;
  selecting: boolean;
  onSelecting: (on: boolean) => void;
  /** 選べる回が期間にあるか */
  canSelect: boolean;
  aside?: ReactNode;
}) {
  return (
    <div className="row pcal-tools">
      <div className="row pcal-nav">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onChange({ view, anchor: shiftAnchor(view, anchor, -1) })}
          aria-label={view === 'week' ? '前の週' : '前の月'}
          data-testid="pcal-prev"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <strong className="pcal-title" aria-live="polite" data-testid="pcal-title">
          {calTitle(view, anchor)}
        </strong>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onChange({ view, anchor: shiftAnchor(view, anchor, 1) })}
          aria-label={view === 'week' ? '次の週' : '次の月'}
          data-testid="pcal-next"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-small" onClick={() => onChange({ view, anchor: today })}>
          今日
        </button>
      </div>
      <fieldset className="segmented pcal-views" aria-label="見せ方">
        {(['week', 'month'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            className={view === v ? 'is-on' : ''}
            onClick={() => onChange({ view: v, anchor })}
            data-testid="pcal-view"
            data-view={v}
          >
            <WithIcon icon={v === 'week' ? CalendarClock : CalendarRange} size={14}>
              {v === 'week' ? '週' : '月'}
            </WithIcon>
          </button>
        ))}
      </fieldset>
      {editable && (
        <button
          type="button"
          className="btn btn-small"
          disabled={addDate === null}
          title={addDate === null ? '今日より前の期間には足せません' : undefined}
          onClick={() => addDate && onAdd(addDate)}
          data-testid="pcal-add"
        >
          <WithIcon icon={Plus} size={14}>
            訪問を追加
          </WithIcon>
        </button>
      )}
      {/* キー・選んだ訪問の操作は全体の元に戻すの1手（日・週・月の操作の行と同じボタン） */}
      {!narrow && <UndoButtons redoShown={false} />}
      {narrow && (
        <SelectToggle selecting={selecting} onChange={onSelecting} testId="pcal-select" disabled={!canSelect} />
      )}
      {aside}
    </div>
  );
}

/** 道具の行の下の知らせ：空き時間に入れるの知らせ・強調する繰り返しの回の数・使い方 */
export function PcalNotes({
  notice: n,
  highlight,
  hlCount,
  editable,
}: {
  notice: InsertNoticeFlow;
  highlight: string | null;
  hlCount: number;
  editable: boolean;
}) {
  return (
    <>
      {n.notice && (
        <output className="stack pcal-notice" data-testid="pcal-notice">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              <WithIcon icon={TriangleAlert} size={16}>
                {n.notice.label} へ動かしました。担当はそのままです（その日に入らなければ要対応に出ます）
              </WithIcon>
            </span>
            <button type="button" className="icon-btn" aria-label="知らせを閉じる" onClick={n.clear}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {n.notice.error && <p className="warn-text">{n.notice.error}</p>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-small"
              onClick={n.insert}
              disabled={!!n.notice.error}
              data-testid="pcal-insert"
            >
              <WithIcon icon={Sparkles} size={14}>
                {mdText(n.notice.date)} の空き時間に入る人を割り当てる
              </WithIcon>
            </button>
          </div>
        </output>
      )}
      {highlight && (
        <p className="sub pcal-hl-note" data-testid="pcal-hl-note">
          選んだ繰り返しの回：この期間に {hlCount}回
        </p>
      )}
      {editable && (
        <p className="sub pcal-howto">
          空いている所を押すと（縦にドラッグすると所要の長さで）訪問を足せます。回をドラッグすると日時を動かせます。
        </p>
      )}
    </>
  );
}

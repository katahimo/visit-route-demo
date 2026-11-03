import { Clock, Coffee, Pencil, RotateCcw, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EdgeScroll } from '../components/EdgeScroll';
import { SlotEditor } from '../components/parts';
import { StaffMark } from '../components/StaffMark';
import { Hint, SidePanel, WithIcon } from '../components/ui';
import type { Absence, Availability, Staff } from '../contracts/documents';
import { availabilityOf, type Slot, slotsError, slotsText, timeText } from '../domain/availability';
import { weekday } from '../domain/time';
import { absenceText } from '../lib/absences';
import { WEEKDAY_LABELS } from '../lib/common';
import type { Picked } from './useAvailabilityEdit';

/** 「09:00」→「9」、「09:30」→「9:30」 */
const hourText = (hhmm: string) => timeText(hhmm).replace(/:00$/, '');
/** セルの短い表示：「9-18」「9:30-12」。休みは「休」 */
const short = (slots: Slot[]) =>
  slots.length === 0 ? ['休'] : slots.map((s) => `${hourText(s.start)}-${hourText(s.end)}`);

/** 凡例と、いつもの時間の説明 */
export function AvailabilityLegend({ suddenOn, staffTerm }: { suddenOn: boolean; staffTerm: string }) {
  return (
    <>
      <div className="avail-legend">
        <span>
          <span className="swatch" aria-hidden="true" />
          基本の時間
        </span>
        <span>
          <span className="swatch is-override" aria-hidden="true" />
          その日だけ変更
        </span>
        <span>
          <span className="swatch is-off" aria-hidden="true" />
          休み
        </span>
        <span>
          <span className="avail-absence">欠勤</span>
          {suddenOn ? '急な欠勤（日の予定で登録）' : '急な欠勤'}
        </span>
        <span>セルを押すと下で変えられます</span>
      </div>
      <Hint>薄い字は、{staffTerm}の設定にあるいつもの時間です。色の付いた日は、その日だけ変えた時間です。</Hint>
    </>
  );
}

/** スタッフ×日の1セル（押すとその日を選ぶ） */
function AvailabilityCell({
  staff: s,
  date: d,
  override: o,
  absence: ab,
  isPicked,
  onPick,
}: {
  staff: Staff;
  date: string;
  override: Availability | undefined;
  absence: Absence | undefined;
  isPicked: boolean;
  onPick: () => void;
}) {
  const { slots } = availabilityOf(s, d, o);
  return (
    <td className="avail-cell">
      <button
        type="button"
        className={[
          'avail-btn',
          o ? 'is-override' : '',
          slots.length === 0 ? 'is-off' : '',
          isPicked ? 'is-picked' : '',
        ].join(' ')}
        title={`${s.name} ${d}：${slotsText(slots)}${ab ? `／${absenceText(ab, slots)}${ab.note ? `（${ab.note}）` : ''}` : ''}`}
        onClick={onPick}
      >
        {slots.length === 0 ? (
          <span className="avail-off">
            <Coffee size={13} aria-hidden="true" />休
          </span>
        ) : (
          short(slots).map((t) => <span key={t}>{t}</span>)
        )}
        {o && <Pencil className="avail-mark" size={9} aria-hidden="true" />}
        {ab && (
          <span className="avail-absence" data-testid="avail-absence">
            {ab.from === null && ab.to === null
              ? '欠勤'
              : `欠 ${short([{ start: ab.from ?? slots[0]?.start ?? '00:00', end: ab.to ?? slots.at(-1)?.end ?? '24:00' }])[0]}`}
          </span>
        )}
      </button>
    </td>
  );
}

/** スタッフ×日の表 */
export function AvailabilityTable({
  staff,
  dates,
  today,
  staffTerm,
  overrides,
  absences,
  picked,
  onPick,
}: {
  staff: Staff[];
  dates: string[];
  today: string;
  staffTerm: string;
  overrides: Map<string, Availability>;
  absences: Map<string, Absence>;
  picked: Picked | null;
  onPick: (staffId: string, date: string) => void;
}) {
  return (
    <EdgeScroll className="table-scroll avail-scroll">
      <table className="avail-table">
        <thead>
          <tr>
            <th className="avail-name">{staffTerm}</th>
            {dates.map((d) => (
              <th key={d} className={`avail-day dow-${weekday(d)} ${d === today ? 'is-today' : ''}`}>
                {Number(d.slice(5, 7))}/{Number(d.slice(8))}
                <br />
                {WEEKDAY_LABELS[weekday(d)]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id}>
              <th className="avail-name">
                <span className="with-staff-mark">
                  <StaffMark staff={s} size="sm" />
                  {s.name}
                </span>
              </th>
              {dates.map((d) => (
                <AvailabilityCell
                  key={d}
                  staff={s}
                  date={d}
                  override={overrides.get(`${s.id}_${d}`)}
                  absence={absences.get(`${s.id}_${d}`)}
                  isPicked={picked?.staffId === s.id && picked.date === d}
                  onPick={() => onPick(s.id, d)}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </EdgeScroll>
  );
}

/** 下の欄の保存・休み・基本に戻すのボタン */
function AvailabilityPanelFoot({
  draft,
  retiredWhy,
  hasOverride,
  onSave,
  onReset,
}: {
  draft: Slot[];
  retiredWhy: string | null;
  hasOverride: boolean;
  onSave: (slots: Slot[]) => void;
  onReset: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        aria-disabled={!!(retiredWhy ?? slotsError(draft)) || undefined}
        title={retiredWhy ?? slotsError(draft) ?? undefined}
        onClick={() => onSave(draft)}
        data-testid="availability-save"
      >
        <WithIcon icon={Save}>この時間で保存</WithIcon>
      </button>
      <button
        type="button"
        className="btn"
        aria-disabled={!!retiredWhy || undefined}
        title={retiredWhy ?? undefined}
        onClick={() => onSave([])}
      >
        <WithIcon icon={Coffee}>休みにする</WithIcon>
      </button>
      {hasOverride && (
        <button type="button" className="btn" onClick={onReset}>
          <WithIcon icon={RotateCcw}>基本の時間に戻す</WithIcon>
        </button>
      )}
    </>
  );
}

/** 選んだセルを直す欄（基本の時間・欠勤の知らせ・時間帯の入力） */
export function AvailabilityPanel({
  staff,
  picked,
  override,
  absence,
  retiredWhy,
  pickedWorks,
  absenceHref,
  draft,
  onDraft,
  onSave,
  onReset,
  onClose,
}: {
  staff: Staff;
  picked: Picked;
  override: Availability | undefined;
  absence: Absence | undefined;
  retiredWhy: string | null;
  pickedWorks: boolean;
  absenceHref: string | null;
  draft: Slot[];
  onDraft: (slots: Slot[]) => void;
  onSave: (slots: Slot[]) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <SidePanel
      narrow
      icon={Clock}
      title={`${staff.name}・${picked.date.slice(5).replace('-', '/')}（${WEEKDAY_LABELS[weekday(picked.date)]}）`}
      onClose={onClose}
      footer={
        <AvailabilityPanelFoot
          draft={draft}
          retiredWhy={retiredWhy}
          hasOverride={!!override}
          onSave={onSave}
          onReset={onReset}
        />
      }
    >
      <p className="sub">
        基本：{slotsText(availabilityOf(staff, picked.date, null).slots)}
        {override && '／この日は変更あり'}
      </p>
      {absence && (
        <p className="warn-text" title={absence.note || undefined}>
          {absenceText(absence, availabilityOf(staff, picked.date, override).slots)}
          {absence.note && `（${absence.note}）`}。欠勤の登録・取り消しは日の予定で
        </p>
      )}
      {/* その日の「欠勤・キャンセル」の欄をこの人で開く（PRD D203）。その日に働く日（保存した時間帯があり、
          最終勤務日の後でない）だけ。休みの日は欄の「休む人」に出ないので出さない。
          日の予定は ?date= を読むので setDate しない（Ctrl+クリックで元のタブの日付を変えない） */}
      {pickedWorks && absenceHref && (
        <p>
          <Link to={absenceHref} className="avail-absence-link" data-testid="availability-absence-link">
            {absence ? 'この日の欠勤を直す・取り消す' : 'この日の欠勤を登録する'}
            （日の予定の「欠勤・キャンセル」で開く）
          </Link>
        </p>
      )}
      {retiredWhy && (
        <p className="warn-text" data-testid="availability-retired">
          {retiredWhy}
        </p>
      )}
      <SlotEditor value={draft} onChange={onDraft} />
    </SidePanel>
  );
}

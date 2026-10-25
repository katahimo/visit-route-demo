// 〈利用者さん〉の繰り返し（定期パターン）の一覧（ADR-0012・0052）：行（押すとカレンダーで強調）・直す／終わらせるのボタン・
// 終わらせる欄（最後の日）。状態と処理は usePatternsFlow
import { CalendarX2, Check, Pencil, X } from 'lucide-react';
import { enterToSave, FieldError } from '../components/FieldError';
import { WithIcon } from '../components/ui';
import { TypeDot } from '../components/visitType';
import type { Pattern, VisitType } from '../contracts/documents';
import { mdText } from '../lib/dateText';
import { patternWhenText, periodText, typeOf, usualStartsLabel } from '../lib/patternText';
import type { PatternEnding } from './usePatternsFlow';

/** 終わらせる欄の値と押したとき（errorState・error は FieldError の token と文） */
type PatternEndProps = {
  ending: PatternEnding | null;
  onChange: (ending: PatternEnding) => void;
  onSave: () => void;
  onCancel: () => void;
  errorState: { text: string } | null;
  error: string | null;
};

/** 終わらせる欄（最後の日を入れて保存） */
function PatternEndForm({
  pattern: p,
  ending,
  today,
  onChange,
  onSave,
  onCancel,
  errorState,
  error,
}: { pattern: Pattern; today: string } & PatternEndProps & { ending: PatternEnding }) {
  return (
    <fieldset className="pattern-form stack" data-testid="pattern-end-form" onKeyDown={enterToSave(onSave)}>
      <legend>繰り返しを終わらせる</legend>
      <label>
        最後の日
        <input
          type="date"
          value={ending.last}
          min={p.from}
          onChange={(e) => onChange({ ...ending, last: e.target.value })}
          data-testid="pattern-end-last"
        />
      </label>
      <span className="sub">この日より後の回を消します（この回だけ変えた回・取り消した回は残します）。</span>
      {p.from > today && (
        <span className="sub" data-testid="pattern-end-before">
          まだ始まっていない繰り返しです（{mdText(p.from)}
          から）。開始日の回も要らないときは、「直す」の「この繰り返しを消す」で消します。
        </span>
      )}
      <FieldError token={errorState}>{error}</FieldError>
      <div className="row">
        <button type="button" className="btn btn-small btn-primary" onClick={onSave} data-testid="pattern-end-save">
          <WithIcon icon={Check} size={14}>
            保存
          </WithIcon>
        </button>
        <button type="button" className="btn btn-small" onClick={onCancel}>
          <WithIcon icon={X} size={14}>
            取り消し
          </WithIcon>
        </button>
      </div>
    </fieldset>
  );
}

/** 繰り返しの行の中身（種類・いつ・所要と期間といつもの担当・標準の開始）。押すとカレンダーで強調する */
function PatternPick({
  pattern: p,
  type: t,
  usual,
  selected,
  onSelect,
}: {
  pattern: Pattern;
  type: VisitType | null;
  usual: string | null;
  selected: boolean;
  onSelect?: (id: string | null) => void;
}) {
  return (
    <button
      type="button"
      className="pattern-pick row"
      aria-pressed={selected}
      onClick={() => onSelect?.(selected ? null : p.id)}
      disabled={!onSelect}
      data-testid="pattern-pick"
    >
      {t ? (
        <span className="type-mark" title={`種類：${t.name}`}>
          <TypeDot type={t} />
          {t.name}
        </span>
      ) : (
        <span className="chip">種類なし</span>
      )}
      <strong>{patternWhenText(p)}</strong>
      <span className="sub">
        {p.durationMinutes}分・{periodText(p)}
        {usual ? `・いつもの担当 ${usual}` : ''}
      </span>
      {usualStartsLabel(p) && (
        <span className="sub" data-testid="pattern-usual-starts">
          {usualStartsLabel(p)}
        </span>
      )}
    </button>
  );
}

/** 繰り返しの一覧（無ければその旨） */
export function PatternsList({
  patterns,
  visitTypes,
  staffName,
  selected,
  onSelect,
  readOnly,
  today,
  onEdit,
  onStartEnd,
  end,
}: {
  patterns: readonly Pattern[];
  visitTypes: readonly VisitType[];
  staffName: (id: string | null) => string | null;
  selected: string | null;
  onSelect?: (id: string | null) => void;
  readOnly: boolean;
  today: string;
  onEdit: (p: Pattern) => void;
  onStartEnd: (p: Pattern) => void;
  /** 終わらせる欄 */
  end: PatternEndProps;
}) {
  if (patterns.length === 0) return <span className="sub">繰り返しはありません</span>;
  return (
    <ul className="pattern-list">
      {patterns.map((p) => (
        <li
          key={p.id}
          className={`pattern-row${selected === p.id ? ' is-selected' : ''}`}
          data-testid="pattern-row"
          data-pattern={p.id}
        >
          <PatternPick
            pattern={p}
            type={typeOf(visitTypes, p.typeId)}
            usual={staffName(p.usualStaffId)}
            selected={selected === p.id}
            onSelect={onSelect}
          />
          {!readOnly && (
            <span className="actions">
              <button
                type="button"
                className="btn btn-small btn-text"
                aria-label={`${patternWhenText(p)}の繰り返しを直す`}
                onClick={() => onEdit(p)}
                data-testid="pattern-edit"
              >
                <WithIcon icon={Pencil} size={14}>
                  直す
                </WithIcon>
              </button>
              <button
                type="button"
                className="btn btn-small btn-text"
                aria-label={`${patternWhenText(p)}の繰り返しを終わらせる`}
                onClick={() => onStartEnd(p)}
                data-testid="pattern-end"
              >
                <WithIcon icon={CalendarX2} size={14}>
                  終わらせる
                </WithIcon>
              </button>
            </span>
          )}
          {end.ending?.id === p.id && <PatternEndForm pattern={p} today={today} {...end} ending={end.ending} />}
        </li>
      ))}
    </ul>
  );
}

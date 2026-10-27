// 基本情報の表（BasicsPage。ADR-0067）の部品：表（行＝繰り返し・列＝曜日・右に相性）と、マスの時刻を直す欄
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Pattern } from '../contracts/documents';
import type { CompatLevel } from '../contracts/rules';
import { type BasicsRow, basicsTimeError, SHIFT_ISSUE_TEXT } from '../lib/basicsView';
import { WEEKDAY_LABELS } from '../lib/common';
import { COMPAT_LEGEND, COMPAT_MEANING, compatLevelClass } from '../lib/compatLevel';
import { patternWhenText } from '../lib/patternText';

/** マスの位置（繰り返しと曜日） */
export type BasicsCellRef = { patternId: string; weekday: number };
const refKey = (r: BasicsCellRef) => `${r.patternId}|${r.weekday}`;

/** 相性の記号（未入力は空） */
const markOf = (level: CompatLevel): string => COMPAT_LEGEND.find((l) => l.cls === compatLevelClass(level))?.mark ?? '';

/** 相性の記号の札（色は相性の表と同じ） */
function CompatMark({ level }: { level: CompatLevel }) {
  if (level === 0) return null;
  return (
    <span className={`basics-compat compat-legend-item ${compatLevelClass(level)}`} title={COMPAT_MEANING[level]}>
      <span aria-hidden="true">{markOf(level)}</span>
      <span className="sr-only">{COMPAT_MEANING[level]}</span>
    </span>
  );
}

export type BasicsTableProps = {
  rows: readonly BasicsRow[];
  weekdays: readonly number[];
  clientName: (id: string) => string;
  staffName: (id: string) => string;
  compatOn: boolean;
  /** マスで時刻を直せるか（曜日ごとの時刻の機能が切れていれば、曜日が2つ以上の繰り返しは直せない） */
  canEdit: (p: Pattern) => boolean;
  open: BasicsCellRef | null;
  onOpen: (ref: BasicsCellRef) => void;
  editor: (p: Pattern, wd: number) => React.ReactNode;
  cellRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
};

/** 1マス：時間の約束（押して直す）・標準の担当（その画面へ）・相性・勤務時間の外 */
function BasicsCellView({ row, wd, props }: { row: BasicsRow; wd: number; props: BasicsTableProps }) {
  const { clientName, staffName, canEdit, open, onOpen, cellRefs } = props;
  const p = row.pattern;
  const c = row.cells[wd];
  if (!c) {
    return (
      <td className="standard-cell-none">
        <span aria-hidden="true">—</span>
        <span className="sr-only">なし</span>
      </td>
    );
  }
  const ref = { patternId: p.id, weekday: wd };
  const time = c.earliestStart === c.latestStart ? c.earliestStart : `${c.earliestStart}〜${c.latestStart}`;
  return (
    <td
      className={c.issue ? 'basics-cell is-issue' : 'basics-cell'}
      data-testid="basics-cell"
      data-pattern={p.id}
      data-weekday={wd}
      data-issue={c.issue ?? undefined}
    >
      {canEdit(p) ? (
        <button
          type="button"
          className="link-btn basics-time"
          aria-expanded={open?.patternId === p.id && open.weekday === wd}
          aria-label={`${clientName(p.clientId)} ${WEEKDAY_LABELS[wd]}曜の時刻 ${time}。押して直す`}
          ref={(el) => {
            if (el) cellRefs.current.set(refKey(ref), el);
            else cellRefs.current.delete(refKey(ref));
          }}
          onClick={() => onOpen(ref)}
          data-testid="basics-time"
        >
          {time}
        </button>
      ) : (
        <span className="basics-time">
          {time}
          <span className="sub basics-time-note">（名前の画面の繰り返しで直す）</span>
        </span>
      )}
      <span className="basics-staff">
        {c.staffId ? (
          <>
            <Link to={`/staff/${c.staffId}`} data-testid="basics-staff-link">
              {staffName(c.staffId)}
            </Link>
            <CompatMark level={c.compat} />
          </>
        ) : (
          <span className="sub">担当なし</span>
        )}
      </span>
      {c.issue && (
        <span className="basics-issue warn-text" data-testid="basics-issue">
          {SHIFT_ISSUE_TEXT[c.issue]}
        </span>
      )}
    </td>
  );
}

/** 基本情報の表（行＝繰り返し・列＝曜日。右の列に相性を入れた〈スタッフ〉） */
export function BasicsTable(props: BasicsTableProps) {
  const { rows, weekdays, clientName, staffName, compatOn, open, editor } = props;
  return (
    <div className="standard-table-scroll">
      <table className="standard-table basics-table" data-testid="basics-table">
        <thead>
          <tr>
            <th scope="col">繰り返し</th>
            {weekdays.map((wd) => (
              <th key={wd} scope="col">
                {WEEKDAY_LABELS[wd]}
              </th>
            ))}
            {compatOn && <th scope="col">相性</th>}
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((row) => {
            const p = row.pattern;
            const tr = (
              <tr key={p.id} data-testid="basics-row" data-pattern={p.id}>
                <th scope="row">
                  <Link to={`/clients/${p.clientId}`} className="standard-row-name" data-testid="basics-client-link">
                    {clientName(p.clientId)}
                  </Link>
                  <span className="standard-row-when">
                    {patternWhenText(p)}・{p.durationMinutes}分
                  </span>
                </th>
                {weekdays.map((wd) => (
                  <BasicsCellView key={wd} row={row} wd={wd} props={props} />
                ))}
                {compatOn && (
                  <td className="basics-compat-cell" data-testid="basics-compat">
                    {row.compat.length === 0 ? (
                      <span className="sub">未入力</span>
                    ) : (
                      <ul className="basics-compat-list">
                        {row.compat.map((c) => (
                          <li key={c.staffId}>
                            <CompatMark level={c.level} />
                            <Link to={`/staff/${c.staffId}`}>{staffName(c.staffId)}</Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                )}
              </tr>
            );
            if (open?.patternId !== p.id) return [tr];
            return [
              tr,
              <tr key={`${p.id}-edit`} className="standard-edit-row">
                <td colSpan={weekdays.length + 1 + (compatOn ? 1 : 0)}>{editor(p, open.weekday)}</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

/** マスの時刻を直す小さな欄（ちょうど＝開始だけ、幅＝開始（早）・開始（遅）。Esc で閉じる） */
export function BasicsTimeEditor({
  pattern,
  wd,
  times,
  title,
  onDone,
  onClose,
}: {
  pattern: Pattern;
  wd: number;
  times: { earliestStart: string; latestStart: string };
  title: string;
  onDone: (earliestStart: string, latestStart: string) => void;
  onClose: () => void;
}) {
  const fixed = pattern.windowKind === 'fixed';
  const [early, setEarly] = useState(times.earliestStart);
  const [late, setLate] = useState(times.latestStart);
  const [tried, setTried] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    first.current?.focus();
  }, []);
  const latest = fixed ? early : late;
  const error = basicsTimeError(early, latest);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!error) onDone(early, latest);
  };
  return (
    <form
      className="standard-editor"
      data-testid="basics-editor"
      aria-label={title}
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <p className="standard-editor-title">{title}</p>
      <label className="field">
        {fixed ? '開始' : '開始（早）'}
        <input
          ref={first}
          type="time"
          value={early}
          onChange={(e) => setEarly(e.target.value)}
          aria-invalid={tried && !!error}
          aria-describedby={tried && error ? `${id}-err` : undefined}
          data-testid="basics-editor-early"
        />
      </label>
      {!fixed && (
        <label className="field">
          開始（遅）
          <input
            type="time"
            value={late}
            onChange={(e) => setLate(e.target.value)}
            aria-invalid={tried && !!error}
            aria-describedby={tried && error ? `${id}-err` : undefined}
            data-testid="basics-editor-late"
          />
        </label>
      )}
      <p className="sub">
        {pattern.weekdays.length > 1 ? `${WEEKDAY_LABELS[wd]}曜だけの時刻にします` : 'この繰り返しの時刻にします'}
      </p>
      {tried && error && (
        <p className="error" id={`${id}-err`} role="alert" data-testid="basics-editor-error">
          {error}
        </p>
      )}
      <div className="row">
        <button type="submit" className="btn btn-small" data-testid="basics-editor-ok">
          決める
        </button>
        <button type="button" className="btn btn-small btn-text" onClick={onClose}>
          やめる
        </button>
      </div>
    </form>
  );
}

/** 閉じたあと、マスの時刻のボタンへフォーカスを戻す */
export function focusCell(cellRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>, ref: BasicsCellRef) {
  cellRefs.current.get(refKey(ref))?.focus();
}

// 組み方の標準の画面（StandardPage）の部品：標準の表と、マスを直す欄
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Pattern } from '../contracts/documents';
import { WEEKDAY_LABELS } from '../lib/common';
import { patternWhenText } from '../lib/patternText';
import { type CellRef, cellOf, type StandardCell, type StandardTable, startError, tableDiff } from '../lib/standard';

/** マスの鍵（繰り返しの id と曜日） */
export const cellKey = (r: CellRef) => `${r.patternId}|${r.weekday}`;

/** 表の見出しに使う名前の引き方（担当・〈利用者さん〉・プリセット） */
export type StandardNames = {
  staffName: (id: string | null) => string;
  clientName: (id: string) => string;
  presetName: (id: string | null) => string;
};

export type TableProps = {
  rows: readonly Pattern[];
  weekdays: readonly number[];
  table: StandardTable | null;
  current: StandardTable;
  clientName: (id: string) => string;
  staffName: (id: string | null) => string;
  testId: string;
  /** 直せる表（下書き）だけ */
  edit?: {
    open: CellRef | null;
    onOpen: (ref: CellRef) => void;
    editor: (p: Pattern, wd: number) => React.ReactNode;
    cellRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  };
};

/** 標準の表（行＝繰り返し・列＝曜日）。今の標準と違うマスに色と「変更」の文字 */
export function StandardTableView({ rows, weekdays, table, current, clientName, staffName, testId, edit }: TableProps) {
  const changed = useMemo(
    () => new Map((table ? tableDiff(table, current) : []).map((d) => [cellKey(d), d.kind])),
    [table, current],
  );
  return (
    <div className="standard-table-scroll">
      <table className="standard-table" data-testid={testId}>
        <thead>
          <tr>
            <th scope="col">繰り返し</th>
            {weekdays.map((wd) => (
              <th key={wd} scope="col">
                {WEEKDAY_LABELS[wd]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((p) => {
            const name = clientName(p.clientId);
            const editing = edit?.open?.patternId === p.id ? edit.open : null;
            const row = (
              <tr key={p.id} data-testid="standard-table-row" data-pattern={p.id}>
                <th scope="row">
                  <span className="standard-row-name">{name}</span>
                  <span className="standard-row-when">{patternWhenText(p)}</span>
                </th>
                {weekdays.map((wd) => {
                  const c = cellOf(table, current, p.id, wd);
                  if (!c || !p.weekdays.includes(wd)) {
                    return (
                      <td key={wd} className="standard-cell-none">
                        <span aria-hidden="true">—</span>
                        <span className="sr-only">なし</span>
                      </td>
                    );
                  }
                  const ref = { patternId: p.id, weekday: wd };
                  const kind = changed.get(cellKey(ref));
                  const isChanged = kind !== undefined;
                  const tag = kind === 'staff' ? '担当変更' : '時刻変更';
                  const body = (
                    <>
                      <span className="standard-cell-staff">{staffName(c.staffId)}</span>
                      <span className="standard-cell-time">{c.start ?? '時刻なし'}</span>
                      {isChanged && <span className="standard-changed-tag">{tag}</span>}
                    </>
                  );
                  return (
                    <td
                      key={wd}
                      className={kind ? `is-changed is-changed-${kind}` : undefined}
                      data-testid="standard-cell"
                      data-pattern={p.id}
                      data-weekday={wd}
                      data-changed={isChanged}
                      data-kind={kind}
                    >
                      {edit ? (
                        <button
                          type="button"
                          className="standard-cell-btn"
                          aria-expanded={editing?.weekday === wd}
                          aria-label={`${name} ${WEEKDAY_LABELS[wd]}曜：${staffName(c.staffId)} ${c.start ?? '時刻なし'}${isChanged ? `（${tag}）` : ''}。押して直す`}
                          ref={(el) => {
                            if (el) edit.cellRefs.current.set(cellKey(ref), el);
                            else edit.cellRefs.current.delete(cellKey(ref));
                          }}
                          onClick={() => edit.onOpen(ref)}
                        >
                          {body}
                        </button>
                      ) : (
                        <span className="standard-cell-read">{body}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
            if (!editing || !edit) return [row];
            return [
              row,
              <tr key={`${p.id}-edit`} className="standard-edit-row">
                <td colSpan={weekdays.length + 1}>{edit.editor(p, editing.weekday)}</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

/** マスを直す小さな欄（担当と時刻。Esc で閉じる） */
export function CellEditor({
  pattern,
  wd,
  cell,
  title,
  staff,
  onDone,
  onClose,
}: {
  pattern: Pattern;
  wd: number;
  cell: StandardCell;
  title: string;
  staff: readonly { id: string; name: string }[];
  onDone: (cell: StandardCell) => void;
  onClose: () => void;
}) {
  const [staffId, setStaffId] = useState<string>(cell.staffId ?? '');
  const [start, setStart] = useState<string>(cell.start ?? '');
  const [tried, setTried] = useState(false);
  const first = useRef<HTMLSelectElement>(null);
  const id = useId();
  useEffect(() => {
    first.current?.focus();
  }, []);
  const error = staffId === '' ? null : startError(pattern, wd, start);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (error) return;
    onDone({ staffId: staffId === '' ? null : staffId, start: staffId === '' || start === '' ? null : start });
  };
  return (
    <form
      className="standard-editor"
      data-testid="standard-editor"
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
        担当
        <select
          ref={first}
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          data-testid="standard-editor-staff"
        >
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          {/* 今の担当が勤務中の人でない（休止・退職）ときも、選んでいる値を見せる */}
          {cell.staffId !== null && !staff.some((s) => s.id === cell.staffId) && (
            <option value={cell.staffId}>（勤務中でない人）</option>
          )}
          <option value="">担当なし</option>
        </select>
      </label>
      <label className="field">
        開始（空＝時刻なし）
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          aria-invalid={tried && !!error}
          aria-describedby={`${id}-hint${tried && error ? ` ${id}-err` : ''}`}
          data-testid="standard-editor-start"
        />
      </label>
      <p className="sub" id={`${id}-hint`}>
        {(() => {
          const t = pattern.dayTimes.find((x) => x.weekday === wd) ?? pattern;
          return `時間の約束：${t.earliestStart === t.latestStart ? `${t.earliestStart}ちょうど` : `${t.earliestStart}〜${t.latestStart}`}`;
        })()}
      </p>
      {tried && error && (
        <p className="error" id={`${id}-err`} role="alert" data-testid="standard-editor-error">
          {error}
        </p>
      )}
      <div className="row">
        <button type="submit" className="btn btn-small" data-testid="standard-editor-ok">
          決める
        </button>
        <button type="button" className="btn btn-small btn-text" onClick={onClose}>
          閉じる
        </button>
      </div>
    </form>
  );
}

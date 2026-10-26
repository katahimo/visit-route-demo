// 組み方の標準の画面（StandardPage）の3段：案をくらべる・表で直す（下書き）・標準にする
import { Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WEEKDAY_LABELS } from '../lib/common';
import { dateText, mdText } from '../lib/dateText';
import type { StandardPeriod } from '../lib/standard';
import { cellOf, diffCounts, mondayOf, type StandardTable, setCell } from '../lib/standard';
import { type StandardWork, setDraft, standardWork, stopProposals } from '../lib/standardDraft';
import { StandardDayView } from './standardDayView';
import { CellEditor, cellKey, type StandardNames, StandardTableView, type TableProps } from './standardParts';
import type { StandardDayViewState } from './useStandardDayView';
import type { StandardDraftState } from './useStandardDraft';
import type { StandardProposals } from './useStandardProposals';
import type { StandardRegisterState } from './useStandardRegister';

/** 表の部品に共通で渡すもの */
export type StandardTableBase = Pick<TableProps, 'rows' | 'weekdays' | 'current' | 'clientName' | 'staffName'>;

/** 1. 案をくらべる：考え方ごとの案を作り、カードで比べ、表で見て・日で見て、下書きにする */
export function ProposalsStep({
  presetCount,
  period,
  cycleReason,
  work,
  proposals,
  hasDraft,
  tableProps,
  day,
  onUse,
}: {
  presetCount: number;
  period: StandardPeriod;
  cycleReason: string;
  work: StandardWork;
  proposals: StandardProposals;
  hasDraft: boolean;
  tableProps: StandardTableBase;
  day: StandardDayViewState;
  onUse: (presetId: string, table: StandardTable) => void;
}) {
  const { staffName } = tableProps;
  const { viewing, setViewing, viewId, run, cards, best, proposalsStale, viewed } = proposals;
  const running = work.running;
  return (
    <li className="card stack" data-step="proposals">
      <h2>1. 案をくらべる</h2>
      <p className="sub" data-testid="standard-period">
        プリセット（考え方）ごとに、{mdText(period.from)}〜{mdText(period.to)}（{period.weeks}週。{cycleReason}
        ）の担当を AI
        で組み、標準の表の案を作ります。繰り返しだけから作り（ピン・今の予定の手直しは見ません）、今の予定は変わりません
      </p>
      <div className="row">
        <button
          type="button"
          className={hasDraft ? 'btn' : 'btn btn-primary'}
          onClick={run}
          disabled={running !== null}
          data-testid="standard-run"
        >
          {presetCount}つの考え方で案を作る
        </button>
        {running && (
          <>
            <output data-testid="standard-progress">
              「{running.presetName}」で作っています {running.day}/{running.days}日
            </output>
            <button type="button" className="btn btn-small" onClick={stopProposals} data-testid="standard-stop">
              止める
            </button>
          </>
        )}
      </div>
      {work.error && (
        <p className="error" role="alert">
          {work.error}
        </p>
      )}
      {proposalsStale && (
        <p className="sub warn" data-testid="standard-proposals-stale">
          案を作ったあとに繰り返しが変わりました。作り直すと今の繰り返しで比べられます
        </p>
      )}
      <ul className="standard-cards">
        {cards.map((card, i) => (
          <ProposalCard
            key={card.preset.id}
            card={card}
            best={i === best}
            running={running !== null}
            viewing={viewing === card.preset.id}
            viewId={viewId}
            staffName={staffName}
            onView={() => setViewing((v) => (v === card.preset.id ? null : card.preset.id))}
            onDay={() => day.open(card.preset.id)}
            onUse={onUse}
          />
        ))}
      </ul>
      {viewed?.prop?.table && (
        <section id={viewId} className="stack" aria-label={`「${viewed.preset.name}」の案の表`}>
          <h3 className="standard-view-title">
            「{viewed.preset.name}」の案の表（今の標準と違うマス {viewed.diff?.all ?? 0}。担当 {viewed.diff?.staff ?? 0}
            ・時刻だけ {viewed.diff?.time ?? 0}）
          </h3>
          <StandardTableView {...tableProps} table={viewed.prop.table} testId="standard-view-table" />
        </section>
      )}
      <StandardDayView
        day={day}
        onUse={(presetId) => {
          const table = cards.find((c) => c.preset.id === presetId)?.prop?.table;
          if (table) onUse(presetId, table);
        }}
      />
    </li>
  );
}

/** 案のカード（考え方ごと）：名前・一言・数字と［表で見る］［日で見る］［この案から作る］ */
function ProposalCard({
  card,
  best,
  running,
  viewing,
  viewId,
  staffName,
  onView,
  onDay,
  onUse,
}: {
  card: StandardProposals['cards'][number];
  best: boolean;
  running: boolean;
  viewing: boolean;
  viewId: string;
  staffName: StandardTableBase['staffName'];
  onView: () => void;
  onDay: () => void;
  onUse: (presetId: string, table: StandardTable) => void;
}) {
  const { preset, prop, diff } = card;
  const s = prop?.stats ?? null;
  const ready = !!prop?.done && !!prop.table;
  return (
    <li className="card standard-card" data-testid="standard-card" data-preset={preset.id}>
      <h3>
        {best && <Crown size={16} aria-label="いちばん点が高い" data-testid="standard-crown" />}
        {preset.name}
      </h3>
      {preset.note && <p className="sub">{preset.note}</p>}
      {ready ? (
        <dl className="standard-stats">
          <dt>点</dt>
          <dd data-testid="standard-points">{s?.points ?? '—'}</dd>
          <dt>移動</dt>
          <dd>{s ? `${Math.round(s.travelMinutes / 6) / 10}時間` : '—'}</dd>
          <dt>担当なし</dt>
          <dd>{s ? `${s.unassigned}件` : '—'}</dd>
          <dt>件数の偏り</dt>
          <dd
            title={
              s?.most && s.least
                ? `いちばん多い：${staffName(s.most.staffId)} ${s.most.count}件・いちばん少ない：${staffName(s.least.staffId)} ${s.least.count}件`
                : undefined
            }
            data-testid="standard-spread"
          >
            {s ? `${s.spread}件` : '—'}
          </dd>
          <dt>今の標準と違う</dt>
          <dd data-testid="standard-card-diff" data-count={diff?.all ?? 0}>
            {diff ? `${diff.all}マス（担当 ${diff.staff}・時刻だけ ${diff.time}）` : '—'}
          </dd>
        </dl>
      ) : (
        <p className="sub">
          {running && prop ? '作っています…' : running ? '順番を待っています' : 'まだ作っていません'}
        </p>
      )}
      {ready && prop?.table && (
        <div className="row standard-card-actions">
          <button
            type="button"
            className="btn btn-small"
            aria-expanded={viewing}
            aria-controls={viewId}
            onClick={onView}
            data-testid="standard-view"
          >
            {viewing ? '表を閉じる' : '表で見る'}
          </button>
          {prop.days.length > 0 && (
            <button type="button" className="btn btn-small" onClick={onDay} data-testid="standard-day">
              日で見る
            </button>
          )}
          <button
            type="button"
            className="btn btn-small"
            onClick={() => onUse(preset.id, prop.table as StandardTable)}
            data-testid="standard-use"
          >
            この案から作る
          </button>
        </div>
      )}
    </li>
  );
}

/** 2. 表で直す（下書き） */
export function DraftStep({
  clientTerm,
  work,
  stateKey,
  tableProps,
  draftState,
  presetName,
  workingStaff,
}: {
  clientTerm: string;
  work: StandardWork;
  stateKey: string;
  tableProps: StandardTableBase;
  draftState: StandardDraftState;
  presetName: StandardNames['presetName'];
  workingStaff: readonly { id: string; name: string }[];
}) {
  const { draft, draftDiff, editing, setEditing, cellRefs, draftHead, closeEditor, fromCurrent, discard } = draftState;
  const { current, clientName } = tableProps;
  const key = stateKey;
  const terms = { client: clientTerm };
  return (
    <li className="card stack" data-step="draft">
      <h2 ref={draftHead} tabIndex={-1}>
        2. 表で直す（下書き）
      </h2>
      {!draft ? (
        <>
          <p className="sub">
            下書きの表で、{terms.client}
            の繰り返しごと・曜日ごとに担当と時刻を直します。上の案から作るか、今の標準から作ります。下書きは標準にするまで予定に書きません
          </p>
          <div className="row">
            <button type="button" className="btn" onClick={fromCurrent} data-testid="standard-from-current">
              今の標準から作る
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="sub" data-testid="standard-draft-from">
            {draft.from ? `「${presetName(draft.from)}」の案から作った下書き` : '今の標準から作った下書き'}
            。マスを押すと担当と時刻を直せます
          </p>
          <p data-testid="standard-diff-count">
            <strong>今の標準と違う所 {draftDiff.length}か所</strong>（担当 {diffCounts(draftDiff).staff}・時刻だけ{' '}
            {diffCounts(draftDiff).time}）
          </p>
          {work.draftKey !== key && (
            <p className="sub warn" data-testid="standard-draft-stale">
              下書きを作ったあとに繰り返しが変わりました。無くなった繰り返しは外し、新しい繰り返しは今の標準で出しています
            </p>
          )}
          <StandardTableView
            {...tableProps}
            table={draft.table}
            testId="standard-table"
            edit={{
              open: editing,
              onOpen: (ref) => setEditing((e) => (e && cellKey(e) === cellKey(ref) ? null : ref)),
              cellRefs,
              editor: (p, wd) => {
                const c = cellOf(draft.table, current, p.id, wd);
                if (!c) return null;
                const ref = { patternId: p.id, weekday: wd };
                return (
                  <CellEditor
                    key={cellKey(ref)}
                    pattern={p}
                    wd={wd}
                    cell={c}
                    title={`${clientName(p.clientId)} ${WEEKDAY_LABELS[wd]}曜の担当と時刻`}
                    staff={workingStaff}
                    onDone={(cell) => {
                      const w = standardWork.get();
                      if (w.draft) setDraft({ ...w.draft, table: setCell(w.draft.table, ref, cell) }, w.draftKey);
                      closeEditor(ref);
                    }}
                    onClose={() => closeEditor(ref)}
                  />
                );
              },
            }}
          />
          <div className="row">
            <button
              type="button"
              className="btn btn-small btn-text"
              onClick={() => void discard()}
              data-testid="standard-discard"
            >
              下書きを捨てる
            </button>
          </div>
        </>
      )}
    </li>
  );
}

/** 3. 標準にする（下書きがあれば登録の操作、登録した直後なら完了の表示） */
export function RegisterStep({
  draft,
  registered,
  register: r,
  draftDiffCount,
  names,
}: {
  draft: boolean;
  registered: { since: string; at: number } | null;
  register: StandardRegisterState;
  draftDiffCount: number;
  names: Pick<StandardNames, 'staffName' | 'clientName'>;
}) {
  const { staffName, clientName } = names;
  const { minSince, since, setSinceIn, effectiveDiff, skippedDiff, temps, temp, setTemp, register } = r;
  return (
    <li className="card stack" data-step="register">
      <h2>3. 標準にする</h2>
      {draft ? (
        <>
          <label className="row">
            いつから
            <input
              type="date"
              value={since}
              min={minSince}
              onChange={(e) => setSinceIn(e.target.value || null)}
              data-testid="standard-since"
            />
          </label>
          {temps.length > 0 && (
            <fieldset className="standard-temp stack" data-testid="standard-temp-choice">
              <legend>
                {mdText(since)}から先ですでに担当が入っている予定のうち、新しい標準と違うもの
                <strong data-testid="standard-temp-count"> {temps.length}件</strong>
              </legend>
              <label className="standard-choice">
                <input
                  type="radio"
                  name="standard-temp"
                  checked={temp === 'drop'}
                  onChange={() => setTemp('drop')}
                  data-testid="standard-temp-drop"
                />
                <span>
                  <strong>標準どおりに入れ替える（おすすめ）</strong>
                  <span className="sub">その予定を消して、新しい標準の担当・時刻にします</span>
                </span>
              </label>
              <label className="standard-choice">
                <input
                  type="radio"
                  name="standard-temp"
                  checked={temp === 'pin'}
                  onChange={() => setTemp('pin')}
                  data-testid="standard-temp-pin"
                />
                <span>
                  <strong>今のまま残す</strong>
                  <span className="sub">その予定は今の担当のまま固定（ピン）します</span>
                </span>
              </label>
              <details>
                <summary>どの予定か見る</summary>
                <ul className="standard-temp-list">
                  {temps.slice(0, 20).map((t) => (
                    <li key={t.visitId}>
                      {dateText(t.date)}
                      {clientName(t.clientId)}：今 {staffName(t.now.staffId)} {t.now.start ?? ''} → 標準{' '}
                      {staffName(t.standard.staffId)} {t.standard.start ?? ''}
                    </li>
                  ))}
                  {temps.length > 20 && <li>ほか {temps.length - 20}件</li>}
                </ul>
              </details>
            </fieldset>
          )}
          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void register()}
              disabled={effectiveDiff.length === 0}
              data-testid="standard-register"
            >
              この表を標準にする
            </button>
            {draftDiffCount === 0 && (
              <span className="sub" data-testid="standard-same">
                今の標準と同じです
              </span>
            )}
            {skippedDiff > 0 && (
              <span className="sub" data-testid="standard-skipped">
                {mdText(since)}より前に終わる繰り返しの直し {skippedDiff}か所は書き換えません
              </span>
            )}
          </div>
        </>
      ) : (
        registered && (
          <div className="standard-done stack" data-testid="standard-done">
            <p>
              <strong>{mdText(registered.since)} から毎週この表のとおりに並びます</strong>
            </p>
            <div className="row">
              <Link to={`/week?d=${mondayOf(registered.since)}`} className="btn" data-testid="standard-week-link">
                週の予定で見る
              </Link>
            </div>
          </div>
        )
      )}
    </li>
  );
}

// 考え方ごとの案の帯（PRD D357。ADR-0064）：組み方の標準が無い日の範囲で、考え方（プリセット）ごとに組んだ案を
// タブで切り替えて「今日の予定」と同じ時間軸で見る（今の担当のタブもある）。タブに点（点数の基準の物差し・100点満点）、
// 選んだ案に［この案を標準にする］（確認のあと、その日に反映し、その曜日の担当・時刻を来週の月曜から標準にし、考え方を
// 点数の基準にする。元に戻すの1手）［この日だけ反映］。担当や時刻が変わる訪問は時間軸の帯に印を付け、一覧でも見られる
import { CircleCheck, Crown, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { jstDate, minutesToHhmm } from '../domain/time';
import { busyStaff, choiceColumns, choicePoints } from '../lib/choiceView';
import { dateText, newId, WEEKDAY_LABELS } from '../lib/common';
import { routesOf, unassignedOf } from '../lib/dayPlan';
import {
  type BatchProposal,
  monthBatch,
  type ProposalChange,
  proposalDayChanges,
  proposalDayFresh,
} from '../lib/monthBatch';
import { mdText } from '../lib/patternText';
import { dayStandardPreview, registerDayStandard } from '../lib/standard';
import { legsOf } from '../lib/timeline';
import { useDayModel } from '../lib/useDayModel';
import { useValueStore } from '../lib/valueStore';
import { useConfirm } from './ConfirmDialog';
import { ProposalChanges } from './proposalChanges';
import { RouteTimeline, type TimelineColumn } from './routeTimeline';
import { StaffMark } from './StaffMark';
import { useToast } from './Toast';
import { WithIcon } from './ui';

type Routes = Record<string, string[]>;
const NO_DROP = { onDragOver: () => {}, onDragLeave: () => {}, onDrop: () => {} };

/** 移動の増減の文（「移動 +12分」「移動 ±0分」） */
const travelText = (minutes: number) => {
  const m = Math.round(minutes);
  return `移動 ${m > 0 ? '+' : m < 0 ? '−' : '±'}${Math.abs(m)}分`;
};

export function ChoiceBand({ proposal }: { proposal: BatchProposal }) {
  const choices = proposal.choices ?? [];
  const date = choices[0]?.days[0]?.date ?? jstDate(Date.now());
  const m = useDayModel(date);
  const { data, staffById, clientById, colorOfStaff } = m;
  const run = useValueStore(monthBatch.run);
  const toast = useToast();
  const confirmDialog = useConfirm();
  const today = jstDate(Date.now());
  /** 見ているタブ（-1 は今の担当） */
  const [tab, setTab] = useState(0);

  const first = choices[0]?.days[0];
  /** 今の担当（組み始めたときの訪問から）と、案ごとの担当 */
  const current: Routes = useMemo(() => (first ? routesOf(first.problem, first.visits) : {}), [first]);
  const points = useMemo(
    () => ({
      current: choicePoints(m.scoreProblem, m.scoreScale, current),
      choices: choices.map((c) => (c.days[0] ? choicePoints(m.scoreProblem, m.scoreScale, c.days[0].routes) : null)),
    }),
    [m.scoreProblem, m.scoreScale, current, choices],
  );
  /** 列にする人：今の担当かどれかの案で訪問のある人（タブを替えても列が動かない） */
  const staffIds = useMemo(() => {
    const out = new Set<string>();
    if (!first) return out;
    for (const id of busyStaff(first.problem, current)) out.add(id);
    for (const c of choices) {
      const d = c.days[0];
      if (d) for (const id of busyStaff(d.problem, d.routes)) out.add(id);
    }
    return out;
  }, [first, current, choices]);
  let best = -1;
  points.choices.forEach((p, k) => {
    if (p !== null && (best < 0 || p > (points.choices[best] ?? -1))) best = k;
  });

  if (!first) return null;
  const k = tab >= choices.length ? 0 : tab;
  const chosen = k >= 0 ? choices[k] : undefined;
  const day = chosen?.days[0];
  const problem = day?.problem ?? first.problem;
  const routes = day?.routes ?? current;
  const changes = new Map<string, ProposalChange>(day ? proposalDayChanges(day).map((r) => [r.visitId, r]) : []);
  const unassigned = unassignedOf(problem, routes);
  const fresh = (i: number) => choices[i]?.days.every((d) => proposalDayFresh(data, d)) ?? false;
  const ok = k >= 0 && fresh(k);
  const staffName = (id: string | null) => (id === null ? '担当なし' : `${staffById.get(id)?.name ?? '（不明）'}さん`);
  const clientName = (visitId: string) => {
    const v = problem.visits.find((x) => x.id === visitId);
    return (v && clientById.get(v.clientId)?.displayName) ?? '（不明）';
  };
  const staleText = '提案を出したあとに訪問が変わったので、反映しませんでした。もう一度組んでください';

  const columns: TimelineColumn[] = choiceColumns(problem, routes, staffIds).map((col) => {
    const s = staffById.get(col.staffId);
    return {
      staffId: col.staffId,
      className: '',
      style: { borderTopColor: colorOfStaff.get(col.staffId) },
      drop: NO_DROP,
      header: (
        <span className="choice-col-head">
          <StaffMark staff={s} size="xs" />
          <span className="ellipsis">{s?.name ?? '（不明）'}</span>
        </span>
      ),
      baseSlots: col.slots,
      slots: col.slots,
      bands: col.stops.map((t) => {
        const c = changes.get(t.visitId);
        const note =
          c?.kind === 'staff'
            ? `担当が変わる（今：${staffName(c.from)}）`
            : c?.kind === 'time'
              ? `時刻が変わる（今：${minutesToHhmm(c.at - c.minutes)}）`
              : undefined;
        return {
          visitId: t.visitId,
          start: t.start,
          end: t.end,
          name: clientName(t.visitId),
          color: null,
          tone: null,
          picked: false,
          dragging: false,
          onPick: () => {},
          note,
          marks: c ? (
            <span className={`choice-mark is-${c.kind}`} title={note} aria-hidden="true">
              {c.kind === 'staff' ? '担当' : '時刻'}
            </span>
          ) : undefined,
        };
      }),
      legs: legsOf(col.stops, col.homeMinutes),
      shadow: null,
      emptyText: '訪問なし',
    };
  });

  const applyOnly = (i: number) => {
    const c = choices[i];
    const r = monthBatch.apply({ id: proposal.id, choice: i });
    if (!r || !c) return;
    toast(r.applied.length === 0 ? staleText : `「${c.name}」の案を${proposal.label}に反映しました`);
  };
  const adopt = async (i: number) => {
    const c = choices[i];
    const d = c?.days[0];
    if (!c || !d) return;
    const pv = dayStandardPreview(data, d, today);
    const wd = WEEKDAY_LABELS[pv.weekday as 0] ?? '';
    const yes = await confirmDialog({
      title: `「${c.name}」の案を組み方の標準にしますか？`,
      body: [
        `・${dateText(d.date)}の担当と時刻をこの案にします`,
        pv.diff.length > 0
          ? `・${mdText(pv.since)}から、毎週${wd}曜の担当と時刻をこの案のとおりにします（今と違う所 ${pv.diff.length}か所。ほかの曜日は今のまま）`
          : `・毎週${wd}曜の担当と時刻は今のままです（この案と同じ）`,
        `・これから AI で組むときは「${c.name}」の考え方で組みます`,
        '「元に戻す」で戻せます。ほかの曜日は「組み方の標準」で表で直せます',
      ].join('\n'),
      confirmLabel: 'この案を標準にする',
    });
    if (!yes) return;
    const r = monthBatch.apply({
      id: proposal.id,
      choice: i,
      andThen: (x) => registerDayStandard(x, d, c.presetId, today, { newId: () => newId('pattern'), at: Date.now() }),
      label: `組み方の標準にする（${c.name}）`,
    });
    if (!r) return;
    toast(
      r.applied.length === 0
        ? staleText
        : `「${c.name}」を組み方の標準にしました。${mdText(pv.since)}から毎週${wd}曜はこの案のとおりに並びます`,
    );
  };

  const pointText = (p: number | null) => (p === null ? '—' : `${p}点`);
  const shown = k >= 0 ? points.choices[k] : points.current;
  const diff = shown !== null && points.current !== null ? shown - points.current : null;

  return (
    <section
      className="plan-band schedule-band proposal-band choice-band stack"
      aria-label="AI の案"
      data-testid="proposal-band"
      data-kind="choices"
    >
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <WithIcon icon={Sparkles} size={16}>
          <span className="band-text">
            <strong>
              {proposal.label}の案（{choices.length}つ）
            </strong>
            ：タブで切り替えて、今の担当とくらべてください。気に入った案を「この案を標準にする」で選ぶと、これから AI
            はその考え方で組みます
          </span>
        </WithIcon>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => monthBatch.discard()}
          data-testid="proposal-discard"
        >
          <WithIcon icon={X} size={14}>
            捨てる
          </WithIcon>
        </button>
      </div>
      <div className="choice-tabs" role="tablist" aria-label="案">
        <button
          type="button"
          role="tab"
          aria-selected={k < 0}
          className={`choice-tab${k < 0 ? ' is-on' : ''}`}
          onClick={() => setTab(-1)}
          data-testid="choice-current"
        >
          <span className="choice-tab-name">今の担当</span>
          <span className="choice-tab-points">{pointText(points.current)}</span>
        </button>
        {choices.map((c, i) => {
          const d = c.days[0];
          return (
            <button
              key={c.presetId}
              type="button"
              role="tab"
              aria-selected={k === i}
              className={`choice-tab${k === i ? ' is-on' : ''}`}
              onClick={() => setTab(i)}
              data-testid="choice-card"
              data-preset={c.presetId}
            >
              <span className="choice-tab-name">
                {best === i && choices.length > 1 && <Crown size={14} aria-label="いちばん点の高い案" />}
                {c.name}
              </span>
              <span className="choice-tab-points" data-testid="choice-points">
                {pointText(points.choices[i] ?? null)}
              </span>
              <span className="choice-tab-sub">担当が変わる {d?.diff?.moved.length ?? 0}件</span>
            </button>
          );
        })}
      </div>
      <div className="choice-panel stack" role="tabpanel" data-testid="choice-panel">
        <div className="row choice-summary" style={{ flexWrap: 'wrap', gap: 8 }}>
          <p className="choice-stats" data-testid="choice-stats">
            <strong>{k >= 0 ? chosen?.name : '今の担当'}</strong>：{pointText(shown)}
            {k >= 0 &&
              diff !== null &&
              `（今 ${pointText(points.current)}・${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff)}）`}
            {day && (
              <>
                ・担当が変わる <strong>{day.diff?.moved.length ?? 0}</strong>件・時刻が変わる{' '}
                <strong>{day.diff?.shifted.length ?? 0}</strong>件
                {day.diff ? `・${travelText(day.diff.travelDelta)}` : ''}
              </>
            )}
            {unassigned.length > 0 && <span className="warn-text">・担当なし {unassigned.length}件</span>}
          </p>
          {k >= 0 && (
            <div className="row choice-actions">
              <button
                type="button"
                className="btn btn-primary btn-small"
                disabled={run !== null || !ok}
                onClick={() => void adopt(k)}
                data-testid="choice-adopt"
              >
                <WithIcon icon={CircleCheck} size={14}>
                  この案を標準にする
                </WithIcon>
              </button>
              <button
                type="button"
                className="btn btn-small"
                disabled={run !== null || !ok}
                onClick={() => applyOnly(k)}
                data-testid="choice-apply"
              >
                この日だけ反映
              </button>
            </div>
          )}
        </div>
        {k >= 0 && !ok && (
          <span className="sub warn-text" data-testid="proposal-stale">
            提案を出したあとに訪問が変わりました（反映できません）
          </span>
        )}
        {day && changes.size === 0 && (
          <p className="sub" data-testid="choice-same">
            変わる訪問はありません
            {chosen?.presetId === data.scorePresetId
              ? '（今の予定は、この考え方（点数の基準）で組んであります）'
              : '（今の担当と同じ）'}
          </p>
        )}
        {k >= 0 && changes.size > 0 && <p className="sub">「担当」「時刻」の印の訪問が、今と変わる訪問です</p>}
        <RouteTimeline columns={columns} legOn={() => false} onLeg={() => {}} />
        {unassigned.length > 0 && (
          <p className="sub warn-text" data-testid="choice-unassigned">
            担当なし：{unassigned.map((id) => clientName(id)).join('・')}
          </p>
        )}
        {day && changes.size > 0 && (
          <details className="reassign-moves-box">
            <summary>変わる訪問の一覧（{changes.size}件）</summary>
            <ProposalChanges data={data} day={day} />
          </details>
        )}
      </div>
    </section>
  );
}

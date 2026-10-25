// 考え方ごとの案の帯（PRD D357。ADR-0064）：組み方の標準が無い日の範囲で、考え方（プリセット）ごとに組んだ案を
// タブで切り替えて「今日の予定」と同じ時間軸で見る（今の担当のタブもある）。タブに点（点数の基準の物差し・100点満点）、
// 選んだ案に［この案を標準にする］（確認のあと、その日に反映し、その曜日の担当・時刻を来週の月曜から標準にし、考え方を
// 点数の基準にする。元に戻すの1手）［この日だけ反映］。担当や時刻が変わる訪問は時間軸の帯に印を付け、一覧でも見られる
import { useMemo, useRef, useState } from 'react';
import { jstDate } from '../domain/time';
import { choicePoints, choiceStaffIds } from '../lib/choiceBandView';
import { ownerOf, routesOf, unassignedOf } from '../lib/dayPlan';
import {
  type BatchProposal,
  monthBatch,
  type ProposalChange,
  proposalDayChanges,
  proposalDayFresh,
} from '../lib/monthBatch';
import { buildRouteMap, homeLegKey } from '../lib/routeView';
import { bestIndex } from '../lib/standard';
import type { LegSpan } from '../lib/timeline';
import { ChoiceHead, ChoiceMapCard, ChoiceSummary, ChoiceTabs } from './choiceBandParts';
import { CHOICE_SET, choiceTimelineColumns } from './choiceColumns';
import { ProposalChanges } from './proposalChanges';
import { RouteTimeline } from './routeTimeline';
import { useChoiceActions } from './useChoiceActions';
import { useDayModel } from './useDayModel';
import { useRouteSelection } from './useRouteSelection';
import { useValueStore } from './valueStore';

type Routes = Record<string, string[]>;

export function ChoiceBand({ proposal }: { proposal: BatchProposal }) {
  const choices = proposal.choices ?? [];
  const date = choices[0]?.days[0]?.date ?? jstDate(Date.now());
  const m = useDayModel(date);
  const { data, staffById, clientById, colorOfStaff } = m;
  const run = useValueStore(monthBatch.run);
  const { applyOnly, adopt } = useChoiceActions(proposal, data, jstDate(Date.now()));
  /** 見ているタブ（-1 は今の担当） */
  const [tab, setTab] = useState(0);
  /** 地図で見る担当・強調する区間・選んだ訪問（予定の画面と共通。担当は見ているタブの案で引く） */
  const owners = useRef(new Map<string, string>());
  const mapCardRef = useRef<HTMLDivElement>(null);
  const sel = useRouteSelection(date, (_set, id) => owners.current.get(id));
  const pick = (next: number) => {
    setTab(next);
    sel.reset();
  };

  const first = choices[0]?.days[0];
  /** 今の担当（組み始めたときの訪問から）と、案ごとの担当 */
  const current: Routes = useMemo(() => (first ? routesOf(first.problem, first.visits) : {}), [first]);
  const points = useMemo(
    () => choicePoints(m.scoreProblem, m.scoreScale, current, choices),
    [m.scoreProblem, m.scoreScale, current, choices],
  );
  /** 列にする人：今の担当かどれかの案で訪問のある人（タブを替えても列が動かない） */
  const staffIds = useMemo(
    () => (first ? choiceStaffIds(first, current, choices) : new Set<string>()),
    [first, current, choices],
  );
  const best = bestIndex(points.choices.map((p) => ({ points: p })));

  if (!first) return null;
  const k = tab >= choices.length ? 0 : tab;
  const chosen = k >= 0 ? choices[k] : undefined;
  const day = chosen?.days[0];
  const problem = day?.problem ?? first.problem;
  const routes = day?.routes ?? current;
  owners.current = ownerOf(routes);
  const visitById = new Map(first.visits.map((v) => [v.id, v]));
  const changes = new Map<string, ProposalChange>(day ? proposalDayChanges(day).map((r) => [r.visitId, r]) : []);
  const unassigned = unassignedOf(problem, routes);
  const ok = k >= 0 && (choices[k]?.days.every((d) => proposalDayFresh(data, d)) ?? false);
  const clientName = (visitId: string) => {
    const v = problem.visits.find((x) => x.id === visitId);
    return (v && clientById.get(v.clientId)?.displayName) ?? '（不明）';
  };

  const columns = choiceTimelineColumns({
    problem,
    routes,
    staffIds,
    staffById,
    colorOfStaff,
    slotsOf: m.slotsOf,
    changes,
    visitTypes: data.visitTypes,
    sel,
    typeIdOf: (visitId) => visitById.get(visitId)?.typeId,
    clientName,
    staffName: (id) => (id === null ? '担当なし' : `${staffById.get(id)?.name ?? '（不明）'}さん`),
  });

  /** 時間軸の区間 → 地図で強調する区間（自宅までは `home:<担当>`、来る区間は行き先の訪問。予定の画面と同じ） */
  const legSel = (leg: LegSpan) => ({
    id: leg.kind === 'toHome' ? homeLegKey(owners.current.get(leg.visitId) ?? '') : leg.visitId,
    set: CHOICE_SET,
  });
  const mapTitle = `地図${sel.focusStaff ? `：${staffById.get(sel.focusStaff)?.name ?? ''}` : ''}`;
  const map = buildRouteMap({
    sets: [{ key: CHOICE_SET, routes }],
    staffOrder: columns.map((c) => c.staffId),
    staffById,
    visitById,
    clientById,
    colorOfStaff,
    focusStaff: sel.focusStaff,
    picked: sel.picked,
    focusLeg: sel.focusLeg,
  });

  return (
    <section
      className="plan-band schedule-band proposal-band choice-band stack"
      aria-label="AI の案"
      data-testid="proposal-band"
      data-kind="choices"
    >
      <ChoiceHead label={proposal.label} count={choices.length} />
      <ChoiceTabs choices={choices} k={k} best={best} points={points} onPick={pick} />
      <div className="choice-panel stack" role="tabpanel" data-testid="choice-panel">
        <ChoiceSummary
          k={k}
          chosen={chosen}
          day={day}
          shown={(k >= 0 ? points.choices[k] : points.current) ?? null}
          currentPoints={points.current}
          unassignedCount={unassigned.length}
          canAct={run === null && ok}
          onAdopt={() => void adopt(k)}
          onApplyOnly={() => applyOnly(k)}
        />
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
        {k >= 0 && changes.size > 0 && (
          <p className="sub">「代」（担当が変わる）・「±分」（時刻が変わる）の印の訪問が、今と変わる訪問です</p>
        )}
        {/* 予定の画面と同じ並び：時間軸の下に地図（全幅）。地図が画面の外なら右下に浮かせる（MapDock） */}
        <RouteTimeline
          columns={columns}
          legOn={(leg) => sel.isLeg(legSel(leg))}
          onLeg={(leg) => sel.toggleLeg(legSel(leg))}
        />
        <ChoiceMapCard
          cardRef={mapCardRef}
          map={map}
          title={mapTitle}
          focusStaff={sel.focusStaff}
          focusKey={sel.focusKey}
          staffIds={columns.map((c) => c.staffId).filter((sid) => (routes[sid]?.length ?? 0) > 0)}
          staffById={staffById}
          onClear={sel.clear}
          onFocus={sel.focusOn}
        />
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

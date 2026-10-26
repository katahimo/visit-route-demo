// 案を日で見る（ChoiceDayView。PRD D350。ADR-0065）：考え方ごとの案のその日を、タブ（今・案ごと。点（点数の基準の物差し・
// 100点満点）と今から担当が変わる件数。いちばん点の高い案に王冠）で切り替えて「今日の予定」と同じ見せ方で見る
// （担当ごとの時間軸を読み取り専用で。下に全幅の地図、画面の外なら右下に浮かぶ地図。担当・時刻が変わる訪問に印）。
// 入力は提案の入れ物に縛られない形（その日の問題・今の割当・案ごとの割当）。組み方の標準の「日で見る」で使う
import { type ReactNode, useMemo, useRef } from 'react';
import type { Visit } from '../contracts/documents';
import {
  type ChoiceDayInput,
  choiceDiff,
  choicePoints,
  choiceStaffIds,
  choiceTab,
  type DayChoice,
} from '../lib/choiceBandView';
import { ownerOf, unassignedOf } from '../lib/dayPlan';
import type { ProposalChange } from '../lib/monthBatch';
import { buildRouteMap, homeLegKey } from '../lib/routeView';
import { bestIndex } from '../lib/standard';
import type { LegSpan } from '../lib/timeline';
import { ChoiceMapCard, ChoiceSummary, ChoiceTabs } from './choiceBandParts';
import { CHOICE_SET, choiceTimelineColumns } from './choiceColumns';
import { ProposalChanges } from './proposalChanges';
import { RouteTimeline } from './routeTimeline';
import { useDayModel } from './useDayModel';
import { useRouteSelection } from './useRouteSelection';
import './choiceBand.css';

export type ChoiceDayViewProps = {
  input: ChoiceDayInput;
  /** その日の訪問（名前・種類・地図。今の割当の訪問） */
  visits: readonly Visit[];
  /** 見ているタブ（'current' か案のプリセット ID。null は既定＝いちばん点の高い案） */
  tab: string | null;
  onTab: (tab: string) => void;
  /** 今のタブの名前（「今の標準」） */
  currentLabel: string;
  /** 選んだ案の操作（［この案から作る］など） */
  action?: (choice: DayChoice) => ReactNode;
};

export function ChoiceDayView({ input, visits, tab, onTab, currentLabel, action }: ChoiceDayViewProps) {
  const { problem, current, choices } = input;
  const date = problem.date;
  const m = useDayModel(date);
  const { data, staffById, clientById, colorOfStaff } = m;
  /** 地図で見る担当・強調する区間・選んだ訪問（予定の画面と共通。担当は見ているタブの案で引く） */
  const owners = useRef(new Map<string, string>());
  const mapCardRef = useRef<HTMLDivElement>(null);
  const sel = useRouteSelection(date, (_set, id) => owners.current.get(id));

  const points = useMemo(() => choicePoints(problem, current, choices), [problem, current, choices]);
  /** 列にする人：今かどれかの案で訪問のある人（タブを替えても列が動かない） */
  const staffIds = useMemo(() => choiceStaffIds(problem, current, choices), [problem, current, choices]);
  /** 案ごとの今 → 案の差（担当が変わる・時刻が変わる） */
  const diffs = useMemo(() => choices.map((c) => choiceDiff(problem, current, c.routes)), [problem, current, choices]);
  const best = bestIndex(points.choices.map((p) => ({ points: p })));
  const k = choiceTab(tab, choices, best);
  const chosen = k >= 0 ? choices[k] : undefined;
  const d = k >= 0 ? diffs[k] : undefined;
  const routes = chosen?.routes ?? current;
  owners.current = ownerOf(routes);
  const pick = (next: number) => {
    onTab(next < 0 ? 'current' : (choices[next]?.presetId ?? 'current'));
    sel.reset();
  };

  const visitById = new Map(visits.map((v) => [v.id, v]));
  const changes = new Map<string, ProposalChange>((d?.changes ?? []).map((r) => [r.visitId, r]));
  const unassigned = unassignedOf(problem, routes);
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
    <div className="choice-day stack">
      <ChoiceTabs
        currentLabel={currentLabel}
        choices={choices}
        moved={diffs.map((x) => x.diff?.moved.length ?? 0)}
        k={k}
        best={best}
        points={points}
        onPick={pick}
      />
      <div className="choice-panel stack" role="tabpanel" data-testid="choice-panel">
        <ChoiceSummary
          name={chosen?.name ?? currentLabel}
          isChoice={k >= 0}
          diff={d?.diff ?? null}
          shown={(k >= 0 ? points.choices[k] : points.current) ?? null}
          currentPoints={points.current}
          currentLabel={currentLabel}
          unassignedCount={unassigned.length}
          action={chosen && action ? action(chosen) : undefined}
        />
        {chosen && changes.size === 0 && (
          <p className="sub" data-testid="choice-same">
            変わる訪問はありません（{currentLabel}と同じ）
          </p>
        )}
        {chosen && changes.size > 0 && (
          <p className="sub">
            「代」（担当が変わる）・「±分」（時刻が変わる）の印の訪問が、{currentLabel}から変わる訪問です
          </p>
        )}
        {/* 予定の画面と同じ並び：時間軸の下に地図（全幅）。地図が画面の外なら右下に浮かせる（MapDock）。札は動かさない */}
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
        {chosen && d && changes.size > 0 && (
          <details className="reassign-moves-box">
            <summary>変わる訪問の一覧（{changes.size}件）</summary>
            <ProposalChanges data={data} day={{ date, problem, routes, diff: d.diff }} />
          </details>
        )}
      </div>
    </div>
  );
}

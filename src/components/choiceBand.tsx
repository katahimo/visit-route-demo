// 考え方ごとの案の帯（PRD D357。ADR-0064）：組み方の標準が無い日の範囲で、考え方（プリセット）ごとに組んだ案を
// タブで切り替えて「今日の予定」と同じ時間軸で見る（今の担当のタブもある）。タブに点（点数の基準の物差し・100点満点）、
// 選んだ案に［この案を標準にする］（確認のあと、その日に反映し、その曜日の担当・時刻を来週の月曜から標準にし、考え方を
// 点数の基準にする。元に戻すの1手）［この日だけ反映］。担当や時刻が変わる訪問は時間軸の帯に印を付け、一覧でも見られる
import { CircleCheck, Clock, Crown, Map as MapIcon, Sparkles, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { slotsText } from '../domain/availability';
import { jstDate, minutesToHhmm } from '../domain/time';
import { busyStaff, choiceColumns } from '../lib/choiceView';
import { colorOf } from '../lib/colors';
import { dateText, deltaText, newId, r0, WEEKDAY_LABELS } from '../lib/common';
import { ownerOf, pointsOf, routesOf, unassignedOf } from '../lib/dayPlan';
import {
  type BatchProposal,
  monthBatch,
  type ProposalChange,
  proposalDayChanges,
  proposalDayFresh,
} from '../lib/monthBatch';
import { mdText, typeOf } from '../lib/patternText';
import { buildRouteMap, homeLegKey, useRouteSelection } from '../lib/routeView';
import { bestIndex, dayStandardPreview, registerDayStandard } from '../lib/standard';
import { type LegSpan, legsOf } from '../lib/timeline';
import { useDayModel } from '../lib/useDayModel';
import { useValueStore } from '../lib/valueStore';
import { useConfirm } from './ConfirmDialog';
import { MapDock } from './MapDock';
import { ProposalChanges } from './proposalChanges';
import { RouteMap } from './RouteMap';
import { RouteTimeline, type TimelineColumn } from './routeTimeline';
import { StaffFocusButton, StaffLegend } from './routeView';
import { useToast } from './Toast';
import { shiftShort, TlMark } from './timelineMarks';
import { SectionTitle, WithIcon } from './ui';

type Routes = Record<string, string[]>;
/** 地図・選択の集まりのキー（案は1つずつ見る） */
const CHOICE_SET = 'choice';
const NO_DROP = { onDragOver: () => {}, onDragLeave: () => {}, onDrop: () => {} };

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
    () => ({
      current: pointsOf(m.scoreProblem, m.scoreScale, current),
      choices: choices.map((c) => (c.days[0] ? pointsOf(m.scoreProblem, m.scoreScale, c.days[0].routes) : null)),
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
  const fresh = (i: number) => choices[i]?.days.every((d) => proposalDayFresh(data, d)) ?? false;
  const ok = k >= 0 && fresh(k);
  const staffName = (id: string | null) => (id === null ? '担当なし' : `${staffById.get(id)?.name ?? '（不明）'}さん`);
  const visitOf = (visitId: string) => first.visits.find((v) => v.id === visitId);
  const clientName = (visitId: string) => {
    const v = problem.visits.find((x) => x.id === visitId);
    return (v && clientById.get(v.clientId)?.displayName) ?? '（不明）';
  };
  const staleText = '提案を出したあとに訪問が変わったので、反映しませんでした。もう一度組んでください';

  const columns: TimelineColumn[] = choiceColumns(problem, routes, staffIds, staffById).map((col) => {
    const s = staffById.get(col.staffId);
    return {
      staffId: col.staffId,
      // 地図で見ている人の列を強調し、ほかを薄くする（予定の画面と同じ）
      className: [
        sel.focusStaff === col.staffId ? 'is-focus' : '',
        sel.focusStaff && sel.focusStaff !== col.staffId ? 'is-dim-col' : '',
      ].join(' '),
      style: { borderTopColor: colorOfStaff.get(col.staffId) },
      drop: NO_DROP,
      header: (
        <>
          <div className="spread">
            <StaffFocusButton
              staff={s}
              name={s?.name ?? '（不明）'}
              on={sel.focusStaff === col.staffId}
              onToggle={() => sel.focusOn(sel.focusStaff === col.staffId ? null : col.staffId)}
            />
            <span className="chip">{col.stops.length}件</span>
          </div>
          <div className="col-hours">
            <span className="sub item-time">
              <Clock size={13} aria-hidden="true" />
              {slotsText(m.slotsOf.get(col.staffId)?.slots ?? [])}
            </span>
          </div>
        </>
      ),
      baseSlots: col.slots,
      slots: col.slots,
      bands: col.stops.map((t) => {
        const c = changes.get(t.visitId);
        const type = typeOf(data.visitTypes, visitOf(t.visitId)?.typeId);
        // 予定の画面の振り直しと同じ印：担当が変わる（代）・時刻だけ変わる（±分）
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
          color: type ? colorOf(type.color) : null,
          tone: null,
          picked: sel.isPicked({ id: t.visitId, set: CHOICE_SET }),
          dragging: false,
          onPick: () => sel.togglePick({ id: t.visitId, set: CHOICE_SET }),
          note,
          marks:
            c && note ? (
              <TlMark tone={c.kind === 'staff' ? 'is-move' : 'is-warn'} title={note} testId="choice-mark">
                {c.kind === 'staff' ? '代' : shiftShort(c.minutes)}
              </TlMark>
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

  /** 時間軸の区間 → 地図で強調する区間（自宅までは `home:<担当>`、来る区間は行き先の訪問。予定の画面と同じ） */
  const legSel = (leg: LegSpan) => ({
    id: leg.kind === 'toHome' ? homeLegKey(owners.current.get(leg.visitId) ?? '') : leg.visitId,
    set: CHOICE_SET,
  });
  const mapTitle = `地図${sel.focusStaff ? `：${staffById.get(sel.focusStaff)?.name ?? ''}` : ''}`;
  const mapStaff = columns.map((c) => c.staffId).filter((sid) => (routes[sid]?.length ?? 0) > 0);
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
          onClick={() => pick(-1)}
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
              onClick={() => pick(i)}
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
                {day.diff ? `・移動 ${deltaText(r0(day.diff.travelDelta), '分')}` : ''}
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
        {k >= 0 && changes.size > 0 && (
          <p className="sub">「代」（担当が変わる）・「±分」（時刻が変わる）の印の訪問が、今と変わる訪問です</p>
        )}
        {/* 予定の画面と同じ並び：時間軸の下に地図（全幅）。地図が画面の外なら右下に浮かせる（MapDock） */}
        <RouteTimeline
          columns={columns}
          legOn={(leg) => sel.isLeg(legSel(leg))}
          onLeg={(leg) => sel.toggleLeg(legSel(leg))}
        />
        <div ref={mapCardRef} className="choice-map stack" data-testid="choice-map">
          <SectionTitle
            icon={MapIcon}
            aside={
              sel.focusStaff && (
                <button type="button" className="btn btn-small" onClick={sel.clear}>
                  全員のルートを見る
                </button>
              )
            }
          >
            {mapTitle}
          </SectionTitle>
          <RouteMap points={map.points} lines={map.lines} height={420} />
          <StaffLegend
            staffIds={mapStaff}
            staffName={(id) => staffById.get(id)?.name ?? '（不明）'}
            focusStaff={sel.focusStaff}
            onFocus={sel.focusOn}
            extra={<span className="nowrap legend-item">「家」＝自宅</span>}
          />
        </div>
        <MapDock target={mapCardRef} points={map.points} lines={map.lines} title={mapTitle} focusKey={sel.focusKey} />
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

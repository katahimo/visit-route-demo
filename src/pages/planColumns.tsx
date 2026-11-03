// 日の予定の担当の列（PRD D58・D63・D231）：列の見出し・class・「担当なしの訪問」の列・時間軸の列・自宅までの区間と、
// 時間軸／順番の表示（PlanBoard）
import { CircleOff, Clock, UserRoundX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PersonInfo } from '../components/PersonPopover';
import { RouteTimeline, type TimelineColumn } from '../components/routeTimeline';
import { LegLine, StaffFocusButton } from '../components/routeView';
import type { StopTiming } from '../contracts/problem';
import { slotsText } from '../domain/availability';
import { NONE } from '../domain/scheduleModel';
import { absenceText } from '../lib/absences';
import { hasLocation, own } from '../lib/common';
import { showLegs, showUnplacedReasons } from '../lib/exceptionView';
import { unplacedReasons } from '../lib/planView';
import { hardReasonLabels, notAllowedText } from '../lib/reassignMenu';
import { homeLegKey, homeTravel } from '../lib/routeView';
import { reasonFace } from '../lib/scoreReason';
import { spansOf } from '../lib/spans';
import { type LegSpan, legsOf, markLegs, shadowOf } from '../lib/timeline';
import { CandidateBox } from './absenceParts';
import { bandOf, bv, card } from './planCards';
import { PLAN_SET } from './usePlanNav';
import type { PlanCtx } from './usePlanPage';

/** 列の最後の「自宅まで N分」（押すと地図でその区間を強調。もう一度押すと外す。自宅の位置が無い人は出さない） */
export function homeLeg(p: PlanCtx, sid: string) {
  const { problem, routes, staffById, sel, only } = bv(p);
  if (!showLegs(only)) return null;
  const t = homeTravel(problem, staffById.get(sid), routes);
  if (t === null) return null;
  const x = { id: homeLegKey(sid), set: PLAN_SET };
  return <LegLine kind="toHome" minutes={t} on={sel.isLeg(x)} onToggle={() => sel.toggleLeg(x)} />;
}

/** 列の要素の class（落とす先・必須に合わない予告・薄い列・地図の絞り込み）。順番・時間軸で共通 */
export function colClass(p: PlanCtx, sid: string) {
  const { allowedFor, focusStaff, dragging, dropTo, reassignMarks, rDiff } = bv(p);
  return [
    dropTo === sid ? 'is-drop' : '',
    dropTo === sid && dragging !== null && !allowedFor(dragging, sid) ? 'is-red' : '',
    rDiff && !reassignMarks.changed.has(sid) ? 'is-unchanged' : '',
    focusStaff === sid ? 'is-focus' : '',
    focusStaff && focusStaff !== sid ? 'is-dim-col' : '',
  ].join(' ');
}

/** 列の見出し（名前・件数・稼働時間帯・欠勤・欠勤の人の近道・必須に合わない予告）。順番・時間軸で共通 */
export function colHeader(p: PlanCtx, sid: string) {
  const {
    problem,
    routes,
    staffById,
    staffName,
    slotsOf,
    allowedFor,
    focusStaff,
    focusOn,
    dragging,
    dropTo,
    reassignInfo,
    absentStaff,
    rDiff,
    left,
    goToBar,
    annealRecommended,
    annealDisabled,
    suddenOn,
    suddenState,
    flow,
  } = bv(p);
  const ids = own(routes, sid) ?? [];
  const notAllowed = dropTo === sid && dragging !== null && !allowedFor(dragging, sid);
  const avail = slotsOf.get(sid);
  const s = staffById.get(sid);
  return (
    <>
      <div className="spread">
        <StaffFocusButton
          staff={s}
          name={staffName(sid)}
          on={focusStaff === sid}
          onToggle={() => focusOn(focusStaff === sid ? null : sid)}
        />
        <span className="chip">{ids.length}件</span>
      </div>
      <div className="col-hours">
        {(avail?.slots.length ?? 0) > 0 ? (
          <span className="sub item-time">
            <Clock size={13} aria-hidden="true" />
            {slotsText(avail?.slots ?? [])}
          </span>
        ) : avail?.absence ? null : (
          <span className="chip chip-off">{s && !s.active ? '休止中' : '休み'}</span>
        )}
        {avail?.absence && (
          <span className="chip chip-red" title={avail.absence.note || undefined} data-testid="absence-mark">
            <UserRoundX size={12} aria-hidden="true" />
            {absenceText(avail.absence, avail.baseSlots)}
          </span>
        )}
        {avail?.overridden && <span className="chip chip-warn">この日だけ変更</span>}
        {suddenOn && (avail?.baseSlots.length ?? 0) > 0 && (
          <button
            type="button"
            className="link-btn absence-btn"
            onClick={() => suddenState.open({ kind: 'staff', staffId: sid })}
            aria-label={
              avail?.absence ? `${staffName(sid)}さんの欠勤を直す` : `この人の欠勤を登録（${staffName(sid)}さん）`
            }
          >
            {/* 入口の呼び方（PRD D231）：欠勤が無ければ「この人の欠勤を登録」、あれば「欠勤を直す」 */}
            {/* 狭い列では「この人の／欠勤を登録」の区切りで折り返す（plan.css の keep-all と wbr） */}
            {avail?.absence ? (
              '欠勤を直す'
            ) : (
              <>
                この人の
                <wbr />
                欠勤を登録
              </>
            )}
          </button>
        )}
        {/*
          詳細の「i」（PRD D124）。見出しのボタン（地図の絞り込み）と入れ子にせず、名前の幅も食わないよう2行目の右端に置く
        */}
        {s && <PersonInfo kind="staff" id={sid} name={s.name} className="col-info" testId="col-info" />}
      </div>
      {reassignInfo && absentStaff.has(sid) && (
        <div className="row col-reassign" data-testid="col-reassign">
          <button type="button" className="link-btn" onClick={goToBar}>
            振り直し済み・入らない（全体） {rDiff?.unplaced.length ?? 0}件
          </button>
          {left.some((x) => x.staffId === sid) && (
            <button type="button" className="chip chip-red chip-btn" onClick={goToBar}>
              欠勤の人のまま {left.filter((x) => x.staffId === sid).length}件
            </button>
          )}
          {annealRecommended && !annealDisabled && (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                flow.anneal.start();
                goToBar();
              }}
            >
              案B を作る
            </button>
          )}
        </div>
      )}
      {notAllowed && problem && dragging !== null && (
        <div className="drop-warning" data-testid="drop-warning">
          ここに移すと：{notAllowedText(hardReasonLabels(problem, dragging, sid))}
        </div>
      )}
    </>
  );
}

/** 「担当なしの訪問」の列（ドラッグの受け口にもなる） */
export function noneCol(p: PlanCtx) {
  const {
    problem,
    routes,
    explained,
    visitById,
    clientOf,
    staffName,
    unassigned,
    noneColId,
    dropTo,
    dropProps,
    running,
    reassignMarks,
    placeCandidate,
    date,
    only,
    whyOf,
  } = bv(p);
  return (
    <div
      className={[
        'route-col route-col-none',
        // ドラッグの間だけ出す空の列は最後に置き、ほかの列をずらさない（掴んだカードが指の下から逃げない）
        unassigned.length === 0 ? 'is-drag-only' : '',
        dropTo === NONE ? 'is-drop' : '',
      ].join(' ')}
      id={noneColId}
      data-staff={NONE}
      {...dropProps(NONE)}
    >
      <div className="spread">
        <strong className="col-head">
          <CircleOff size={16} aria-hidden="true" />
          担当なしの訪問
        </strong>
        <span className="chip chip-warn">{unassigned.length}件</span>
      </div>
      {unassigned.length === 0 && <span className="sub">ここへドラッグすると担当なしにできます</span>}
      {/* 日の予定では AI で組まない（ADR-0063）ので、入れ方を書き、この日の担当を組むへ案内する */}
      {unassigned.length > 0 && (
        <span className="sub" data-testid="unassigned-help">
          カードを担当の列へドラッグすると入れられます。まとめて入れるなら
          <Link to={`/arrange?date=${date}`} data-testid="unassigned-arrange">
            この日の担当を組む
          </Link>
        </span>
      )}
      {unassigned.map((id) => {
        const reasons = unplacedReasons(problem, explained, id);
        const why = whyOf.get(id);
        const client = clientOf(id);
        return (
          <div key={id} className="stack" style={{ gap: 2 }}>
            {card(p, id)}
            {/* 組めない理由の短い内訳（入切とも控えめに。押すと訪問の詳細の「組めない理由」で案内とリンク。PRD D430） */}
            {why && (
              <span className="sub unplaced-why" title={why.guide} data-testid="unplaced-why">
                組めない理由：{why.summary}
              </span>
            )}
            {/* 〈利用者さん〉の名前はカード（押すと選ぶ・ドラッグ）の中なので、詳細は外の i から開く（PRD D205） */}
            <div className="row unplaced-reasons" style={{ flexWrap: 'wrap', gap: 4 }}>
              {client && <PersonInfo kind="client" id={client.id} name={client.displayName} testId="unplaced-info" />}
              {/* 理由の札は符号の無い言葉（PRD D229。内部の値は title にだけ）。札ごとに「理由 N ▾」で開く（入。PRD D393）。
                担当なしの理由の一覧なので、（担当にできない）は付けない（札の名前が理由そのもの。title に残る） */}
              {showUnplacedReasons(only) && reasons.length > 0 && (
                <details className="unplaced-reasons-fold" data-testid="unplaced-reasons-fold">
                  <summary data-testid="unplaced-reasons-toggle">理由 {reasons.length} ▾</summary>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
                    {reasons.map((r) => {
                      const f = reasonFace(r);
                      return (
                        <span
                          key={`${r.ruleId}:${r.label}`}
                          className="chip chip-warn"
                          title={f.title}
                          data-testid="unplaced-reason"
                        >
                          {f.text}
                          {f.note && f.note !== '担当にできない' && `（${f.note}）`}
                        </span>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
            {problem && reassignMarks.unplaced.has(id) && (
              <CandidateBox
                problem={problem}
                routes={routes}
                visitId={id}
                staffName={staffName}
                visit={visitById.get(id)}
                running={!!running}
                onPlace={(c) => placeCandidate(id, c)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 時間軸の列の移動の区間（組みの結果の時刻から。分数は計算し直さない）。切でも出す（PRD D431）：
 * 位置が未登録の区間は見込み、着く時刻が「いつまでに始める」を過ぎる区間は警告
 */
function columnLegs(p: PlanCtx, sid: string, ids: string[], stops: StopTiming[]): LegSpan[] {
  const { problem, routes, staffById, clientOf } = bv(p);
  if (stops.length !== ids.length) return [];
  const home = staffById.get(sid)?.home;
  return markLegs(legsOf(stops, homeTravel(problem, staffById.get(sid), routes, true)), {
    order: ids,
    visitPlace: (id) => clientOf(id)?.place,
    homePlaced: home !== undefined && hasLocation(home),
    latestOf: (id) => problem?.visits.find((v) => v.id === id)?.latest,
  });
}

/** 時間軸の列（PRD D58） */
export function timelineCol(p: PlanCtx, sid: string): TimelineColumn {
  const { problem, routes, owner, explained, slotsOf, colorOfStaff, dragging, dropTo, dropProps } = bv(p);
  const ids = own(routes, sid) ?? [];
  const avail = slotsOf.get(sid);
  const stops = ids.flatMap((id) => {
    const t = explained.get(id)?.timing;
    return t ? [t] : [];
  });
  const shadow =
    dropTo === sid && dragging !== null && problem && owner.get(dragging) !== sid
      ? shadowOf(problem, routes, dragging, sid)
      : null;
  return {
    staffId: sid,
    className: colClass(p, sid),
    style: { borderTopColor: colorOfStaff.get(sid) },
    drop: dropProps(sid),
    header: colHeader(p, sid),
    baseSlots: spansOf(avail?.baseSlots ?? []),
    slots: spansOf(avail?.slots ?? []),
    bands: ids.map((id) => bandOf(p, id, sid)),
    legs: columnLegs(p, sid, ids, stops),
    shadow,
    emptyText: 'ここへドラッグすると移せます',
  };
}

/** 時間軸の区間 → 地図で強調する区間（自宅までは `home:<担当>`、来る区間は行き先の訪問） */
export function legSel(p: PlanCtx, leg: LegSpan) {
  const { owner } = bv(p);
  return {
    id: leg.kind === 'toHome' ? homeLegKey(owner.get(leg.visitId) ?? '') : leg.visitId,
    set: PLAN_SET,
  };
}

/** 時間軸（PRD D58）か順番の表示（列ごとのカード）。担当なしの訪問があれば先頭に「担当なしの訪問」の列 */
export function PlanBoard({ p }: { p: PlanCtx }) {
  const { unassigned, columns, routes, colorOfStaff, owner, sel, dragging, dropProps } = bv(p);
  return (
    <div className="card stack plan-view" data-testid="plan-view">
      {p.v.shownView === 'timeline' ? (
        <>
          {unassigned.length > 0 && noneCol(p)}
          <RouteTimeline
            columns={columns.map((sid) => timelineCol(p, sid))}
            legOn={(leg) => sel.isLeg(legSel(p, leg))}
            onLeg={(leg) => sel.toggleLeg(legSel(p, leg))}
          />
          {/* 未割当が0件のときのドラッグの受け口は時間軸の下に出す（時間軸の位置を変えない） */}
          {unassigned.length === 0 && dragging !== null && owner.has(dragging) && noneCol(p)}
        </>
      ) : (
        <div className="route-grid">
          {(unassigned.length > 0 || (dragging !== null && owner.has(dragging))) && noneCol(p)}
          {columns.map((sid) => {
            const ids = own(routes, sid) ?? [];
            return (
              <div
                key={sid}
                className={`route-col ${colClass(p, sid)}`}
                style={{ borderTopColor: colorOfStaff.get(sid) }}
                data-staff={sid}
                {...dropProps(sid)}
              >
                {colHeader(p, sid)}
                {ids.length === 0 && <span className="sub">ここへドラッグすると移せます</span>}
                {ids.map((id) => card(p, id))}
                {homeLeg(p, sid)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

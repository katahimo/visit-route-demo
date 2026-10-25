// 提案を比べる（pages/ComparePage）の担当ごとの比較と地図。A は点線、B は実線。
// 訪問・区間・担当を選ぶと地図で目立つ（予定の画面と同じ useRouteSelection。集まりのキーは 'a'・'b'）
import { Car, Map as MapIcon, ShieldAlert, TriangleAlert, UserRound, Users } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { MapDock } from '../components/MapDock';
import { RouteMap } from '../components/RouteMap';
import { LegLine, StaffLegend, VisitCard } from '../components/routeView';
import { StaffMarkById } from '../components/StaffMark';
import { Hint, SectionTitle, WithIcon } from '../components/ui';
import type { useRouteSelection } from '../components/useRouteSelection';
import type { Client, Staff, Visit } from '../contracts/documents';
import type { PlanScore, Problem, VisitExplain } from '../contracts/problem';
import { deltaText, own, r0 } from '../lib/common';
import { type CompareChoice, type CompareSide, movedLabel, routeTotals } from '../lib/compareChoices';
import { buildRouteMap, homeLegKey, homeTravel } from '../lib/routeView';
import { ReasonBox } from './planParts';

type RouteSelection = ReturnType<typeof useRouteSelection>;

/** A・B の片方の担当の並び・説明・採点・持ち主（訪問 → 担当） */
export type CompareSideView = {
  routes: Record<string, string[]>;
  explain: ReadonlyMap<string, VisitExplain>;
  score: PlanScore | null;
  owner: ReadonlyMap<string, string>;
};

/** 担当ごとの比較と地図に要るもの */
export type CompareStaffProps = {
  problem: Problem | null;
  A: CompareChoice;
  B: CompareChoice;
  a: CompareSideView;
  b: CompareSideView;
  staffIds: string[];
  staffById: Map<string, Staff>;
  visitById: Map<string, Visit>;
  clientById: Map<string, Client>;
  colorOfStaff: Map<string, string>;
  staffName: (id: string) => string;
  staffTerm: string;
  rs: RouteSelection;
};

/** 1人の片方の案の訪問の札（もう一方で担当が違う訪問・守れない条件の訪問に印。最後に自宅までの区間） */
function StopCards({ p, staffId, side }: { p: CompareStaffProps; staffId: string; side: CompareSide }) {
  const { problem, staffById, visitById, clientById, rs } = p;
  const mine = side === 'a' ? p.a : p.b;
  const theirs = side === 'a' ? p.b : p.a;
  const ids = own(mine.routes, staffId) ?? [];
  if (ids.length === 0) return <span className="sub">訪問なし</span>;
  const back = homeTravel(problem, staffById.get(staffId), mine.routes);
  const homeX = { id: homeLegKey(staffId), set: side };
  const inProblem = !problem || problem.staff.some((s) => s.id === staffId);
  const clientOf = (visitId: string) => {
    const v = visitById.get(visitId);
    return v ? clientById.get(v.clientId) : undefined;
  };
  return (
    <div className="stack" style={{ gap: 0 }}>
      {!inProblem && (
        <span className="chip chip-red" style={{ alignSelf: 'flex-start' }}>
          <TriangleAlert size={12} aria-hidden="true" />
          この日は計算に入れていません（休み・休止中など）
        </span>
      )}
      {ids.map((id, i) => {
        const e = mine.explain.get(id);
        const moved = movedLabel(theirs.owner.get(id), staffId, side, p.staffName);
        const hard = mine.score?.hardViolations.some((h) => h.visitId === id);
        const x = { id, set: side };
        return (
          <VisitCard
            key={id}
            visitId={id}
            timing={e?.timing ?? null}
            fallbackTime={visitById.get(id)?.earliestStart ?? ''}
            client={clientOf(id)}
            first={i === 0}
            legOn={rs.isLeg(x)}
            onLeg={() => rs.toggleLeg(x)}
            picked={rs.isPicked(x)}
            onPick={() => rs.togglePick(x)}
            tone={hard ? 'red' : moved ? 'moved' : null}
            detail={<ReasonBox explain={e} />}
          >
            {(moved || hard) && (
              <div className="row visit-tags">
                {moved && <span className="chip chip-move">{moved}</span>}
                {hard && (
                  <span className="chip chip-red">
                    <ShieldAlert size={12} aria-hidden="true" />
                    守れない条件
                  </span>
                )}
              </div>
            )}
          </VisitCard>
        );
      })}
      {back !== null && (
        <LegLine kind="toHome" minutes={back} on={rs.isLeg(homeX)} onToggle={() => rs.toggleLeg(homeX)} />
      )}
    </div>
  );
}

/** 担当ごとの比較：人ごとに件数・移動の A→B と、A・B の訪問の札を並べる。人の名前を押すと地図がその人だけになる */
export function StaffCompareCard(p: CompareStaffProps) {
  const { problem, A, B, a, b, rs, staffName } = p;
  return (
    <div className="card stack">
      <SectionTitle
        icon={Users}
        aside={
          <Hint>
            <ul className="hint-list">
              <li>訪問を押すと、その担当になった理由が出て、地図でその訪問先が目立ちます。</li>
              <li>{p.staffTerm}の名前を押すと、地図がその人だけになります。もう一度押すと全員に戻ります。</li>
              <li>
                「自宅から」「自宅まで」や移動の分を押すと、地図でその道のりが目立ちます。A は点線、B は実線です。
              </li>
            </ul>
          </Hint>
        }
      >
        {p.staffTerm}ごとの比較
      </SectionTitle>
      <div className="compare">
        <div className="compare-row compare-header">
          <div />
          <div>
            <span className="ab-badge ab-a">A</span> {A.title}
          </div>
          <div>
            <span className="ab-badge ab-b">B</span> {B.title}
          </div>
        </div>
        {p.staffIds.map((id) => {
          const pa = routeTotals(problem, id, own(a.routes, id) ?? []);
          const pb = routeTotals(problem, id, own(b.routes, id) ?? []);
          const d = r0((pb?.travelMinutes ?? 0) - (pa?.travelMinutes ?? 0));
          return (
            <div key={id} className="compare-row" style={{ borderTopColor: p.colorOfStaff.get(id) }}>
              <button
                type="button"
                className={`compare-staff ${rs.focusStaff === id ? 'is-on' : ''}`}
                aria-pressed={rs.focusStaff === id}
                onClick={() => rs.focusOn(rs.focusStaff === id ? null : id)}
                title={rs.focusStaff === id ? '地図を全員に戻す' : '地図でこの人のルートだけを見る'}
              >
                <strong className="col-head">
                  <StaffMarkById id={id} size="sm" />
                  {staffName(id)}
                </strong>
                <span className="sub">
                  <WithIcon icon={UserRound} size={13}>
                    {own(a.routes, id)?.length ?? 0}件 → {own(b.routes, id)?.length ?? 0}件
                  </WithIcon>
                </span>
                {pa && pb && (
                  <>
                    <span className="sub">
                      <WithIcon icon={Car} size={13}>
                        {r0(pa.travelMinutes)}分 → {r0(pb.travelMinutes)}分
                      </WithIcon>
                    </span>
                    <span className={`chip ${d < 0 ? 'chip-ok' : d > 0 ? 'chip-warn' : ''}`}>{deltaText(d, '分')}</span>
                  </>
                )}
              </button>
              <div className="compare-col" data-side="A">
                <StopCards p={p} staffId={id} side="a" />
              </div>
              <div className="compare-col" data-side="B">
                <StopCards p={p} staffId={id} side="b" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 地図のカード（A 点線・B 実線）と、カードが画面の外のときに右下に浮かせる地図 */
export function CompareMapCard(p: CompareStaffProps) {
  const { staffIds, staffName, rs } = p;
  const { points, lines } = useMemo(
    () =>
      buildRouteMap({
        sets: [
          { key: 'a', routes: p.a.routes, dashed: true },
          { key: 'b', routes: p.b.routes },
        ],
        staffOrder: staffIds,
        staffById: p.staffById,
        visitById: p.visitById,
        clientById: p.clientById,
        colorOfStaff: p.colorOfStaff,
        focusStaff: rs.focusStaff,
        picked: rs.picked,
        focusLeg: rs.focusLeg,
      }),
    [
      p.a.routes,
      p.b.routes,
      staffIds,
      p.staffById,
      p.visitById,
      p.clientById,
      p.colorOfStaff,
      rs.focusStaff,
      rs.picked,
      rs.focusLeg,
    ],
  );
  const mapCardRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div className="card stack" ref={mapCardRef}>
        <SectionTitle
          icon={MapIcon}
          aside={
            rs.focusStaff && (
              <button type="button" className="btn btn-small" onClick={rs.clear}>
                全員のルートを見る
              </button>
            )
          }
        >
          地図{rs.focusStaff ? `：${staffName(rs.focusStaff)}` : ''}
        </SectionTitle>
        <RouteMap points={points} lines={lines} height={400} />
        <StaffLegend
          staffIds={staffIds}
          staffName={staffName}
          focusStaff={rs.focusStaff}
          onFocus={rs.focusOn}
          extra={
            <>
              <span className="legend-item">
                <span className="legend-line is-dashed" aria-hidden="true" />
                A（点線）
              </span>
              <span className="legend-item">
                <span className="legend-line legend-line-ink" aria-hidden="true" />
                B（実線）
              </span>
              <span className="nowrap legend-item">「家」＝自宅</span>
            </>
          }
        />
      </div>
      <MapDock
        target={mapCardRef}
        points={points}
        lines={lines}
        title={`地図${rs.focusStaff ? `：${staffName(rs.focusStaff)}` : ''}（A 点線・B 実線）`}
        focusKey={rs.focusKey}
      />
    </>
  );
}

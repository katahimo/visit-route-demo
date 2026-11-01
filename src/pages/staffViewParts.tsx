// 〈スタッフ〉のスマホ画面の部品（D16。PRD D99・D100。ADR-0018）：1日の全行程のリンクの行と、訪問の1件（移動・時刻・道順のリンク）
import { Car, Clock } from 'lucide-react';
import { MAPS_SR_TAIL, MapsLink, VisitRouteLinks } from '../components/mapsLinks';
import { VisitRules } from '../components/VisitRules';
import type { TravelMode } from '../contracts/codes';
import type { Client, Visit } from '../contracts/documents';
import { minutesToHhmm } from '../domain/time';
import { colorOf, initialOf } from '../lib/colors';
import { r0 } from '../lib/common';
import { BICYCLE_NOTE, HOME_LABEL, type TripLink } from '../lib/mapsLink';
import type { PrevStop } from '../lib/prevStop';

/** 訪問の時刻（移動を入れた時刻なら移動の分も。目安なら travel は null） */
export type StaffViewTiming = { start: number; end: number; travel: number | null };

/** 1日の全行程のリンクの行（経由地が多ければ分けたリンク）と、入らなかった場所の注記 */
export function StaffViewTrip({
  trip,
  clientTerm,
  mode,
}: {
  trip: { links: TripLink[]; skipped: string[]; homeSkipped: boolean };
  clientTerm: string;
  mode: TravelMode;
}) {
  const trips = trip.links;
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 6 }} data-testid="sv-trip">
      {trips.map((t) => {
        const text = trips.length > 1 ? `${t.label}を開く` : '1日の全行程を開く';
        const end = (x: string) => (x === HOME_LABEL ? x : `${x}さん`);
        return (
          <MapsLink
            key={t.label}
            href={t.href}
            label={`${text}（${end(t.from)}から${end(t.to)}まで。経由地${t.waypoints}件。${MAPS_SR_TAIL}）`}
            testId="maps-trip"
          >
            {text}
          </MapsLink>
        );
      })}
      {trip.skipped.length > 0 && (
        <span className="sub" data-testid="sv-trip-skipped">
          （場所が未登録の{clientTerm}（{trip.skipped.map((x) => `${x}さん`).join('・')}
          ）は全行程に入っていません）
        </span>
      )}
      {trip.homeSkipped && <span className="sub">（自宅の場所が未登録のため、全行程は自宅を通りません）</span>}
      {mode === 'BICYCLE' && <span className="sub">{BICYCLE_NOTE}</span>}
    </div>
  );
}

/** 訪問の1件（前からの移動・〈利用者さん〉・時刻・メモ・決まりごと・道順のリンク） */
export function StaffViewStop({
  v,
  c,
  t,
  prev,
  mode,
  first = false,
}: {
  v: Visit | undefined;
  c: Client | undefined;
  t: StaffViewTiming | undefined;
  /** 道順の起点（lib/prevStop） */
  prev: PrevStop | null;
  mode: TravelMode;
  /** 初めての訪問先（過去8週に担当していない。PRD D415） */
  first?: boolean;
}) {
  return (
    <div>
      {t?.travel != null && (
        <div className="leg">
          <Car size={14} aria-hidden="true" />約{r0(t.travel)}分
        </div>
      )}
      <div className="stop">
        <span className="dot" style={{ background: colorOf(c?.color ?? 0) }}>
          {initialOf(c?.displayName ?? '?')}
        </span>
        <div className="grow">
          <div className="sv-name">{c?.displayName ?? '（不明）'}さん</div>
          {/* 初めての訪問先は印と決まりごとを先頭に（PRD D415） */}
          {first && <VisitRules client={c} first />}
          <div className="sub sv-time">
            <Clock size={14} aria-hidden="true" />
            {t ? `${minutesToHhmm(t.start)}〜${minutesToHhmm(t.end)}` : v?.earliestStart}
          </div>
          {v?.note && <div className="sub">{v.note}</div>}
          {!first && <VisitRules client={c} />}
          <VisitRouteLinks
            to={c?.place}
            toName={c?.displayName ?? '（不明）'}
            from={prev?.from}
            fromName={prev?.fromName ?? HOME_LABEL}
            mode={mode}
          />
        </div>
      </div>
    </div>
  );
}

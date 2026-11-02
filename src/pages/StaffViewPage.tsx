import { ArrowLeft, Car, Info, MapPin, Smartphone, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDay } from '../components/day';
import { RouteMap } from '../components/RouteMap';
import { StaffMark } from '../components/StaffMark';
import { Empty, WithIcon } from '../components/ui';
import { useDateEntry } from '../components/useDateEntry';
import { useDayModel } from '../components/useDayModel';
import { useFeature } from '../components/useFeature';
import { timesOf } from '../domain/scheduleModel';
import { jstDate } from '../domain/time';
import { colorOf, initialOf } from '../lib/colors';
import { AI_LINE, attempt, hasLocation, own, r0, TRAVEL_MODE_LABELS } from '../lib/common';
import { dateText } from '../lib/dateText';
import { isFirstVisit, servedPairsBefore } from '../lib/firstVisit';
import { dayStops, tripLinks } from '../lib/mapsLink';
import { prevStopOf } from '../lib/prevStop';
import type { MapPoint } from '../lib/routeView';
import { scheduleRoute } from '../matching';
import { StaffViewDayNav, StaffViewStop, type StaffViewTiming, StaffViewTrip } from './staffViewParts';
import './schedule.css';

/**
 * スタッフのスマホ画面風の「今日の順番」（D16。表示だけで記録はしない）。
 * その日の訪問の担当と開始の並び（版2）。まだ確定していない（伝えていない）日はそう添える。
 * 日付は画面で共通の選んでいる日（useDay）。?date= で開いた日を選び、日付の横の日送りで前・次の日・今日へ（PRD D417）
 */
export default function StaffViewPage() {
  const { staffId = '' } = useParams();
  const { date, setDate } = useDay();
  useDateEntry(date, setDate);
  const today = jstDate(Date.now());
  const isToday = date === today;
  const m = useDayModel(date);
  const { data, staffById, clientById, visitById, problem, slotsOf } = m;
  const me = staffById.get(staffId);
  // 道順のリンク（ADR-0028 の mapsLink）を切っていれば、1日の全行程のリンクと注記を出さない
  const mapsOn = useFeature('mapsLink');

  /** 確定した（伝えた）日か */
  const told = !!own(data.snapshots, date);
  // 取り消し・〈利用者さん〉の休み（ADR-0013）の訪問は出さない（visitById はその日の計算に入れる候補の訪問だけ）
  const ids = useMemo(
    () => m.visits.filter((v) => v.staffId === staffId && visitById.has(v.id)).map((v) => v.id),
    [m.visits, staffId, visitById],
  );
  /** 過去8週に担当した組（初めての訪問先に印と決まりごと。PRD D415） */
  const served = useMemo(() => servedPairsBefore(data, date), [data, date]);

  // 時刻：問題があれば移動を入れた時刻（scheduleRoute）、無ければ移動を入れない目安
  const timing = useMemo((): Map<string, StaffViewTiming> => {
    if (problem) {
      const si = problem.staff.findIndex((s) => s.id === staffId);
      const idx = ids.map((id) => problem.visits.findIndex((v) => v.id === id)).filter((i) => i >= 0);
      if (si >= 0) {
        const r = attempt(() => scheduleRoute(problem, si, idx, 'lenient')).value;
        if (r) return new Map(r.stops.map((s) => [s.visitId, { start: s.start, end: s.end, travel: s.travelIn }]));
      }
    }
    const t = timesOf(ids, visitById, slotsOf.get(staffId)?.slots);
    return new Map([...t].map(([id, x]) => [id, { start: x.start, end: x.end, travel: null }]));
  }, [problem, staffId, ids, visitById, slotsOf]);

  const points: MapPoint[] = [];
  if (me && hasLocation(me.home)) points.push({ lat: me.home.lat, lng: me.home.lng, label: '家', color: '#f0a050' });
  for (const id of ids) {
    const c = clientById.get(visitById.get(id)?.clientId ?? '');
    if (c && hasLocation(c.place))
      points.push({ lat: c.place.lat, lng: c.place.lng, label: initialOf(c.displayName), color: colorOf(c.color) });
  }
  // Google マップの全行程（自宅→訪問…→自宅。経由地が多ければ分ける。PRD D99。ADR-0018）
  const stops = me
    ? dayStops(
        me.home,
        ids.map((id) => {
          const c = clientById.get(visitById.get(id)?.clientId ?? '');
          return { label: c?.displayName ?? '（不明）', place: c?.place ?? { address: '', lat: null, lng: null } };
        }),
      )
    : [];
  // 経由地はスマホのブラウザに合わせて3件まで（tripLinks の既定）。公共交通は全行程を出さない（区間ごとのリンクだけ）
  const trip = me ? tripLinks(stops, me.travelMode) : { links: [], skipped: [], homeSkipped: false };
  const trips = trip.links;
  const terms = data.org.terms;
  const line = { points: points.map(({ lat, lng }) => ({ lat, lng })), color: AI_LINE };
  const total = [...timing.values()].reduce((s, t) => s + (t.travel ?? 0), 0);

  return (
    <div className="phone-wrap">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <Link to="/staff" className="btn btn-small">
          <WithIcon icon={ArrowLeft} size={14}>
            管理者の画面に戻る
          </WithIcon>
        </Link>
        <span className="sub with-icon">
          <Smartphone size={14} aria-hidden="true" />
          {data.org.terms.staff}のスマホ画面（見本）
        </span>
      </div>
      <div className="phone staff-shell stack">
        {!me ? (
          <p>この{data.org.terms.staff}は見つかりません。</p>
        ) : (
          <>
            <div className="spread">
              <h2>{isToday ? '今日の訪問順' : '訪問順'}</h2>
              <span className="chip">
                <Car size={14} aria-hidden="true" />
                {TRAVEL_MODE_LABELS[me.travelMode]}
                {timing.size > 0 && [...timing.values()].some((t) => t.travel !== null) && ` 移動 約${r0(total)}分`}
              </span>
            </div>
            <div className="sv-meta sub">
              <span className="with-staff-mark">
                <StaffMark staff={me} size="sm" />
                {/* 日送りで変わる日付を読み上げる */}
                <span aria-live="polite" data-testid="sv-date">
                  {me.name}さん・{dateText(date)}
                </span>
              </span>
              <StaffViewDayNav date={date} today={today} setDate={setDate} />
              {!told && ids.length > 0 && (
                <span className="chip chip-warn">
                  <Sparkles size={13} aria-hidden="true" />
                  まだ確定していません（変わることがあります）
                </span>
              )}
            </div>
            {points.length > 0 && <RouteMap points={points} lines={[line]} height={240} />}
            {mapsOn && trips.length > 0 && <StaffViewTrip trip={trip} clientTerm={terms.client} mode={me.travelMode} />}
            {mapsOn && me.travelMode === 'TRANSIT' && ids.length > 0 && (
              <p className="sub" data-testid="sv-transit">
                公共交通のため、1日の全行程のリンクはありません。訪問ごとの「自宅から」「前の場所から」「ここへ道案内」を使ってください。
              </p>
            )}
            <div className="card">
              {ids.length === 0 && <Empty icon={MapPin}>{isToday ? '今日' : 'この日'}の訪問はありません</Empty>}
              {ids.map((id) => {
                const v = visitById.get(id);
                return (
                  <StaffViewStop
                    key={id}
                    v={v}
                    c={v ? clientById.get(v.clientId) : undefined}
                    t={timing.get(id)}
                    prev={prevStopOf(data, id)}
                    mode={me.travelMode}
                    first={!!v && isFirstVisit(served, v.clientId, staffId)}
                  />
                );
              })}
            </div>
            <p className="sub with-icon">
              <Info size={14} aria-hidden="true" />
              移動時間は直線距離からの目安です。道順のリンクは Google マップを開くだけで、時間・距離は Google
              マップで確かめてください。記録はデモにはありません。
            </p>
          </>
        )}
      </div>
    </div>
  );
}

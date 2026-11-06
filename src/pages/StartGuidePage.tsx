import { ListChecks, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CAL_OFF_ICON, CAL_OFF_LABEL, CalendarOffPanel } from '../components/CalendarOffPanel';
import { RoadTravelChoice } from '../components/RoadTravelChoice';
import { RosterCard } from '../components/RosterCard';
import { PageHeader, WithIcon } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { type PlaceAllRun, usePlaceAllRun } from '../components/usePlaceAllRun';
import { useRestartFirstRun } from '../components/useRestartFirstRun';
import { useRosterAutoPlace } from '../components/useRosterAutoPlace';
import type { Terms } from '../contracts/documents';
import { RESTART_TITLE } from '../lib/firstRun';
import { createPlaceLane } from '../lib/placeRunQueue';
import {
  START_GUIDE_ROSTER_FORMS,
  type StartGuideStep,
  startGuideCount,
  startGuideHref,
  startGuideIndex,
  startGuideNeighbors,
  startGuidePlanPath,
  startGuideSteps,
  withGuideBack,
} from '../lib/startGuide';
import { useDemoData } from '../store';
import { BookingCard } from './dataBookings';
import { PlaceAllBusyLine, PlaceAllPanel } from './PlaceAllPanel';
import './settings.css';

/**
 * 登録の案内（`#/start`。PRD D381。ADR-0073）：自分のデータで始めたあと、1画面1項目の3段で案内する。
 * 上に「1/3」。①〈利用者さん〉②〈スタッフ〉は名簿の欄（今の名簿の読み込み。開け閉めせず、テンプレートとファイルを選ぶをそのまま出す）、
 * ③は予約の CSV の読み込み（データの画面の予約の CSV の欄と同じ）と予定の画面へ。主ボタンは各段で1つ（①②は「次へ」、③は「予定の画面へ」）。
 * 段は URL の `?step=`。名簿・予約の CSV を①→②→③の順に読み込めば、事業所の CSV でデモを始められる（ADR-0092）。
 * ①②で名簿が入ったら、郵便番号・住所の検索が入なら位置の無い人を自動でまとめて地図に置き始める（PRD D427。ADR-0094）。
 * 置く処理は段を替えても続くよう、この画面が〈利用者さん〉・〈スタッフ〉の2つを持つ。2つは1本の列に並べ、同時には走らせない
 * （片方が走っていれば、もう片方は終わるまで待って始める。外部の検索は同時に1本。ADR-0016）。
 * 走っている間は、どの段にも進み具合と［止める］を出す（いまの段の欄に出ない種類の分は上の1行）
 */
export default function StartGuidePage() {
  const { data } = useDemoData();
  const [params] = useSearchParams();
  const index = startGuideIndex(params.get('step'));
  const step = startGuideSteps(data.org.terms)[index - 1]!;
  const { prev, next } = startGuideNeighbors(index);
  const restart = useRestartFirstRun();
  const [lane] = useState(createPlaceLane);
  const placeRuns = { client: usePlaceAllRun('client', lane), staff: usePlaceAllRun('staff', lane) };
  const shown = step.kind === 'roster' ? step.person : null;
  return (
    <div className="stack" style={{ maxWidth: 720 }} data-testid="start-guide" data-step={index}>
      <PageHeader
        icon={ListChecks}
        title={step.title}
        lead={<span data-testid="start-guide-count">{startGuideCount(index)}</span>}
      />
      {(['client', 'staff'] as const)
        .filter((k) => k !== shown)
        .map((k) => (
          <PlaceAllBusyLine key={k} model={placeRuns[k]} />
        ))}
      {step.kind !== 'roster' && (
        // 移動時間の見積もり方（PRD D436。ADR-0101）：名簿と緯度・経度が入ったあとの③で選ぶ。緯度・経度を探している間は取れない
        <section className="card stack" data-testid="start-guide-road">
          <RoadTravelChoice
            waitReason={
              placeRuns.client.running || placeRuns.staff.running ? '緯度・経度を探し終えてから押せます' : null
            }
          />
          <p className="sub">あとから管理者設定の「移動時間の見積もり方」で変えられます。</p>
        </section>
      )}
      <section className="card stack">
        {step.kind === 'roster' ? (
          <RosterStep
            key={step.index}
            step={step}
            run={placeRuns[step.person]}
            registered={step.person === 'client' ? data.clients.length : data.staff.length}
          />
        ) : (
          <PlanStep
            planPath={startGuidePlanPath(data.org.features)}
            terms={data.org.terms}
            visits={data.visits.length}
          />
        )}
      </section>
      <nav className="row" aria-label="案内の段" style={{ justifyContent: 'space-between' }}>
        <div className="row">
          {prev && (
            <Link to={startGuideHref(prev)} className="btn" data-testid="start-guide-prev">
              戻る
            </Link>
          )}
          {/* 最初の設定（デモか自分のデータか・使い方）をやり直す（ADR-0092） */}
          <button type="button" className="btn" onClick={() => void restart()} data-testid="start-guide-restart">
            <WithIcon icon={Undo2}>{RESTART_TITLE}</WithIcon>
          </button>
        </div>
        {next && (
          <Link to={startGuideHref(next)} className="btn btn-primary" data-testid="start-guide-next">
            次へ
          </Link>
        )}
      </nav>
    </div>
  );
}

/** ①②の本体：名簿の欄をそのまま出す（読み込むしかないので開け閉めしない）。入れた人数を添える。下にまとめて置く欄 */
function RosterStep({
  step,
  run,
  registered,
}: {
  step: Extract<StartGuideStep, { kind: 'roster' }>;
  run: PlaceAllRun;
  registered: number;
}) {
  const geocodeOn = useFeature('geocode');
  const autoPlace = useRosterAutoPlace({ run, geocodeOn });
  const navigate = useNavigate();
  // 人の画面に戻り先（この段）を付ける。案内はメニューに無いので、付けないと案内へ戻れない
  const openPlace = (id: string) =>
    navigate(
      withGuideBack(
        step.person === 'staff'
          ? `/staff/${encodeURIComponent(id)}?tab=basic&edit=home`
          : `/clients/${encodeURIComponent(id)}?tab=basic&edit=place`,
        step.index,
      ),
    );
  return (
    <>
      <p className="sub">{START_GUIDE_ROSTER_FORMS}</p>
      {/* 名簿の欄（ADR-0068）をそのまま使う。ここでも読み込める */}
      <RosterCard kind={step.person} id={`start-guide-roster-${step.person}`} onPlace={autoPlace.onPlace} inline />
      <p className="sub" data-testid="start-guide-registered">
        いま登録されているのは {registered}人です
      </p>
      <PlaceAllPanel model={run} geocodeOn={geocodeOn} ref={autoPlace.panelRef} onEdit={openPlace} />
      {step.person === 'staff' && <CalendarOffStep registered={registered} />}
    </>
  );
}

/**
 * ②の下：休みのカレンダー（Google カレンダーの書き出しの zip）を取り込む（PRD D440。ADR-0107）。〈スタッフ〉を読み込んだあとに押せる。
 * 欠勤・キャンセルの機能が切なら出さない。ふだんは予定の画面の「休みを取り込む」から
 */
function CalendarOffStep({ registered }: { registered: number }) {
  const suddenOn = useFeature('sudden');
  const [open, setOpen] = useState(false);
  if (!suddenOn) return null;
  return (
    <div className="stack" data-testid="start-guide-cal-off">
      <p className="sub">
        休みを Google カレンダーに入れているなら、書き出した zip
        をそのまま取り込めます。ふだんは予定の画面の「休みを取り込む」から取り込み直せます。
      </p>
      <button
        type="button"
        className="btn"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => registered > 0 && setOpen(true)}
        aria-disabled={registered === 0 || undefined}
        title={registered === 0 ? '名簿を読み込んでから押せます' : undefined}
        data-testid="start-guide-cal-off-open"
      >
        <WithIcon icon={CAL_OFF_ICON}>{CAL_OFF_LABEL}</WithIcon>
      </button>
      {open && <CalendarOffPanel onClose={() => setOpen(false)} />}
    </div>
  );
}

/** ③の本体：予約の CSV があれば読み込み（ADR-0075・ADR-0092）、予定の画面へ（主ボタン）。入った訪問の数を添える */
function PlanStep({
  planPath,
  terms,
  visits,
}: {
  planPath: string;
  terms: Pick<Terms, 'client' | 'staff'>;
  visits: number;
}) {
  return (
    <>
      <p>
        予約の CSV があれば読み込みます。無ければ、予定の画面で訪問を追加します。追加した訪問には自動で担当が付きます。
      </p>
      {/* データの画面の予約の CSV の欄をそのまま使う。ここでも読み込める */}
      <BookingCard t={terms} />
      <p className="sub" data-testid="start-guide-visits">
        いま登録されている訪問は {visits}件です
      </p>
      <Link
        to={planPath}
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start' }}
        data-testid="start-guide-plan"
      >
        予定の画面へ
      </Link>
    </>
  );
}

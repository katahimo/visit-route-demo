import { ListChecks, Sheet, Undo2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
} from '../lib/startGuide';
import { useDemoData } from '../store';
import { BookingCard } from './dataBookings';
import { PlaceAllBusyLine, PlaceAllPanel } from './PlaceAllPanel';
import './settings.css';

/**
 * 登録の案内（`#/start`。PRD D381。ADR-0073）：自分のデータで始めたあと、1画面1項目の3段で案内する。
 * 上に「1/3」。①〈利用者さん〉②〈スタッフ〉は「CSV・Excel を読み込む」（名簿の欄＝今の名簿の読み込み）と「1人ずつ入れる」（今の追加の画面）、
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
          {/* 始め方（デモか自分のデータか・使い方）を選び直す（ADR-0092） */}
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

/** ①②の本体：読み込む・1人ずつ入れる（どちらも今ある画面へつなぐ）。入れた人数を添える。下にまとめて置く欄 */
function RosterStep({
  step,
  run,
  registered,
}: {
  step: Extract<StartGuideStep, { kind: 'roster' }>;
  run: PlaceAllRun;
  registered: number;
}) {
  const [open, setOpen] = useState(false);
  const rosterId = useId();
  const geocodeOn = useFeature('geocode');
  const autoPlace = useRosterAutoPlace({ run, geocodeOn, onStart: () => setOpen(false) });
  const navigate = useNavigate();
  const openPlace = (id: string) =>
    navigate(
      step.person === 'staff'
        ? `/staff/${encodeURIComponent(id)}?tab=basic&edit=home`
        : `/clients/${encodeURIComponent(id)}?tab=basic&edit=place`,
    );
  return (
    <>
      <p>{step.term}の名簿の CSV・Excel を読み込みます。</p>
      <p className="sub">{START_GUIDE_ROSTER_FORMS}</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn"
          aria-expanded={open}
          aria-controls={rosterId}
          onClick={() => setOpen((o) => !o)}
          data-testid="start-guide-import"
        >
          <WithIcon icon={Sheet}>CSV・Excel を読み込む</WithIcon>
        </button>
      </div>
      {/* 名簿の欄（ADR-0068）をそのまま使う。Excel の入出力の入り切りにかかわらず、ここでは読み込める */}
      <RosterCard
        kind={step.person}
        id={rosterId}
        open={open}
        onClose={() => setOpen(false)}
        onPlace={autoPlace.onPlace}
      />
      <p className="sub" data-testid="start-guide-registered">
        いま登録されているのは {registered}人です
      </p>
      <PlaceAllPanel model={run} geocodeOn={geocodeOn} ref={autoPlace.panelRef} onEdit={openPlace} />
    </>
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
      <p>予約の CSV があれば読み込みます。無ければ、予定の画面で訪問を足します。足した訪問には自動で担当が付きます。</p>
      {/* データの画面の予約の CSV の欄をそのまま使う。Excel の入出力の入り切りにかかわらず、ここでは読み込める */}
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

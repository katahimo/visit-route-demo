import { ListChecks, Plus, Sheet } from 'lucide-react';
import { useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RosterCard } from '../components/RosterCard';
import { PageHeader, WithIcon } from '../components/ui';
import type { Terms } from '../contracts/documents';
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
import './settings.css';

/**
 * 登録の案内（`#/start`。PRD D381。ADR-0073）：自分のデータで始めたあと、1画面1項目の3段で案内する。
 * 上に「1/3」。①〈利用者さん〉②〈スタッフ〉は「CSV・Excel を読み込む」（名簿の欄＝今の名簿の読み込み）と「1人ずつ入れる」（今の追加の画面）、
 * ③は予約の CSV の読み込み（データの画面の予約の CSV の欄と同じ）と予定を入れる画面へ。主ボタンは各段で1つ（①②は「次へ」、③は「予定を入れる」）。
 * 段は URL の `?step=`。名簿・予約の CSV を①→②→③の順に読み込めば、事業所の CSV でデモを始められる（ADR-0092）
 */
export default function StartGuidePage() {
  const { data } = useDemoData();
  const [params] = useSearchParams();
  const index = startGuideIndex(params.get('step'));
  const step = startGuideSteps(data.org.terms)[index - 1]!;
  const { prev, next } = startGuideNeighbors(index);
  return (
    <div className="stack" style={{ maxWidth: 720 }} data-testid="start-guide" data-step={index}>
      <PageHeader
        icon={ListChecks}
        title={step.title}
        lead={<span data-testid="start-guide-count">{startGuideCount(index)}</span>}
      />
      <section className="card stack">
        {step.kind === 'roster' ? (
          <RosterStep
            key={step.index}
            step={step}
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
        {prev ? (
          <Link to={startGuideHref(prev)} className="btn" data-testid="start-guide-prev">
            戻る
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={startGuideHref(next)} className="btn btn-primary" data-testid="start-guide-next">
            次へ
          </Link>
        )}
      </nav>
    </div>
  );
}

/** ①②の本体：読み込む・1人ずつ入れる（どちらも今ある画面へつなぐ）。入れた人数を添える */
function RosterStep({ step, registered }: { step: Extract<StartGuideStep, { kind: 'roster' }>; registered: number }) {
  const [open, setOpen] = useState(false);
  const rosterId = useId();
  return (
    <>
      <p>{step.term}を入れます。ファイルがあれば読み込み、少ないときは1人ずつ入れます。</p>
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
        <Link to={step.addTo} className="btn" data-testid="start-guide-add">
          <WithIcon icon={Plus}>1人ずつ入れる</WithIcon>
        </Link>
      </div>
      {/* 名簿の欄（ADR-0068）をそのまま使う。Excel の入出力の入り切りにかかわらず、ここでは読み込める */}
      <RosterCard kind={step.person} id={rosterId} open={open} onClose={() => setOpen(false)} />
      <p className="sub" data-testid="start-guide-registered">
        いま入っているのは {registered}人です
      </p>
    </>
  );
}

/** ③の本体：予約の CSV があれば読み込み（ADR-0075・ADR-0092）、予定を入れる画面へ（主ボタン）。入った訪問の数を添える */
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
        予約の CSV
        があれば読み込みます。無ければ、予定の画面で日を選んで訪問を足します。足した訪問は、入れた分だけ自動で担当が付きます。
      </p>
      {/* データの画面の予約の CSV の欄をそのまま使う。Excel の入出力の入り切りにかかわらず、ここでは読み込める */}
      <BookingCard t={terms} />
      <p className="sub" data-testid="start-guide-visits">
        いま入っている訪問は {visits}件です
      </p>
      <Link
        to={planPath}
        className="btn btn-primary"
        style={{ alignSelf: 'flex-start' }}
        data-testid="start-guide-plan"
      >
        予定を入れる
      </Link>
    </>
  );
}

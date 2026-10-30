// 日の予定の操作の行（日・週・月で同じ並び・同じ位置＝状態の1行のすぐ下。PRD D327・D344）：欠勤・キャンセルを登録／
// 元に戻す・やり直す／表示／訪問を追加・使い方（スマホは その他 ▾）と、計算中の進み具合（PRD D249）
import { Info, Mail, Plus, Square } from 'lucide-react';
import type { MenuItem } from '../components/MenuButton';
import { ScheduleToolbar } from '../components/scheduleParts';
import { WithIcon } from '../components/ui';
import { useExceptionsOnly } from '../components/useFeature';
import { useValueStore } from '../components/valueStore';
import type { ReadableStore } from '../lib/valueStore';
import type { PlanCtx } from './usePlanPage';
import type { PlanProgress } from './usePlanRun';

/**
 * 計算の進み具合のバーと回数（PRD D249）。進み具合は外の入れ物から読み、変わってもここだけ描き直す
 */
function PlanProgressText({ store, prefix }: { store: ReadableStore<PlanProgress | null>; prefix: string }) {
  const progress = useValueStore(store);
  return (
    <>
      <progress value={progress?.iteration ?? 0} max={progress?.total ?? 1} />
      <span className="sub">
        {prefix}
        {progress
          ? `${progress.iteration.toLocaleString()} / ${progress.total.toLocaleString()} 回${progress.hundred === null ? '' : `・いまの最良 ${progress.hundred}点`}`
          : '準備中…'}
      </span>
    </>
  );
}

/** 日付の短い表示（2026-10-13 → 10/13） */
function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/**
 * 操作の行の「その他 ▾」（スマホだけ。PRD D334・D344）：訪問を追加・表示・使い方。
 * パソコン・タブレットは項目が少ないので、訪問を追加・使い方をたたまずに操作の行へ出す（その他 ▾ は出さない）
 */
/** 表示の切り替えの項目 */
const viewItem = (k: string, text: string, i: number, current: boolean, onSelect: () => void): MenuItem => ({
  key: `view-${k}`,
  group: i === 0 ? '表示' : undefined,
  label: `${text}で見る`,
  current,
  onSelect,
  testId: `plan-view-${k}`,
});

function moreItemsOf(p: PlanCtx, addWhy: string | false, only: boolean): MenuItem[] {
  const { compact, mView, setMView, shownView, setColView, helpOpen, setHelpOpen } = p.v;
  // 切（例外だけ。PRD D384）はパソコンでも、表示の切り替え・使い方・メールで送るを「その他 ▾」へ（操作の行のボタンは2つまで）
  if (!compact && !only) return [];
  const mail: MenuItem[] =
    only && p.f.mailOn
      ? [
          {
            key: 'mail',
            group: '予定まわり',
            label: '予定をメールで送る',
            icon: Mail,
            onSelect: () => p.v.setPanel('mail'),
            testId: 'day-mail',
          },
        ]
      : [];
  return [
    // 訪問を追加は、スマホでは「その他 ▾」の中（切のパソコンは操作の行の主ボタン）
    ...(compact
      ? [
          {
            key: 'add',
            label: '訪問を追加',
            icon: Plus,
            disabled: addWhy,
            onSelect: () => p.nav.openVisit(null),
            testId: 'plan-visit-add',
          } satisfies MenuItem,
        ]
      : []),
    // 表示の切り替えを「その他 ▾」に入れる（スマホは操作の行を1段にするため。PRD D334。切のパソコンは操作の行のボタンを2つまでにするため。PRD D384）
    ...(compact
      ? (
          [
            ['day', '日ごとのリスト'],
            ['order', '順番'],
            ['list', '一覧'],
          ] as const
        ).map(([k, text], i) => viewItem(k, text, i, mView === k, () => setMView(k)))
      : p.d.visits.length > 0 || p.d.m.leaveVisits.length > 0
        ? (
            [
              ['timeline', '時間軸'],
              ['order', '順番'],
              ['list', '一覧'],
            ] as const
          ).map(([k, text], i) => viewItem(k, text, i, shownView === k, () => setColView(k)))
        : []),
    {
      key: 'help',
      group: 'そのほか',
      label: helpOpen ? '使い方を閉じる' : '使い方',
      icon: Info,
      onSelect: () => setHelpOpen(!helpOpen),
      testId: 'plan-more-help',
    },
    ...mail,
  ];
}

export function PlanToolbar({ p }: { p: PlanCtx }) {
  const { d, v, f, nav, flow, sudden } = p;
  const { compact, shownView, setColView, helpOpen, setHelpOpen } = v;
  const only = useExceptionsOnly();
  const { running, runningFor, progressStore, stop } = flow.planRun;
  /** 訪問を追加を押せない理由（〈利用者さん〉がいない・スマホの幅） */
  const addWhy =
    d.m.clients.length === 0
      ? `${d.terms.client}がいません`
      : compact
        ? 'スマホの幅では訪問を足しません（パソコン・タブレットで）'
        : false;
  /** 計算中の進み具合（操作の行） */
  const progressView = running && (
    <div className="plan-progress" data-testid="plan-progress">
      <PlanProgressText
        store={progressStore}
        prefix={runningFor ? `${shortDate(runningFor.date)} の${runningFor.label}案B・` : ''}
      />
      <button type="button" className="btn btn-small" onClick={stop}>
        <WithIcon icon={Square} size={14}>
          止める
        </WithIcon>
      </button>
    </div>
  );
  return (
    <ScheduleToolbar
      zoom="day"
      className="plan-toolbar"
      absence={
        f.suddenOn
          ? {
              onClick: () => p.suddenState.open({}),
              disabled: d.visits.length === 0 && sudden.staffList.length === 0,
              ref: sudden.btnRef,
            }
          : null
      }
      moreItems={moreItemsOf(p, addWhy, only)}
      add={compact ? null : { onClick: () => p.nav.openVisit(null), why: addWhy }}
      after={progressView}
    >
      {!compact && !only && (d.visits.length > 0 || d.m.leaveVisits.length > 0) && (
        <fieldset className="segmented seg-sm plan-view-toggle" aria-label="表示">
          {(
            [
              ['timeline', '時間軸'],
              ['order', '順番'],
              ['list', '一覧'],
            ] as const
          ).map(([k, text]) => (
            <button
              key={k}
              type="button"
              aria-pressed={shownView === k}
              className={`${shownView === k ? 'is-on' : ''} plan-view-${k}`}
              onClick={() => setColView(k)}
            >
              {text}
            </button>
          ))}
        </fieldset>
      )}
      {/* パソコン・タブレットは「その他 ▾」にたたまずに出す（PRD D344） */}
      {!compact && !only && (
        <>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (addWhy === false) nav.openVisit(null);
            }}
            aria-disabled={addWhy !== false || undefined}
            title={addWhy || undefined}
            data-testid="plan-visit-add"
          >
            <WithIcon icon={Plus}>
              <span className="tb-label">訪問を追加</span>
            </WithIcon>
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={helpOpen}
            onClick={() => setHelpOpen(!helpOpen)}
            data-testid="plan-help-btn"
          >
            <WithIcon icon={Info}>
              <span className="tb-label">{helpOpen ? '使い方を閉じる' : '使い方'}</span>
            </WithIcon>
          </button>
        </>
      )}
    </ScheduleToolbar>
  );
}

// 日の予定の操作の行（日・週・月で同じ作り・同じ位置。PRD D327・D402）：訪問を1件追加（主）・確定（伝えた）（入）／
// その他 ▾（欠勤・キャンセル（入）・元に戻す・表示の切り替え・使い方・書き出し（チャット用にコピー・メールで送る・印刷。PRD D419））と、
// 計算中の進み具合（PRD D249）
import { Info, Mail, MessageSquareText, Plus, Printer, Square } from 'lucide-react';
import type { MenuItem } from '../components/MenuButton';
import { ScheduleToolbar } from '../components/scheduleParts';
import { WithIcon } from '../components/ui';
import { useValueStore } from '../components/valueStore';
import { ADD_VISIT_LABEL } from '../lib/exceptionView';
import type { ReadableStore } from '../lib/valueStore';
import { AdoptButton } from './planHeader';
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

/** 表示の切り替えの項目 */
const viewItem = (k: string, text: string, i: number, current: boolean, onSelect: () => void): MenuItem => ({
  key: `view-${k}`,
  group: i === 0 ? '表示' : undefined,
  label: `${text}で見る`,
  current,
  onSelect,
  testId: `plan-view-${k}`,
});

/**
 * 書き出し（行き先ごとに1つずつ。PRD D419）：チャット用にコピー・印刷（文に出す訪問のある日。取り消し・休みの訪問だけの日は出さない）、
 * メールで送る（`mail` が入で、訪問のある日・未連絡の変更のある日）
 */
function exportItemsOf(p: PlanCtx): MenuItem[] {
  const hasVisits = p.contact.hasShownVisits;
  const items: MenuItem[] = [
    ...(hasVisits
      ? [
          {
            key: 'chat',
            label: 'チャット用にコピー',
            icon: MessageSquareText,
            onSelect: p.contact.copyChat,
            testId: 'day-chat-copy',
          },
        ]
      : []),
    ...(p.f.mailOn && (p.d.hasPlan || p.d.toldState === 'changed')
      ? [{ key: 'mail', label: 'メールで送る', icon: Mail, onSelect: () => p.v.setPanel('mail'), testId: 'day-mail' }]
      : []),
    ...(hasVisits
      ? [{ key: 'print', label: '印刷', icon: Printer, onSelect: () => window.print(), testId: 'day-print' }]
      : []),
  ];
  return items.map((x, i) => (i === 0 ? { ...x, group: '書き出し' } : x));
}

/**
 * 操作の行の「その他 ▾」の項目（入切とも。PRD D402）：スマホは 訪問を1件追加・日ごとのリスト／順番／一覧、パソコン・タブレットは 時間軸／順番／一覧
 * （訪問のある日だけ）、使い方、書き出し（exportItemsOf）
 */
function moreItemsOf(p: PlanCtx, addWhy: string | false): MenuItem[] {
  const { compact, mView, setMView, shownView, setColView, helpOpen, setHelpOpen } = p.v;
  return [
    // 訪問を1件追加は、スマホでは「その他 ▾」の中（パソコン・タブレットは操作の行の主ボタン）
    ...(compact
      ? [
          {
            key: 'add',
            label: ADD_VISIT_LABEL,
            icon: Plus,
            disabled: addWhy,
            onSelect: () => p.nav.openVisit(null),
            testId: 'plan-visit-add',
          } satisfies MenuItem,
        ]
      : []),
    // 表示の切り替えを「その他 ▾」に入れる（操作の行のボタンを2つまでにするため。PRD D334・D384・D402）
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
    ...exportItemsOf(p),
  ];
}

export function PlanToolbar({ p }: { p: PlanCtx }) {
  const { d, v, f, nav, flow, sudden, confirm } = p;
  const { compact } = v;
  const { running, runningFor, progressStore, stop } = flow.planRun;
  /** 訪問を1件追加を押せない理由（〈利用者さん〉がいない・スマホの幅） */
  const addWhy =
    d.m.clients.length === 0
      ? `${d.terms.client}がいません`
      : compact
        ? 'スマホの幅では訪問を追加しません（パソコン・タブレットで）'
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
      moreItems={moreItemsOf(p, addWhy)}
      add={compact ? null : { onClick: () => nav.openVisit(null), why: addWhy }}
      confirm={
        f.confirmStep && (d.hasPlan || d.toldState === 'changed') ? (
          <AdoptButton toldState={d.toldState} running={!!p.running} onAdopt={confirm.adopt} />
        ) : null
      }
      after={progressView}
    />
  );
}

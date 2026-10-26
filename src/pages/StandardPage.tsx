// 組み方の標準（標準の週。PRD D350〜D354・D359。ADR-0063・ADR-0065）の画面。3段：案をくらべる（カード・表で見る・日で見る）→
// 表で直す（下書き） → 標準にする。標準を決める道はこの画面だけ。
// 案・下書きは画面の外の入れ物（lib/standardDraft）に置き、ほかの画面へ移っても残す。実際の予定（訪問）には登録まで書かない。
// 登録は store の update の1回（全体の「元に戻す」で戻せる）
import { CalendarCheck } from 'lucide-react';
import { useMemo } from 'react';
import { ArrangeTabs } from '../components/ArrangeTabs';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui';
import { useUndoAction } from '../components/undo';
import { useValueStore } from '../components/valueStore';
import { jstDate } from '../domain/time';
import { mdText } from '../lib/dateText';
import { currentTable, cycleWeeks, standardPeriod } from '../lib/standard';
import { patternsKey, standardWork } from '../lib/standardDraft';
import { standardRows, standardWeekdays, workingStaff as workingStaffOf } from '../lib/standardView';
import { useDemoData } from '../store';
import './settings.css';
import './standard.css';
import { DraftStep, ProposalsStep, RegisterStep } from './standardSteps';
import { useStandardDayView } from './useStandardDayView';
import { useStandardDraft } from './useStandardDraft';
import { useStandardProposals } from './useStandardProposals';
import { useStandardRegister } from './useStandardRegister';

export default function StandardPage() {
  const { data, update } = useDemoData();
  const today = jstDate(Date.now());
  const confirmDialog = useConfirm();
  const toast = useToast();
  const undoAction = useUndoAction();
  const work = useValueStore(standardWork);
  const staffName = (id: string | null) =>
    id === null ? '担当なし' : (data.staff.find((s) => s.id === id)?.name ?? '（いない人）');
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.displayName ?? id;
  const presetName = (id: string | null) => data.presets.find((p) => p.id === id)?.name ?? '消したプリセット';

  const current = useMemo(() => currentTable(data, today), [data, today]);
  const key = useMemo(() => patternsKey(data, today), [data, today]);
  const rows = useMemo(() => standardRows(data, today), [data, today]);
  const weekdays = useMemo(() => standardWeekdays(rows), [rows]);
  const workingStaff = useMemo(() => workingStaffOf(data.staff), [data.staff]);
  const cycle = cycleWeeks(data, today);
  const period = standardPeriod(data, today);
  const tableProps = { rows, weekdays, current, clientName, staffName };

  const proposals = useStandardProposals(data, today, current, key, work);
  const day = useStandardDayView(data, work);
  const draftState = useStandardDraft(work, current, key, confirmDialog, presetName);
  const { draft, draftDiff } = draftState;
  const register = useStandardRegister(
    {
      data,
      update,
      today,
      confirmDialog,
      toast,
      undoAction,
      presetName,
      closeEditing: () => draftState.setEditing(null),
    },
    draft,
    draftDiff,
  );

  const std = data.standard;
  // 元に戻したら（登録の時刻が今のデータと違えば）完了の表示を出さない
  const registered = work.registered && data.standard?.at === work.registered.at ? work.registered : null;

  return (
    <div className="stack standard-page">
      <PageHeader
        nav={<ArrangeTabs />}
        icon={CalendarCheck}
        title="組み方の標準"
        lead="誰が・何曜・何時に行くかの標準を表で決めます。登録すると、先の週・月はこの表のとおりに並びます"
      />
      <p className="sub" data-testid="standard-now">
        {std
          ? `標準：${mdText(std.from)}から・考え方「${presetName(data.scorePresetId ?? std.presetId)}」・${std.weeks}週の周期（${mdText(jstDate(std.at))}に登録）`
          : 'まだ標準を登録していません'}
      </p>
      <ol className="standard-steps stack" data-testid="standard-steps">
        <ProposalsStep
          presetCount={data.presets.length}
          period={period}
          cycleReason={cycle.reason}
          work={work}
          proposals={proposals}
          hasDraft={draft !== null}
          tableProps={tableProps}
          day={day}
          onUse={(presetId, table) => void draftState.pickProposal(presetId, table)}
        />

        <DraftStep
          clientTerm={data.org.terms.client}
          work={work}
          stateKey={key}
          tableProps={tableProps}
          draftState={draftState}
          presetName={presetName}
          workingStaff={workingStaff}
        />

        {(draft || registered) && (
          <RegisterStep
            draft={draft !== null}
            registered={registered}
            register={register}
            draftDiffCount={draftDiff.length}
            names={{ staffName, clientName }}
          />
        )}
      </ol>
    </div>
  );
}

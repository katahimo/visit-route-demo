import { CalendarDays, Check, UserRoundCog, Users, X } from 'lucide-react';
import { Hint, SectionTitle, SidePanel, WithIcon } from '../components/ui';
import { addDays } from '../domain/time';
import { byName } from '../lib/common';
import { mdText } from '../lib/dateText';
import { OFFBOARD_SAMPLE_DAYS } from '../lib/offboard';
import { OffboardClientsTable, OffboardVisitDays } from './offboardParts';
import { useOffboardFlow } from './useOffboardFlow';

/**
 * 退職・担当替えの一括振り直し（PRD D71。ADR-0015）：最終勤務日のある〈スタッフ〉について、〈利用者さん〉ごとに代わりの人を選び、
 * 「まとめて適用」で 繰り返しの担当・保存した回の担当・担当できる人 を置き換える（版2。ADR-0053）。
 * 状態と処理は useOffboardFlow、表と日の一覧は offboardParts
 */
export function OffboardPanel({ staffId, onClose }: { staffId: string; onClose: () => void }) {
  const { terms, scope, name, canApply, apply, ...flow } = useOffboardFlow(staffId, onClose);

  return (
    <SidePanel
      icon={UserRoundCog}
      title={`担当の振り直し：${name}`}
      onClose={onClose}
      focusPanel
      footer={
        <>
          <button
            type="button"
            className="btn btn-primary"
            aria-disabled={!canApply || undefined}
            title={canApply ? '' : `置き換える${terms.client}はいません`}
            onClick={apply}
            data-testid="offboard-apply"
          >
            <WithIcon icon={Check}>まとめて適用</WithIcon>
          </button>
          <button type="button" className="btn" onClick={onClose}>
            <WithIcon icon={X}>閉じる</WithIcon>
          </button>
          {!canApply && <span className="sub">置き換える{terms.client}はいません</span>}
        </>
      }
    >
      {!scope ? (
        <p className="sub">最終勤務日が入っていません。{terms.staff}の編集で最終勤務日を入れてください。</p>
      ) : (
        <div className="stack" data-testid="offboard-panel">
          <p>
            最終勤務日：<strong>{mdText(scope.lastDay)}</strong>。{mdText(addDays(scope.lastDay, 1))}
            からは予定に入りません。
          </p>
          <Hint label="振り直しのしかた">
            <ul className="hint-list">
              <li>
                {terms.client}ごとに代わりの{terms.staff}を選び、「まとめて適用」を押します。
              </li>
              <li>
                {mdText(scope.from)}
                からの繰り返しの担当と訪問の担当が、選んだ人に替わります。それより前の日はそのままです。
              </li>
              <li>
                候補は、{mdText(scope.from)}からの{OFFBOARD_SAMPLE_DAYS}
                日の訪問に、ほかの人の予定を変えずに入れられる回の多い順です。
              </li>
              <li>入らない回は要対応に出ます。「担当を組む」の画面の「AI で組む」で組み直せます。</li>
            </ul>
          </Hint>

          <SectionTitle icon={Users}>
            {terms.client}ごとの代わり（{scope.clients.length}人）
          </SectionTitle>
          {scope.clients.length === 0 ? (
            <p className="sub" data-testid="offboard-no-clients">
              {name}さんを繰り返しの担当・担当できる人・{mdText(scope.from)}からの訪問の担当にしている{terms.client}
              はいません。
            </p>
          ) : (
            <OffboardClientsTable
              staffId={staffId}
              clients={scope.clients}
              choices={flow.choices}
              onChoices={flow.setChoices}
              staffById={flow.staffById}
              clientById={flow.clientById}
              limitsOn={flow.limitsOn}
              terms={terms}
            />
          )}

          <SectionTitle icon={CalendarDays}>
            {mdText(scope.from)}以降に{name}さんが担当している訪問（{scope.visits.length}件）
          </SectionTitle>
          {flow.byDate.length === 0 ? (
            <p className="sub" data-testid="offboard-no-visits">
              {name}さんの担当の訪問はありません。
            </p>
          ) : (
            <OffboardVisitDays
              byDate={flow.byDate}
              lastDay={scope.lastDay}
              from={scope.from}
              onOpenDay={flow.openDay}
              onOpenMonth={() => flow.openMonth(scope.from)}
            />
          )}
        </div>
      )}
    </SidePanel>
  );
}

/** 最終勤務日のある利用中の〈スタッフ〉（名前の順） */
export function leavingStaff<T extends { name: string; active: boolean; lastDay: string | null }>(staff: readonly T[]) {
  return staff.filter((s) => s.active && s.lastDay !== null).sort(byName);
}

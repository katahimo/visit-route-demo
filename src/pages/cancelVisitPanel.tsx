// 日の予定の訪問を取り消す欄（PRD D74。ADR-0015）：取り消しの種類（ふつう・当日キャンセル）を選んで取り消す
import { Ban } from 'lucide-react';
import { SidePanel, WithIcon } from '../components/ui';
import type { Visit } from '../contracts/documents';
import { windowText } from '../domain/scheduleModel';

/** 取り消しの欄（suddenOn が false なら種類を選ばず、ふつうの取り消し） */
export function CancelVisitPanel({
  visit,
  clientName,
  clientWord,
  suddenOn,
  sameDay,
  setSameDay,
  onCancel,
  onClose,
}: {
  visit: Visit;
  clientName: string;
  /** 〈利用者さん〉の呼び方 */
  clientWord: string;
  /** 欠勤・キャンセルの機能（当日キャンセルを選べる） */
  suddenOn: boolean;
  /** 当日キャンセルか（開くたびに「ふつうの取り消し」から。呼ぶ側が持つ） */
  sameDay: boolean;
  setSameDay: (on: boolean) => void;
  /** 取り消す */
  onCancel: () => void;
  onClose: () => void;
}) {
  return (
    <SidePanel
      icon={Ban}
      narrow
      title="訪問を取り消す"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-danger" onClick={onCancel} data-testid="cancel-visit-ok">
            <WithIcon icon={Ban}>取り消す</WithIcon>
          </button>
          <button type="button" className="btn" onClick={onClose}>
            閉じる
          </button>
        </>
      }
    >
      <p>
        <strong>
          {clientName} {windowText(visit)}
        </strong>{' '}
        の訪問を取り消します。
      </p>
      {suddenOn && (
        <>
          <fieldset className="stack cancel-kind" style={{ gap: 6 }} data-testid="cancel-kind">
            <legend>取り消しの種類</legend>
            <label className="check">
              <input
                type="radio"
                name="cancel-kind"
                checked={!sameDay}
                onChange={() => setSameDay(false)}
                style={{ width: 'auto' }}
              />
              ふつうの取り消し（前もって決まった休み・予定の変更など）
            </label>
            <label className="check">
              <input
                type="radio"
                name="cancel-kind"
                checked={sameDay}
                onChange={() => setSameDay(true)}
                style={{ width: 'auto' }}
                data-testid="cancel-same-day"
              />
              当日キャンセル（その日になって{clientWord}の都合で取りやめ）
            </label>
          </fieldset>
          <p className="sub">
            当日キャンセルは、月の予定と{clientWord}
            ごとの集計に回数が出ます。ほかの担当はそのままで、この訪問だけ外れます。
          </p>
        </>
      )}
    </SidePanel>
  );
}

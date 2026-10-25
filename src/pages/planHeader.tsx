// 日の予定の上の段（PRD D63・D345・D346）：上のナビの行の確定の印とボタン、「今の担当」の1行のまとめ、使い方
import { ChevronRight, CircleCheck, Mail, TriangleAlert } from 'lucide-react';
import type { RefObject } from 'react';
import { type IssueRow, PlanIssueCount } from '../components/PlanIssueCount';
import { Term } from '../components/Term';
import { WithIcon } from '../components/ui';
import type { PlanScore } from '../contracts/problem';
import { r0 } from '../lib/common';
import type { ToldState } from '../lib/dayPlan';
import type { ScoreReason } from '../lib/scoreReason';
import { HARD_NOTE, NextUnconfirmed, ScoreNextStep, ScoreReasonText } from './planParts';

/** 上のナビの行の右：伝えた状態の印・予定をメールで送る・確定（伝えた） */
export function PlanConfirmActions({
  toldState,
  toldCount,
  date,
  mailOn,
  running,
  onPickDate,
  onOpenTold,
  onMail,
  onAdopt,
}: {
  toldState: ToldState;
  /** 未連絡の変更の件数 */
  toldCount: number;
  date: string;
  mailOn: boolean;
  running: boolean;
  /** 次の確定していない日へ（PRD D224） */
  onPickDate: (date: string) => void;
  onOpenTold: () => void;
  onMail: () => void;
  onAdopt: () => void;
}) {
  return (
    <>
      {toldState === 'told' ? (
        <>
          <span className="chip chip-ok" data-testid="confirm-state">
            <CircleCheck size={12} aria-hidden="true" />
            <Term k="confirmed">確定済み</Term>
          </span>
          {/* 確定したら次の確定していない日へ（PRD D224） */}
          <NextUnconfirmed date={date} onPick={onPickDate} />
        </>
      ) : toldState === 'changed' ? (
        <button
          type="button"
          className="chip chip-warn chip-btn"
          onClick={onOpenTold}
          data-testid="confirm-state"
          title="伝えたあとに変わった訪問の連絡の一覧を開く"
        >
          <TriangleAlert size={12} aria-hidden="true" />
          <Term k="confirmDiff">未連絡の変更あり</Term> {toldCount}件
        </button>
      ) : (
        <span className="chip chip-warn" data-testid="confirm-state">
          <TriangleAlert size={12} aria-hidden="true" />
          <Term k="unconfirmed">まだ伝えていない</Term>
        </span>
      )}
      {/* 担当ごとの予定をメールアプリで開く（PRD D92・D306。ADR-0017）。毎日送るので見出しの主ボタンの隣に枠のボタンで置く */}
      {mailOn && (
        <button type="button" className="btn" onClick={onMail} data-testid="day-mail">
          <WithIcon icon={Mail}>
            <span className="m-sr">予定をメールで送る</span>
          </WithIcon>
        </button>
      )}
      {/* 主ボタン（塗り）は「確定」だけ。確定済みの日は枠にして主ボタンを置かない（PRD D238） */}
      <button
        type="button"
        className={toldState === 'told' ? 'btn' : 'btn btn-primary'}
        disabled={!!running || toldState === 'told'}
        onClick={onAdopt}
        data-testid="adopt"
        title="今の担当と時刻を〈スタッフ〉に伝えたら押します"
      >
        <WithIcon icon={CircleCheck}>{toldState === 'changed' ? '確定し直す（伝えた）' : '確定（伝えた）'}</WithIcon>
      </button>
    </>
  );
}

/** 「今の担当」の1行（訪問・入らない・守れない条件・移動・点数・点を下げている理由・詳しく。PRD D63・D173・D345） */
export function PlanOneLine({
  cs,
  visitCount,
  droppedRows,
  hardRows,
  hundredNow,
  scoreRulerName,
  reasonNow,
  rulesOn,
  compatOn,
  date,
  lookNone,
  lookAt,
  goToNone,
  onOpen,
  onDetail,
}: {
  cs: PlanScore;
  visitCount: number;
  droppedRows: IssueRow[];
  hardRows: IssueRow[];
  /** 点数（100点満点。物差しが無ければ null） */
  hundredNow: number | null;
  scoreRulerName: string;
  reasonNow: ScoreReason | null;
  rulesOn: boolean;
  compatOn: boolean;
  date: string;
  /** 「見る」（入らない訪問・担当のある訪問） */
  lookNone: (visitId: string) => void;
  lookAt: (visitId: string) => void;
  /** 担当なしの列へ */
  goToNone: () => void;
  /** 訪問の詳細の欄を開く */
  onOpen: (visitId: string) => void;
  onDetail: () => void;
}) {
  const hardCount = cs.hardViolations.length;
  return (
    <div className="plan-oneline" data-testid="plan-summary">
      <span className="plan-oneline-title">今の担当</span>
      <span>
        訪問 <strong>{visitCount}</strong>件
      </span>
      {/* 数を押すと一覧（見る・開く・関連の画面へ。PRD D345）。0 件は数だけ */}
      <span className={cs.dropped > 0 ? 'warn-text' : ''}>
        <Term k="dropped" />{' '}
        <PlanIssueCount
          count={cs.dropped}
          title={`入らない訪問 ${droppedRows.length}件`}
          rows={droppedRows}
          onLook={lookNone}
          onOpen={onOpen}
          footer={(close) => (
            <button
              type="button"
              className="btn btn-small btn-text detail-popover-link"
              onClick={() => {
                close();
                requestAnimationFrame(goToNone);
              }}
              data-testid="plan-dropped-none"
            >
              担当なしの列へ
            </button>
          )}
          testId="plan-dropped"
        />
      </span>
      <span className={`m-hide${hardCount > 0 ? ' error' : ''}`}>
        <Term k="hard" />{' '}
        <PlanIssueCount
          count={hardCount}
          title={`守れない条件 ${hardCount}件`}
          rows={hardRows}
          onLook={lookAt}
          onOpen={onOpen}
          testId="plan-hard"
        />
      </span>
      <span className="m-hide">
        <Term k="travel" /> <strong>{r0(cs.travelMinutes)}</strong>分
      </span>
      {/* 点数の色（PRD D266）：入らない・必須の違反があるときだけ要対応の色。無ければ点が低くても赤にしない（D228） */}
      <span
        className={`plan-oneline-score${cs.dropped > 0 || hardCount > 0 ? ' is-alert' : ''}`}
        title={`「${scoreRulerName}」の重みで付けた点数`}
        data-testid="plan-score"
      >
        <Term k="score" /> <strong data-testid="plan-total">{hundredNow ?? '—'}</strong>点
        {hardCount > 0 && (
          <span className="chip chip-warn" title={HARD_NOTE}>
            参考
          </span>
        )}
      </span>
      {/* 点を下げているいちばん大きい理由（PRD D173） */}
      <span className="plan-oneline-why">
        {rulesOn && reasonNow && <ScoreReasonText reason={reasonNow} testId="plan-reason" />}
        {/* いちばんの理由の次の一手（PRD D229）：担当なし → 受けられる人・相性 → 相性の表。
          理由のすぐ後ろに同じ行で（上の段を詰める。PRD D237） */}
        {rulesOn && reasonNow && <ScoreNextStep reason={reasonNow} date={date} compatOn={compatOn} />}
      </span>
      <button type="button" className="link-btn plan-oneline-more" onClick={onDetail} data-testid="plan-detail">
        <WithIcon icon={ChevronRight} size={14}>
          詳しく
        </WithIcon>
      </button>
    </div>
  );
}

/** 操作の行の「使い方」で開く説明（PRD D279・D344。操作の行のすぐ下） */
export function PlanHelp({
  helpRef,
  staffTerm,
  onClose,
}: {
  helpRef: RefObject<HTMLDivElement | null>;
  staffTerm: string;
  onClose: () => void;
}) {
  return (
    <div ref={helpRef} className="hint-body plan-help" tabIndex={-1} data-testid="plan-help">
      <ul className="plan-help-list">
        <li>
          担当を変えるには、訪問を別の{staffTerm}
          の列へドラッグします。訪問を押して「担当を変える」から選んでも同じです。
          移した訪問は、その人の回る順番のいちばん無駄の少ない所に入り、ピンが付きます（ピンの付いた訪問は、AI
          で組み直しても担当を変えません）。
        </li>
        <li>「担当なしの訪問」へ移すと、担当なしに戻ります。</li>
        <li>
          「元に戻す」（Ctrl+Z）で1手ずつ戻せます（50手まで）。「やり直す」（Ctrl+Shift+Z）で戻した手をやり直せます。
        </li>
        <li>
          Shift か Ctrl
          を押しながら訪問を押すと、複数を選べます。下に出る帯で、まとめて担当を替える・時刻をずらす・取り消すができます。
        </li>
        <li>
          「予定をメールで送る」などで{staffTerm}
          に伝えたら「確定」を押します。確定のあとに変えた訪問は「未連絡の変更」に出ます。
        </li>
        <li>
          名前の下の時間は、その日に働ける時間です。約束の時間に間に合わない訪問や、働ける時間からはみ出す訪問は赤い枠になります。訪問を押すと理由が出ます。
        </li>
        <li>「自宅から」「自宅まで」や移動の時間を押すと、地図でその道のりが太くなります。</li>
        <li>
          時間軸の灰色は働かない時間・休憩、斜線は欠勤、点線の枠は待ち時間です。ドラッグしている間は、落とす列に入れられるか（緑）入れられないか（赤）が出ます。
        </li>
      </ul>
      <div>
        <button type="button" className="btn btn-small btn-text" onClick={onClose}>
          使い方を閉じる
        </button>
      </div>
    </div>
  );
}

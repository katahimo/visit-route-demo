// 日の予定の「あるときだけの帯」（PRD D63）：エラー・組んだ範囲の提案・要対応・未連絡の変更・欠勤の振り直し・
// 〈利用者さん〉の休み・拘束が上限を超える人。ドラッグ中には増減しない（移したあとに変わる）
import { BedSingle, MessageSquareText, Timer, TriangleAlert, UserRoundX } from 'lucide-react';
import { Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PersonButton } from '../components/PersonPopover';
import { RangeProposalBand } from '../components/scheduleParts';
import { Term } from '../components/Term';
import { WithIcon } from '../components/ui';
import type { Staff, Terms } from '../contracts/documents';
import { workloadHref } from '../lib/links';
import { hmText } from '../lib/workload';

/** 拘束が上限を超える人（稼働の見込み。PRD D72。ADR-0015） */
type OverSpan = { staffId: string; span: number };

/**
 * 要対応の訪問の件数の帯（PRD D63）：「要対応の訪問 N件（内訳）」と担当なしを見るボタン。入は「詳しく ▾」の中に置く
 * （上の要対応の帯が同じことを知らせるので、ふだんは出さない。PRD D393）。切は出さない
 */
export function CareBand({
  count,
  parts,
  unassigned,
  onGoNone,
}: {
  count: number;
  parts: string[];
  unassigned: number;
  onGoNone: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="plan-band is-warn row" data-testid="band-care">
      <WithIcon icon={TriangleAlert} size={16}>
        <span className="band-text">
          <Term k="attention">要対応</Term>の訪問 <strong>{count}</strong>件（{parts.join('・')}）
        </span>
      </WithIcon>
      {unassigned > 0 && (
        <button type="button" className="btn btn-small" onClick={onGoNone} data-testid="band-unassigned">
          担当なしを見る
        </button>
      )}
    </div>
  );
}

export function PlanBands({
  errors,
  toldCount,
  reassign,
  leave,
  over,
  terms,
  date,
  staffName,
  on,
}: {
  /** 問題を作れない・計算のエラー・採点できない（無ければ null） */
  errors: { problem: string | null; run: string | null; score: string | null };
  /** 未連絡の変更の件数（伝えたあとに変わっていなければ null） */
  toldCount: number | null;
  /** 欠勤の振り直し（入らない・欠勤の人のまま。振り直していなければ null） */
  reassign: { unplaced: number; left: number } | null;
  /** 〈利用者さん〉の休みのため無しの訪問の件数と名前 */
  leave: { count: number; names: { clientId: string; name: string; note: string }[] };
  /** 拘束が上限を超える人（稼働の見込みを切っていれば null） */
  over: { list: OverSpan[]; limitHours: number; staffById: Map<string, Staff> } | null;
  terms: Terms;
  date: string;
  staffName: (id: string) => string;
  on: { openTold: () => void; goBar: () => void; showList: () => void };
}) {
  const { problem: problemError, run: error, score: scoreError } = errors;
  const { count: leaveCount, names: leaveNames } = leave;
  const { openTold: onOpenTold, goBar: onGoBar, showList: onShowList } = on;
  return (
    <>
      {/* あるときだけの帯（PRD D63）。ドラッグ中には増減しない（移したあとに変わる） */}
      {problemError && (
        <p className="error plan-band" role="alert">
          問題を作れませんでした：{problemError}
        </p>
      )}
      {error && (
        <p className="error plan-band" role="alert">
          {error}
        </p>
      )}
      {scoreError && (
        <p className="error plan-band" role="alert">
          採点できません（{scoreError}）
        </p>
      )}
      {/* 担当を組むの画面で組んだ範囲の提案（日・週・月の予定で同じもの） */}
      <RangeProposalBand />
      {toldCount !== null && (
        <div className="plan-band row" data-testid="band-told">
          <WithIcon icon={MessageSquareText} size={16}>
            伝えたあとに変わった訪問 {toldCount}件（未連絡の変更）
          </WithIcon>
          <button type="button" className="btn btn-small" onClick={onOpenTold} data-testid="told-open">
            連絡の一覧
          </button>
        </div>
      )}
      {reassign && (
        <div className="plan-band row" data-testid="band-reassign">
          <WithIcon icon={UserRoundX} size={16}>
            欠勤の振り直し：入らない {reassign.unplaced}件
            {reassign.left > 0 ? `・欠勤の人のまま ${reassign.left}件` : ''}
          </WithIcon>
          <button type="button" className="btn btn-small" onClick={onGoBar}>
            差の欄へ
          </button>
        </div>
      )}
      {leaveCount > 0 && (
        <div className="plan-band row" data-testid="band-leave">
          <WithIcon icon={BedSingle} size={16}>
            {/* 名前のボタンを並べても折り返すよう、文は1つの要素に入れる（with-icon は横並び） */}
            <span className="band-text">
              {terms.client}の休みのため無し {leaveCount}件：
              {leaveNames.map((x, i) => (
                <Fragment key={x.clientId}>
                  {i > 0 && '・'}
                  <PersonButton kind="client" id={x.clientId} name={x.name} testId="leave-name">
                    {x.name || '（不明）'}
                  </PersonButton>
                  {x.note && `（${x.note}）`}
                </Fragment>
              ))}
            </span>
          </WithIcon>
          <button type="button" className="btn btn-small" onClick={onShowList}>
            一覧で見る
          </button>
        </div>
      )}
      {over && over.list.length > 0 && <OverSpanBand {...over} terms={terms} date={date} staffName={staffName} />}
    </>
  );
}

/** 出勤〜退勤（拘束）が上限を超える人の帯（人ごとに稼働の見込みへ。PRD D72・D207） */
function OverSpanBand({
  list: overSpan,
  limitHours,
  staffById,
  terms,
  date,
  staffName,
}: {
  list: OverSpan[];
  limitHours: number;
  staffById: Map<string, Staff>;
  terms: Terms;
  date: string;
  staffName: (id: string) => string;
}) {
  const navigate = useNavigate();
  return (
    <div className="plan-band is-warn row" data-testid="band-over-span">
      <WithIcon icon={Timer} size={16}>
        <span className="band-text">
          出勤〜退勤（拘束）が上限の{limitHours}時間を超える
          {terms.staff}：
          {overSpan.map((x, i) => {
            const name = staffById.get(x.staffId)?.name ?? '';
            return (
              <Fragment key={x.staffId}>
                {i > 0 && '・'}
                {/* 1人ぶん（名前・拘束・リンク）は途中で折り返さない */}
                <span className="over-span-item">
                  <PersonButton kind="staff" id={x.staffId} name={name} testId="over-span-name">
                    {staffName(x.staffId)}
                  </PersonButton>{' '}
                  {hmText(x.span)}
                  {/* 2人以上なら人ごとに稼働の見込みへ（主ボタンは増やさない。PRD D207） */}
                  {overSpan.length > 1 && (
                    <Link
                      to={workloadHref(date.slice(0, 7), x.staffId)}
                      className="over-span-link"
                      aria-label={`${staffName(x.staffId)}さんの勤務の見込み`}
                      data-testid="over-span-link"
                    >
                      勤務の見込み
                    </Link>
                  )}
                </span>
              </Fragment>
            );
          })}
          （今の担当からの見込み）
        </span>
      </WithIcon>
      {overSpan.length === 1 && (
        <button
          type="button"
          className="btn btn-small"
          onClick={() => navigate(workloadHref(date.slice(0, 7), overSpan[0]!.staffId))}
        >
          勤務の見込み
        </button>
      )}
    </div>
  );
}

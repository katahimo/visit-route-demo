import { BookmarkPlus, Copy, MapPin, MessageSquareText } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { DetailsFold } from '../components/DetailsFold';
import { AddressField } from '../components/placeLookup';
import { WithIcon } from '../components/ui';
import type { Place, VisitType } from '../contracts/documents';
import { type InquiryWish, VACANCY_MARGIN_DEFAULT, type VacancyCell, type VacancyResult } from '../contracts/vacancy';
import { pinnedAddressAfter } from '../lib/addressLookup';
import { inquiryRows } from '../lib/glance';
import { type AnswerCard, placeLine } from '../lib/vacancyView';
import type { VacancyInputState } from './useVacancyInput';
import { AnswerBox, FoldMark, InquiryWeeks, NoPlanNote, StepNo, VacancyGrid, VacancyLegendBox } from './vacancyParts';

// 空き状況の画面（VacancyPage）の段階（PRD D184）：2 場所、3 受けられる曜日・時間帯、4 次の一手（1 いつ・何を は vacancyWhen）

/**
 * 2 場所（任意。PRD D184）：はじめは畳んで要約の行だけ。開くと郵便番号・住所・地図。
 * 畳んでも中の入力・ピンは残す（details の中に置いたまま。閉じても消さない）
 */
export function PlaceStage({
  input,
  hasPin,
}: {
  input: Pick<VacancyInputState, 'place' | 'setPlace'>;
  hasPin: boolean;
}) {
  const { place, setPlace } = input;
  // 段階の要約の行（PRD D184）
  const summary = placeLine(
    { address: place.address, pinnedAddress: place.pinnedAddress, hasPin },
    VACANCY_MARGIN_DEFAULT,
  );
  return (
    <details className="card vacancy-stage vacancy-place-stage" data-testid="vacancy-step-place">
      <summary data-testid="vacancy-place-toggle">
        <h2 className="vacancy-stage-head">
          <StepNo n={2} />
          <WithIcon icon={MapPin} size={16}>
            場所（任意）
          </WithIcon>
        </h2>
        <span className={`vacancy-stage-line${summary.set ? ' is-set' : ''}`} data-testid="vacancy-place-line">
          {summary.text}
        </span>
        <FoldMark />
      </summary>
      <div className="stack vacancy-place">
        <span className="sub">
          郵便番号・住所から探して置くか、地図に点を置くと、その場所への移動を含めて正確に数えます（すぐ下の結果が変わります）。空のときは移動を前後
          {VACANCY_MARGIN_DEFAULT}分で見込んだ目安です。
        </span>
        <AddressField
          value={place}
          onChange={(p) =>
            setPlace((cur) => ({ ...p, postalCode: cur.postalCode, pinnedAddress: pinnedAddressAfter(cur, p) }))
          }
          postalCode={place.postalCode}
          onPostalCodeChange={(postalCode) => setPlace((cur) => ({ ...cur, postalCode }))}
          testId="vacancy"
          noticeNote="（押したときだけ。条件などほかの項目は送りません）"
        />
      </div>
    </details>
  );
}

/**
 * 3 受けられる曜日・時間帯（PRD D184・D187・D412）：一番上に答えのカード（中に主ボタン［要約をコピー］）。
 * 希望の曜日×週のマス（D79）・凡例・曜日×開始時刻の表（D45）は「詳しく ▾」（閉じて始め、開け閉めは details:vacancy で覚える）
 */
export function TableStage({
  view,
  picked,
  onPick,
  onCopy,
  gridRef,
}: {
  view: {
    result: VacancyResult | null;
    /** 時間帯のチップの外のマスを除いた結果（週ごとのマス。lib/vacancyBands の inBands） */
    answerResult: VacancyResult | null;
    busy: boolean;
    exactPlace: Place | null;
    whenLine: string;
    answer: AnswerCard | null;
    noPlan: string[];
    missing: string[];
    summary: string | null;
    wish: Omit<InquiryWish, 'startDate'>;
    vType: VisitType | null;
    staffWord: string;
  };
  picked: VacancyCell | null;
  onPick: (c: VacancyCell) => void;
  onCopy: () => void;
  gridRef: RefObject<HTMLDivElement | null>;
}) {
  const { result, answerResult, busy, exactPlace, whenLine, answer, noPlan, missing, summary, wish, vType, staffWord } =
    view;
  return (
    <section className="card stack vacancy-stage" data-testid="vacancy-table-card">
      <div className="section-title">
        <h2>
          <StepNo n={3} />
          受けられる曜日・時間帯（
          {result?.exact
            ? `${exactPlace?.address.trim() || '選んだ場所'}への移動を含む`
            : `目安。移動を前後${VACANCY_MARGIN_DEFAULT}分で見込む`}
          ）
        </h2>
        {busy && (
          <div className="section-aside">
            <span className="sub">計算しています…</span>
          </div>
        )}
      </div>
      {answer && (
        <AnswerBox answer={answer}>
          {summary && (
            <>
              <output className="inquiry-summary" data-testid="inquiry-summary">
                {summary}
              </output>
              <div className="row">
                <button type="button" className="btn btn-primary" onClick={onCopy} data-testid="copy-summary">
                  <WithIcon icon={Copy}>要約をコピー</WithIcon>
                </button>
              </div>
            </>
          )}
        </AnswerBox>
      )}
      <p className="sub vacancy-when-line" data-testid="vacancy-when-line">
        {whenLine}
      </p>
      <NoPlanNote noPlan={noPlan} missing={missing} />
      <DetailsFold testId="vacancy-details" screen="vacancy">
        {answerResult && summary && <InquiryWeeks rows={inquiryRows(answerResult, wish)} exact={answerResult.exact} />}
        <h3 className="vacancy-sub-title">曜日・開始時刻ごとの表</h3>
        <VacancyLegendBox exact={!!result?.exact} vType={vType} />
        {result && result.times.length === 0 && <p className="sub">所要が長すぎて、入る時刻がありません</p>}
        {result && result.times.length > 0 && (
          <VacancyGrid result={result} staffWord={staffWord} picked={picked} onPick={onPick} gridRef={gridRef} />
        )}
      </DetailsFold>
    </section>
  );
}

/**
 * 4 次の一手（PRD D184・D412）：この問い合わせを仮押さえする（従のボタン）と、
 * 空き枠を広く知らせる（案内文・コピー・紹介元へメール。はじめは畳む。children）。要約のコピーは答えのカードの中
 */
export function NextStage({
  summary,
  canHold,
  perWeek,
  hasPlace,
  clientWord,
  onHoldOpen,
  children,
}: {
  summary: string | null;
  canHold: boolean;
  perWeek: number;
  hasPlace: boolean;
  clientWord: string;
  onHoldOpen: () => void;
  children?: ReactNode;
}) {
  return (
    <section className="card stack vacancy-stage" data-testid="vacancy-step-next">
      <div className="section-title">
        <h2>
          <StepNo n={4} />
          次の一手
        </h2>
      </div>
      <div className="stack vacancy-next" data-testid="inquiry-card">
        <h3 className="vacancy-sub-title">
          <WithIcon icon={MessageSquareText} size={16}>
            この問い合わせを押さえる
          </WithIcon>
        </h3>
        {summary ? (
          <>
            {canHold ? (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button type="button" className="btn" data-testid="hold-open" onClick={onHoldOpen}>
                  <WithIcon icon={BookmarkPlus}>仮の{clientWord}として押さえる</WithIcon>
                </button>
              </div>
            ) : (
              <p className="sub" data-testid="hold-why">
                仮押さえは、希望の曜日・時間帯に、どの週も受けられる（○）開始時刻が週{perWeek}回分あるときにできます。
              </p>
            )}
            {!hasPlace && <p className="sub">場所を入れると、移動を含めて答えられます（上の「2 場所」）。</p>}
          </>
        ) : (
          <p className="sub">上の「1 いつ・何を」を直すと、要約と仮押さえが出ます。</p>
        )}
      </div>
      {children}
    </section>
  );
}

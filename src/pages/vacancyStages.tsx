import { BookmarkPlus, Copy, MapPin, MessageSquareText } from 'lucide-react';
import { type ReactNode, type RefObject, useId } from 'react';
import { ConditionsEditor } from '../components/conditions';
import { FieldError, invalidAttrs } from '../components/FieldError';
import { AddressField } from '../components/placeLookup';
import { Hint, WithIcon } from '../components/ui';
import '../components/weekdayToggles.css';
import type { DemoData } from '../contracts/data';
import type { Place, VisitType } from '../contracts/documents';
import {
  type InquiryWish,
  VACANCY_DURATION_MAX,
  VACANCY_DURATION_MIN,
  VACANCY_MARGIN_DEFAULT,
  VACANCY_WEEKS_MAX,
  VACANCY_WEEKS_MIN,
  type VacancyCell,
  type VacancyResult,
} from '../contracts/vacancy';
import { HALF_HOURS, timeText } from '../domain/availability';
import { pinnedAddressAfter } from '../lib/addressLookup';
import { WEEKDAY_LABELS } from '../lib/common';
import { inquiryRows } from '../lib/glance';
import { typeOf } from '../lib/patternText';
import { type AnswerCard, NO_TYPE_TEXT, placeLine } from '../lib/vacancyView';
import type { VacancyInputState } from './useVacancyInput';
import {
  AnswerBox,
  FoldMark,
  InquiryWeeks,
  NoPlanNote,
  ROW_WEEKDAYS,
  StepNo,
  VacancyGrid,
  VacancyLegendBox,
} from './vacancyParts';

// 空き状況の画面（VacancyPage）の段階（PRD D184）：1 いつ・何を、2 場所、3 受けられる曜日・時間帯、4 次の一手

/** 1 いつ・何を（PRD D184）。入れるとすぐ下の結果が変わる（自動で計算し直すので主ボタンは無い） */
export function WhenStage({
  data,
  input,
  durationOk,
  fromOk,
  wishOk,
}: {
  data: Pick<DemoData, 'visitTypes' | 'items' | 'org'>;
  input: VacancyInputState;
  durationOk: boolean;
  fromOk: boolean;
  wishOk: boolean;
}) {
  const { typeId, setTypeId, duration, setDuration, wishFrom, setWishFrom, wishTo, setWishTo } = input;
  const { perWeek, setPerWeek, from, setFrom, weeks, setWeeks, wishDays, setWishDays } = input;
  const { requirements, setRequirements } = input;
  /** 入力の誤りの文の id（入力欄の aria-describedby。PRD D250） */
  const durationErrId = useId();
  const fromErrId = useId();
  const wishErrId = useId();
  return (
    <section className="card stack vacancy-stage" data-testid="vacancy-step-when">
      <div className="section-title">
        <h2>
          <StepNo n={1} />
          いつ・何を
        </h2>
      </div>
      <div className="form-grid">
        <label>
          種類
          <select
            value={typeId}
            data-testid="vacancy-type"
            onChange={(e) => {
              const t = typeOf(data.visitTypes, e.target.value);
              setTypeId(e.target.value);
              // 種類を選ぶと所要の初期値をその種類の標準の所要にする
              if (t) setDuration(String(t.durationMinutes));
            }}
          >
            <option value="">{NO_TYPE_TEXT}</option>
            {data.visitTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          所要（分）
          <input
            type="number"
            min={VACANCY_DURATION_MIN}
            max={VACANCY_DURATION_MAX}
            step={5}
            value={duration}
            {...invalidAttrs(!durationOk, durationErrId)}
            data-testid="vacancy-duration"
            onChange={(e) => setDuration(e.target.value)}
          />
        </label>
        <label>
          希望の開始（から）
          <select
            value={wishFrom}
            {...invalidAttrs(!wishOk, wishErrId)}
            onChange={(e) => setWishFrom(e.target.value)}
            data-testid="wish-from"
          >
            {HALF_HOURS.map((h) => (
              <option key={h} value={h}>
                {timeText(h)}
              </option>
            ))}
          </select>
        </label>
        <label>
          希望の開始（まで）
          <select
            value={wishTo}
            {...invalidAttrs(!wishOk, wishErrId)}
            onChange={(e) => setWishTo(e.target.value)}
            data-testid="wish-to"
          >
            {HALF_HOURS.map((h) => (
              <option key={h} value={h}>
                {timeText(h)}
              </option>
            ))}
          </select>
        </label>
        <label>
          週の回数
          <select value={perWeek} onChange={(e) => setPerWeek(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                週{n}回
              </option>
            ))}
          </select>
        </label>
        <label>
          開始日
          <input
            type="date"
            value={from}
            {...invalidAttrs(!fromOk, fromErrId)}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          見る週の数
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            {Array.from({ length: VACANCY_WEEKS_MAX - VACANCY_WEEKS_MIN + 1 }, (_, i) => i + VACANCY_WEEKS_MIN).map(
              (n) => (
                <option key={n} value={n}>
                  {n}週
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <WishDaysField wishDays={wishDays} setWishDays={setWishDays} />
      <FieldError id={durationErrId} live={false}>
        {!durationOk && `所要は${VACANCY_DURATION_MIN}〜${VACANCY_DURATION_MAX}分で入れてください`}
      </FieldError>
      <FieldError id={fromErrId} live={false}>
        {!fromOk && '開始日を入れてください'}
      </FieldError>
      <FieldError id={wishErrId} live={false}>
        {!wishOk && '希望の開始は「から」を「まで」より前にしてください'}
      </FieldError>
      <details className="vacancy-more">
        <summary>
          {data.org.terms.staff}の条件
          {requirements.length > 0 ? `（${requirements.length}件）` : '（問わない）'}
        </summary>
        <Hint>例：性別が女性。種類の「担当に必要な条件」は、ここで選ばなくても入ります。</Hint>
        <ConditionsEditor items={data.items} target="staff" value={requirements} onChange={setRequirements} />
      </details>
    </section>
  );
}

/** 希望の曜日（複数。選ばない＝どの曜日でも） */
function WishDaysField({ wishDays, setWishDays }: Pick<VacancyInputState, 'wishDays' | 'setWishDays'>) {
  const toggleDay = (w: number) =>
    setWishDays(wishDays.includes(w) ? wishDays.filter((x) => x !== w) : [...wishDays, w]);
  return (
    <div className="stack" style={{ gap: 4 }}>
      <span className="sub">希望の曜日（選ばない＝どの曜日でも）</span>
      <fieldset className="weekday-toggles" aria-label="希望の曜日" data-testid="wish-days">
        {ROW_WEEKDAYS.map((w) => (
          <button
            key={w}
            type="button"
            className={`weekday-toggle${wishDays.includes(w) ? ' is-on' : ''}`}
            aria-pressed={wishDays.includes(w)}
            onClick={() => toggleDay(w)}
          >
            {WEEKDAY_LABELS[w]}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/**
 * 2 場所（任意。PRD D184・D185）：はじめは畳んで要約の行だけ。開くと郵便番号・住所・地図。
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
  // 段階の要約の行（PRD D184・D185）
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

/** 3 受けられる曜日・時間帯（PRD D184・D187）：要約・週ごとのマス・曜日×開始時刻の表 */
export function TableStage({
  view,
  picked,
  onPick,
  gridRef,
}: {
  view: {
    result: VacancyResult | null;
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
  gridRef: RefObject<HTMLDivElement | null>;
}) {
  const { result, busy, exactPlace, whenLine, answer, noPlan, missing, summary, wish, vType, staffWord } = view;
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
      <p className="sub vacancy-when-line" data-testid="vacancy-when-line">
        {whenLine}
      </p>
      {answer && <AnswerBox answer={answer} />}
      <NoPlanNote noPlan={noPlan} missing={missing} />
      {summary && (
        <>
          <h3 className="vacancy-sub-title">答える文（下の「要約をコピー」でコピー）</h3>
          <output className="inquiry-summary" data-testid="inquiry-summary">
            {summary}
          </output>
          {result && <InquiryWeeks rows={inquiryRows(result, wish)} exact={result.exact} />}
        </>
      )}
      <h3 className="vacancy-sub-title">曜日・開始時刻ごとの表</h3>
      <VacancyLegendBox exact={!!result?.exact} vType={vType} />
      {result && result.times.length === 0 && <p className="sub">所要が長すぎて、入る時刻がありません</p>}
      {result && result.times.length > 0 && (
        <VacancyGrid result={result} staffWord={staffWord} picked={picked} onPick={onPick} gridRef={gridRef} />
      )}
    </section>
  );
}

/**
 * 4 次の一手（PRD D184・D186）：この問い合わせに答える（要約をコピー＝この段階の主ボタン・仮押さえ）と、
 * 空き枠を広く知らせる（案内文・コピー・紹介元へメール。はじめは畳む。children）
 */
export function NextStage({
  summary,
  canHold,
  perWeek,
  hasPlace,
  clientWord,
  onCopy,
  onHoldOpen,
  children,
}: {
  summary: string | null;
  canHold: boolean;
  perWeek: number;
  hasPlace: boolean;
  clientWord: string;
  onCopy: () => void;
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
            この問い合わせに答える
          </WithIcon>
        </h3>
        {summary ? (
          <>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={onCopy} data-testid="copy-summary">
                <WithIcon icon={Copy}>要約をコピー</WithIcon>
              </button>
              {canHold && (
                <button type="button" className="btn" data-testid="hold-open" onClick={onHoldOpen}>
                  <WithIcon icon={BookmarkPlus}>仮の{clientWord}として押さえる</WithIcon>
                </button>
              )}
            </div>
            {!canHold && (
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

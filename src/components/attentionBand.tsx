import { ChevronLeft, ChevronRight, Sparkles, TriangleAlert } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { confirmLeave } from '../lib/leaveGuard';
import { useDay } from './day';
import { WithIcon } from './ui';
import { useAttentionBand } from './useAttentionBand';
import { useBandArrange } from './useBandArrange';
import { useBandStep } from './useBandStep';
import './attentionBand.css';

/**
 * 予定（月・週・日）の上の要対応の帯（PRD D400・D403・D404）：担当なし・間に合わない・重なり・休みの人の訪問の件数を1行で（エキスパート機能が入なら、
 * 未確定・組み直し・標準が無いも足す）。無ければ出さない。右に［要対応を組む］（切で組める要対応の訪問があるとき。従のボタン）と［見に行く ›］。
 * 見に行くは、訪問の種類なら 間に合わない・重なり・休みの人 → 担当なし の並び（日付 → 開始）で、押すたびに次の1件のある日の予定を開き、
 * その訪問を選んで見える所へ巻く（担当なしは欄を開く。日の予定の usePlanNav）。2件目からは「n/N」と［‹ 前へ］（useBandStep。ADR-0089）。
 * ［見に行く］の読み上げの名前は「次を見に行く」、位置「n/N」は aria-live（polite）で知らせる。
 * 担当なしがあれば、組めない理由の内訳（「勤務時間外 6・勤務日外 5」。lib/unassignedReason。PRD D430）を添える。
 * 日の予定でその日を見ているときも、移り直して同じことをする。入だけの種類は移る先が決まっている（lib/attentionBand の go）。印刷では出さない
 */
export function AttentionBand() {
  const band = useAttentionBand();
  const arrange = useBandArrange();
  const { place, step } = useBandStep(band);
  const { setDate } = useDay();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const goRef = useRef<HTMLButtonElement>(null);
  /** ［要対応を組む］を押したあと、ボタンが消えるまで（組み終えて0件）。消えたらフォーカスを落とさず移す */
  const pressed = useRef(false);
  const shown = arrange !== null;
  useEffect(() => {
    if (shown || !pressed.current) return;
    pressed.current = false;
    // 帯が残れば［見に行く］、帯ごと消えたら操作の行の最初のボタン
    (goRef.current ?? document.querySelector<HTMLElement>('[data-testid="schedule-toolbar"] :is(button, a)'))?.focus();
  }, [shown]);
  if (!band) return null;
  const go = async (dir: 1 | -1) => {
    // 下書きを持つ画面から移るときの確かめ（lib/leaveGuard。日・週・月の予定は通常は下書きを持たないので素通り。断れば移らない）
    if (!(await confirmLeave())) return;
    const target = step(dir);
    if (!target) return;
    const { to, date, visitId } = target;
    if (date) setDate(date);
    // 同じ画面（日の予定）で押したときは履歴を積まず置き換える（location.key が変わるので、日の予定は渡した訪問を受け直す）
    navigate(to, {
      state: visitId ? { visitId, band: true } : undefined,
      replace: to === '/plan' && pathname === '/plan',
    });
  };
  return (
    <div className="attention-band" data-testid="attention-band">
      <WithIcon icon={TriangleAlert} size={16}>
        <span className="band-text">
          <span className="attention-band-title">要対応</span>{' '}
          <span data-testid="attention-band-text">{band.text}</span>
          {/* 担当なしの組めない理由の内訳（PRD D430）。直し方は［見に行く］で開く訪問の詳細の「組めない理由」 */}
          {band.why && (
            <span className="attention-band-why" data-testid="attention-band-why">
              {' '}
              （担当なしの理由：{band.why}）
            </span>
          )}
        </span>
      </WithIcon>
      <span className="attention-band-actions">
        {arrange && (
          <button
            type="button"
            className="btn btn-small attention-band-arrange"
            aria-disabled={arrange.running || undefined}
            onClick={() => {
              pressed.current = true;
              arrange.run();
            }}
            title={`今日から来月末までの要対応の訪問 ${arrange.count}件（担当なし・間に合わない・重なり・休みの人）を、いまの条件で組みます`}
            data-testid="attention-band-arrange"
          >
            <WithIcon icon={Sparkles} size={16}>
              {arrange.running ? '組んでいます…' : '要対応を組む'}
            </WithIcon>
          </button>
        )}
        {place && (
          <button
            type="button"
            className="attention-band-go"
            onClick={() => void go(-1)}
            data-testid="attention-band-prev"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            前へ
          </button>
        )}
        {/* 位置「n/N」は読み上げに知らせる（入れ物は常に置き、中身だけ変える） */}
        <span aria-live="polite" className="attention-band-live">
          {place && (
            <span className="attention-band-place" data-testid="attention-band-place">
              {place.n}/{place.total}
            </span>
          )}
        </span>
        <button
          ref={goRef}
          type="button"
          className="attention-band-go"
          onClick={() => void go(1)}
          aria-label="次を見に行く"
          data-testid="attention-band-go"
        >
          見に行く
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}

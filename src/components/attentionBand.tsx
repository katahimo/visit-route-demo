import { ChevronRight, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { confirmLeave } from '../lib/leaveGuard';
import { useDay } from './day';
import { WithIcon } from './ui';
import { useAttentionBand } from './useAttentionBand';
import './attentionBand.css';

/**
 * 予定（月・週・日）の上の要対応の帯（エキスパート機能が切のとき。PRD D383）：担当なし・重なり・休みの人の訪問の件数を1行で。
 * 無ければ出さない。押すと、いちばん早い日の最初の該当の訪問のある日の予定を開き、その訪問を選んで見える所へ巻く
 * （週の帯から開くのと同じ：日を選び、日の予定へ state の visitId を渡す。日の予定の usePlanNav が選んで巻く）。印刷では出さない
 */
export function AttentionBand() {
  const band = useAttentionBand();
  const { setDate } = useDay();
  const navigate = useNavigate();
  if (!band) return null;
  const go = async () => {
    // 下書きのある画面（月の「休みを入れる」の入力中など）から移るときは確かめる（断れば移らない）
    if (!(await confirmLeave())) return;
    setDate(band.first.date);
    navigate('/plan', { state: { visitId: band.first.visitId } });
  };
  return (
    <button type="button" className="attention-band" onClick={() => void go()} data-testid="attention-band">
      <WithIcon icon={TriangleAlert} size={16}>
        <span className="band-text">
          <span className="attention-band-title">要対応</span>{' '}
          <span data-testid="attention-band-text">{band.text}</span>
        </span>
      </WithIcon>
      <span className="attention-band-go">
        見に行く
        <ChevronRight size={16} aria-hidden="true" />
      </span>
    </button>
  );
}

import { CalendarCheck, ChevronRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { IconButton, WithIcon } from './ui';
import { useNextMonthCheck } from './useNextMonthCheck';
import './attentionBand.css';

/**
 * 来月の確認（PRD D413。ADR-0081）：予定（月・週・日）の要対応の帯の下の1行。エキスパート機能が切で月の20日以降、来月に訪問があるときだけ。
 * 「12月の予定 N件はできています・担当なし a件…」＋［12月を見る ›］（月の予定の来月）＋［×］（その月の間は出さない）。印刷では出さない
 */
export function NextMonthCheck() {
  const next = useNextMonthCheck();
  if (!next) return null;
  const { check, close } = next;
  return (
    <section className="next-month-check" aria-label={`${check.label}の確認`} data-testid="next-month-check">
      <WithIcon icon={CalendarCheck} size={16}>
        <span className="band-text" data-testid="next-month-check-text">
          {check.text}
        </span>
      </WithIcon>
      <span className="attention-band-actions">
        <Link to={`/month?ym=${check.ym}`} className="next-month-check-go" data-testid="next-month-check-go">
          {check.label}を見る
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
        <IconButton
          icon={X}
          label={`${check.label}の確認を閉じる（今月は出しません）`}
          onClick={() => {
            close();
            // 閉じるボタンが消えるのでフォーカスを見出しへ移す（落とさない）
            const h1 = document.querySelector<HTMLElement>('.page-head h1');
            if (h1) {
              h1.tabIndex = -1;
              h1.focus();
            }
          }}
          data-testid="next-month-check-close"
        />
      </span>
    </section>
  );
}

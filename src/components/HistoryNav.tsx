// 上の帯の左端の「戻る」「進む」（ブラウザの履歴。Alt＋←→ と同じ。PRD D438。ADR-0103）。リンクで別の画面へ移ったあと、元の画面へ戻る道を画面に出す。
// 押せるかの決め方は lib/historyNav。下書きのある画面では、ほかの移動のボタンと同じく移る前に確かめる（lib/leaveGuard）
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  hasHistoryIdx,
  historyIdxOf,
  initialMaxIdx,
  loadHistoryMax,
  nextMaxIdx,
  saveHistoryMax,
} from '../lib/historyNav';
import { confirmLeave } from '../lib/leaveGuard';
import { IconButton } from './ui';

const nowIdx = () => historyIdxOf(window.history.state);
/**
 * 起動したときの履歴の項目に react-router の番号が残っていたか（読み直し・履歴での行き来）。
 * ルーターが番号を入れる前（このファイルを読んだとき）に見る
 */
const RESTORED = typeof window !== 'undefined' && hasHistoryIdx(window.history.state);

export function HistoryNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();
  const [idx, setIdx] = useState(nowIdx);
  const [maxIdx, setMaxIdx] = useState(() => initialMaxIdx(loadHistoryMax(), nowIdx(), RESTORED));
  // biome-ignore lint/correctness/useExhaustiveDependencies: 画面が移るたび（location.key）に番号を読み直す
  useEffect(() => {
    const now = nowIdx();
    setIdx(now);
    setMaxIdx((m) => {
      const next = nextMaxIdx(m, now, navType);
      saveHistoryMax(next);
      return next;
    });
  }, [location.key, navType]);
  const go = (delta: -1 | 1) => {
    void confirmLeave().then((ok) => ok && navigate(delta));
  };
  return (
    <div className="history-nav" data-testid="history-nav">
      <IconButton
        icon={ArrowLeft}
        label="前の画面に戻る"
        disabled={idx <= 0}
        onClick={() => go(-1)}
        data-testid="history-back"
      />
      <IconButton
        icon={ArrowRight}
        label="次の画面に進む"
        disabled={idx >= maxIdx}
        onClick={() => go(1)}
        data-testid="history-forward"
      />
    </div>
  );
}

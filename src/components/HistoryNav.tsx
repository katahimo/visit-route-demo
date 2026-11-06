// 上の帯の左端の「戻る」「進む」（ブラウザの履歴。Alt＋←→ と同じ）。リンクで別の画面へ移ったあと、元の画面へ戻る道を画面に出す。
// 戻れるかは react-router が履歴に入れる番号（history.state.idx）で見る。進めるかは、この画面で開いた中でいちばん先の番号を覚えて見る
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { IconButton } from './ui';

/** react-router が履歴に入れる番号（無ければ 0） */
const historyIdx = (): number => {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' ? idx : 0;
};

export function HistoryNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const navType = useNavigationType();
  const [idx, setIdx] = useState(historyIdx);
  const [maxIdx, setMaxIdx] = useState(historyIdx);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 画面が移るたび（location.key）に番号を読み直す
  useEffect(() => {
    const now = historyIdx();
    setIdx(now);
    // 新しく開いた（PUSH）ら先の履歴は消える。置き換え・戻る・進むは、覚えている先の番号を下げない
    setMaxIdx((m) => (navType === 'PUSH' ? now : Math.max(m, now)));
  }, [location.key, navType]);
  return (
    <div className="history-nav" data-testid="history-nav">
      <IconButton
        icon={ArrowLeft}
        label="前の画面に戻る"
        disabled={idx <= 0}
        onClick={() => navigate(-1)}
        data-testid="history-back"
      />
      <IconButton
        icon={ArrowRight}
        label="次の画面に進む"
        disabled={idx >= maxIdx}
        onClick={() => navigate(1)}
        data-testid="history-forward"
      />
    </div>
  );
}

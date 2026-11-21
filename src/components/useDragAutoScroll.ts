// ドラッグ中に画面の上下の端へ寄せると画面を巻くフック（日の予定。担当なしの訪問が多いと落とす先の列が画面の外に出るため）。
// ブラウザの巻き方に頼らない（Safari は巻かないことがある）。巻く量は lib/dragScroll（純粋関数。テストあり）
import { useEffect } from 'react';
import { dragScrollStep } from '../lib/dragScroll';

/** 上の帯の高さ（--header-h。無ければ 0）。この下を見えている範囲の上の端にする */
function headerBottom(): number {
  const v = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h'));
  return Number.isFinite(v) ? v : 0;
}

/** active（ドラッグ中）の間、最後の dragover の高さが上下の端にあれば、コマごとに画面を巻く。離す・窓の外へ出たら止める */
export function useDragAutoScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let y: number | null = null;
    let frame = 0;
    const onOver = (e: DragEvent) => {
      y = e.clientY;
    };
    // 窓の外へ出た・落とした・やめたら止める（dragover が来れば続ける）。Safari は要素の間を移るときも relatedTarget が
    // 無いので、窓の外かは位置で見る（巻くと指の下の要素が替わって dragleave が来るが、止めない）
    const onLeave = (e: DragEvent) => {
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)
        y = null;
    };
    const stop = () => {
      y = null;
    };
    const tick = () => {
      if (y !== null) {
        const step = dragScrollStep(y, headerBottom(), window.innerHeight);
        if (step !== 0) window.scrollBy(0, step);
      }
      frame = requestAnimationFrame(tick);
    };
    document.addEventListener('dragover', onOver, true);
    document.addEventListener('dragleave', onLeave, true);
    document.addEventListener('drop', stop, true);
    document.addEventListener('dragend', stop, true);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('dragover', onOver, true);
      document.removeEventListener('dragleave', onLeave, true);
      document.removeEventListener('drop', stop, true);
      document.removeEventListener('dragend', stop, true);
    };
  }, [active]);
}

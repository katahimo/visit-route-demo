// 全画面の切り替え（上の帯の右端。ブラウザの Fullscreen API）。全画面のときは「全画面をやめる」に変わる。
// 全画面にできないブラウザ（iPhone の Safari など）では出さない。Esc などでブラウザ側から戻ったときも表示を合わせる
import { Maximize, Minimize } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton } from './ui';

const canFullscreen = () => typeof document !== 'undefined' && document.fullscreenEnabled === true;
const isFullscreen = () => typeof document !== 'undefined' && document.fullscreenElement != null;

export function FullscreenButton() {
  const [on, setOn] = useState(isFullscreen);
  useEffect(() => {
    const sync = () => setOn(isFullscreen());
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  if (!canFullscreen()) return null;
  const toggle = () => {
    const done = on ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    // 断られたとき（ユーザーの操作でない・許可されていない）は何もしない（表示は fullscreenchange で合わせる）
    void done?.catch(() => {});
  };
  return (
    <IconButton
      icon={on ? Minimize : Maximize}
      label={on ? '全画面をやめる' : '全画面で表示'}
      className="fullscreen-btn"
      aria-pressed={on}
      onClick={toggle}
      data-testid="fullscreen"
    />
  );
}

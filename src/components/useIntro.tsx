// 画面の上の説明（見出しの下の1行）の出し分け：エキスパート機能が入は今のまま。切は初回だけ出し、閉じたら端末に覚えて出さない
// （PRD D384。覚えるのは store/navOpen の開け閉めの鍵 intro:<画面>。判定は lib/exceptionView）
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import { introKey, introShown, introText, type ScheduleZoom } from '../lib/exceptionView';
import { navOpenMemory } from '../store';
import { IconButton } from './ui';
import { useExceptionsOnly } from './useFeature';

/** 見出しの下に出す説明（出さないときは undefined）。expertText は入のときの今の文 */
export function useIntro(zoom: ScheduleZoom, expertText: string): ReactNode {
  const only = useExceptionsOnly();
  const stored = useSyncExternalStore(navOpenMemory.subscribe, navOpenMemory.read, navOpenMemory.cached);
  if (!introShown(stored, zoom, only)) return undefined;
  const text = introText(zoom, only, expertText);
  if (!only) return text;
  return (
    <span className="page-lead-row" data-testid="page-intro">
      {text}
      <IconButton
        icon={X}
        label="説明を閉じる"
        className="icon-btn-sm"
        onClick={() => {
          navOpenMemory.write(introKey(zoom), false);
          // 閉じるボタンが消えるのでフォーカスを見出しへ移す（落とさない）
          const h1 = document.querySelector<HTMLElement>('.page-head h1');
          if (h1) {
            h1.tabIndex = -1;
            h1.focus();
          }
        }}
        data-testid="page-intro-close"
      />
    </span>
  );
}

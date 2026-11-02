// 相性を選ぶ欄（PRD D420）：表のマスを押すと出る1つの欄。◎・○・未入力・△・× を意味の文つきで並べ、今の相性に印。
// 選ぶと入れて閉じる（フォーカスはマスへ戻る）。中は ↑↓・Home・End で動く。閉じ方は DetailPopover と同じ
import type { KeyboardEvent } from 'react';
import { DetailPopover } from '../components/DetailPopover';
import { COMPAT_LABELS, type CompatLevel } from '../contracts/rules';
import { COMPAT_CHOICES, COMPAT_WORD, compatLevelClass } from '../lib/compatLevel';

/** ↑↓・Home・End で選ぶボタンの間を動く */
function moveFocus(e: KeyboardEvent<HTMLFieldSetElement>) {
  const list = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
  const n = list.length;
  const at = list.indexOf(document.activeElement as HTMLButtonElement);
  const to: Record<string, number> = { ArrowDown: (at + 1) % n, ArrowUp: (at - 1 + n) % n, Home: 0, End: n - 1 };
  if (!Object.hasOwn(to, e.key)) return;
  e.preventDefault();
  list[to[e.key] ?? 0]?.focus();
}

export function CompatChoice({
  id,
  anchorId,
  clientName,
  staffName,
  current,
  onPick,
  onClose,
}: {
  id: string;
  /** 押したマスの id */
  anchorId: string;
  clientName: string;
  staffName: string;
  current: CompatLevel;
  onPick: (level: CompatLevel) => void;
  onClose: () => void;
}) {
  return (
    <DetailPopover
      id={id}
      anchorId={anchorId}
      title={`${clientName} × ${staffName}`}
      titleId={`${id}-title`}
      onClose={onClose}
      testId="compat-choice-pop"
      focusSelector='[aria-pressed="true"]'
    >
      <fieldset className="compat-choices" onKeyDown={moveFocus}>
        <legend className="sr-only">相性</legend>
        {COMPAT_CHOICES.map((l) => (
          <button
            key={l}
            type="button"
            className={`compat-choice ${compatLevelClass(l)}`}
            aria-pressed={l === current}
            onClick={() => onPick(l)}
            data-testid="compat-choice"
            data-level={l}
          >
            <b className="compat-choice-mark" aria-hidden="true">
              {COMPAT_LABELS[l] || '－'}
            </b>
            {COMPAT_WORD[l]}
          </button>
        ))}
      </fieldset>
    </DetailPopover>
  );
}

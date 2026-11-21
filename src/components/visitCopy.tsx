// 訪問のコピー（PRD D473〜D475。ADR-0120）：訪問の詳細の欄の［この訪問をコピー］と、コピーの欄の「同行」（ふつうのコピー・2人体制・研修同行）。
// コピーは「訪問を1件追加」と同じ欄を、今の欄の入力（保存していない直しも）を入れて開く（保存は lib/visitOps の applyVisitEdit）。データを書くのは store の update だけ
import { Copy } from 'lucide-react';
import type { DemoData } from '../contracts/data';
import {
  accompanyOf,
  COPY_ACCOMPANY_CHOICES,
  canAccompany,
  copyAccompanyPatch,
  PAST_ACCOMPANY_HINT,
} from '../lib/companion';
import type { VisitDraft } from '../lib/visitDraft';
import { findVisit } from '../patterns';
import { WithIcon } from './ui';

/** ［この訪問をコピー］（訪問の詳細の欄。広い画面だけ）。押すとコピーの欄に開き直す */
export function VisitCopyButton({ onCopy }: { onCopy: () => void }) {
  return (
    <div className="vp-section vp-copy">
      <button type="button" className="btn btn-small" onClick={onCopy} data-testid="vp-copy">
        <WithIcon icon={Copy}>この訪問をコピー</WithIcon>
      </button>
      <span className="sub">2人体制・研修同行・別の日時や人へ</span>
    </div>
  );
}

/**
 * コピーの欄の「同行」。2人体制・研修同行を選ぶと、日時を元の訪問にそろえる（同じ日・同じ開始でないと組にならない）。
 * 元の訪問が今日より前なら同行は選べない（今日より前の日には訪問を足せない）
 */
export function CopyAccompanyFields({
  data,
  copyOf,
  draft,
  set,
  today,
}: {
  data: DemoData;
  copyOf: string;
  draft: VisitDraft;
  set: (patch: Partial<VisitDraft>) => void;
  today: string;
}) {
  const source = findVisit(data, copyOf);
  const value = draft.accompany ?? '';
  const can = canAccompany(source, today);
  const choose = (x: string) => {
    const patch = copyAccompanyPatch(source, accompanyOf(x), draft, today);
    if (patch) set(patch);
  };
  return (
    <fieldset className="vp-section" data-testid="vp-accompany">
      <legend>コピーの使い方</legend>
      <div className="vp-choices" role="radiogroup" aria-label="コピーの使い方">
        {COPY_ACCOMPANY_CHOICES.map((c) => {
          const off = c.value !== '' && !can;
          return (
            <label key={c.value || 'plain'} className="vp-choice">
              <input
                type="radio"
                name="vp-accompany"
                checked={value === c.value}
                disabled={off}
                onChange={() => choose(c.value)}
                data-testid={`vp-accompany-${c.value || 'plain'}`}
              />
              <span className="vp-choice-text">
                <span className="vp-choice-name">{c.label}</span>
                <span className="sub vp-choice-desc">{off ? PAST_ACCOMPANY_HINT : c.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

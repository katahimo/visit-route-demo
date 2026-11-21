// 訪問のコピー（PRD D473〜D475。ADR-0120）：訪問の詳細の欄の［この訪問をコピー］と、コピーの欄の「同行」（ふつうのコピー・2人体制・研修同行）。
// コピーは「訪問を1件追加」と同じ欄を、元の訪問の中身を入れて開く（保存は lib/visitOps の applyVisitEdit）。データを書くのは store の update だけ
import { Copy } from 'lucide-react';
import type { DemoData } from '../contracts/data';
import { accompanyOf, COPY_ACCOMPANY_CHOICES } from '../lib/companion';
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
 * コピーの欄の「同行」。2人体制・研修同行を選ぶと、日時を元の訪問にそろえる（同じ日・同じ開始でないと組にならない）
 */
export function CopyAccompanyFields({
  data,
  copyOf,
  draft,
  set,
}: {
  data: DemoData;
  copyOf: string;
  draft: VisitDraft;
  set: (patch: Partial<VisitDraft>) => void;
}) {
  const source = findVisit(data, copyOf);
  const value = draft.accompany ?? '';
  const choose = (x: string) => {
    const accompany = accompanyOf(x);
    set(
      accompany && source
        ? {
            accompany,
            date: source.date,
            windowKind: source.windowKind,
            earliestStart: source.earliestStart,
            latestStart: source.latestStart,
          }
        : { accompany },
    );
  };
  return (
    <fieldset className="vp-section" data-testid="vp-accompany">
      <legend>コピーの使い方</legend>
      <div className="vp-choices" role="radiogroup" aria-label="コピーの使い方">
        {COPY_ACCOMPANY_CHOICES.map((c) => (
          <label key={c.value || 'plain'} className="vp-choice">
            <input
              type="radio"
              name="vp-accompany"
              checked={value === c.value}
              onChange={() => choose(c.value)}
              data-testid={`vp-accompany-${c.value || 'plain'}`}
            />
            <span className="vp-choice-text">
              <span className="vp-choice-name">{c.label}</span>
              <span className="sub vp-choice-desc">{c.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

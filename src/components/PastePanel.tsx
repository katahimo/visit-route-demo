// 「連絡を貼り付けて入れる」の右の欄（PRD D418。ADR-0084）：予定（月・週・日）の「その他 ▾」から開く。
// テキストの欄に貼ると1行ずつ読み（lib/pasteNotices・lib/pasteRows）、読んだ内容とチェック、または読めない理由の一覧を出す。
// 主ボタン［N件を入れる］で1回で書く（元に戻せる）。状態と処理は usePasteNotices
import { Check, ClipboardPaste, X } from 'lucide-react';
import { useId } from 'react';
import { pasteApplyLabel } from '../lib/pasteRows';
import { SidePanel, WithIcon } from './ui';
import { COMPACT_QUERY, useMedia } from './useMedia';
import { usePasteNotices } from './usePasteNotices';
import './pastePanel.css';

/** 欄の見出しと「その他 ▾」の項目の名前 */
export const PASTE_LABEL = '連絡を貼り付けて入れる';

export function PastePanel({ onClose }: { onClose: () => void }) {
  const p = usePasteNotices(onClose);
  const narrow = useMedia(COMPACT_QUERY);
  const helpId = useId();
  const ok = p.rows.filter((r) => r.action).length;
  return (
    <SidePanel
      icon={ClipboardPaste}
      title={PASTE_LABEL}
      sheet={narrow}
      onClose={onClose}
      onSubmit={p.save}
      footer={
        <>
          <button
            type="submit"
            className="btn btn-primary"
            aria-disabled={p.count === 0 || undefined}
            data-testid="paste-apply"
          >
            <WithIcon icon={Check}>{pasteApplyLabel(p.count)}</WithIcon>
          </button>
          <button type="button" className="btn" onClick={onClose} data-testid="paste-close">
            <WithIcon icon={X}>閉じる</WithIcon>
          </button>
        </>
      }
    >
      <div className="paste-panel stack" data-testid="paste-panel">
        <label className="stack paste-text">
          <span>連絡の文</span>
          <textarea
            rows={6}
            value={p.text}
            onChange={(e) => p.setText(e.target.value)}
            aria-describedby={helpId}
            placeholder={'12/3 田中 休み\n12/5 山田様 中止\n12/3〜12/10 佐藤様 入院'}
            data-testid="paste-text"
          />
        </label>
        <p className="sub" id={helpId}>
          1行に 日付・名前・言葉。{p.terms.staff}は 休み・欠勤・希望休（午前・午後・10時から・15時まで）、
          {p.terms.client}は 中止・キャンセル・休み、入院・ショートは「〜12/10」まで。担当は振り直しません。
        </p>
        <p className="paste-count" aria-live="polite" data-testid="paste-count">
          {p.rows.length === 0 ? '' : `読めた ${ok}行・読めない ${p.rows.length - ok}行`}
        </p>
        {p.rows.length > 0 && (
          <ul className="paste-rows" aria-label="読んだ行" data-testid="paste-rows">
            {p.rows.map((r, i) =>
              r.action ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: 同じ文の行もあるので位置で分ける
                <li key={i} className="paste-row" data-state="ok" data-testid="paste-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={p.checked(i)}
                      onChange={() => p.toggle(i)}
                      data-testid="paste-row-check"
                    />
                    <span className="paste-row-text">{r.text}</span>
                  </label>
                </li>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: 同じ文の行もあるので位置で分ける
                <li key={i} className="paste-row" data-state="ng" data-testid="paste-row">
                  <span className="paste-row-text">{r.text}</span>
                  <span className="paste-row-reason" data-testid="paste-row-reason">
                    {r.reason}
                  </span>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </SidePanel>
  );
}

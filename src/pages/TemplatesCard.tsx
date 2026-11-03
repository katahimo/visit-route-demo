import { CircleCheck, LayoutTemplate } from 'lucide-react';
import { useId } from 'react';
import { DetailsFold } from '../components/DetailsFold';
import type { Terms } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { matchTemplate, TEMPLATES, type TemplateDef } from '../lib/features';
import { currentTemplateName, templateCardText } from '../lib/settingsView';

/**
 * ひな形（PRD D212・D395。ADR-0074 段4）：見出しの横に「いま：〈今使っているものの名前〉」（どれとも違えば「いま：カスタム」。読み上げは「今のひな形：〜」）だけを出し、
 * 5つの一覧は「詳しく ▾」に畳む（閉じて始める。開閉は覚えない）。「適用」は呼ぶ側の確認ダイアログへ。
 * 1つずつ 名前・近い業種の例・使うときの説明・基本との差（足す・外す機能）を出す（ADR-0092）
 */
export function TemplatesCard({
  features,
  terms,
  onApply,
}: {
  features: Features;
  terms: Pick<Terms, 'client' | 'staff'>;
  onApply: (t: TemplateDef) => void;
}) {
  const titleId = useId();
  const current = matchTemplate(features);
  const now = currentTemplateName(current);
  return (
    <section className="card stack" aria-labelledby={titleId} data-testid="feature-templates">
      <h2 id={titleId} className="feature-section-title">
        <LayoutTemplate size={18} aria-hidden="true" />
        ひな形
        <span
          role="img"
          aria-label={`今のひな形：${now.name}`}
          className={now.custom ? 'feature-badge is-custom' : 'feature-badge'}
          data-testid={now.custom ? 'feature-custom' : 'feature-template-current'}
        >
          いま：{now.name}
        </span>
      </h2>
      <DetailsFold testId="feature-templates-fold" heading="5つから選んで適用">
        <p className="sub">よく使う組み合わせを一度に適用します。適用したあとも、下のスイッチで1つずつ直せます。</p>
        <ul className="feature-templates">
          {TEMPLATES.map((t) => {
            const text = templateCardText(t, terms);
            return (
              <li
                key={t.id}
                className={current === t.id ? 'feature-template is-now' : 'feature-template'}
                data-testid="feature-template"
                data-template={t.id}
              >
                <h3>
                  {t.label}
                  {text.example && (
                    <span className="feature-template-example" data-testid="feature-template-example">
                      {text.example}
                    </span>
                  )}
                  {current === t.id && (
                    <span className="feature-badge" data-testid="feature-template-now">
                      <CircleCheck size={14} aria-hidden="true" />
                      いまの設定
                    </span>
                  )}
                </h3>
                <p className="sub">{text.description}</p>
                {text.delta.map((line) => (
                  <p key={line} className="feature-template-delta" data-testid="feature-template-delta">
                    {line}
                  </p>
                ))}
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => onApply(t)}
                  aria-label={`ひな形「${t.label}」を適用する`}
                  data-testid="feature-template-apply"
                >
                  適用
                </button>
              </li>
            );
          })}
        </ul>
      </DetailsFold>
    </section>
  );
}

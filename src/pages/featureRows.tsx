import { useId } from 'react';
import { Hint } from '../components/ui';
import type { Terms } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { FEATURES, type FeatureDef, type FeatureGroup, isOn } from '../lib/features';
import { featureRowText } from '../lib/settingsView';

/** グループごとのスイッチ（見出しはグループの名前） */
export type RowProps = {
  features: Features;
  terms: Pick<Terms, 'client' | 'staff'>;
  onToggle: (f: FeatureDef) => Promise<void>;
};

export function FeatureGroupCard({ group, ...props }: RowProps & { group: FeatureGroup }) {
  const titleId = useId();
  const list = FEATURES.filter((f) => f.group === group);
  return (
    <section className="card stack" aria-labelledby={titleId} data-testid="feature-group">
      <h2 id={titleId} className="feature-section-title">
        {group}
      </h2>
      <ul className="feature-list">
        {list.map((f) => (
          <FeatureRow key={f.id} f={f} {...props} />
        ))}
      </ul>
    </section>
  );
}

/**
 * 機能の1行（PRD D395。ADR-0074 段4）：名前と1行の説明を出し、「切ると隠れるもの」と依存の注記は ⓘ の中。
 * 依存先が切で押せないときの理由は行に出す。閉じた <details> の中は aria-describedby で指しても読み上げに入らないので、
 * スイッチの読み上げ用に隠れるもの・依存の注記の写しを <details> の外（`feature-sr`。hidden）に置き、aria-describedby はそれを指す
 */
function FeatureRow({ f, features, terms, onToggle }: RowProps & { f: FeatureDef }) {
  const baseId = useId();
  const on = isOn(features, f.id);
  const text = featureRowText(f, features, terms);
  const blocked = text.requires?.blocked === true;
  const reqNote = text.requires && (
    <span
      id={blocked ? `${baseId}-req` : undefined}
      className={blocked ? 'feature-req is-blocked' : 'feature-req'}
      data-testid={blocked ? undefined : 'feature-req-note'}
    >
      {text.requires.text}
    </span>
  );
  const srText = [text.hides, blocked ? '' : text.requires?.text].filter(Boolean).join('。');
  return (
    <li className="feature-row" data-testid="feature-row" data-feature={f.id}>
      <div className="feature-text">
        <strong id={`${baseId}-name`}>{text.label}</strong>
        <span className="feature-desc-line">
          <span id={`${baseId}-desc`} className="sub">
            {text.description}
          </span>
          <Hint ariaLabel={`${text.label}の説明`}>
            <span className="feature-hides" data-testid="feature-hides">
              {text.hides}
            </span>
            {!blocked && reqNote}
          </Hint>
        </span>
        {blocked && reqNote}
        <span id={`${baseId}-sr`} hidden data-testid="feature-sr">
          {srText}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-disabled={blocked || undefined}
        aria-labelledby={`${baseId}-name`}
        aria-describedby={[`${baseId}-desc`, blocked ? `${baseId}-req` : '', `${baseId}-sr`].filter(Boolean).join(' ')}
        className={on ? 'feature-switch is-on' : 'feature-switch'}
        onClick={() => void onToggle(f)}
        data-testid="feature-switch"
      >
        <span className="feature-switch-track" aria-hidden="true">
          <span className="feature-switch-knob" />
        </span>
        <span className="feature-switch-text" aria-hidden="true">
          {on ? '入' : '切'}
        </span>
      </button>
    </li>
  );
}

// 条件の重みの画面のプリセットの節（D20・D24・D235。ADR-0008・ADR-0035）：点数の基準の選択・プリセットごとの名前・一言・
// 型ごとの重み・必須（変えるとすぐ保存）・消す（最後の1つは消せない）・基準の重みを写して保存（6つまで）・初期値に戻す。
// 状態と処理は usePresetSection
import { LayoutGrid, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { WeightSlider } from '../components/parts';
import { Term } from '../components/Term';
import { Hint, SectionTitle, WithIcon } from '../components/ui';
import type { Terms } from '../contracts/documents';
import { HARDABLE, MAX_PRESETS, type Preset, type RuleType } from '../contracts/rules';
import { ruleTypeLabel, weightLocked } from '../lib/common';
import { narrowRole } from '../lib/narrowRoles';
import { PRESET_NAME_MAX, PRESET_NOTE_MAX } from '../lib/presets';
import { useDemoData } from '../store';
import { SavePresetForm } from './planParts';
import { RULE_ICONS } from './rulesParts';
import { usePresetSection } from './usePresetSection';

type PresetFlow = ReturnType<typeof usePresetSection>;

export function PresetSection({
  draftCount,
  onReset,
  shownTypes,
}: {
  draftCount: number;
  onReset: () => void;
  /** 出す条件の型（相性を切っているときは相性を除く） */
  shownTypes: readonly RuleType[];
}) {
  const { data } = useDemoData();
  const terms = data.org.terms;
  const flow = usePresetSection({ draftCount, onReset });
  return (
    <div className="card stack" ref={flow.ref} data-testid="preset-section">
      <SectionTitle
        icon={LayoutGrid}
        aside={
          <Hint>
            <ul className="hint-list">
              <li>日の予定で、プリセットで試して提案を比べられます（比べた提案は保存しません）。</li>
              <li>点数の基準に選んだプリセットの重みで、AI で組みます。</li>
              <li>{MAX_PRESETS}つまで作れます。変えるとすぐ保存します。</li>
            </ul>
          </Hint>
        }
      >
        <span>
          <Term k="preset" />（{data.presets.length}/{MAX_PRESETS}）
        </span>
      </SectionTitle>
      <ScoreRulerChoice presets={data.presets} rulerId={flow.ruler?.id} onChoose={flow.choose} />
      <div className="stack" style={{ gap: 8 }}>
        {data.presets.map((p, i) => (
          <PresetEdit
            key={p.id}
            preset={p}
            no={i + 1}
            only={data.presets.length <= 1}
            shownTypes={shownTypes}
            terms={terms}
            flow={flow}
          />
        ))}
      </div>
      <div className="row narrow-stack" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <SavePresetForm from="basis" />
        <button type="button" className="btn" onClick={flow.reset}>
          <WithIcon icon={RotateCcw}>初期値に戻す</WithIcon>
        </button>
      </div>
    </div>
  );
}

/** 点数の基準の選択（ラジオ。ふだん使う重み） */
function ScoreRulerChoice({
  presets,
  rulerId,
  onChoose,
}: {
  presets: Preset[];
  rulerId: string | undefined;
  onChoose: (p: Preset) => Promise<void>;
}) {
  return (
    <fieldset className="score-ruler" data-testid="score-ruler-choice">
      <legend>
        点数の基準
        <Hint ariaLabel="点数の基準の説明">
          <ul className="hint-list">
            <li>ここで選んだプリセットが、ふだん使う重みです。</li>
            <li>AI で組む・点数・要対応の検査に、この重みを使います。</li>
            <li>上の表で直すのは、このプリセットの重みです。</li>
          </ul>
        </Hint>
      </legend>
      <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
        {presets.map((p) => (
          <label key={p.id} className="score-ruler-option">
            <input
              type="radio"
              name="score-preset"
              value={p.id}
              checked={rulerId === p.id}
              onChange={() => void onChoose(p)}
            />
            {p.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** プリセット1つの編集（畳める。名前・一言・型ごとの重み・必須・消す） */
function PresetEdit({
  preset: p,
  no,
  only,
  shownTypes,
  terms,
  flow,
}: {
  preset: Preset;
  /** 並びの番号（1から） */
  no: number;
  /** 最後の1つ（消せない） */
  only: boolean;
  shownTypes: readonly RuleType[];
  terms: Terms;
  flow: PresetFlow;
}) {
  const { current, ruler, set, remove } = flow;
  return (
    <details className="preset-edit" data-testid="preset-edit">
      <summary className="narrow-preset-summary">
        <span className="preset-no">{no}</span>
        <strong>{p.name}</strong>
        {/* 日の予定で試している重みが基準と違うプリセットに当たるときだけ（ADR-0035） */}
        {current?.id === p.id && ruler?.id !== p.id && <span className="chip chip-primary">日の予定で使用中</span>}
        {ruler?.id === p.id && <span className="chip">点数の基準</span>}
        <span className="sub ellipsis">{p.note}</span>
      </summary>
      <div className="stack" style={{ gap: 8, paddingTop: 8 }}>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <div className="stack" style={{ maxWidth: 220, gap: 2 }}>
            <span>名前</span>
            <PresetText
              value={p.name}
              max={PRESET_NAME_MAX}
              required
              ariaLabel="プリセットの名前"
              onChange={(name) => set(p.id, { name })}
            />
          </div>
          <div className="stack" style={{ flex: 1, minWidth: 200, gap: 2 }}>
            <span>一言</span>
            <PresetText
              value={p.note}
              max={PRESET_NOTE_MAX}
              ariaLabel="プリセットの一言"
              onChange={(note) => set(p.id, { note })}
            />
          </div>
        </div>
        <PresetWeights preset={p} shownTypes={shownTypes} terms={terms} onWeight={flow.setWeight} />
        <div className="row">
          <button
            type="button"
            className="btn btn-small"
            disabled={only}
            title={only ? '最後の1つは消せません' : undefined}
            onClick={() => remove(p)}
          >
            <WithIcon icon={Trash2} size={14}>
              このプリセットを消す
            </WithIcon>
          </button>
        </div>
      </div>
    </details>
  );
}

/** プリセットの型ごとの重み・必須の表（狭い画面では行をカードにする） */
function PresetWeights({
  preset: p,
  shownTypes,
  terms,
  onWeight,
}: {
  preset: Preset;
  shownTypes: readonly RuleType[];
  terms: Terms;
  onWeight: (p: Preset, t: RuleType, w: Partial<{ weight: number; hard: boolean }>) => void;
}) {
  return (
    <div className="table-scroll">
      <table {...narrowRole.table} className="rules-table narrow-cards">
        <thead {...narrowRole.rowgroup}>
          <tr {...narrowRole.row}>
            <th {...narrowRole.columnheader}>条件の種類</th>
            <th {...narrowRole.columnheader} style={{ width: 220 }}>
              重み
            </th>
            <th {...narrowRole.columnheader}>必須</th>
          </tr>
        </thead>
        <tbody {...narrowRole.rowgroup}>
          {shownTypes.map((t) => {
            const w = p.weights[t];
            const hardable = HARDABLE.has(t);
            const locked = weightLocked({ type: t, hard: w.hard });
            return (
              <tr {...narrowRole.row} key={t} className={w.weight === 0 && !w.hard ? 'is-dim' : ''}>
                <td {...narrowRole.cell} className="narrow-title" data-label="条件の種類">
                  <WithIcon icon={RULE_ICONS[t]} size={14}>
                    {ruleTypeLabel(t, terms)}
                  </WithIcon>
                </td>
                <td {...narrowRole.cell} data-label="重み">
                  <WeightSlider
                    label={`${p.name}の${ruleTypeLabel(t, terms)}`}
                    value={w.weight}
                    disabled={locked}
                    onChange={(weight) => onWeight(p, t, { weight })}
                  />
                </td>
                <td {...narrowRole.cell} className={hardable ? 'nowrap narrow-head' : 'nowrap'} data-label="必須">
                  {hardable ? (
                    <label className={`hard-toggle${w.hard ? ' is-on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={w.hard}
                        onChange={(e) => onWeight(p, t, { hard: e.target.checked })}
                      />
                      <WithIcon icon={ShieldCheck} size={14}>
                        必須
                      </WithIcon>
                    </label>
                  ) : (
                    <span className="sub">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** プリセットの名前・一言の入力（名前は空のまま保存しない。空のまま離れたら元に戻す） */
function PresetText({
  value,
  max,
  required = false,
  ariaLabel,
  onChange,
}: {
  value: string;
  max: number;
  required?: boolean;
  ariaLabel: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      value={draft ?? value}
      maxLength={max}
      aria-label={ariaLabel}
      onChange={(e) => {
        const t = e.target.value;
        setDraft(t);
        if (!required || t.trim()) onChange(t.slice(0, max));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

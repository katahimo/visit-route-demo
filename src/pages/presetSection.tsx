// 条件の重みの画面の「考え方（プリセット）の管理」（D20・D235。ADR-0008・ADR-0035・ADR-0088・ADR-0099。畳んで画面の下）：
// プリセットの一覧の各行の丸で点数の基準を選ぶ・名前・一言の編集（変えるとすぐ保存）・型ごとの重み・必須の読み取り専用の一覧
// （基準のプリセットは上の条件の表に寄せる）・消す（初期の3つと最後の1つは消せない）。プリセットの重みは変えない（重みは上の表で直して保存する）。
// 状態と処理は usePresetSection
import { LayoutGrid, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Term } from '../components/Term';
import { Hint, SectionTitle, WithIcon } from '../components/ui';
import type { Terms } from '../contracts/documents';
import { HARDABLE, MAX_PRESETS, type Preset, type RuleType } from '../contracts/rules';
import { ruleTypeLabel, weightLocked } from '../lib/common';
import { narrowRole } from '../lib/narrowRoles';
import { isInitialPreset, PRESET_NAME_MAX, PRESET_NOTE_MAX } from '../lib/presets';
import { useDemoData } from '../store';
import { RULE_ICONS } from './rulesParts';
import { usePresetSection } from './usePresetSection';

type PresetFlow = ReturnType<typeof usePresetSection>;

export function PresetSection({
  draftCount,
  shownTypes,
}: {
  draftCount: number;
  /** 出す条件の型（相性を切っているときは相性を除く） */
  shownTypes: readonly RuleType[];
}) {
  const { data } = useDemoData();
  const terms = data.org.terms;
  const flow = usePresetSection({ draftCount });
  return (
    <div className="stack" ref={flow.ref} data-testid="preset-section">
      <SectionTitle
        icon={LayoutGrid}
        aside={
          <Hint>
            <ul className="hint-list">
              <li>
                丸で選んだプリセットが点数の基準（ふだんの考え方）です。自動の組み・担当を組む・訪問ごとの検査はこの重み・必須で計算し、画面の点数（100点満点）もこれで付けます。
              </li>
              <li>
                プリセットの重み・必須は変えられません。上の表で直して保存すると「調整した重み」に書き、それを点数の基準にします。
              </li>
              <li>案を比べるでは、プリセットごとに提案を作れます。</li>
              <li>{MAX_PRESETS}つまで作れます。名前・一言は変えるとすぐ保存します。初期の3つは消せません。</li>
            </ul>
          </Hint>
        }
      >
        <span>
          <Term k="preset" />（{data.presets.length}/{MAX_PRESETS}）
        </span>
      </SectionTitle>
      {/* 点数の基準の選択はプリセットの一覧の各行の丸（同じプリセットを2回並べない。ADR-0088） */}
      <fieldset className="preset-list" data-testid="score-ruler-choice">
        <legend className="sub">左の丸で点数の基準（ふだんの考え方）を選びます</legend>
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
      </fieldset>
    </div>
  );
}

/** プリセット1つ（左に点数の基準の丸。畳める中身は名前・一言の編集・重みの読み取り専用の一覧・消す） */
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
  const { ruler, rename, remove, choose } = flow;
  const initial = isInitialPreset(p.id);
  const isRuler = ruler?.id === p.id;
  return (
    <div className="preset-row">
      <input
        type="radio"
        name="score-preset"
        value={p.id}
        checked={isRuler}
        onChange={() => void choose(p)}
        aria-label={`「${p.name}」を点数の基準にする`}
        data-testid="score-ruler-radio"
      />
      <details className="preset-edit" data-testid="preset-edit" data-preset={p.id}>
        <summary className="narrow-preset-summary">
          <span className="preset-no">{no}</span>
          <strong>{p.name}</strong>
          {initial && (
            <span className="chip" data-testid="preset-initial">
              初期
            </span>
          )}
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
                onChange={(name) => rename(p.id, { name })}
              />
            </div>
            <div className="stack" style={{ flex: 1, minWidth: 200, gap: 2 }}>
              <span>一言</span>
              <PresetText
                value={p.note}
                max={PRESET_NOTE_MAX}
                ariaLabel="プリセットの一言"
                onChange={(note) => rename(p.id, { note })}
              />
            </div>
          </div>
          {isRuler ? (
            // 基準のプリセットの重み・必須は上の条件の表と同じなので、表に寄せる（ADR-0088）
            <p className="sub" data-testid="preset-weights-basis">
              重み・必須は上の条件の表のとおりです（点数の基準）。
            </p>
          ) : (
            <PresetWeights preset={p} shownTypes={shownTypes} terms={terms} />
          )}
          {!initial && !only && (
            <div className="row">
              <button
                type="button"
                className="btn btn-small"
                onClick={() => void remove(p)}
                data-testid="preset-remove"
              >
                <WithIcon icon={Trash2} size={14}>
                  このプリセットを消す
                </WithIcon>
              </button>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

/** 重みの読み取り専用の文（重みを使わない必須は「—」、0 は「0（使わない）」） */
const weightCell = (t: RuleType, w: { weight: number; hard: boolean }): string =>
  weightLocked({ type: t, hard: w.hard }) ? '—' : w.weight === 0 ? '0（使わない）' : String(w.weight);

/** プリセットの型ごとの重み・必須の読み取り専用の一覧（変えられない。ADR-0065。狭い画面では行をカードにする） */
function PresetWeights({
  preset: p,
  shownTypes,
  terms,
}: {
  preset: Preset;
  shownTypes: readonly RuleType[];
  terms: Terms;
}) {
  return (
    <div className="table-scroll">
      <table {...narrowRole.table} className="rules-table narrow-cards" data-testid="preset-weights">
        <thead {...narrowRole.rowgroup}>
          <tr {...narrowRole.row}>
            <th {...narrowRole.columnheader}>条件の種類</th>
            <th {...narrowRole.columnheader}>重み</th>
            <th {...narrowRole.columnheader}>必須</th>
          </tr>
        </thead>
        <tbody {...narrowRole.rowgroup}>
          {shownTypes.map((t) => {
            const w = p.weights[t];
            const hard = HARDABLE.has(t) && w.hard;
            return (
              <tr {...narrowRole.row} key={t} className={w.weight === 0 && !hard ? 'is-dim' : ''}>
                <td {...narrowRole.cell} className="narrow-title" data-label="条件の種類">
                  <WithIcon icon={RULE_ICONS[t]} size={14}>
                    {ruleTypeLabel(t, terms)}
                  </WithIcon>
                </td>
                <td {...narrowRole.cell} data-label="重み">
                  {weightCell(t, w)}
                </td>
                <td
                  {...narrowRole.cell}
                  className={HARDABLE.has(t) ? 'nowrap narrow-head' : 'nowrap'}
                  data-label="必須"
                >
                  {hard ? (
                    <WithIcon icon={ShieldCheck} size={14}>
                      必須
                    </WithIcon>
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

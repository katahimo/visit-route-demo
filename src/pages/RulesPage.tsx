import { SlidersHorizontal } from 'lucide-react';
import { useConfirm } from '../components/ConfirmDialog';
import { PageHeader } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { RULE_TYPES, type Rule, type RuleType } from '../contracts/rules';
import { newId, ruleTypeLabel } from '../lib/common';
import { addRule } from '../lib/presets';
import { isSavedHard, RULE_DEFAULTS, removeRule, renameRule } from '../lib/ruleEdit';
import { useDemoData } from '../store';
import './settings.css';
import { PresetSection } from './presetSection';
import { RulesAdd, RulesAdvanced, RulesDraftBar, RulesFill, RulesIntro, RulesTable } from './rulesParts';
import { useRulesDraft } from './useRulesDraft';

/**
 * 相性（ADR-0028 の compat）を切っているときは「相性」の条件を出さない（計算からも外れる。条件のデータは消さない）
 */
function useShownTypes(): { compatOn: boolean; shownTypes: readonly RuleType[] } {
  const compatOn = useFeature('compat');
  return { compatOn, shownTypes: compatOn ? RULE_TYPES : RULE_TYPES.filter((t) => t !== 'compatibility') };
}

/**
 * 条件の重み（メニュー「組む」の子。PRD D233・D360。ADR-0035・ADR-0048・ADR-0099）：予定を入れたときの自動の組み・担当を組む・
 * 点数・検査に使う重みを直す画面。条件（ルール）の一覧に、重み 0〜5（0.5刻み、0 で半透明＝無効）と必須の切り替え。
 * 表の重み・必須は点数の基準のプリセット（今の重み）から始まり、動かしても・［値を入れる］でプリセットの値を入れても保存せず
 * 画面の中の下書きに置く（状態と処理は useRulesDraft）。「保存」で「調整した重み」に書いて点数の基準にする（ほかのプリセットは変えない）。
 * プリセットの管理（基準を選ぶ・名前・消す）は畳んで下に置く。区画の部品は rulesParts、プリセットの管理は presetSection
 */
export default function RulesPage() {
  const { data, update } = useDemoData();
  const { compatOn, shownTypes } = useShownTypes();
  const confirmDialog = useConfirm();
  const terms = data.org.terms;
  const draft = useRulesDraft();
  const { changes } = draft;
  const add = (type: RuleType) => {
    // 足す条件の重み・必須は、押した時点のデータで決める（点数の基準のプリセットのその型。lib/presets の addRule）
    const rule = { id: newId('r'), type, label: ruleTypeLabel(type, terms) };
    update((d) => addRule(d, rule, RULE_DEFAULTS[type]), '条件を追加');
  };
  const remove = async (r: Rule) => {
    // 必須の条件は、消すと「守らなければ担当にしない」が無くなることを本文で伝える（PRD D271）
    const hard = isSavedHard(draft.savedRules, r);
    if (
      !(await confirmDialog({
        title: `条件「${r.label}」を消しますか？`,
        body: hard
          ? '必須の条件です。消すと「守らなければ担当にしない」決まりが無くなり、合わない人にも担当が入ることがあります。'
          : undefined,
        confirmLabel: '消す',
        tone: 'danger',
      }))
    )
      return;
    update((d) => removeRule(d, r.id), '条件を消す');
  };

  return (
    <div className="stack">
      <PageHeader
        icon={SlidersHorizontal}
        title="条件の重み"
        lead="AI で担当を組むとき（予定を入れたときの自動の組み・担当を組む）に、どの条件を重く見るかを決めます。保存すると次に組むときから使います"
      />

      <div className="card stack">
        <RulesIntro basisName={draft.basis?.name} />
        <RulesFill presets={data.presets} basisId={draft.basis?.id} onFill={(p) => draft.fill(p.weights, shownTypes)} />
        <RulesTable
          rules={draft.shownRules.filter((r) => compatOn || r.type !== 'compatibility')}
          terms={terms}
          changeOf={draft.changeOf}
          actions={{
            onLabel: (id, label) => update((d) => renameRule(d, id, label), '条件の名前'),
            onWeight: draft.setWeight,
            onRemove: remove,
          }}
        />
        {data.rules.length === 0 && <p className="sub">条件がありません。移動時間だけで割り当てます。</p>}
        <RulesAdd types={shownTypes} terms={terms} primary={changes.length === 0} onAdd={add} />
      </div>

      {/* プリセットの管理はふだん使わないので畳む（読み直すと畳む。#presets から来たら開く） */}
      <details className="card rules-presets" data-testid="preset-fold">
        <summary>考え方（プリセット）の管理</summary>
        <PresetSection draftCount={changes.length} shownTypes={shownTypes} />
      </details>

      <RulesAdvanced />

      {changes.length > 0 && (
        <RulesDraftBar count={changes.length} full={draft.full} onDiscard={draft.discard} onConfirm={draft.saveDraft} />
      )}
    </div>
  );
}

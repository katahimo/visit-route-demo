import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { PageHeader, WithIcon } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { RULE_TYPES, type Rule, type RuleType } from '../contracts/rules';
import { newId, ruleTypeLabel } from '../lib/common';
import { addRule } from '../lib/presets';
import { isSavedHard, RULE_DEFAULTS, removeRule, renameRule } from '../lib/ruleEdit';
import { useDemoData } from '../store';
import './settings.css';
import { PresetSection } from './presetSection';
import { RulesAdd, RulesAdvanced, RulesDraftBar, RulesIntro, RulesTable } from './rulesParts';
import { useRulesDraft } from './useRulesDraft';

/**
 * 相性（ADR-0028 の compat）を切っているときは「相性」の条件を出さない（計算からも外れる。条件のデータは消さない）
 */
function useShownTypes(): { compatOn: boolean; shownTypes: readonly RuleType[] } {
  const compatOn = useFeature('compat');
  return { compatOn, shownTypes: compatOn ? RULE_TYPES : RULE_TYPES.filter((t) => t !== 'compatibility') };
}

/**
 * 条件の重み（組み方の標準の「1. 案をくらべる」からの寄り道。PRD D233・D360。ADR-0035・ADR-0065・ADR-0066）。
 * 上にプリセットの節（点数の基準を選ぶと下の表の重みが替わる）。その下の条件（ルール）の一覧に、重み 0〜5（0.5刻み、0 で半透明＝無効）と
 * 必須の切り替え。表の重み・必須は点数の基準のプリセット（ふだんの考え方）のものから始まり、動かしても保存せず画面の中の下書きに置く
 * （PRD D286。ADR-0048。状態と処理は useRulesDraft）。保存するとプリセットは書き換えず、新しい考え方（プリセット）として足して
 * 点数の基準にする（ADR-0065）。担当を組む・点数・検査はこの重みで計算する（重みは1組。ADR-0053）。
 * 区画の部品は rulesParts、プリセットの節は presetSection
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
    update((d) => addRule(d, rule, RULE_DEFAULTS[type]), '条件を足す');
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
        lead="ふだんの考え方（点数の基準）の重みを決めます。触らなくても、初期の考え方で組めます"
        actions={
          <Link to="/standard" className="btn" data-testid="rules-back">
            <WithIcon icon={ArrowLeft}>組み方の標準へ戻る</WithIcon>
          </Link>
        }
      />
      <PresetSection draftCount={changes.length} shownTypes={shownTypes} />

      <div className="card stack">
        <RulesIntro basisName={draft.basis?.name} />
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

      <RulesAdvanced />

      {changes.length > 0 && (
        <RulesDraftBar count={changes.length} full={draft.full} onDiscard={draft.discard} onConfirm={draft.saveDraft} />
      )}
    </div>
  );
}

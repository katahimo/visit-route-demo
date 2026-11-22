// 設定のひな形（設定セット。PRD D480〜D482。ADR-0121）：管理者設定の機能の入り切りと、いくつかの設定（条件・移動時間の見積もり方）を
// まとめて変える型。`#/settings?apply=<ID>` のリンクで開き、確認のあと［適用］で書く（画面は components/useSettingSetLink）。
// 公開 URL は複数の顧客が使うので、更新で全員に自動で適用しない（リンクを開いた人が確認して押したときだけ）。
// 名前は業務の型で、法人名は出さない（AGENTS.md）。書くのは設定だけ（org.features・rules・org.lineTravel）で、
// 〈利用者さん〉・〈スタッフ〉・予定には触らない。データは書き換えない（新しい DemoData を返す。書くのは画面の update(fn)）
import type { DemoData } from '../contracts/data';
import type { FeatureId } from '../contracts/features';
import { HOME_NEAR_BEFORE_END_DEFAULT } from '../contracts/rules';
import { scorePresetOf } from '../seed';
import { ruleTypeLabel } from './common';
import { featureLabel, isSwitchOn, turnOffImpact } from './features';
import { addRule } from './presets';
import { RULE_DEFAULTS } from './ruleEdit';

/** 設定のひな形の ID（URL の `apply=` に書く。業務の型の名前） */
export const SETTING_SET_IDS = ['standard-start-no-shift'] as const;
export type SettingSetId = (typeof SETTING_SET_IDS)[number];

/** 設定のひな形の1つ。無い欄は変えない */
export type SettingSetDef = {
  id: SettingSetId;
  /** 中身が分かる名前（確認の見出し・知らせ） */
  label: string;
  /** 機能の入り切り（書くのはここにある機能だけ。ほかは今のまま） */
  features: Partial<Record<FeatureId, boolean>>;
  /** 帰りの前は自宅に近い人（homeNear）の条件が無ければ足す（重みは足すときの既定、勤務の終わりの何分前からは既定） */
  addHomeNear?: true;
  /** 直線距離からの見積もりの車の速さ（km/h。org.lineTravel.driveKmh） */
  driveKmh?: number;
};

export const SETTING_SETS: readonly SettingSetDef[] = [
  {
    id: 'standard-start-no-shift',
    label: 'ちょうどの時刻で組む・連絡を短く',
    features: {
      shiftStart: false,
      clientTraits: false,
      timeWindow: false,
      clientContact: false,
      contactAddress: false,
    },
    addHomeNear: true,
    driveKmh: 30,
  },
];

/** ID の設定のひな形（知らない ID は null。前後の空白は落とし、大文字・小文字は区別しない） */
export function settingSetOf(id: string): SettingSetDef | null {
  const key = id.trim().toLowerCase();
  return SETTING_SETS.find((s) => s.id === key) ?? null;
}

/** 確認の一覧の1行（変わる項目。今の値 → 新しい値） */
export type SettingChange = {
  key: string;
  label: string;
  from: string;
  to: string;
  /** 機能の入り切りの行なら、その機能 */
  feature?: FeatureId;
};

const onOff = (on: boolean) => (on ? '入' : '切');

/** 足す帰りの前は自宅に近い人の重み（足すときの既定：点数の基準のプリセットのその型。lib/presets の addRule と同じ） */
function homeNearWeight(d: Pick<DemoData, 'presets' | 'scorePresetId'>): number {
  return (scorePresetOf(d.presets, d.scorePresetId)?.weights.homeNear ?? RULE_DEFAULTS.homeNear).weight;
}

/**
 * 適用すると変わる項目（確認の一覧）。すでに同じ値の項目は出さない（全部同じなら []）。並びは 機能（表の順ではなくひな形の順）→
 * 条件 → 移動時間の見積もり方
 */
export function settingSetChanges(
  d: Pick<DemoData, 'org' | 'rules' | 'presets' | 'scorePresetId'>,
  set: SettingSetDef,
): SettingChange[] {
  const terms = d.org.terms;
  const out: SettingChange[] = [];
  for (const [id, on] of Object.entries(set.features) as [FeatureId, boolean][]) {
    const cur = isSwitchOn(d.org.features, id);
    if (cur !== on)
      out.push({
        key: `feature:${id}`,
        label: `機能「${featureLabel(id, terms)}」`,
        from: onOff(cur),
        to: onOff(on),
        feature: id,
      });
  }
  if (set.addHomeNear && !d.rules.some((r) => r.type === 'homeNear'))
    out.push({
      key: 'rule:homeNear',
      label: `条件「${ruleTypeLabel('homeNear', terms)}」`,
      from: 'なし',
      to: `足す（重み${homeNearWeight(d)}・勤務の終わりの${HOME_NEAR_BEFORE_END_DEFAULT}分前から）`,
    });
  if (set.driveKmh !== undefined && d.org.lineTravel.driveKmh !== set.driveKmh)
    out.push({
      key: 'lineTravel:driveKmh',
      label: '移動時間の見積もり方の車の速さ',
      from: `${d.org.lineTravel.driveKmh}km/h`,
      to: `${set.driveKmh}km/h`,
    });
  return out;
}

/** 確認の一覧の本文の行（「・機能「…」：入 → 切」） */
export const settingChangeLines = (changes: readonly SettingChange[]): string[] =>
  changes.map((c) => `・${c.label}：${c.from} → ${c.to}`);

/**
 * 確認の本文（独自の確認ダイアログ。改行で行を分ける）：変わる項目の一覧・切れる機能に入っているデータの件数と効き方（turnOffImpact。
 * today は YYYY-MM-DD）・道路の所要を取ってあるときの車の速さの効き方・変えないもの
 */
export function settingSetConfirmBody(
  d: Parameters<typeof turnOffImpact>[0] & Pick<DemoData, 'roads'>,
  changes: readonly SettingChange[],
  today: string,
): string {
  const impacts = changes.flatMap((c) =>
    c.feature && c.to === onOff(false) ? (turnOffImpact(d, c.feature, today)?.text ?? []) : [],
  );
  const roadNote =
    d.roads && changes.some((c) => c.key === 'lineTravel:driveKmh')
      ? ['※道路の所要を取ってある区間は道路の所要を使い、車の速さはそれ以外の区間に使います。']
      : [];
  return [
    '変わる項目（今 → 適用後）：',
    ...settingChangeLines(changes),
    ...impacts.map((x) => `※${x}`),
    ...roadNote,
    `${d.org.terms.client}・${d.org.terms.staff}・予定は変えません。切った機能のデータは消えません。`,
  ].join('\n');
}

/**
 * 設定のひな形を適用したデータ（設定だけ書く。〈利用者さん〉・〈スタッフ〉・予定は同じもの）。
 * 足す条件の ID は ruleId（呼ぶ側が作る）。変わる項目が無ければ同じ d を返す
 */
export function applySettingSet(d: DemoData, set: SettingSetDef, ruleId: string): DemoData {
  if (settingSetChanges(d, set).length === 0) return d;
  let next: DemoData = {
    ...d,
    org: {
      ...d.org,
      features: { ...d.org.features, ...set.features },
      ...(set.driveKmh !== undefined && { lineTravel: { ...d.org.lineTravel, driveKmh: set.driveKmh } }),
    },
  };
  if (set.addHomeNear && !d.rules.some((r) => r.type === 'homeNear'))
    next = addRule(
      next,
      { id: ruleId, type: 'homeNear', label: ruleTypeLabel('homeNear', d.org.terms) },
      RULE_DEFAULTS.homeNear,
    );
  return next;
}

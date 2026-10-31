// 管理者設定の見せ方（PRD D395。ADR-0074 段4）：スイッチの行は名前と1行の説明だけを出し、「切ると隠れるもの」・依存の注記は
// ⓘ（ラベルは「説明」）の中へ回す（依存先が切で押せないときの理由だけは行に出す）。ひな形は今のものの名前だけ出して畳む。
// 画面は表（lib/features）から文を受け取る。データは書き換えない
import type { Terms } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { type FeatureDef, featureLabel, fillTerms, isOn, type TemplateId, templateDef } from './features';

/** スイッチの行の文 */
export type FeatureRowText = {
  label: string;
  /** 行に出す1行の説明 */
  description: string;
  /** ⓘ の中：切ると隠れるもの */
  hides: string;
  /** 依存の注記（依存先が無ければ null）。blocked（依存先が切）のときだけ行に出し、そうでなければ ⓘ の中 */
  requires: { text: string; blocked: boolean } | null;
};

/** 機能の1行の文（名前・説明・隠れるものは呼び方 terms に置き換える。依存の注記は依存先が入かどうかで言い方を変える） */
export function featureRowText(
  f: FeatureDef,
  features: Features,
  terms: Pick<Terms, 'client' | 'staff'>,
): FeatureRowText {
  const blocked = f.requires !== undefined && !isOn(features, f.requires);
  const reqName = f.requires ? featureLabel(f.requires, terms) : '';
  return {
    label: featureLabel(f.id, terms),
    description: fillTerms(f.description, terms),
    hides: `切ると隠れるもの：${fillTerms(f.hides, terms)}`,
    requires: f.requires
      ? { blocked, text: blocked ? `「${reqName}」を入れると使えます` : `「${reqName}」が入っているときに使えます` }
      : null,
  };
}

/** ひな形の見出しに出す「今使っているもの」（どのひな形とも違えば「カスタム」） */
export function currentTemplateName(id: TemplateId | 'custom'): { name: string; custom: boolean } {
  return id === 'custom' ? { name: 'カスタム', custom: true } : { name: templateDef(id).label, custom: false };
}

/** メールの予約送信の手順の見出しの1行（畳んだままでも数が読める） */
export const mailStepsHeading = (count: number): string => `手順 ${count}つ`;

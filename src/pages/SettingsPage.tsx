import { Settings } from 'lucide-react';
import { flushSync } from 'react-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui';
import type { FeatureId } from '../contracts/features';
import { jstDate } from '../domain/time';
import {
  applyTemplate,
  type FeatureDef,
  featureLabel,
  isOn,
  isSwitchOn,
  type TemplateDef,
  templateDiff,
  turnOffImpact,
  withFeature,
} from '../lib/features';
import { useDemoData } from '../store';
import '../components/features.css';
import { SettingsTabs } from '../components/SettingsTabs';
import { FeatureSwitchesCard } from './featureRows';
import { MailScheduleSettingsCard } from './mailScheduleSettings';
import { RoadTravelSettingsCard } from './roadTravelSettings';
import { TemplatesCard } from './TemplatesCard';

/**
 * 管理者設定（`#/settings`。PRD D210〜D212。ADR-0028）：機能の入り切り。だれでも開ける（ログイン・鍵なし）。
 * 上にひな形（見出しの横に今のひな形の名前、どれとも違えば「カスタム」。5つは「詳しく ▾」に畳む。TemplatesCard）。「適用」は
 * 独自の確認ダイアログで入る機能・切れる機能を出してから書く。下に機能の入・切の1枚（pages/featureRows。グループは見出し、名前と1行の説明、
 * 隠れるものは ⓘ。押すとすぐ保存。主ボタンは置かない）。メールの予約送信の手順も畳む（PRD D395）。
 * データを作り直す操作（最初の設定をやり直す）はデータの画面に置き、ここには置かない（ADR-0092）。
 * 移動時間の見積もり方（直線距離・車道の道のり）と係数もここに置く（PRD D436。pages/roadTravelSettings）。
 * 書くのは store の update(fn) だけ。切った機能のデータは消さない。呼び方は org.terms
 */
export default function SettingsPage() {
  const { data, update } = useDemoData();
  /** 今日（休み・希望休・欠勤は今日以降に掛かるものだけを数える。turnOffImpact） */
  // 切るときの影響は今日から数える（この画面には日付の選択を出さないので、見えない選択日付は使わない。PRD D267）
  const today = jstDate(Date.now());
  const features = data.org.features;
  const terms = data.org.terms;
  const toast = useToast();
  const confirmDialog = useConfirm();

  const names = (ids: readonly FeatureId[]) => ids.map((id) => featureLabel(id, terms)).join('、');

  /** ひな形を適用する（確認で入る機能・切れる機能を出す。PRD D212） */
  const apply = async (t: TemplateDef) => {
    const diff = templateDiff(features, t.id);
    // 切れる機能に入っているデータの件数と効き方（PRD D215。turnOffImpact）
    const impacts = diff.off.flatMap((id) => turnOffImpact(data, id, today)?.text ?? []);
    const body = [
      diff.on.length > 0 ? `入る機能：${names(diff.on)}` : '入る機能：なし',
      diff.off.length > 0 ? `切れる機能：${names(diff.off)}` : '切れる機能：なし',
      ...impacts.map((x) => `・${x}`),
      '切った機能のデータは消えません。あとから1つずつ入り切りできます。',
    ].join('\n');
    const ok = await confirmDialog({
      title: `ひな形「${t.label}」を適用しますか？`,
      body,
      confirmLabel: '適用',
    });
    if (!ok) return;
    const next = applyTemplate(t.id);
    update((d) => ({ ...d, org: { ...d.org, features: next } }), `ひな形「${t.label}」を適用`);
    toast(`ひな形「${t.label}」を適用しました`);
  };

  /**
   * スイッチを押す（すぐ保存。依存先が切なら押せない）。新しい値は update の中で最新の d.org.features から決め、
   * トーストの文も同じ値から作る（素早く2回押したとき、描画前の古い features で決めて同じ値を2回書かない）。
   * flushSync で update をその場で済ませ、決めた値を受け取る。
   * 切るときにその機能のデータがあれば、先に独自の確認ダイアログで件数と効き方を出す（PRD D215。turnOffImpact）。
   * 確認したあとは「切る」と決めて書く（確認の間に別のタブで切られていても入れ直さない）
   */
  const toggle = async (f: FeatureDef) => {
    let forced: boolean | null = null;
    if (isSwitchOn(features, f.id) && !(f.requires && !isOn(features, f.requires))) {
      const impact = turnOffImpact(data, f.id, today);
      if (impact) {
        const ok = await confirmDialog({
          title: `${featureLabel(f.id, terms)}を切りますか？`,
          body: `${impact.text}。\n切った機能のデータは消えません。入れ直せば元に戻ります。`,
          confirmLabel: '切る',
        });
        if (!ok) return;
        forced = false;
      }
    }
    /** update の中で決めた新しい値（依存先が切で押せなければ null） */
    const decided: { on: boolean | null } = { on: null };
    flushSync(() =>
      update((d) => {
        const cur = d.org.features;
        if (f.requires && !isOn(cur, f.requires)) {
          decided.on = null;
          return d;
        }
        const on = forced ?? !isSwitchOn(cur, f.id);
        decided.on = on;
        return { ...d, org: { ...d.org, features: withFeature(cur, f.id, on) } };
      }, '機能の入り切り'),
    );
    if (decided.on === null) return;
    toast(`${featureLabel(f.id, terms)}を${decided.on ? '入れました' : '切りました'}`);
  };

  return (
    <div className="stack settings-page" style={{ maxWidth: 880 }}>
      <PageHeader
        nav={<SettingsTabs />}
        icon={Settings}
        title="管理者設定"
        lead="使う機能を選びます。切った機能のデータは消えません"
      />

      <TemplatesCard features={features} terms={terms} onApply={(t) => void apply(t)} />

      <FeatureSwitchesCard features={features} terms={terms} onToggle={toggle} />

      {/* 移動時間の見積もり方（PRD D436。ADR-0101）：車道の道のりは押したときだけ OSRM から取る */}
      <RoadTravelSettingsCard />

      {/* メールの予約送信（PRD D366。ADR-0069）：メールの機能が入のときだけ */}
      {isOn(features, 'mail') && <MailScheduleSettingsCard />}
    </div>
  );
}

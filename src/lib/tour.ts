// 案内ツアー（PRD D192・D193・D323・D277。ADR-0025・ADR-0045）の純粋な部分：案内の中身（2枚。最後の枚は
// 「今日の予定を開く」）、「次へ」「戻る」「とばす」の行き先。初めて開いたときの「どこまで使うか」（D276）は最初の2問（lib/firstRun。
// PRD D379）に置き換え、ツアーは自動で開かない（データの画面の「案内をもう一度見る」だけ）。画面は components/Tour.tsx
import type { Terms } from '../contracts/documents';
import type { FeatureId, Features } from '../contracts/features';
import { isOn } from './features';

/** 案内の1枚 */
export type TourStep = {
  key: 'plan' | 'absence';
  title: string;
  body: string;
  /** 本文の下に番号付きで並べる段（3段の説明） */
  points?: string[];
  /** どこにあるか（メニュー・下のタブ・上の帯の名前） */
  where: string;
  /** その枚が案内する機能（切っていたら枚を出さない。土台の枚は無し） */
  feature?: FeatureId;
};

/**
 * 案内の2枚（PRD D277。呼び方は terms）：予定で担当を組んで決める（3段「組む（AI）→ ピン → 確定（伝えた）／変更あり」）／欠勤・キャンセル。
 * 最後の枚は、画面で主ボタン「今日の予定を開く」を添える（PRD D323）。ホームは無いので（PRD D400・D401）、最初の枚は予定の画面
 * （上の要対応の帯の「見に行く」と、画面の上の［月｜週｜日］）から始める。条件の重み・探す（Ctrl+K）の枚は入れない
 * （探すは上の帯の「探す」が見えている。条件は設定のタブにある）。
 * features で切った機能の枚（欠勤・キャンセル）は出さない（PRD D213。枚数はそのぶん減る）。
 * エキスパート機能が切のときの組むは予定の上の要対応の帯の「要対応を組む」（PRD D403）、入のときはメニューの「組む」の「担当を組む」、
 * 帯の種類も入は未確定・組み直し・標準が無いが増える。確定の段階が切には無いので、切の3段目は「変更あり」
 */
export function tourSteps(terms: Pick<Terms, 'client' | 'staff'>, features: Features = {}): TourStep[] {
  const expert = isOn(features, 'expert');
  const all: TourStep[] = [
    {
      key: 'plan',
      title: '予定を組んで、直して、確定します',
      body: expert
        ? '予定の上の赤い帯に、担当なし・間に合わない・重なり・休みの人・未確定の日などが出ます。「見に行く」から開けます。担当は「組む」で組みます（組み方の標準を決める・担当なしの訪問を AI で組む）。予定は、画面の上の［月｜週｜日］で表示を切り替え、手で直します。繰り返しの訪問は、繰り返しの担当（標準）で最初から入っています。次の3段で決めます。'
        : '担当なし・間に合わない・重なり・休みの人の訪問は、予定の上の赤い帯の「見に行く」から順に開けます。まとめて組むなら帯の「要対応を組む」。予定は、画面の上の［月｜週｜日］で表示を切り替え、手で直します。繰り返しの訪問は、繰り返しの担当で最初から入っています。次の3段で決めます。',
      points: [
        expert
          ? '組む（AI）：メニューの「組む」の「担当を組む」で、月・週・日を選んで「AI で組む」。提案を見て、よければ「反映する」。間違えたら「元に戻す」（Ctrl+Z）。'
          : '組む（AI）：予定の上の赤い帯の「要対応を組む」で、今日から来月末までの担当なし・間に合わない・重なり・休みの人の訪問を組みます。間違えたら「元に戻す」（Ctrl+Z）。',
        `ピン：替えたい訪問は、別の${terms.staff}へドラッグします。動かした訪問にはピンが付き、AI で組んでも担当が残ります。予定の画面では手で直すだけです。`,
        expert
          ? `確定（伝えた）：${terms.staff}に伝えたら「確定（伝えた）」を押します。あとの変更は「未連絡の変更」として連絡の一覧に出ます。`
          : `決まったあと：決まった日に変えた訪問には「変更あり」の印が出ます。印を押すと連絡の一覧が開き、${terms.staff}に伝えられます。`,
      ],
      where: 'メニューの「予定」（スマホは下のタブの「予定」）',
    },
    {
      key: 'absence',
      title: '欠勤・キャンセルはここから',
      body: `${terms.staff}の急な欠勤や${terms.client}の当日キャンセルを登録すると、その日の担当を振り直す手順に進みます。日の予定の「欠勤・キャンセルを登録」から登録できます。`,
      where: '日の予定の「欠勤・キャンセルを登録」',
      feature: 'sudden',
    },
  ];
  return all.filter((s) => !s.feature || isOn(features, s.feature));
}

/** 押したボタン（Esc は skip と同じ） */
export type TourMove = 'next' | 'back' | 'skip';

/**
 * 次に出す枚の番号。閉じるときは null（とばす・最後の枚の「次へ」＝「閉じる」）。
 * 最初の枚の「戻る」は動かない。count が 0 なら閉じる
 */
export function tourMove(index: number, count: number, move: TourMove): number | null {
  if (count <= 0 || move === 'skip') return null;
  const i = Math.min(Math.max(0, index), count - 1);
  if (move === 'back') return Math.max(0, i - 1);
  return i + 1 >= count ? null : i + 1;
}

/** 「次へ」のボタンの文（最後の枚は「閉じる」。最後の枚の主ボタンは TOUR_TODAY_LABEL） */
export const tourNextLabel = (index: number, count: number): string => (index >= count - 1 ? '閉じる' : '次へ');

/** 最後の枚の主ボタン：閉じて今日の日の画面を開く（PRD D323） */
export const TOUR_TODAY_LABEL = '今日の予定を開く';

/** 何枚目か（「2 / 3」） */
export const tourCountText = (index: number, count: number): string => `${index + 1} / ${count}`;

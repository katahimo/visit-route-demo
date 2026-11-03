// 自分のデータで始めたあとの、1画面1項目の3段の登録の案内（PRD D381。ADR-0073）の純粋な部分：
// ①〈利用者さん〉②〈スタッフ〉③予定、上に「1/3」、①②は「CSV・Excel を読み込む」、③は予定の画面へ。
// 画面は pages/StartGuidePage。呼び名は org.terms から引く（直書きしない）
import type { Terms } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { isOn } from './features';

/** 登録の案内の画面（`#/start`。段は `?step=2`・`?step=3`） */
export const START_GUIDE_PATH = '/start';

/** ①②に添える、読める名簿の形（excel/rosterForms の形と、このアプリの名簿の形。ADR-0075・ADR-0092） */
export const START_GUIDE_ROSTER_FORMS = '台帳・予約システムの CSV、このアプリの名簿などを読めます。';

/** 案内の段の数 */
const START_GUIDE_COUNT = 3;

/** 段の種類：人を入れる段（名簿）と、予定の段 */
export type StartGuideStep =
  | { index: 1 | 2; kind: 'roster'; person: 'client' | 'staff'; title: string; term: string }
  | { index: 3; kind: 'plan'; title: string };

/** 段の一覧（terms は呼び名） */
export function startGuideSteps(terms: Pick<Terms, 'client' | 'staff'>): readonly StartGuideStep[] {
  return [
    {
      index: 1,
      kind: 'roster',
      person: 'client',
      title: `① ${terms.client}の名簿を読み込む`,
      term: terms.client,
    },
    {
      index: 2,
      kind: 'roster',
      person: 'staff',
      title: `② ${terms.staff}の名簿を読み込む`,
      term: terms.staff,
    },
    { index: 3, kind: 'plan', title: '③ 予定を登録する' },
  ];
}

/** URL の `?step=` の値から段の番号（1〜3）。無い・読めない・範囲外は 1 */
export function startGuideIndex(param: string | null): 1 | 2 | 3 {
  return param === '2' ? 2 : param === '3' ? 3 : 1;
}

/** 上に出す「1/3」 */
export const startGuideCount = (index: number): string => `${index}/${START_GUIDE_COUNT}`;

/** 前・次の段の番号（先頭の前・最後の次は null） */
export function startGuideNeighbors(index: 1 | 2 | 3): { prev: 1 | 2 | null; next: 2 | 3 | null } {
  return { prev: index === 1 ? null : ((index - 1) as 1 | 2), next: index === 3 ? null : ((index + 1) as 2 | 3) };
}

/** 段の画面のパス（`/start?step=2`） */
export const startGuideHref = (index: number): string =>
  index === 1 ? START_GUIDE_PATH : `${START_GUIDE_PATH}?step=${index}`;

/** 登録の案内から人の画面へ移るときに付ける、戻り先の段の番号（`?guide=1`）。人の画面のタブを替えても残る */
export const GUIDE_BACK_PARAM = 'guide';

/** 登録の案内の index 段から開く人の画面のパス（戻り先を付ける） */
export const withGuideBack = (path: string, index: number): string =>
  `${path}${path.includes('?') ? '&' : '?'}${GUIDE_BACK_PARAM}=${index}`;

/** 人の画面の URL の検索部から、戻る先の登録の案内（無ければ null） */
export function guideBackHref(search: string): string | null {
  const v = new URLSearchParams(search).get(GUIDE_BACK_PARAM);
  return v === '1' || v === '2' || v === '3' ? startGuideHref(Number(v)) : null;
}

/** ③の「予定の画面へ」で開く予定の画面：繰り返しを使う（定期）なら月、使わない（単発）なら週（最初に開く画面と同じ。lib/firstRun） */
export const startGuidePlanPath = (features: Features): '/month' | '/week' =>
  isOn(features, 'patterns') ? '/month' : '/week';

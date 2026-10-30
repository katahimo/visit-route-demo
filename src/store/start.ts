// 初めて開いたとき（保存データが無い）に最初の2問を出さず、今までの初期データ＋すべて入で始める印（PRD D379。ADR-0045・ADR-0073）。
// DemoData とは別のキーに「all」と書いてあれば、2問を出さず、すべて入（{}）の今の初期データで始める
// （e2e の共通の部品 scripts/lib/startFeatures.cjs と、全機能を見せたいデモの前準備のため。値は印だけで個人の情報は持たない）。
// localStorage を触るのは store の中だけ（AGENTS.md）。読めなければ印なし（2問を出す）

/** localStorage のキー（DemoData の STORAGE_KEY とは別。データの版・書き出し・初期状態に戻すに入れない） */
export const FEATURES_START_KEY = 'vrdemo:features:start';
/** 「2問を出さず、すべて入で始める」の印 */
export const FEATURES_START_ALL = 'all';

type KeyStore = Pick<Storage, 'getItem'>;

/** 印「all」があるか（あれば初めて開いたときに2問を出さず、今の初期データ＋すべて入で始める） */
export function startsWithAll(getStorage: () => KeyStore | null = () => globalThis.localStorage ?? null): boolean {
  try {
    return getStorage()?.getItem(FEATURES_START_KEY) === FEATURES_START_ALL;
  } catch {
    return false;
  }
}

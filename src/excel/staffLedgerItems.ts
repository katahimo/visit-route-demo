// 職員台帳の資格・研修の列 → 〈スタッフ〉の項目「資格」「研修」の選択肢を足す（PRD D443）。
// 初期の項目は少なくしておき（ベビーシッターなどでは要らない）、台帳を読んだときに値のある列だけを選択肢に足す。
// データは書き換えない：足した項目の一覧を返し、名簿の読み込み（importRoster）がほかの変更と一緒に入れる
import type { Item } from '../contracts/rules';
import { MAX_OPTIONS, nameKey } from '../lib/common';
import { ITEM_ID } from '../seed/people';
import { cellOf, colKey, columnsOf } from './csvColumns';

/** 職員台帳の資格の列（介護職員初任者研修は資格の「初任者研修」に含めて読むので、ここに無い。staffLedgerCsv の QUALIFICATION_ALIASES） */
export const LEDGER_QUALIFICATIONS: readonly string[] = [
  '介護福祉士',
  '看護師',
  '准看護師',
  '保健師',
  '理学療法士',
  '作業療法士',
  '言語聴覚士',
  '介護支援専門員',
  '社会福祉士',
  '精神保健福祉士',
  '社会福祉主事',
  '医師',
  '薬剤師',
  '管理栄養士',
  '歯科衛生士',
  '柔道整復師',
  'あん摩マッサージ指圧師',
  '義肢装具士',
  '福祉住環境コーディネーター1級',
  '福祉住環境コーディネーター2級',
  '福祉住環境コーディネーター3級',
  '児童発達支援管理責任者',
  '心理士',
  '児童指導員',
  '調理師',
];

/** 職員台帳の研修の列 */
export const LEDGER_TRAININGS: readonly string[] = [
  '介護福祉士実務者研修',
  '介護職員基礎研修',
  'ホームヘルパー1級',
  'ホームヘルパー2級',
  '居宅介護職員初任者研修課程',
  '障害者居宅介護従業者基礎研修課程',
  '重度訪問介護従業者養成研修(基礎)',
  '重度訪問介護従業者養成研修(追加)',
  '行動援護従業者養成研修',
  '同行援護従業者養成研修(一般)',
  '同行援護従業者養成研修(応用)',
  '視覚障害者ガイド養成研修修了者',
  '全身性障害者ガイド養成研修修了者',
  '知的障害者ガイド養成研修修了者',
];

/** 足す先の項目（ID で探し、無ければ同じ名前の〈スタッフ〉の選択肢から複数の項目、それも無ければ作る）と、その列 */
const GROUPS: readonly { id: string; name: string; cols: readonly string[] }[] = [
  { id: ITEM_ID.qualification, name: '資格', cols: LEDGER_QUALIFICATIONS },
  { id: ITEM_ID.training, name: '研修', cols: LEDGER_TRAININGS },
];

const isStaffMulti = (it: Item) => it.target === 'staff' && it.kind === 'multi';

/** 選択肢を足した項目の一覧と、足した選択肢の文（「資格（准看護師・保健師）」。足さなければ空）と、値の無い資格・研修の列 */
export interface LedgerItems {
  items: Item[];
  added: string[];
  /** 台帳にあって、職員名のある行に値の無い資格・研修の列（足さないが、読んだ列とみなして読まなかった列に出さない） */
  empty: string[];
}

/**
 * 職員台帳の表の資格・研修の列のうち、職員名のある行に値（取得日・取得日不明など）が1つ以上あり、
 * まだどの〈スタッフ〉の選択肢から複数の項目にも無い名前（全角半角・空白は同一視）を、項目「資格」「研修」の選択肢の後ろに足す。
 * - 項目が無ければ後ろに作る（ID が同じで種類の違う項目があるときは足さない）
 * - 選択肢は MAX_OPTIONS まで。入らない列は読まず、読まなかった列に出る
 */
export function withLedgerOptions(
  header: readonly string[],
  body: readonly (readonly string[])[],
  items: readonly Item[],
): LedgerItems {
  const at = columnsOf(header);
  const named = body.filter((r) => cellOf(at, r)('職員名') !== '');
  const used = (col: string) => at.has(colKey(col)) && named.some((r) => cellOf(at, r)(col) !== '');
  const have = new Set(items.filter(isStaffMulti).flatMap((it) => it.options.map(nameKey)));
  const out = items.map((it) => ({ ...it, options: [...it.options] }));
  const added: string[] = [];
  const empty = GROUPS.flatMap((g) => g.cols.filter((c) => at.has(colKey(c)) && !used(c)));
  for (const g of GROUPS) {
    const want = g.cols.filter((c) => used(c) && !have.has(nameKey(c)));
    if (want.length === 0) continue;
    const byId = out.find((it) => it.id === g.id);
    if (byId && !isStaffMulti(byId)) continue;
    let item = byId ?? out.find((it) => isStaffMulti(it) && nameKey(it.name) === nameKey(g.name));
    if (!item) {
      item = { id: g.id, name: g.name, target: 'staff', kind: 'multi', options: [] };
      out.push(item);
    }
    const fit = want.slice(0, Math.max(0, MAX_OPTIONS - item.options.length));
    if (fit.length === 0) continue;
    item.options.push(...fit);
    added.push(`${item.name}（${fit.join('・')}）`);
  }
  return { items: added.length > 0 ? out : [...items], added, empty };
}

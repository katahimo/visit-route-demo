// 条件（Condition）の判定と表示文（contracts/rules.ts の OPS のコメントが仕様）
import type { Condition, Item, TraitValue } from '../contracts/rules';

/** 条件の value を配列として読む（in/hasAny/hasAll で1つだけ渡されたときも配列にする） */
function asList(v: TraitValue): string[] {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  return [String(v)];
}

function sameValue(a: TraitValue, b: TraitValue): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    // multi どうしの is は「同じ集合」とみなす
    const x = asList(a);
    const y = asList(b);
    return x.length === y.length && x.every((e) => y.includes(e));
  }
  return a === b;
}

/** 開始年 startYear から、日付 date（YYYY-MM-DD）の年までの年数（年の引き算。始める前は 0。ADR-0070） */
export function yearsSince(startYear: number, date: string): number {
  return Math.max(0, Number(date.slice(0, 4)) - startYear);
}

/** 条件と比べる値：開始年の項目はその日までの年数、ほかは持つ値のまま */
function comparable(item: Item, v: TraitValue, date: string): TraitValue {
  return item.kind === 'startYear' && typeof v === 'number' ? yearsSince(v, date) : v;
}

/**
 * 相手の特性 value が、日付 date に条件を満たすか（項目がなければ false）。未入力（null）は not だけ満たす。
 * date は開始年の項目の年数を数えるのに使う
 */
export function matches(cond: Condition, item: Item | undefined, value: TraitValue | undefined, date: string): boolean {
  if (!item) return false;
  const v = value === undefined || value === null ? null : comparable(item, value, date);
  if (cond.op === 'not') return v === null || !sameValue(v, cond.value);
  if (v === null) return false;
  switch (cond.op) {
    case 'is':
      return sameValue(v, cond.value);
    case 'in':
      return asList(cond.value).some((c) => sameValue(v, c));
    case 'hasAny': {
      const have = asList(v);
      return asList(cond.value).some((c) => have.includes(c));
    }
    case 'hasAll': {
      const have = asList(v);
      return asList(cond.value).every((c) => have.includes(c));
    }
    case 'gte':
      return typeof v === 'number' && typeof cond.value === 'number' && v >= cond.value;
    case 'lte':
      return typeof v === 'number' && typeof cond.value === 'number' && v <= cond.value;
    default:
      return false;
  }
}

function plainText(v: TraitValue): string {
  if (v === null) return '未入力';
  if (typeof v === 'boolean') return v ? 'あり' : 'なし';
  if (Array.isArray(v)) return v.join('・');
  return String(v);
}

/** 条件の表示文（例：「資格に看護師を含む」「経験年数 3年以上」「ペット可 あり」） */
export function conditionText(cond: Condition, item: Item | undefined): string {
  if (!item) return '（項目がありません）';
  const name = item.name;
  // 開始年の項目の条件の値は年数
  const valueText = (v: TraitValue) => (item.kind === 'startYear' && typeof v === 'number' ? `${v}年` : plainText(v));
  const list = asList(cond.value);
  switch (cond.op) {
    case 'is':
      if (typeof cond.value === 'boolean') return `${name} ${valueText(cond.value)}`;
      return `${name}が${valueText(cond.value)}`;
    case 'not':
      if (typeof cond.value === 'boolean') return `${name} ${valueText(!cond.value)}`;
      return `${name}が${valueText(cond.value)}でない`;
    case 'in':
      return list.length <= 1 ? `${name}が${list.join('')}` : `${name}が${list.join('・')}のどれか`;
    case 'hasAny':
      return list.length <= 1 ? `${name}に${list.join('')}を含む` : `${name}に${list.join('・')}のどれかを含む`;
    case 'hasAll':
      return list.length <= 1 ? `${name}に${list.join('')}を含む` : `${name}に${list.join('・')}をすべて含む`;
    case 'gte':
      return `${name} ${valueText(cond.value)}以上`;
    case 'lte':
      return `${name} ${valueText(cond.value)}以下`;
    default:
      return name;
  }
}

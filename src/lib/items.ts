// 特性の項目（〈スタッフ〉の項目・〈利用者さん〉の項目）の編集と数え方の純粋関数。データを書き換えるのは store の update(fn) を
// 通した画面（pages/ItemsPage）だけ。ここは新しい DemoData を返す
import type { DemoData } from '../contracts/data';
import type { Condition, Item, ItemKind, ItemTarget, Traits, TraitValue } from '../contracts/rules';
import { newId } from './common';

/** 選択肢を持つ形か（ひとつ選ぶ・いくつでも選ぶ） */
export const hasOptions = (k: ItemKind) => k === 'choice' || k === 'multi';

/** 項目の値を持つ人・場所の traits を書き換える */
function mapTraits(d: DemoData, target: ItemTarget, fn: (t: Traits) => Traits): DemoData {
  return target === 'staff'
    ? { ...d, staff: d.staff.map((s) => ({ ...s, traits: fn(s.traits) })) }
    : { ...d, clients: d.clients.map((c) => ({ ...c, traits: fn(c.traits) })) };
}
/** 項目を使う条件（相手側の requirements・preferences）を書き換える */
function mapConds(d: DemoData, target: ItemTarget, fn: (c: Condition[]) => Condition[]): DemoData {
  return target === 'staff'
    ? {
        ...d,
        clients: d.clients.map((c) => ({ ...c, requirements: fn(c.requirements), preferences: fn(c.preferences) })),
      }
    : { ...d, staff: d.staff.map((s) => ({ ...s, requirements: fn(s.requirements), preferences: fn(s.preferences) })) };
}
/** 項目の中身（id の一致するもの）を書き換える */
function mapItem(d: DemoData, id: string, fn: (i: Item) => Item): DemoData {
  return { ...d, items: d.items.map((i) => (i.id === id ? fn(i) : i)) };
}
/** その項目の値を traits から外す */
function dropTrait(d: DemoData, item: Item): DemoData {
  return mapTraits(d, item.target, (t) => {
    const { [item.id]: _drop, ...rest } = t;
    return rest;
  });
}

/** 項目を参照している条件の持ち主の名前 */
export function itemRefs(d: DemoData, item: Item): string[] {
  const uses = (cs: Condition[]) => cs.some((c) => c.itemId === item.id);
  return item.target === 'staff'
    ? d.clients.filter((c) => uses(c.requirements) || uses(c.preferences)).map((c) => c.displayName)
    : d.staff.filter((s) => uses(s.requirements) || uses(s.preferences)).map((s) => s.name);
}
/** 値が入っている件数 */
export function itemValueCount(d: DemoData, item: Item): number {
  const owners: { traits: Traits }[] = item.target === 'staff' ? d.staff : d.clients;
  return owners.filter((o) => {
    const v = o.traits[item.id];
    return v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0);
  }).length;
}
/** 選択肢を使っている件数 */
export function optionUseCount(d: DemoData, item: Item, opt: string): number {
  const owners: { traits: Traits }[] = item.target === 'staff' ? d.staff : d.clients;
  return owners.filter((o) => {
    const v = o.traits[item.id];
    return v === opt || (Array.isArray(v) && v.includes(opt));
  }).length;
}
/** 値の中の選択肢 from を to に替える（to が null なら外す） */
export function replaceOption(v: TraitValue | undefined, from: string, to: string | null): TraitValue {
  if (v === undefined) return null;
  if (v === from) return to;
  if (Array.isArray(v)) return v.flatMap((x) => (x === from ? (to === null ? [] : [to]) : [x]));
  return v;
}

/** 新しい項目の名前：同じ対象の中で重ならない「新しい項目N」（Excel では対象ごとに名前で項目を引く。ADR-0006） */
export function newItemName(items: readonly Item[]): string {
  let no = items.length + 1;
  while (items.some((i) => i.name === `新しい項目${no}`)) no++;
  return `新しい項目${no}`;
}
/** 項目を最後に足す（あり／なしの形。名前は同じ対象の中で重ならないもの） */
export function addItem(d: DemoData, target: ItemTarget): DemoData {
  const name = newItemName(d.items.filter((i) => i.target === target));
  return { ...d, items: [...d.items, { id: newId('i'), name, target, kind: 'flag', options: [] }] };
}
/** 項目の名前・選択肢などを直す */
export function patchItem(d: DemoData, id: string, patch: Partial<Item>): DemoData {
  return mapItem(d, id, (i) => ({ ...i, ...patch }));
}
/** 項目を消す。入っている値も消す（その項目を使う条件は残す。無効になる） */
export function removeItem(d: DemoData, item: Item): DemoData {
  const next = dropTrait(d, item);
  return { ...next, items: next.items.filter((i) => i.id !== item.id) };
}
/** 項目の形を変える。値とその項目を使う条件を消す（選択肢を持たない形にしたら選択肢も消す） */
export function changeItemKind(d: DemoData, item: Item, kind: ItemKind): DemoData {
  const next = mapConds(dropTrait(d, item), item.target, (cs) => cs.filter((c) => c.itemId !== item.id));
  return mapItem(next, item.id, (i) => ({ ...i, kind, options: hasOptions(kind) ? i.options : [] }));
}
/** 選択肢の名前を変える。入っている値と条件の値も替える */
export function renameOption(d: DemoData, item: Item, from: string, to: string): DemoData {
  let next = mapTraits(d, item.target, (t) =>
    item.id in t ? { ...t, [item.id]: replaceOption(t[item.id], from, to) } : t,
  );
  next = mapConds(next, item.target, (cs) =>
    cs.map((c) => (c.itemId === item.id ? { ...c, value: replaceOption(c.value, from, to) } : c)),
  );
  return mapItem(next, item.id, (i) => ({ ...i, options: i.options.map((o) => (o === from ? to : o)) }));
}
/** 選択肢を消す。入っている値から外し、条件からも外す（値が空になった・消した選択肢そのものだった条件は消す） */
export function removeOption(d: DemoData, item: Item, opt: string): DemoData {
  let next = mapTraits(d, item.target, (t) =>
    item.id in t ? { ...t, [item.id]: replaceOption(t[item.id], opt, null) } : t,
  );
  // 残すと誰も満たさない条件になるので消す
  next = mapConds(next, item.target, (cs) =>
    cs.flatMap((c) => {
      if (c.itemId !== item.id) return [c];
      if (Array.isArray(c.value)) {
        const value = c.value.filter((x) => x !== opt);
        return value.length === 0 ? [] : [{ ...c, value }];
      }
      return c.value === opt ? [] : [c];
    }),
  );
  return mapItem(next, item.id, (i) => ({ ...i, options: i.options.filter((o) => o !== opt) }));
}

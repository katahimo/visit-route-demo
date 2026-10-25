// 訪問の種類（ADR-0012。PRD D36）の編集と数え方の純粋関数。データを書き換えるのは store の update(fn) を通した画面
// （pages/TypesPage）だけ。ここは新しい DemoData を返す
import type { DemoData } from '../contracts/data';
import { MAX_VISIT_TYPES, type VisitType, visitTypeSchema } from '../contracts/documents';
import { CLIENT_COLORS } from './colors';
import { formError, nameTaken, newId } from './common';

/** 新しい種類の初めの形（色は今ある種類の数から順に回す） */
export const blankVisitType = (color: number): VisitType => ({
  id: newId('t'),
  name: '',
  color: color % CLIENT_COLORS.length,
  durationMinutes: 60,
  requirements: [],
  note: '',
});

/** 入力中の形（所要は文字のまま持つ） */
export type VisitTypeForm = Omit<VisitType, 'durationMinutes'> & { durationMinutes: string };

/** 種類を入力中の形にする（中身は写す。元の種類と共有しない） */
export function visitTypeForm(t: VisitType): VisitTypeForm {
  return { ...structuredClone(t), durationMinutes: String(t.durationMinutes) };
}

/** 種類を使っている訪問・パターンの数 */
export type TypeUses = { visits: number; patterns: number };
const NO_USES: TypeUses = { visits: 0, patterns: 0 };

/** 種類ごとの、使っている訪問・パターンの数 */
export function typeUses(d: {
  visits: readonly { typeId: string | null }[];
  patterns: readonly { typeId: string | null }[];
}): Map<string, TypeUses> {
  const m = new Map<string, TypeUses>();
  const at = (id: string) => {
    let x = m.get(id);
    if (!x) {
      x = { visits: 0, patterns: 0 };
      m.set(id, x);
    }
    return x;
  };
  for (const v of d.visits) if (v.typeId) at(v.typeId).visits++;
  for (const p of d.patterns) if (p.typeId) at(p.typeId).patterns++;
  return m;
}
/** その種類を使っている数（使っていなければ 0 件） */
export const usesOf = (m: ReadonlyMap<string, TypeUses>, id: string): TypeUses => m.get(id) ?? NO_USES;

/** 入力を確かめる。保存できるなら種類、できなければ誤り（誤った欄があれば field） */
export function checkVisitTypeForm(
  form: VisitTypeForm,
  visitTypes: readonly VisitType[],
  isNew: boolean,
): { type: VisitType } | { error: { text: string; field?: string } } {
  // 同じ名前は保存しない（Excel では種類を名前で引くため。ADR-0006）
  if (nameTaken([...visitTypes], (x) => x.name, form.name, form.id))
    return {
      error: { text: `「${form.name.trim()}」と同じ名前の種類があります。名前を変えてください`, field: 'name' },
    };
  if (isNew && visitTypes.length >= MAX_VISIT_TYPES) return { error: { text: `種類は${MAX_VISIT_TYPES}までです` } };
  const r = visitTypeSchema.safeParse({
    ...form,
    name: form.name.trim(),
    durationMinutes: Number(form.durationMinutes),
  });
  if (r.success) return { type: r.data };
  const where = r.error.issues[0]?.path[0];
  return {
    error: {
      text:
        where === 'name'
          ? '名前は1〜20字で入れてください'
          : where === 'durationMinutes'
            ? '標準の所要は5〜720分で入れてください'
            : formError(r.error),
      field: typeof where === 'string' ? where : undefined,
    },
  };
}

/** 種類を保存する（同じ id があれば置き換え、無ければ最後に足す） */
export function saveVisitType(d: DemoData, t: VisitType): DemoData {
  return {
    ...d,
    visitTypes: d.visitTypes.some((x) => x.id === t.id)
      ? d.visitTypes.map((x) => (x.id === t.id ? t : x))
      : [...d.visitTypes, t],
  };
}

/** 種類を消す。使っている訪問・パターンは種類なしにする */
export function removeVisitType(d: DemoData, id: string): DemoData {
  return {
    ...d,
    visitTypes: d.visitTypes.filter((x) => x.id !== id),
    visits: d.visits.map((v) => (v.typeId === id ? { ...v, typeId: null } : v)),
    patterns: d.patterns.map((p) => (p.typeId === id ? { ...p, typeId: null } : p)),
  };
}

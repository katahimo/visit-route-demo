// 相性の記号（◎○△×。PRD D113・D177・D420）：意味の文・凡例・マスの色の印・選ぶ欄の並び・選んだ相性を入れる
import type { Pattern } from '../contracts/documents';
import type { PatternInput } from '../contracts/patterns';
import { COMPAT_LEVELS, type Compat, type CompatLevel } from '../contracts/rules';
import { splitPattern } from '../patterns';

/** 凡例（◎○△×の意味。色は表のセルと同じ） */
export const COMPAT_LEGEND: { mark: string; cls: string; text: string }[] = [
  { mark: '◎', cls: 'lv2', text: '選ばれやすい' },
  { mark: '○', cls: 'lv1', text: 'やや選ばれやすい' },
  { mark: '△', cls: 'lvm1', text: '選ばれにくい' },
  { mark: '×', cls: 'lvm2', text: '担当にしない' },
];

/** 相性の言葉（記号なし。相性を選ぶ欄のボタン。PRD D420） */
export const COMPAT_WORD: Record<CompatLevel, string> = {
  2: '選ばれやすい',
  1: 'やや選ばれやすい',
  0: '未入力（ふつう）',
  [-1]: '選ばれにくい',
  [-2]: '担当にしない',
};

/** 相性の記号の意味（マスの title・読み上げ。PRD D177。凡例を見なくても分かるように） */
export const COMPAT_MEANING: Record<CompatLevel, string> = {
  2: `◎ ${COMPAT_WORD[2]}`,
  1: `○ ${COMPAT_WORD[1]}`,
  0: COMPAT_WORD[0],
  [-1]: `△ ${COMPAT_WORD[-1]}`,
  [-2]: `× ${COMPAT_WORD[-2]}`,
};

/** マスを押すと出る欄で選べる相性（並びは ◎→○→未入力→△→×。PRD D420） */
export const COMPAT_CHOICES: readonly CompatLevel[] = COMPAT_LEVELS;

/** 1行（staffId → 相性）のうち、その人との相性（無ければ 0＝未入力） */
export const compatLevelOf = (row: Compat[string] | undefined, staffId: string): CompatLevel =>
  (row && Object.hasOwn(row, staffId) ? row[staffId] : 0) ?? 0;

/** セルの色の印（lv2・lv1・lv0・lvm1・lvm2） */
export const compatLevelClass = (l: CompatLevel): string => `lv${l < 0 ? `m${-l}` : l}`;

/** その組の相性を level にした相性（未入力なら消す。ほかの行・人はそのまま、元は変えない） */
export function setCompatLevel(compat: Compat, clientId: string, staffId: string, level: CompatLevel): Compat {
  const row = { ...(compat[clientId] ?? {}) };
  if (level === 0) delete row[staffId];
  else row[staffId] = level;
  return { ...compat, [clientId]: row };
}

/** いつもの担当を外す範囲（どちらも省くと全員。両方指定ならその組だけ） */
export type UsualNgScope = { clientId?: string; staffId?: string };

/** clearUsualWhereNg が担当なしにする繰り返しか（続いている・scope に入る・いつもの担当が × の人） */
function isUsualNg(
  p: Pick<Pattern, 'clientId' | 'usualStaffId' | 'to'>,
  compat: Compat,
  today: string,
  scope: UsualNgScope,
): boolean {
  return (
    p.usualStaffId !== null &&
    (p.to === null || p.to >= today) &&
    (scope.clientId === undefined || p.clientId === scope.clientId) &&
    (scope.staffId === undefined || p.usualStaffId === scope.staffId) &&
    compatLevelOf(compat[p.clientId], p.usualStaffId) === -2
  );
}

/**
 * 相性が「× 担当にしない」の人がいつもの担当（繰り返しの担当）になっている繰り返しを、today から担当なし（null）にする。
 * 対象は today に続いている（終わっていない）繰り返しだけ。終わった繰り返しの担当は履歴なのでそのまま。
 * 始まりが today より前の繰り返しは、ほかの直し方の「いつから」と同じく patterns の splitPattern で today から分け
 * （前はその人のまま＝過去の回の担当を消さない。後ろは担当なし）、today 以降に始まる繰り返しはその場で担当なしにする。
 * 外すものが無ければ同じデータ（参照）を返す。scope で〈利用者さん〉・〈スタッフ〉を絞る（PRD D8・D68。ADR-0100）。
 * newId は分けたときの新しい繰り返しの id
 */
export function clearUsualWhereNg(
  data: PatternInput,
  compat: Compat,
  today: string,
  scope: UsualNgScope,
  newId: () => string,
): Pick<PatternInput, 'patterns' | 'visits'> {
  const hits = data.patterns.filter((p) => isUsualNg(p, compat, today, scope));
  if (hits.length === 0) return { patterns: data.patterns, visits: data.visits };
  let patterns = data.patterns;
  let visits = data.visits;
  for (const p of hits) {
    if (p.from >= today) {
      patterns = patterns.map((y) => (y.id === p.id ? { ...y, usualStaffId: null } : y));
      continue;
    }
    const { id: _id, from: _from, ...rest } = p;
    const r = splitPattern(
      { patterns, visits, clients: data.clients },
      p.id,
      { ...rest, usualStaffId: null },
      today,
      today,
      newId(),
    );
    patterns = r.patterns;
    visits = r.visits;
  }
  return { patterns, visits };
}

/** いつもの担当が「× 担当にしない」と重なっている繰り返しの数（clearUsualWhereNg で today から外れる数。画面の知らせ用） */
export function countUsualWhereNg(
  patterns: Pick<Pattern, 'clientId' | 'usualStaffId' | 'to'>[],
  compat: Compat,
  today: string,
  scope: UsualNgScope = {},
): number {
  return patterns.filter((p) => isUsualNg(p, compat, today, scope)).length;
}

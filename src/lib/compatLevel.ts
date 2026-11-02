// 相性の記号（◎○△×。PRD D113・D177・D420）：意味の文・凡例・マスの色の印・選ぶ欄の並び・選んだ相性を入れる
import { COMPAT_LEVELS, type Compat, type CompatLevel } from '../contracts/rules';

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

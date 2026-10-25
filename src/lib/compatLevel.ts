// 相性の記号（◎○△×。PRD D113・D177）：意味の文・凡例・セルの色の印・押したときの次の相性
import { COMPAT_LEVELS, type Compat, type CompatLevel } from '../contracts/rules';

/** 凡例（◎○△×の意味。色は表のセルと同じ） */
export const COMPAT_LEGEND: { mark: string; cls: string; text: string }[] = [
  { mark: '◎', cls: 'lv2', text: '選ばれやすい' },
  { mark: '○', cls: 'lv1', text: 'やや選ばれやすい' },
  { mark: '△', cls: 'lvm1', text: '選ばれにくい' },
  { mark: '×', cls: 'lvm2', text: '担当にしない' },
];

/** 相性の記号の意味（セルの title・読み上げ。PRD D177。凡例を見なくても分かるように） */
export const COMPAT_MEANING: Record<CompatLevel, string> = {
  2: '◎ 選ばれやすい',
  1: '○ やや選ばれやすい',
  0: '未入力（ふつう）',
  [-1]: '△ 選ばれにくい',
  [-2]: '× 担当にしない',
};

/** 次の相性（◎→○→空→△→×→◎） */
export const nextCompatLevel = (l: CompatLevel): CompatLevel =>
  COMPAT_LEVELS[(COMPAT_LEVELS.indexOf(l) + 1) % COMPAT_LEVELS.length] as CompatLevel;

/** 1行（staffId → 相性）のうち、その人との相性（無ければ 0＝未入力） */
export const compatLevelOf = (row: Compat[string] | undefined, staffId: string): CompatLevel =>
  (row && Object.hasOwn(row, staffId) ? row[staffId] : 0) ?? 0;

/** セルの色の印（lv2・lv1・lv0・lvm1・lvm2） */
export const compatLevelClass = (l: CompatLevel): string => `lv${l < 0 ? `m${-l}` : l}`;

/** その組の相性を次へ回した相性（未入力に戻ったら消す） */
export function cycleCompat(compat: Compat, clientId: string, staffId: string): Compat {
  const row = { ...(compat[clientId] ?? {}) };
  const next = nextCompatLevel(row[staffId] ?? 0);
  if (next === 0) delete row[staffId];
  else row[staffId] = next;
  return { ...compat, [clientId]: row };
}

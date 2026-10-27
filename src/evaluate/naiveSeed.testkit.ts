// seed の14日 × 各プリセットで「AI の提案は素朴な案より悪くならない」を確かめる test を作る（naive.seed*.test.ts から呼ぶ）。
// 1日 × 全プリセットで既定の反復の焼きなましを回すので重い（1日 5〜8秒）。14日を1つのファイルにすると
// vitest の worker 1つで直列になり、ユニットテスト全体の時間がこのファイルで決まる。ファイルを日で分けて並列に回す（PRD D254）。
// テストのための部品（*.testkit.ts）：check:code の対象から外し（code-rules.json の exclude）、vitest の対象（*.test.ts）にもならない
import { afterAll, expect, it } from 'vitest';
import { addDays } from '../domain/time';
import { compile } from '../matching';
import { applyPreset, createDemoData, INITIAL_PRESETS } from '../seed';
import { defaultIterations, solve } from '../solver';
import { naivePlan, normalize, score, toHundred } from './index';

/** seed の14日（2026-10-12 から） */
export const SEED_DATES = Array.from({ length: 14 }, (_, i) => addDays('2026-10-12', i));
/** naive.seed1〜4.test.ts が受け持つ日（並べると SEED_DATES。naive.test.ts で確かめる） */
export const SEED_PARTS = [
  SEED_DATES.slice(0, 4),
  SEED_DATES.slice(4, 8),
  SEED_DATES.slice(8, 11),
  SEED_DATES.slice(11),
];

/**
 * dates の日ごとに test を1つ作る（1つの同期の塊を短くする。PRD D254）：各プリセットで、
 * AI の提案の費用 ≤ 素朴な案・素朴な案は訪問を落とさない・AI の提案の点は 0 より大きく 100 以下・
 * 下限は AI の提案と素朴な案の費用以下（ADR-0007 案A）
 */
export function seedDayTests(dates: readonly string[]): void {
  const demo = createDemoData('2026-10-12');
  /** プリセット名 → 平日・土日の点 */
  const ranges = new Map<string, { weekday: number[]; weekend: number[] }>();

  it.each(dates)('seed の %s・各プリセットで、AI の提案の費用 ≤ 素朴な案、AI の提案の点 > 0、下限 ≤ 費用', (date) => {
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    for (const preset of INITIAL_PRESETS) {
      const q = compile({ ...demo, rules: applyPreset(demo.rules, preset) }, date);
      const s = normalize(q);
      const naive = score(q, naivePlan(q));
      const r = solve(q, { seed: demo.seed, iterations: defaultIterations(q) });
      expect(r.score).toBeLessThanOrEqual(naive.total + 1e-6);
      expect(naive.dropped).toBe(0);
      expect(s.lowerBound, `${date} ${preset.name}：下限 ≤ AI の提案`).toBeLessThanOrEqual(r.score + 1e-6);
      expect(s.lowerBound, `${date} ${preset.name}：下限 ≤ 素朴な案`).toBeLessThanOrEqual(naive.total + 1e-6);
      const h = toHundred(r.score, s);
      expect(h, `${date} ${preset.name}`).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(100);
      const e = ranges.get(preset.name) ?? { weekday: [], weekend: [] };
      (weekday >= 1 && weekday <= 5 ? e.weekday : e.weekend).push(h);
      ranges.set(preset.name, e);
    }
  });

  // 平日・土日の点の範囲を出す（このファイルの日が全部通ったあと）
  afterAll(() => {
    const span = (xs: number[]) => (xs.length ? `${Math.min(...xs)}〜${Math.max(...xs)}点（${xs.length}日）` : 'なし');
    for (const [name, e] of ranges)
      console.info(`[点数] ${dates[0]}〜${dates.at(-1)} ${name}：平日 ${span(e.weekday)}・土日 ${span(e.weekend)}`);
  });
}

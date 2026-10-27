// seed の14日のうち SEED_PARTS[1] の日で、AI の提案は素朴な案より悪くならない（ADR-0007。naiveSeed.testkit.ts）
import { describe } from 'vitest';
import { SEED_PARTS, seedDayTests } from './naiveSeed.testkit';

describe('AI の提案は素朴な案より悪くならない（初期解の候補に素朴な案）', () => {
  seedDayTests(SEED_PARTS[1]!);
});

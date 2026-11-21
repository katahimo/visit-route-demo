// プリセット（DemoData.presets。ADR-0008）の移行と repair
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { HOME_NEAR_WEIGHT_DEFAULT, MAX_PRESETS, SAME_CLIENT_WEIGHT_DEFAULT } from '../contracts/rules';
import { createDemoData, INITIAL_PRESETS } from '../seed';
import { importJson, isImportError, migrate } from './index';
import { repair } from './repair';

const base = () => createDemoData('2026-10-12');

describe('プリセットの読み込み', () => {
  it('weights に無い型は 重み0・必須でない で補う', () => {
    const d = base();
    const { wait: _, ...weights } = d.presets[0]!.weights;
    const r = migrate({ ...d, presets: [{ ...d.presets[0]!, weights }] });
    if (isImportError(r)) throw new Error(r.message);
    expect(r.presets[0]!.weights.wait).toEqual({ weight: 0, hard: false });
  });

  it('あとから足した型（続く訪問・夕方は自宅に近い人）が無い古いプリセットは既定の重み（ADR-0116）', () => {
    const d = base();
    const { sameClient: _a, homeNear: _b, ...weights } = d.presets[0]!.weights;
    const r = migrate({ ...d, presets: [{ ...d.presets[0]!, weights }] });
    if (isImportError(r)) throw new Error(r.message);
    expect(r.presets[0]!.weights.sameClient).toEqual({ weight: SAME_CLIENT_WEIGHT_DEFAULT, hard: false });
    expect(r.presets[0]!.weights.homeNear).toEqual({ weight: HOME_NEAR_WEIGHT_DEFAULT, hard: false });
  });

  it('組み込みの条件（続く訪問）が無い古いデータは、最後に足して重みは点数の基準のプリセットから（ADR-0116）', () => {
    const d = base();
    const old = { ...d, rules: d.rules.filter((r) => r.type !== 'sameClient') };
    const r = migrate(old);
    if (isImportError(r)) throw new Error(r.message);
    expect(r.rules.slice(0, -1)).toEqual(old.rules);
    expect(r.rules.at(-1)).toEqual({
      id: 'sameClient',
      type: 'sameClient',
      label: '続く訪問は同じ人',
      weight: 2,
      hard: false,
    });
    // ID が使われていれば後ろに番号
    const taken = migrate({ ...old, rules: [...old.rules, { ...old.rules[0]!, id: 'sameClient' }] });
    if (isImportError(taken)) throw new Error(taken.message);
    expect(taken.rules.filter((x) => x.type === 'sameClient').map((x) => x.id)).toEqual(['sameClient2']);
    // あれば足さない（初期データはそのまま）
    expect(repair(d).rules).toBe(d.rules);
  });

  it('名前が空のプリセットは日本語のエラー（元のデータは残す）', () => {
    const d = base();
    const r = migrate({ ...d, presets: [{ ...d.presets[0]!, name: '' }] });
    expect(isImportError(r)).toBe(true);
  });

  it('書き出し → 読み込みで同じプリセット', () => {
    const d = base();
    const r = importJson(JSON.stringify(d));
    if (isImportError(r)) throw new Error(r.message);
    expect(r.presets).toEqual(d.presets);
  });
});

describe('プリセットの repair', () => {
  it('重みは 0〜5・0.5刻みに、必須にできない型の必須は外す', () => {
    const d = base();
    const p = d.presets[0]!;
    const broken: DemoData = {
      ...d,
      presets: [
        {
          ...p,
          weights: {
            ...p.weights,
            compatibility: { weight: 7, hard: false },
            continuity: { weight: -1, hard: false },
            balance: { weight: 1.26, hard: false },
            clientPreference: { weight: Number.NaN, hard: false },
            wait: { weight: 2, hard: true },
          },
        },
      ],
    };
    const w = repair(broken).presets[0]!.weights;
    expect(w.compatibility.weight).toBe(5);
    expect(w.continuity.weight).toBe(0);
    expect(w.balance.weight).toBe(1.5);
    expect(w.clientPreference.weight).toBe(0);
    expect(w.wait).toEqual({ weight: 2, hard: false });
  });

  it(`ID の重複は最初の1件、${MAX_PRESETS}つを超える分は後ろを捨て、0件なら初期の3つ`, () => {
    const d = base();
    const p = d.presets[0]!;
    const many = Array.from({ length: 9 }, (_, i) => ({ ...p, id: `p${i}`, name: `p${i}` }));
    const r = repair({ ...d, presets: [{ ...p, id: 'p0', name: '先' }, ...many] });
    expect(r.presets).toHaveLength(MAX_PRESETS);
    expect(r.presets[0]!.name).toBe('先');
    expect(new Set(r.presets.map((x) => x.id)).size).toBe(MAX_PRESETS);
    expect(repair({ ...d, presets: [] }).presets).toEqual(INITIAL_PRESETS);
  });

  it('食い違いのないプリセットは同じもの（参照も変えない）', () => {
    const d = base();
    expect(repair(d).presets[0]).toBe(d.presets[0]);
  });
});

describe('点数の基準のプリセット（scorePresetId。ADR-0010）', () => {
  it('初期データは「バランス」', () => {
    expect(base().scorePresetId).toBe('balance');
  });

  it('無い古いデータ・存在しない id は先頭のプリセットにする（版は1のまま）', () => {
    const { scorePresetId: _, ...old } = base();
    const r = migrate(old);
    if (isImportError(r)) throw new Error(r.message);
    expect(r.scorePresetId).toBe(r.presets[0]!.id);
    const d = base();
    const moved = repair({ ...d, presets: [d.presets[1]!, d.presets[0]!], scorePresetId: 'nothing' });
    expect(moved.scorePresetId).toBe('travel');
  });

  it('あるプリセットを指していればそのまま（書き出し → 読み込みで戻る）', () => {
    const d = { ...base(), scorePresetId: 'people' };
    expect(repair(d).scorePresetId).toBe('people');
    const r = importJson(JSON.stringify(d));
    if (isImportError(r)) throw new Error(r.message);
    expect(r.scorePresetId).toBe('people');
  });
});

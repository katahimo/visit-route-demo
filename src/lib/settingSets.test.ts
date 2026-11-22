// 設定のひな形（PRD D480〜D482。ADR-0121）
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { HOME_NEAR_WEIGHT_DEFAULT } from '../contracts/rules';
import { createDemoData } from '../seed';
import {
  applySettingSet,
  isSettingSetLink,
  SETTING_SETS,
  settingChangeLines,
  settingSetBackupStep,
  settingSetChanges,
  settingSetConfirmBody,
  settingSetOf,
} from './settingSets';

const base = () => createDemoData('2026-10-12');
const set = settingSetOf('standard-start-no-shift')!;

describe('設定のひな形', () => {
  it('ID で引く（前後の空白・大文字は許す）。知らない ID は null', () => {
    expect(set.label).toBe('ちょうどの時刻で組む・連絡を短く');
    expect(settingSetOf(' Standard-Start-No-Shift ')).toBe(set);
    expect(settingSetOf('nope')).toBeNull();
    expect(settingSetOf('')).toBeNull();
  });
  it('名前・ID に法人名を出さない（業務の型の名前）。ID は URL にそのまま書ける', () => {
    for (const s of SETTING_SETS) expect(s.id).toMatch(/^[a-z0-9-]+$/);
  });
  it('変わる項目：機能5つを切・条件を足す・車の速さ（今の値 → 新しい値）', () => {
    const d = base();
    const lines = settingChangeLines(settingSetChanges(d, set));
    expect(lines).toEqual([
      '・機能「開始時刻をずらして組む」：入 → 切',
      `・機能「${d.org.terms.client}の特性」：入 → 切`,
      '・機能「時間の決め方（ちょうど・幅）」：入 → 切',
      `・機能「${d.org.terms.client}への訪問連絡」：入 → 切`,
      `・機能「${d.org.terms.staff}あての変更の連絡に住所」：入 → 切`,
      `・条件「帰りの前は自宅に近い人」：なし → 足す（重み${HOME_NEAR_WEIGHT_DEFAULT}・勤務の終わりの60分前から）`,
      '・移動時間の見積もり方の車の速さ：25km/h → 30km/h',
    ]);
  });
  it('適用すると設定だけ変わり、〈利用者さん〉・〈スタッフ〉・予定は同じもの', () => {
    const d = base();
    const next = applySettingSet(d, set, 'r-home');
    expect(next.org.features).toMatchObject({
      shiftStart: false,
      clientTraits: false,
      timeWindow: false,
      clientContact: false,
      contactAddress: false,
    });
    expect(next.org.lineTravel).toEqual({ ...d.org.lineTravel, driveKmh: 30 });
    expect(next.rules.at(-1)).toEqual({
      id: 'r-home',
      type: 'homeNear',
      label: '帰りの前は自宅に近い人',
      weight: HOME_NEAR_WEIGHT_DEFAULT,
      hard: false,
    });
    expect(next.rules.slice(0, -1)).toEqual(d.rules);
    for (const k of ['clients', 'staff', 'visits', 'patterns', 'absences', 'compat', 'presets'] as const)
      expect(next[k]).toBe(d[k]);
    // ほかの機能のスイッチは今のまま
    const other: DemoData = { ...d, org: { ...d.org, features: { compat: false } } };
    expect(applySettingSet(other, set, 'r').org.features.compat).toBe(false);
  });
  it('すでに同じ値の項目は出さない。全部同じなら変わる項目は無く、同じデータを返す', () => {
    const once = applySettingSet(base(), set, 'r-home');
    expect(settingSetChanges(once, set)).toEqual([]);
    expect(applySettingSet(once, set, 'r-2')).toBe(once);
    // 条件だけ自分で足してあれば、条件の行は出さず、足さない（勤務の終わりの何分前からも変えない）
    const d = base();
    const mine: DemoData = {
      ...d,
      rules: [...d.rules, { id: 'h', type: 'homeNear', label: '早く帰す', weight: 1, hard: false, beforeEndMin: 30 }],
    };
    expect(settingSetChanges(mine, set).some((c) => c.key === 'rule:homeNear')).toBe(false);
    const applied = applySettingSet(mine, set, 'r-home');
    expect(applied.rules.filter((r) => r.type === 'homeNear')).toEqual([mine.rules.at(-1)]);
  });
  it('車の速さが地域に合わせた別の値でも、一覧に今の値を出して上書きする', () => {
    const d = base();
    const fast: DemoData = { ...d, org: { ...d.org, lineTravel: { ...d.org.lineTravel, driveKmh: 40 } } };
    expect(settingChangeLines(settingSetChanges(fast, set))).toContain(
      '・移動時間の見積もり方の車の速さ：40km/h → 30km/h',
    );
    expect(applySettingSet(fast, set, 'r').org.lineTravel.driveKmh).toBe(30);
  });
  it('確認の本文：一覧・切れる機能のデータの効き方・道路の所要があるときの注・変えないもの', () => {
    const d = base();
    const body = settingSetConfirmBody(d, settingSetChanges(d, set), '2026-10-12').split('\n');
    expect(body[0]).toBe('変わる項目（今 → 適用後）：');
    expect(body).toContain('・移動時間の見積もり方の車の速さ：25km/h → 30km/h');
    expect(body.at(-1)).toBe(
      `${d.org.terms.client}・${d.org.terms.staff}・予定は変えません。切った機能のデータは消えません。`,
    );
    expect(body.some((l) => l.includes('道路の所要'))).toBe(false);
    const withRoads: DemoData = {
      ...d,
      roads: { at: 0, points: [], near: [], seconds: [], meters: [] },
    };
    expect(settingSetConfirmBody(withRoads, settingSetChanges(withRoads, set), '2026-10-12')).toContain('道路の所要');
  });
});

describe('リンクの手順（PRD D484〜D487。ADR-0122）', () => {
  it('管理者設定で apply があるときだけリンク', () => {
    expect(isSettingSetLink('/settings', '?apply=standard-start-no-shift')).toBe(true);
    expect(isSettingSetLink('/settings', '')).toBe(false);
    expect(isSettingSetLink('/data', '?apply=x')).toBe(false);
  });
  const at = Date.parse('2026-11-22T09:05:00+09:00');
  it('自動の控えがあれば時刻を出し、書き出すまで［適用］を押せない（理由を添える）', () => {
    const s = settingSetBackupStep({ auto: { kept: true, at }, fresh: false, exported: false });
    expect(s.lead).toBe(
      '更新前の控えを自動で残しました（9時05分）。適用の前に、今のデータの控えをファイルに書き出してください。',
    );
    expect(s).toMatchObject({ needsExport: true, canApply: false });
    expect(s.blocked).toContain('書き出すと');
    expect(settingSetBackupStep({ auto: { kept: true, at }, fresh: false, exported: true })).toMatchObject({
      canApply: true,
      blocked: null,
    });
  });
  it('自動の控えを残せなかった・更新が無かったときも書き出しを求める', () => {
    const failed = settingSetBackupStep({
      auto: { kept: false, why: '控えを残せません：容量不足' },
      fresh: false,
      exported: false,
    });
    expect(failed.lead).toContain('自動で残せませんでした（容量不足）');
    expect(failed.canApply).toBe(false);
    const none = settingSetBackupStep({ auto: null, fresh: false, exported: false });
    expect(none.lead).toBe('適用の前に、今のデータの控えをファイルに書き出してください。');
    expect(none.canApply).toBe(false);
  });
  it('最初の2問で作ったばかりのデータは書き出しを求めない', () => {
    expect(settingSetBackupStep({ auto: null, fresh: true, exported: false })).toMatchObject({
      needsExport: false,
      canApply: true,
      blocked: null,
    });
  });
});

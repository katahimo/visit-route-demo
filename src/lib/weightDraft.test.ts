import { describe, expect, it } from 'vitest';
import type { Rule } from '../contracts/rules';
import { createDemoData, INITIAL_PRESETS, scorePresetOf, scoreRulesOf } from '../seed';
import { leaveTarget } from './leaveGuard';
import {
  changeText,
  confirmBody,
  confirmTitle,
  draftChanges,
  draftWeights,
  editDraft,
  fillDraft,
  leaveDialog,
  pruneDraft,
  SAVED_TEXT,
  savedWeights,
  type WeightDraft,
  withDraft,
} from './weightDraft';

const TODAY = '2026-10-21';
const rule = (id: string, type: Rule['type'], weight: number, hard = false, label = id): Rule =>
  ({ id, type, label, weight, hard }) as Rule;

describe('下書きの差分（PRD D286）', () => {
  const rules = [rule('a', 'wait', 3, false, '待ち'), rule('b', 'continuity', 2), rule('c', 'wait', 3, false, '待ち2')];
  const saved = savedWeights(rules);

  it('型ごとの保存済みの値は型の最初の条件。必須にできない型は必須にしない', () => {
    expect(saved.wait).toEqual({ weight: 3, hard: false });
    expect(savedWeights([rule('x', 'wait', 1, true)]).wait).toEqual({ weight: 1, hard: false });
    expect(savedWeights([rule('x', 'clientRequirement', 3, true)]).clientRequirement).toEqual({
      weight: 3,
      hard: true,
    });
  });

  it('直すと下書きに入り、保存済みと同じ値に戻すと外れる。条件の無い型は直さない', () => {
    const d1 = editDraft({}, saved, 'wait', { weight: 4 });
    // 触った欄だけ持つ
    expect(d1).toEqual({ wait: { weight: 4 } });
    expect(editDraft(d1, saved, 'wait', { weight: 3 })).toEqual({});
    const none: WeightDraft = {};
    expect(editDraft(none, saved, 'balance', { weight: 1 })).toBe(none);
  });

  it('表に当てると同じ型の条件はどれも下書きの値。変更は型ごとに1件で、名前は表の並び', () => {
    const draft = editDraft({}, saved, 'wait', { weight: 4 });
    expect(withDraft(rules, draft).map((r) => r.weight)).toEqual([4, 2, 4]);
    const ch = draftChanges(rules, draft);
    expect(ch).toHaveLength(1);
    expect(ch[0]).toMatchObject({
      type: 'wait',
      labels: ['待ち', '待ち2'],
      before: { weight: 3 },
      after: { weight: 4 },
    });
    expect(changeText(ch[0]!)).toBe('3→4');
  });

  it('条件を消して型が無くなった・保存済みと同じになった型は外す。変わらなければ同じオブジェクト', () => {
    const draft: WeightDraft = { wait: { weight: 4 }, continuity: { weight: 5 } };
    expect(pruneDraft(draft, saved)).toBe(draft);
    expect(pruneDraft(draft, savedWeights([rules[0]!]))).toEqual({ wait: { weight: 4 } });
    expect(pruneDraft(draft, savedWeights([rule('a', 'wait', 4), rule('b', 'continuity', 2)]))).toEqual({
      continuity: { weight: 5 },
    });
  });

  it('下書きは触った欄だけを保存済みに重ねる：保存済みの必須（別のタブで変わったもの）を上書きしない', () => {
    const d = createDemoData(TODAY);
    const basis = scorePresetOf(d.presets, d.scorePresetId)!;
    const t = 'clientPreference' as const;
    // 保存済みの必須が別のタブで変わった（基準のプリセットの必須が反対）
    const other = { ...basis.weights, [t]: { ...basis.weights[t], hard: !basis.weights[t].hard } };
    const w = basis.weights[t].weight === 5 ? 4 : basis.weights[t].weight + 1;
    const draft: WeightDraft = { [t]: { weight: w } };
    const out = draftWeights(other, draft);
    expect(out[t]).toEqual({ weight: w, hard: !basis.weights[t].hard });
    // ほかの型は保存済みのまま・深く写す（元と中身を共有しない）
    expect(out.wait).toEqual(other.wait);
    expect(out.wait).not.toBe(other.wait);
    // 表にも保存済みの必須で出す
    const shown = withDraft(scoreRulesOf({ ...d, presets: [{ ...basis, weights: other }] }), draft).find(
      (r) => r.type === t,
    )!;
    expect(shown.hard).toBe(!basis.weights[t].hard);
    expect(shown.weight).toBe(w);
  });

  it('必須にできない型の下書きの必須は保存する重みでも必須にしない', () => {
    const basis = scorePresetOf(createDemoData(TODAY).presets, 'balance')!;
    expect(draftWeights(basis.weights, { wait: { hard: true } }).wait.hard).toBe(false);
  });

  it('重みの文：0 は「使わない」、重みを使わない必須は「必須」、バランスの必須は重みも', () => {
    expect(changeText({ type: 'wait', before: { weight: 2.5, hard: false }, after: { weight: 0, hard: false } })).toBe(
      '2.5→0（使わない）',
    );
    expect(changeText({ type: 'balance', before: { weight: 3, hard: false }, after: { weight: 3, hard: true } })).toBe(
      '3→3・必須',
    );
    expect(
      changeText({ type: 'clientRequirement', before: { weight: 3, hard: false }, after: { weight: 3, hard: true } }),
    ).toBe('3→必須');
  });
});

describe('保存の確認（PRD D286。ADR-0100）', () => {
  it('見出し・本文：変わる条件（前→後）・次に組むときから使う・今の担当は変わらない', () => {
    expect(confirmTitle(2)).toBe('重みを保存しますか？（2件）');
    const rules = [rule('a', 'wait', 3, false, '待ち')];
    const ch = draftChanges(rules, { wait: { weight: 4, hard: false } });
    const body = confirmBody(ch);
    expect(body).toContain('・待ち：3→4');
    expect(body).toContain('次から使います');
    expect(body).toContain('今の担当は変わりません');
    expect(SAVED_TEXT).toBe('重みを保存しました。次に組むときから使います');
  });

  it('fillDraft：プリセットの値を下書きに入れ、保存済みと同じ型は外す。条件の無い型・渡さない型は入れない', () => {
    const rules = [rule('a', 'wait', 3, false, '待ち'), rule('b', 'balance', 2, false, '偏り')];
    const saved = savedWeights(rules);
    const weights = {
      ...INITIAL_PRESETS[0]!.weights,
      wait: { weight: 1, hard: false },
      balance: { weight: 2, hard: false },
      continuity: { weight: 5, hard: false },
    };
    expect(fillDraft({}, saved, weights, ['wait', 'balance', 'continuity'])).toEqual({ wait: { weight: 1 } });
    expect(fillDraft({ wait: { weight: 4 } }, saved, weights, ['balance'])).toEqual({ wait: { weight: 4 } });
  });

  it('離れるときの確認は〈スタッフ〉の変更を捨てる確認と同じ形（危険の色・「編集を続ける」）', () => {
    expect(leaveDialog(2)).toMatchObject({ confirmLabel: '捨てて移る', cancelLabel: '編集を続ける', tone: 'danger' });
    expect(leaveDialog(2).body).toContain('（2件）');
  });
});

describe('離れる先（leaveTarget。PRD D286）', () => {
  it('アプリの中の別の画面なら移る先、同じ画面・外のリンクは null', () => {
    expect(leaveTarget('#/month?ym=2026-10', '/rules')).toBe('/month?ym=2026-10');
    expect(leaveTarget('#/home', '/rules')).toBe('/home');
    expect(leaveTarget('#/rules#presets', '/rules')).toBeNull();
    expect(leaveTarget('#/rules?x=1', '/rules')).toBeNull();
    expect(leaveTarget('#', '/rules')).toBeNull();
    expect(leaveTarget('https://example.com/', '/rules')).toBeNull();
    expect(leaveTarget('mailto:a@example.com', '/rules')).toBeNull();
    expect(leaveTarget(null, '/rules')).toBeNull();
  });
});

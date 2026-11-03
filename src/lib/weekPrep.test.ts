import { describe, expect, it } from 'vitest';
import type { BulkConfirm } from './confirmDay';
import type { DayStatus } from './month';
import { weekConfirmLabel, weekDayCountText, weekNext, weekPrepOf, weekStatusText } from './weekPrep';

const bulk = (x: Partial<BulkConfirm> = {}): BulkConfirm => ({ targets: [], problem: [], changed: [], ...x });
const base = { futureDays: 5, bulk: bulk(), running: false };

describe('weekNext（週の主ボタン。PRD D328。週の予定では AI で組まない）', () => {
  it('確定 → 済み の順で1つ', () => {
    expect(weekNext({ ...base, bulk: bulk({ targets: ['2026-10-22', '2026-10-23'] }) })).toMatchObject({
      kind: 'confirm',
      label: 'この週の問題の無い日をまとめて確定（2日）',
    });
    expect(weekNext(base)).toMatchObject({ kind: 'done', label: '確定済み' });
  });
  it('月の予定で担当を組んでいる間は確定を押せず理由', () => {
    expect(weekNext({ ...base, bulk: bulk({ targets: ['2026-10-22'] }), running: true }).why).toMatch(/確定できません/);
  });
  it('要対応・未連絡の変更の日だけ残る：ボタンなしで日の予定で確定する理由', () => {
    const r = weekNext({ ...base, bulk: bulk({ problem: ['2026-10-22'], changed: ['2026-10-23'] }) });
    expect(r).toMatchObject({ kind: 'rest', label: '未確定 2日' });
    expect(r.why).toBe('要対応・未連絡の変更の日は日の予定で確かめて確定');
    expect(weekNext({ ...base, bulk: bulk({ problem: ['2026-10-22'] }) }).why).toBe(
      '要対応の日は日の予定で確かめて確定',
    );
    expect(weekNext({ ...base, bulk: bulk({ changed: ['2026-10-23'] }) }).why).toBe(
      '未連絡の変更の日は日の予定で確かめて確定',
    );
  });
  it('今日以降に訪問の無い週はボタンなし', () => {
    expect(weekNext({ ...base, futureDays: 0 }).kind).toBe('none');
  });
  it('文', () => {
    expect(weekConfirmLabel(4)).toBe('この週の問題の無い日をまとめて確定（4日）');
  });
});

describe('weekDayCountText（日の見出しの件数。PRD D314）', () => {
  it('件数と担当なし', () => {
    expect(weekDayCountText({ count: 0, unassigned: 0 })).toBe('0件');
    expect(weekDayCountText({ count: 17, unassigned: 0 })).toBe('17件');
    expect(weekDayCountText({ count: 17, unassigned: 2 })).toBe('17件・担当なし2');
  });
});

describe('weekPrepOf（この週の準備のまとめ。PRD D328・D332）', () => {
  const st = (date: string, x: Partial<DayStatus> = {}): DayStatus =>
    ({ date, count: 2, state: 'none', care: 0, ...x }) as DayStatus;
  it('まとめて確定の振り分け（月と同じ決まり）と1行の状態', () => {
    const statuses = new Map([
      ['2026-10-22', st('2026-10-22')],
      ['2026-10-23', st('2026-10-23', { care: 1 })],
      ['2026-10-24', st('2026-10-24', { state: 'changed' })],
    ]);
    const r = weekPrepOf(
      {
        unconfirmed: ['2026-10-22', '2026-10-23', '2026-10-24'],
        attentionItems: [],
        days: 4,
        confirmed: 1,
        changed: 1,
        notYet: 2,
        care: 1,
      },
      (d) => statuses.get(d),
    );
    expect(r.bulk).toEqual({ targets: ['2026-10-22'], problem: ['2026-10-23'], changed: ['2026-10-24'] });
    expect(r.futureDays).toBe(4);
    expect(r.line).toEqual({ told: 1, changed: 1, notYet: 2, care: 1 });
  });
});

describe('expert 切（確定の段階が無い。ADR-0073）', () => {
  it('主ボタンも状態も出さない', () => {
    const bulk = { targets: ['2026-10-20'], problem: [], changed: [] };
    expect(weekNext({ futureDays: 3, bulk, running: false }).kind).toBe('confirm');
    expect(weekNext({ futureDays: 3, bulk, running: false, confirmStep: false })).toMatchObject({
      kind: 'none',
      label: '',
    });
  });
  it('1行の状態は変更ありと要対応だけ', () => {
    const line = { told: 3, changed: 1, notYet: 2, care: 4 };
    expect(weekStatusText(line, true)).toBe('確定済み 3日・まだ伝えていない 2日・未連絡の変更 1日・要対応 4件');
    expect(weekStatusText(line, false)).toBe('変更あり 1日・要対応 4件');
    expect(weekStatusText({ ...line, changed: 0 }, false)).toBe('要対応 4件');
  });
});

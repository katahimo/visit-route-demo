import { describe, expect, it } from 'vitest';
import type { Absence, Staff } from '../contracts/documents';
import { monthLabel } from './dateText';
import { HOME_NEXT_MONTH_FROM_DAY, homeDays, homeMonths, homeTasks, routedStaffCount, taskAction } from './home';
import { type DayStatus, monthProgress } from './month';

/** 日の状態（既定は訪問3件・確定済み・問題なし） */
function st(date: string, x: Partial<DayStatus> = {}): DayStatus {
  return {
    date,
    count: 3,
    state: 'told',
    unassigned: 0,
    issues: new Map(),
    care: 0,
    changes: 0,
    absence: false,
    overSpan: [],
    needsCare: false,
    ...x,
  };
}
/** 担当なしの訪問が n件ある日（要対応） */
const unassigned = (n: number): Partial<DayStatus> => ({
  unassigned: n,
  care: n,
  needsCare: true,
  issues: new Map(Array.from({ length: n }, (_, i) => [`v${i}`, [{ kind: 'unassigned' as const, label: '担当なし' }]])),
});
/** 組み方の標準は登録済み（標準のカードは別の段で確かめる） */
const data = {
  absences: [] as Absence[],
  staff: [] as Staff[],
  standard: { at: 0, presetId: 'balance', from: '2026-10-01', weeks: 1 },
};
const TODAY = '2026-10-14';
const input = (statuses: DayStatus[], months = ['2026-10'], todayStaff = 2, today = TODAY) => ({
  today,
  statuses,
  months: months.map((ym) => ({ ym })),
  todayStaff,
  data,
  features: {},
});

describe('homeMonths・homeDays', () => {
  it('14日までは今月だけ', () => {
    expect(homeMonths('2026-10-14')).toEqual(['2026-10']);
    expect(homeMonths('2026-10-01')).toEqual(['2026-10']);
    expect(homeDays('2026-10-14')).toHaveLength(18);
    expect(homeDays('2026-10-14')[0]).toBe('2026-10-14');
  });
  it(`${HOME_NEXT_MONTH_FROM_DAY}日以降なら来月も（年をまたぐ）`, () => {
    expect(homeMonths('2026-10-15')).toEqual(['2026-10', '2026-11']);
    expect(homeMonths('2026-12-31')).toEqual(['2026-12', '2027-01']);
    const days = homeDays('2026-12-31');
    expect(days[0]).toBe('2026-12-31');
    expect(days.at(-1)).toBe('2027-01-31');
    expect(days).toHaveLength(32);
  });
  it('月の名前', () => {
    expect(monthLabel('2026-03')).toBe('3月');
  });
});

describe('homeTasks（版2）', () => {
  it('組み方の標準を登録していなければ先頭に標準のカード（PRD D354）', () => {
    const r = homeTasks({
      ...input([st(TODAY, { count: 0, state: 'none' })], ['2026-10'], 0),
      data: { absences: [], staff: [] },
    });
    expect(r.tasks.map((t) => t.kind)).toEqual(['standard', 'today']);
    expect(r.tasks[0]).toMatchObject({ tone: 'todo', to: '/standard' });
    expect(r.ready).toBe(false);
  });
  it('何も無い：今日の訪問は無い知らせだけで、準備はできている', () => {
    const r = homeTasks(input([st(TODAY, { count: 0, state: 'none' })], ['2026-10'], 0));
    expect(r.ready).toBe(true);
    expect(r.tasks.map((t) => t.kind)).toEqual(['today']);
    expect(r.tasks[0]).toMatchObject({ tone: 'info', to: '/plan', date: TODAY });
    expect(r.tasks[0]!.title).toContain('訪問はありません');
  });

  it('全部済み：今日の予定の要約（確定済み）だけで、準備はできている', () => {
    const r = homeTasks(input([st(TODAY), st('2026-10-15'), st('2026-10-16', { count: 0, state: 'none' })]));
    expect(r.ready).toBe(true);
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0]).toMatchObject({ kind: 'today', tone: 'info' });
    expect(r.tasks[0]!.title).toContain('確定済み');
    expect(r.tasks[0]!.detail).toBe('訪問 3件・担当 2人・要対応 0件');
  });

  it('担当なしの日が2日以上：予定を組むの「担当を組む」へ（ADR-0063）', () => {
    const r = homeTasks(
      input([st(TODAY, { state: 'none', ...unassigned(1) }), st('2026-10-15', { state: 'none', ...unassigned(2) })]),
    );
    expect(r.ready).toBe(false);
    expect(r.tasks.map((t) => t.kind)).toEqual(['attention', 'create', 'confirm', 'today']);
    const c = r.tasks.find((t) => t.kind === 'create')!;
    expect(c).toMatchObject({
      tone: 'todo',
      title: '10月の担当なしの訪問を組む',
      to: '/arrange?ym=2026-10',
    });
    expect(c.detail).toBe('担当なしの訪問がある日 2日');
  });

  it('一部済み：要対応 → 確定していない日 → 今日 の順（作業の順。PRD D263）', () => {
    const r = homeTasks(
      input(
        [
          st('2026-10-13', { state: 'none' }), // 今日より前は数えない
          st(TODAY, { state: 'none', ...unassigned(1) }),
          st('2026-10-15', { state: 'changed', changes: 2 }),
          st('2026-10-16', { state: 'none' }),
        ],
        ['2026-10'],
        3,
      ),
    );
    expect(r.ready).toBe(false);
    expect(r.tasks.map((t) => t.kind)).toEqual(['attention', 'confirm', 'today']);
    const [att, conf, today] = r.tasks;
    expect(att).toMatchObject({ title: '10月の要対応 2件', to: '/month?ym=2026-10&do=attention' });
    expect(att!.detail).toBe('要対応の訪問がある日 1日・未連絡の変更がある日 1日');
    expect(today).toMatchObject({ tone: 'warn' });
    expect(today!.title).toContain('（まだ伝えていない）');
    expect(today!.detail).toBe('訪問 3件・担当 3人・要対応 1件');
    expect(conf).toMatchObject({ title: '10月の確定していない日 3日を確認', to: '/month?ym=2026-10&do=unconfirmed' });
    expect(conf!.detail).toBe('まだ伝えていない 2日・未連絡の変更あり 1日。見直して伝えたら「確定」');
  });

  it('expert 切：確定していない日のカードを出さず、今日の予定に「まだ伝えていない」と添えない（変更ありは添える。ADR-0073）', () => {
    const off = { features: { expert: false } };
    const none = homeTasks({ ...input([st(TODAY, { state: 'none' }), st('2026-10-16', { state: 'none' })]), ...off });
    expect(none.tasks.map((t) => t.kind)).not.toContain('confirm');
    expect(none.tasks.find((t) => t.kind === 'today')!.title).toBe('今日 10/14（水）の予定');
    const changed = homeTasks({ ...input([st(TODAY, { state: 'changed' })]), ...off });
    expect(changed.tasks.map((t) => t.kind)).not.toContain('confirm');
    expect(changed.tasks.find((t) => t.kind === 'today')!.title).toContain('変更あり');
  });
  it('要対応が1日だけなら日の画面へ', () => {
    const r = homeTasks(input([st(TODAY, { state: 'none', ...unassigned(1) })]));
    expect(r.tasks[0]).toMatchObject({ kind: 'attention', to: '/plan', date: TODAY });
  });

  it('確定していない日の日数・並びは月の「今月の準備」の③（monthProgress の unconfirmed）と同じ', () => {
    const list = [
      st(TODAY, { state: 'none' }),
      st('2026-10-15', { state: 'told' }),
      st('2026-10-16', { state: 'none' }),
      st('2026-10-18', { state: 'changed', changes: 1 }),
      st('2026-10-20', { state: 'none', count: 0 }),
    ];
    const byDate = new Map(list.map((x) => [x.date, x]));
    const progress = monthProgress(
      { ...data, visits: [], patterns: [], clients: [], clientLeaves: [], snapshots: {} } as never,
      '2026-10',
      TODAY,
      (d) => byDate.get(d) ?? st(d, { count: 0, state: 'none' }),
    );
    const conf = homeTasks(input(list)).tasks.find((t) => t.kind === 'confirm')!;
    expect(progress.unconfirmed).toEqual([TODAY, '2026-10-16', '2026-10-18']);
    expect(conf.title).toBe(`10月の確定していない日 ${progress.unconfirmed.length}日を確認`);
  });

  it('欠勤だけの日（担当が休みの訪問は無い）は要対応に数えない', () => {
    const r = homeTasks({
      ...input([st('2026-10-20', { absence: true })]),
      data: {
        staff: [{ id: 's1', name: '山田' } as Staff],
        absences: [{ id: 'a1', staffId: 's1', date: '2026-10-20', from: '09:00', to: '12:00', note: '' } as Absence],
      },
    });
    expect(r.tasks.some((t) => t.kind === 'attention')).toBe(false);
  });

  it('月末は来月のカードも（今月は済み、来月は担当なしの日が多い）', () => {
    const today = '2026-10-28';
    const r = homeTasks(
      input(
        [
          st(today),
          st('2026-11-02', { state: 'none', ...unassigned(1) }),
          st('2026-11-03', { state: 'none', ...unassigned(1) }),
        ],
        ['2026-10', '2026-11'],
        2,
        today,
      ),
    );
    expect(r.tasks.map((t) => [t.kind, t.title])).toEqual([
      ['attention', '11月の要対応 2件'],
      ['create', '11月の担当なしの訪問を組む'],
      ['confirm', '11月の確定していない日 2日を確認'],
      ['today', '今日 10/28（水）の予定（確定済み）'],
    ]);
  });
});

describe('routedStaffCount（今日の担当の人数）', () => {
  it('訪問の列が1件以上ある人だけ数える', () => {
    expect(routedStaffCount({})).toBe(0);
    expect(routedStaffCount({ s1: ['v1', 'v2'], s2: [], s3: ['v3'] })).toBe(2);
  });
});

describe('担当なしの［組む］カード（エキスパート機能が切のとき。ADR-0072 第2段）', () => {
  const sts = [st(TODAY, { state: 'none' })];
  const withAuto = (features: Record<string, boolean>, autoCount: number) =>
    homeTasks({ ...input(sts), features, autoCount }).tasks;

  it('切なら「担当なし N件」のカードを出す（行き先でなくその場で組む）。やること（todo）で、準備はできている扱いにしない', () => {
    const r = homeTasks({ ...input(sts), features: { expert: false }, autoCount: 3 });
    const card = r.tasks.find((t) => t.kind === 'auto');
    expect(card).toMatchObject({ tone: 'todo', title: '担当なし 3件' });
    expect(taskAction(card!)).toEqual({ type: 'arrange' });
    expect(r.ready).toBe(false);
  });

  it('入なら出さない（今の「担当なしの訪問を組む」のまま）。件数が0でも出さない', () => {
    expect(withAuto({ expert: true }, 3).some((t) => t.kind === 'auto')).toBe(false);
    expect(withAuto({}, 3).some((t) => t.kind === 'auto')).toBe(false);
    expect(withAuto({ expert: false }, 0).some((t) => t.kind === 'auto')).toBe(false);
  });

  it('切のときは「担当なしの訪問を組む」（担当を組むへ）を出さず［組む］だけ、入のときはそのカードだけ', () => {
    const list = [
      st(TODAY, { state: 'none', ...unassigned(1) }),
      st('2026-10-15', { state: 'none', ...unassigned(1) }),
    ];
    const kinds = (features: Record<string, boolean>) =>
      homeTasks({ ...input(list), features, autoCount: 2 }).tasks.map((t) => t.kind);
    expect(kinds({ expert: false })).toContain('auto');
    expect(kinds({ expert: false })).not.toContain('create');
    expect(kinds({ expert: true })).toContain('create');
    expect(kinds({ expert: true })).not.toContain('auto');
  });

  it('行き先のあるカードは link の動き（移る先と日付）', () => {
    const list = [
      st(TODAY, { state: 'none', ...unassigned(1) }),
      st('2026-10-15', { state: 'none', ...unassigned(1) }),
    ];
    const r = homeTasks({ ...input(list), features: { expert: false }, autoCount: 2 });
    const today = r.tasks.find((t) => t.kind === 'today')!;
    expect(taskAction(today)).toEqual({ type: 'link', to: '/plan', date: TODAY });
  });
});

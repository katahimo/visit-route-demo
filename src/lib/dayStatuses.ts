// 日ごとの状態（月のマスの色・要対応・今月の準備と同じ数え方）の計算と、日ごとの覚え。React・store は使わない。
// 画面からは components/useDayStatuses で使う。覚えはアプリで1つ（dayStatusMemo）を、要対応の帯・月の画面と自動の組みの対象（lib/autoArrange）・
// 自動の伝えた記録（lib/settled）で分け合う
import type { DemoData } from '../contracts/data';
import type { Visit } from '../contracts/documents';
import type { Problem } from '../contracts/problem';
import type { CompileInput } from '../matching';
import { visitsOn } from '../patterns';
import { visitBandKind } from './bandIssues';
import { own } from './common';
import { dayProblemOf } from './dayPlan';
import { type DayStatus, dayStatus } from './month';

/** 日の表示の計算の覚え（日付ごと。同じ入力なら compile・検査し直さない） */
type Memo = {
  base: unknown[];
  visits: Visit[];
  snapshot: unknown;
  problem: Problem | null;
  status: DayStatus;
};

/** 日ごとの状態と問題 */
export type DayStatuses = Map<string, { status: DayStatus; problem: Problem | null }>;

const sameList = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** 覚えておく数の既定（日付ごとに最近の数件・日付の数） */
const MEMO_PER_DAY = 3;
const MEMO_DAYS = 400;

/**
 * 日ごとの覚えを持つ計算を作る。入力はすべて同じもの（===）のときだけ覚えを使う。
 * 訪問は visitsOn の結果（保存した回と計算した回。計算した回は同じパターン・同じ日なら同じオブジェクト）。
 * 日付ごとに最近の perDay 件、日付は maxDays 日まで（古い日付から捨てる）
 */
export function createDayStatusMemo(perDay = MEMO_PER_DAY, maxDays = MEMO_DAYS) {
  const memo = new Map<string, Memo[]>();
  const remember = (date: string, m: Memo) => {
    const list = memo.get(date) ?? [];
    memo.delete(date);
    memo.set(date, [m, ...list].slice(0, perDay));
    // 古い日付から捨てる（Map は入れた順）
    while (memo.size > maxDays) memo.delete(memo.keys().next().value as string);
  };
  /** その日たちの状態（lib/month の dayStatus：訪問ごとの検査と伝えた状態） */
  const statusesOf = (
    snapshots: DemoData['snapshots'],
    compileInput: CompileInput,
    days: readonly string[],
  ): DayStatuses => {
    const out: DayStatuses = new Map();
    const c = compileInput;
    // compile が読むデータのうち訪問以外のすべて（CompileInput のキーから作り、足したフィールドを漏らさない）
    const base = (Object.keys(c) as (keyof CompileInput)[])
      .filter((k) => k !== 'visits')
      .sort()
      .map((k) => c[k]);
    for (const d of days) {
      const visits = visitsOn(c, d);
      const snapshot = own(snapshots, d);
      const hit = memo
        .get(d)
        ?.find((x) => x.snapshot === snapshot && sameList(x.base, base) && sameList(x.visits, visits));
      if (hit) {
        out.set(d, { status: hit.status, problem: hit.problem });
        continue;
      }
      const problem = visits.some((v) => !v.cancelled) ? dayProblemOf(c, d) : null;
      const status = dayStatus({ ...c, snapshots }, d, problem);
      remember(d, { base, visits, snapshot, problem, status });
      out.set(d, { status, problem });
    }
    return out;
  };
  return { statusesOf };
}

/** アプリで1つの覚え（画面を移っても消えない。要対応の帯・月の画面・自動の組みの対象で同じ計算を使い回す） */
export const dayStatusMemo = createDayStatusMemo();

/** compile が読むデータだけを取り出す（覚えの鍵。components/useCompileInput と同じフィールド） */
export function compileInputOf(data: CompileInput): CompileInput {
  return {
    org: data.org,
    items: data.items,
    rules: data.rules,
    staff: data.staff,
    clients: data.clients,
    compat: data.compat,
    visits: data.visits,
    availability: data.availability,
    absences: data.absences,
    visitTypes: data.visitTypes,
    patterns: data.patterns,
    clientLeaves: data.clientLeaves,
  };
}

/**
 * その日たちの問題と、帯の種類（担当なし・間に合わない・重なり・休みの人。lib/bandIssues）の訪問の ID（日付 → 問題・ID の集まり）。
 * 要対応の帯と同じ日ごとの状態（dayStatusMemo）から引く（自動の伝えた記録 lib/settled もこれで決める）。訪問が無い日の問題は null
 */
export function dayBandOf(
  data: CompileInput & Pick<DemoData, 'snapshots'>,
  days: readonly string[],
): Map<string, { problem: Problem | null; ids: Set<string> }> {
  const out = new Map<string, { problem: Problem | null; ids: Set<string> }>();
  for (const [date, { status, problem }] of dayStatusMemo.statusesOf(data.snapshots, compileInputOf(data), days)) {
    const ids = new Set<string>();
    for (const [id, issues] of status.issues) if (visitBandKind(issues)) ids.add(id);
    out.set(date, { problem, ids });
  }
  return out;
}

/** その日たちの、帯の種類の訪問の ID（日付 → ID の集まり。dayBandOf の ID だけ） */
export function bandIssueIds(
  data: CompileInput & Pick<DemoData, 'snapshots'>,
  days: readonly string[],
): Map<string, Set<string>> {
  return new Map([...dayBandOf(data, days)].map(([date, { ids }]) => [date, ids]));
}

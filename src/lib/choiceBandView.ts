// 案をその日の担当ごとの時間軸と地図で見る（components/choiceBand の ChoiceDayView。PRD D350。ADR-0065）ための純粋関数：
// 点数・列にする人・今との差（変わる訪問）・見るタブ・印の文。入力は提案の入れ物に縛られない形（問題・今の割当・案ごとの割当）
import type { Problem } from '../contracts/problem';
import type { ReassignDiff } from '../contracts/reassign';
import { minutesToHhmm } from '../domain/time';
import { normalize } from '../evaluate';
import { reassignDiff } from '../reassign';
import { busyStaff } from './choiceView';
import { attempt } from './common';
import { pointsOf } from './dayPlan';
import { type ProposalChange, proposalDayChanges } from './monthBatch';

type Routes = Record<string, string[]>;

/** 日で見る案の1つ（考え方のプリセットと、その日の割当） */
export type DayChoice = { presetId: string; name: string; routes: Routes };

/**
 * 日で見るの入力（提案の入れ物に縛られない形）：その日の問題（点数の基準の物差しで作ったもの。時間軸・地図・点に使う）・
 * 今の割当（くらべる元が無ければ null。そのときは案どうしだけ）・案ごとの割当（どれも同じ問題の訪問 ID を並べたもの）
 */
export type ChoiceDayInput = { problem: Problem; current: Routes | null; choices: readonly DayChoice[] };

/** 今の割当と案ごとの点（点数の基準の物差しで 100点満点。採点できない・今の割当が無ければ null） */
export function choicePoints(
  problem: Problem,
  current: Routes | null,
  choices: readonly Pick<DayChoice, 'routes'>[],
): { current: number | null; choices: (number | null)[] } {
  const scale = attempt(() => normalize(problem)).value ?? null;
  return {
    current: current ? pointsOf(problem, scale, current) : null,
    choices: choices.map((c) => pointsOf(problem, scale, c.routes)),
  };
}

/** 列にする人：今の割当かどれかの案で訪問のある人（タブを替えても列が動かない） */
export function choiceStaffIds(
  problem: Problem,
  current: Routes | null,
  choices: readonly Pick<DayChoice, 'routes'>[],
): Set<string> {
  const out = new Set<string>();
  if (current) for (const id of busyStaff(problem, current)) out.add(id);
  for (const c of choices) for (const id of busyStaff(problem, c.routes)) out.add(id);
  return out;
}

/**
 * 今の割当 → 案の差（担当が変わる・時刻が変わる。出せなければ null）と、変わる訪問（提案での開始の順）。
 * 今の割当が無ければ差は無い
 */
export function choiceDiff(
  problem: Problem,
  current: Routes | null,
  routes: Routes,
): { diff: ReassignDiff | null; changes: ProposalChange[] } {
  if (!current) return { diff: null, changes: [] };
  const diff = attempt(() => reassignDiff({ problem, routes: current }, { problem, routes })).value ?? null;
  return { diff, changes: proposalDayChanges({ problem, routes, diff }) };
}

/**
 * 見るタブの番号（-1 は今の割当）：tab は 'current' か案のプリセット ID。無い・選んでいなければ best（いちばん点の高い案）、
 * それも無ければ最初の案、案が無ければ今の割当。今の割当が無ければ（hasCurrent が偽）'current' も既定と同じ
 */
export function choiceTab(
  tab: string | null,
  choices: readonly Pick<DayChoice, 'presetId'>[],
  best: number,
  hasCurrent = true,
): number {
  if (tab === 'current' && hasCurrent) return -1;
  const k = tab === null ? -1 : choices.findIndex((c) => c.presetId === tab);
  if (k >= 0) return k;
  if (best >= 0 && best < choices.length) return best;
  return choices.length > 0 ? 0 : -1;
}

/** 点の文（採点できなければ —） */
export const pointText = (p: number | null): string => (p === null ? '—' : `${p}点`);

/** 点の差の符号（＋・−・±） */
export const diffSign = (diff: number): string => (diff > 0 ? '+' : diff < 0 ? '−' : '±');

/** 時間軸の帯に付ける印の文：担当が変わる（今の担当つき）・時刻だけ変わる（今の時刻つき）。変わらなければ undefined */
export function changeNote(
  c: ProposalChange | undefined,
  staffName: (id: string | null) => string,
): string | undefined {
  if (c?.kind === 'staff') return `担当が変わる（今：${staffName(c.from)}）`;
  if (c?.kind === 'time') return `時刻が変わる（今：${minutesToHhmm(c.at - c.minutes)}）`;
  return undefined;
}

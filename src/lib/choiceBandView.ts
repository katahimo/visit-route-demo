// 考え方ごとの案の帯（PRD D357。ADR-0064）の表示のための純粋関数：点数・列にする人・印の文・確認の本文
import type { ScoreScale } from '../contracts/problem';
import { minutesToHhmm } from '../domain/time';
import { busyStaff } from './choiceView';
import { WEEKDAY_LABELS } from './common';
import { dateText, mdText } from './dateText';
import { pointsOf } from './dayPlan';
import type { ProposalChange, ProposalChoice, ProposalDay } from './monthBatch';
import type { dayStandardPreview } from './standard';

type Routes = Record<string, string[]>;
type ScoreProblem = Parameters<typeof pointsOf>[0];

/** 反映できなかったときの文（案を出したあとに訪問が変わった） */
export const STALE_TEXT = '提案を出したあとに訪問が変わったので、反映しませんでした。もう一度組んでください';

/** 今の担当と案ごとの点（100点満点。採点できなければ null） */
export function choicePoints(
  scoreProblem: ScoreProblem,
  scale: ScoreScale | null,
  current: Routes,
  choices: readonly ProposalChoice[],
): { current: number | null; choices: (number | null)[] } {
  return {
    current: pointsOf(scoreProblem, scale, current),
    choices: choices.map((c) => (c.days[0] ? pointsOf(scoreProblem, scale, c.days[0].routes) : null)),
  };
}

/** 列にする人：今の担当かどれかの案で訪問のある人（タブを替えても列が動かない） */
export function choiceStaffIds(first: ProposalDay, current: Routes, choices: readonly ProposalChoice[]): Set<string> {
  const out = new Set<string>();
  for (const id of busyStaff(first.problem, current)) out.add(id);
  for (const c of choices) {
    const d = c.days[0];
    if (d) for (const id of busyStaff(d.problem, d.routes)) out.add(id);
  }
  return out;
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

/** 「この案を標準にする」の確認の本文 */
export function adoptBody(
  choice: Pick<ProposalChoice, 'name'>,
  pv: ReturnType<typeof dayStandardPreview>,
  date: string,
): { weekdayLabel: string; body: string } {
  const wd = WEEKDAY_LABELS[pv.weekday as 0] ?? '';
  const body = [
    `・${dateText(date)}の担当と時刻をこの案にします`,
    pv.diff.length > 0
      ? `・${mdText(pv.since)}から、毎週${wd}曜の担当と時刻をこの案のとおりにします（今と違う所 ${pv.diff.length}か所。ほかの曜日は今のまま）`
      : `・毎週${wd}曜の担当と時刻は今のままです（この案と同じ）`,
    `・これから AI で組むときは「${choice.name}」の考え方で組みます`,
    '「元に戻す」で戻せます。ほかの曜日は「組み方の標準」で表で直せます',
  ].join('\n');
  return { weekdayLabel: wd, body };
}

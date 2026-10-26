// 組み方の標準の画面（#/standard）のための純粋関数：表の行・曜日・担当に選べる人・登録で書き換える所・登録の確認文・
// 日で見るの日付と入力
import type { DemoData } from '../contracts/data';
import type { Pattern } from '../contracts/documents';
import type { Problem } from '../contracts/problem';
import type { ChoiceDayInput } from './choiceBandView';
import { mdText } from './dateText';
import {
  type CellDiff,
  type StandardDay,
  standardDayRoutes,
  standardPatterns,
  type TemporaryChoice,
  WEEKDAY_ORDER,
} from './standard';

/** 標準の表の行の並び：〈利用者さん〉の名前順（日本語）、同じなら最初の曜日（月曜はじまり）順 */
export function standardRows(data: Pick<DemoData, 'patterns' | 'clients'>, today: string): Pattern[] {
  const names = new Map(data.clients.map((c) => [c.id, c.displayName]));
  const firstWd = (p: Pattern) => Math.min(...p.weekdays.map((w) => (w + 6) % 7));
  return [...standardPatterns(data, today)].sort(
    (a, b) => (names.get(a.clientId) ?? '').localeCompare(names.get(b.clientId) ?? '', 'ja') || firstWd(a) - firstWd(b),
  );
}

/** 表に出す曜日（行のどれかが行く曜日だけ。月曜はじまり） */
export function standardWeekdays(rows: readonly Pick<Pattern, 'weekdays'>[]): number[] {
  return WEEKDAY_ORDER.filter((wd) => rows.some((p) => p.weekdays.includes(wd)));
}

/** マスの担当に選べる人（勤務中の人を名前順に） */
export function workingStaff(
  staff: readonly { id: string; name: string; active: boolean }[],
): { id: string; name: string }[] {
  return staff
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

/** 「いつから」より前に終わる繰り返しの id（登録でそのマスは書き換えない。レビュー #92） */
export function endsBeforeIds(patterns: readonly Pick<Pattern, 'id' | 'to'>[], since: string): Set<string> {
  const ids = new Set<string>();
  for (const p of patterns) if (p.to !== null && p.to < since) ids.add(p.id);
  return ids;
}

/** 違うマスのうち、登録で書き換えるもの（「いつから」より前に終わる繰り返しのマスを除く） */
export function effectiveDiff(diff: readonly CellDiff[], endsBefore: ReadonlySet<string>): CellDiff[] {
  return diff.filter((c) => !endsBefore.has(c.patternId));
}

/** 登録の確認の文の行（空の行は含まない）。presetName は標準の考え方に選ぶ案の名前（無ければ null） */
export function registerLines(
  changes: readonly CellDiff[],
  since: string,
  tempCount: number,
  temp: TemporaryChoice,
  presetName: string | null,
): string[] {
  const patternsChanged = new Set(changes.map((c) => c.patternId)).size;
  return [
    `今の標準と違う ${changes.length}か所（繰り返し ${patternsChanged}件）を書き換えます。曜日で担当が違う繰り返しは曜日ごとに分けます。`,
    `${mdText(since)}から先の予定は、この表の担当・時刻で並びます。`,
    tempCount > 0
      ? temp === 'drop'
        ? `すでに入っている予定で新しい標準と違う ${tempCount}件は、消して標準どおりにします。`
        : `すでに入っている予定で新しい標準と違う ${tempCount}件は、今の担当のまま固定（ピン）します。`
      : '',
    presetName !== null ? `標準の考え方（点数の基準）を「${presetName}」にします。` : '',
    '伝えた日の予定とピンの予定は変えません。元に戻すで戻せます',
  ].filter(Boolean);
}

/** 案の日ごとの割当（lib/standardDraft の StandardProposal のうち日で見るに使う所） */
type DayProposal = { presetId: string; done: boolean; days: readonly StandardDay[] };

/** 日で見るの日付（作り終えた案のどれかに訪問のある日。昇順。PRD D350） */
export function standardDayDates(proposals: readonly DayProposal[]): string[] {
  const out = new Set<string>();
  for (const p of proposals) if (p.done) for (const d of p.days) out.add(d.date);
  return [...out].sort();
}

/** 日で見るの日付：選んだ日が日付の中にあればそれ、無ければ最初の日（日が無ければ null） */
export function standardDayDate(picked: string | null, dates: readonly string[]): string | null {
  return picked !== null && dates.includes(picked) ? picked : (dates[0] ?? null);
}

/**
 * 日で見るの入力（ChoiceDayInput。ADR-0065）：problem は点数の基準の物差しで作ったひな形のその日の問題（作れなければ最初の案の
 * その日の問題）、今の標準（standardDayRoutes）、作り終えた案ごとのその日の割当（その日の無い案は除く。名前は data.presets）。
 * どの案にもその日が無ければ null
 */
export function standardDayInput(
  data: DemoData,
  proposals: readonly DayProposal[],
  date: string,
  scoreProblem: Problem | null,
): ChoiceDayInput | null {
  const name = new Map(data.presets.map((p) => [p.id, p.name]));
  const choices: (ChoiceDayInput['choices'][number] & { problem: Problem })[] = [];
  for (const p of proposals) {
    const day = p.done ? p.days.find((d) => d.date === date) : undefined;
    if (day) choices.push({ presetId: p.presetId, name: name.get(p.presetId) ?? '消したプリセット', ...day });
  }
  const problem = scoreProblem ?? choices[0]?.problem;
  if (!problem || choices.length === 0) return null;
  return {
    problem,
    current: standardDayRoutes(data, problem),
    choices: choices.map(({ presetId, name: n, routes }) => ({ presetId, name: n, routes })),
  };
}

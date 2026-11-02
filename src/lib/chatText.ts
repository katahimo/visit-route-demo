// 日の予定のチャット用の文（PRD D419。ADR-0085）：1日の全員分を1つの文に。LINE WORKS などに人が貼る（アプリは送らない）。
// 担当ごとの並びはメール（lib/mail の dayByStaff。伝えた内容、無ければ今の担当）、決まりごとの行は lib/visitRules、
// 初めての訪問先の判定は lib/firstVisit を使い回す。住所は入れない。データは書き換えない純粋関数
import type { DemoData } from '../contracts/data';
import { byName } from './common';
import { clockTime } from './dateText';
import { isFirstVisit, servedPairsBefore } from './firstVisit';
import { dayByStaff, type MailVisit, mdw, nameOf } from './mail';
import { visitRuleLines } from './visitRules';

/** 訪問の行（「 9:00 青葉様（60分）」。時刻は5桁にそろえる） */
const visitLine = (v: MailVisit) =>
  `${clockTime(v.start).padStart(5, ' ')} ${nameOf(v.client)}（${v.visit?.durationMinutes ?? Math.round(v.end - v.start)}分）`;

/**
 * その日のチャット用の文。「11/3（火）の予定」の下に担当ごとに「■〈名前〉」（名前の順）と訪問の行、最後に「■担当なし」。
 * 決まりごと（入り方・駐車場・注意。D66）は初めての訪問先（D415）の行の下だけ（notesOn が false なら入れない）。
 * 鍵は includeKeys のときだけ。訪問が無い日は「訪問はありません」
 */
export function dayChatText(data: DemoData, date: string, opts: { notesOn: boolean; includeKeys: boolean }): string {
  const { byStaff, unassigned } = dayByStaff(data, date);
  const served = opts.notesOn ? servedPairsBefore(data, date) : null;
  const staff = [...data.staff].filter((s) => byStaff.has(s.id)).sort(byName);
  /** 初めての訪問先なら決まりごとの行（入っている項目だけ） */
  const notesOf = (staffId: string, v: MailVisit): string[] => {
    if (!served || !v.client || !isFirstVisit(served, v.client.id, staffId)) return [];
    return visitRuleLines(v.client, opts.includeKeys).map((r) => `   ${r.label}：${r.text}`);
  };
  const blocks = [
    ...staff.map((s) => [
      `■${s.name}`,
      ...(byStaff.get(s.id) ?? []).flatMap((v) => [visitLine(v), ...notesOf(s.id, v)]),
    ]),
    ...(unassigned.length > 0 ? [['■担当なし', ...unassigned.map(visitLine)]] : []),
  ];
  const head = `${mdw(date)}の予定`;
  return blocks.length === 0 ? `${head}\n訪問はありません` : [head, ...blocks.flat()].join('\n');
}

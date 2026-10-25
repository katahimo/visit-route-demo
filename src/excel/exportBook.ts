// DemoData → Excel のブック（テンプレート）。データは書き換えない（ADR-0006）
// シートごとの書き出しは exportSheets.ts、表の共通部分は exportTable.ts、人のシートは exportPersonTables.ts
import ExcelJS from 'exceljs';
import type { DemoData, RosterKind } from '../contracts/data';
import { nameKey, optionNameError } from '../lib/common';
import { clientTable, staffTable } from './exportPersonTables';
import {
  makeSheetCtx,
  writeAbsences,
  writeAvailability,
  writeClientLeaves,
  writeCompat,
  writeHowto,
  writeItems,
  writeOrg,
  writePatterns,
  writePresets,
  writeRules,
  writeVisits,
  writeVisitTypes,
  writeWorkload,
} from './exportSheets';
import { addTable } from './exportTable';
import { personSheetNames } from './text';

export { workloadRows } from './exportSheets';
export { sheetRef } from './exportTable';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** DemoData → Excel のブック（.xlsx の Blob） */
/**
 * 書き出せないデータ（読み込み直せないもの）を見つける。あれば場所付きの文、なければ null。
 * 選択肢の名前の「、」・改行・「（なし）」（区切り・空の印と区別できない）と、同じ2つの呼び方（項目の対象を区別できない）
 */
export function exportProblem(data: DemoData): string | null {
  const t = data.org.terms;
  if (t.staff.trim() === '' || t.client.trim() === '')
    return '呼び方が空なので書き出せません。データの画面の「呼び方」で入れてください';
  if (t.staff.trim() === t.client.trim())
    return `呼び方（訪問する人・訪問先）が同じ「${t.staff}」なので書き出せません。データの画面の「呼び方」で変えてください`;
  // 全角半角・空白だけが違う名前は、見出し（相性・特性の列）で区別できないので止める
  const groups: [string, string[]][] = [
    [t.staff, data.staff.map((s) => s.name)],
    [t.client, data.clients.map((c) => c.displayName)],
    [`${t.staff}の項目`, data.items.filter((i) => i.target === 'staff').map((i) => i.name)],
    [`${t.client}の項目`, data.items.filter((i) => i.target === 'client').map((i) => i.name)],
    ['種類', data.visitTypes.map((v) => v.name)],
  ];
  for (const [what, names] of groups) {
    const seen = new Map<string, string>();
    for (const n of names) {
      const before = seen.get(nameKey(n));
      if (before !== undefined)
        return `${what}の「${before}」と「${n}」は、全角半角・空白だけが違うので Excel では区別できません。どちらかの名前を変えてから書き出してください`;
      seen.set(nameKey(n), n);
    }
  }
  for (const it of data.items) {
    for (const o of it.options) {
      const e = optionNameError(o);
      if (e) return `項目「${it.name}」の選択肢「${o}」：${e}。項目の画面で名前を変えてから書き出してください`;
    }
  }
  return null;
}

/**
 * 名簿のブック（PRD D103。ADR-0020）：〈利用者さん〉か〈スタッフ〉のシート1枚だけ（全体のブックの同じシートと同じ列・書式）。
 * シート名は呼び方（personSheetNames）。書き出せないデータ（exportProblem）は全体と同じく止める
 */
export async function exportRosterWorkbook(data: DemoData, kind: RosterKind): Promise<Blob> {
  const problem = exportProblem(data);
  if (problem) throw new Error(problem);
  const names = personSheetNames(data.org.terms);
  const wb = new ExcelJS.Workbook();
  wb.creator = '訪問ルートAI デモ版';
  if (kind === 'staff') addTable(wb, staffTable(data, names.staff));
  // 〈スタッフ〉のシートが無いので、「いつもの担当」のプルダウンは名前の一覧（長すぎれば付けない）
  else addTable(wb, clientTable(data, names.client));
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as ArrayBuffer], { type: XLSX_MIME });
}

/** 全体のブック。シートの順は使い方・事業所・項目・条件・プリセット・スタッフ・利用者・相性・稼働時間・欠勤・種類・パターン・訪問・休み・稼働の見込み */
export async function exportWorkbook(data: DemoData): Promise<Blob> {
  const problem = exportProblem(data);
  if (problem) throw new Error(problem);
  const names = personSheetNames(data.org.terms);
  const wb = new ExcelJS.Workbook();
  wb.creator = '訪問ルートAI デモ版';
  const ctx = makeSheetCtx(wb, data, names);

  writeHowto(ctx);
  writeOrg(ctx);
  writeItems(ctx);
  writeRules(ctx);
  writePresets(ctx);
  addTable(wb, staffTable(data, names.staff));
  addTable(wb, clientTable(data, names.client));
  writeCompat(ctx);
  writeAvailability(ctx);
  writeAbsences(ctx);
  writeVisitTypes(ctx);
  writePatterns(ctx);
  writeVisits(ctx);
  writeClientLeaves(ctx);
  writeWorkload(ctx);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf as ArrayBuffer], { type: XLSX_MIME });
}

// 〈スタッフ〉・〈利用者さん〉のシートの表（全体のブックと名簿のブックで同じ列・同じ書式。PRD D103）
import type { DemoData } from '../contracts/data';
import type { Condition, Item, Traits } from '../contracts/rules';
import { STAGE_LABELS } from '../lib/clientStage';
import { type CellIn, condList, type ListRule, nullable, type TableSpec, traitList, yes } from './exportTable';
import {
  CLIENT_POSTAL_COL,
  CLIENT_STAGE_COLS,
  CLIENT_TRAVEL_COLS,
  clientExportCols,
  prefHeader,
  reqHeader,
  STAFF_COLS,
  STAFF_EMAIL_COL,
  STAFF_ICON_COL,
  STAFF_LAST_DAY_COL,
  traitCols,
} from './layout';
import { condsToCell, hhmmToCell, traitToCells, travelModeLabels, workDaysText, YES } from './text';

/** 特性・必要条件・希望の列（見出し・値・プルダウン）。base は前に並ぶ固定の列の数 */
function personItemCols(base: number, own: Item[], other: Item[]) {
  const traits = own.flatMap(traitCols);
  const headers = [...traits.map((c) => c.header), ...other.map(reqHeader), ...other.map(prefHeader)];
  const lists: ListRule[] = [];
  traits.forEach((c, i) => {
    const l = traitList(c, base + i + 1);
    if (l) lists.push(l);
  });
  other.forEach((it, i) => {
    for (const col of [base + traits.length + i + 1, base + traits.length + other.length + i + 1]) {
      const l = condList(it, col);
      if (l) lists.push(l);
    }
  });
  const cells = (p: { traits: Traits; requirements: Condition[]; preferences: Condition[] }): CellIn[] => [
    ...own.flatMap((it) => traitToCells(it, Object.hasOwn(p.traits, it.id) ? p.traits[it.id] : undefined)),
    ...other.map((it) =>
      condsToCell(
        it,
        p.requirements.filter((c) => c.itemId === it.id),
      ),
    ),
    ...other.map((it) =>
      condsToCell(
        it,
        p.preferences.filter((c) => c.itemId === it.id),
      ),
    ),
  ];
  return { headers, lists, cells };
}

/** 〈スタッフ〉のシート（全体のブックと名簿のブックで同じ列・同じ書式。PRD D103） */
export function staffTable(data: DemoData, name: string): TableSpec {
  const staffItems = data.items.filter((i) => i.target === 'staff');
  const clientItems = data.items.filter((i) => i.target === 'client');
  const staffBase = [...Object.values(STAFF_COLS), STAFF_LAST_DAY_COL, STAFF_EMAIL_COL, STAFF_ICON_COL];
  const sp = personItemCols(staffBase.length, staffItems, clientItems);
  return {
    name,
    headers: [...staffBase, ...sp.headers],
    rows: data.staff.map((s) => [
      s.id,
      s.name,
      travelModeLabels[s.travelMode],
      workDaysText(s.workDays),
      hhmmToCell(s.shiftStart),
      hhmmToCell(s.shiftEnd),
      yes(s.active),
      s.home.address,
      nullable(s.home.lat),
      nullable(s.home.lng),
      s.lastDay ?? '',
      // メールアドレス（ADR-0017）
      s.email,
      // アイコン（ADR-0050）
      s.icon,
      ...sp.cells(s),
    ]),
    // 文字列の書式：ID・曜日・勤務の開始と終了・最終勤務日・アイコン（数字や日付に化けないように。ADR-0050）。メールアドレスは付けない（前から）
    textCols: [1, 4, 5, 6, staffBase.indexOf(STAFF_LAST_DAY_COL) + 1, staffBase.indexOf(STAFF_ICON_COL) + 1],
    lists: [{ col: 3, values: Object.values(travelModeLabels) }, { col: 7, values: [YES] }, ...sp.lists],
    freezeCols: 2,
  };
}

/**
 * 〈利用者さん〉のシート（全体のブックと名簿のブックで同じ列・同じ書式。PRD D103）。
 */
export function clientTable(data: DemoData, name: string): TableSpec {
  const staffItems = data.items.filter((i) => i.target === 'staff');
  const clientItems = data.items.filter((i) => i.target === 'client');
  const staffName = new Map(data.staff.map((s) => [s.id, s.name]));
  const clientBase = clientExportCols();
  const cp = personItemCols(clientBase.length, clientItems, staffItems);
  return {
    name,
    headers: [...clientBase, ...cp.headers],
    rows: data.clients.map((c) => [
      c.id,
      c.displayName,
      c.kana,
      c.color + 1,
      yes(c.active),
      yes(c.tentative),
      // 郵便番号（ADR-0016）：文字列の列（先頭の0を保つ）
      c.place.postalCode,
      c.place.address,
      nullable(c.place.lat),
      nullable(c.place.lng),
      // 移動時間（片道・分）・遠方（出張）（ADR-0096）
      c.place.travelMinutes ?? null,
      yes(c.place.farTrip === true),
      // 担当できる人（ADR-0014）：名前を「、」で区切る
      c.allowedStaffIds
        .flatMap((id) => staffName.get(id) ?? [])
        .join('、'),
      c.note,
      c.entryNote,
      c.keyNote,
      c.parkingNote,
      c.cautionNote,
      // 段階と紹介元（ADR-0015）
      STAGE_LABELS[c.stage],
      c.referrer.name,
      c.referrer.contact,
      c.referrer.note,
      c.referrer.email,
      ...cp.cells(c),
    ]),
    textCols: [1, 3, clientBase.indexOf(CLIENT_POSTAL_COL) + 1],
    lists: [
      { col: 4, values: ['1', '2', '3', '4', '5', '6', '7', '8'] },
      { col: 5, values: [YES] },
      { col: 6, values: [YES] },
      { col: clientBase.indexOf(CLIENT_TRAVEL_COLS.farTrip) + 1, values: [YES] },
      { col: clientBase.indexOf(CLIENT_STAGE_COLS.stage) + 1, values: Object.values(STAGE_LABELS) },
      ...cp.lists,
    ],
    freezeCols: 2,
  };
}

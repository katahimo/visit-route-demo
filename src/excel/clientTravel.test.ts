// 〈利用者さん〉の移動時間（片道・分）・遠方（出張）の列（PRD D429。ADR-0096）：全体のブックと名簿のブック
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { DemoData, ImportError, RosterImportResult } from '../contracts/data';
import { withTravel } from '../lib/clientTravel';
import { base, col, editAndImport, fail, ok, sheet, toBuffer, withoutPlans } from './excel.testkit';
import { exportRosterWorkbook, importRoster, importWorkbook } from './index';
import { personSheetNames } from './text';

const MIN = '移動時間（片道・分）';
const FAR = '遠方（出張）';

/** 1人目に移動時間と遠方、2人目に移動時間だけ */
const withTravelData = (d: DemoData): DemoData => ({
  ...d,
  clients: d.clients.map((c, i) =>
    i === 0
      ? { ...c, place: withTravel(c.place, 180, true) }
      : i === 1
        ? { ...c, place: withTravel(c.place, 45, false) }
        : c,
  ),
});

const rok = (r: RosterImportResult | ImportError): RosterImportResult => {
  if ('code' in r) throw new Error(`読み込めなかった：${r.message}`);
  return r;
};

describe('全体のブック', () => {
  it('書き出し → 読み込みで同じに戻る（列は「経度」の次。無い人は空）', async () => {
    const d = withTravelData(base());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await toBuffer(d));
    const ws = sheet(wb, personSheetNames(d.org.terms).client);
    expect(col(ws, MIN)).toBe(col(ws, '経度') + 1);
    expect(ws.getRow(2).getCell(col(ws, MIN)).value).toBe(180);
    expect(ws.getRow(2).getCell(col(ws, FAR)).value).toBe('○');
    expect(ws.getRow(4).getCell(col(ws, MIN)).value).toBeNull();
    const r = ok(await importWorkbook(await toBuffer(d), d));
    expect(r.clients[0]!.place).toMatchObject({ travelMinutes: 180, farTrip: true });
    expect(r.clients[1]!.place.travelMinutes).toBe(45);
    expect('farTrip' in r.clients[1]!.place).toBe(false);
    expect('travelMinutes' in r.clients[2]!.place).toBe(false);
    expect(r).toEqual(withoutPlans(d));
  });

  it('列が無い古いブックは無し。範囲外・整数でない値は行付きで止める', async () => {
    const d = withTravelData(base());
    const r = ok(
      await editAndImport(d, (wb) => {
        const ws = sheet(wb, personSheetNames(d.org.terms).client);
        ws.spliceColumns(col(ws, FAR), 1);
        ws.spliceColumns(col(ws, MIN), 1);
      }),
    );
    expect(r.clients.every((c) => c.place.travelMinutes === undefined && c.place.farTrip === undefined)).toBe(true);
    const msg = fail(
      await editAndImport(d, (wb) => {
        const ws = sheet(wb, personSheetNames(d.org.terms).client);
        ws.getCell(3, col(ws, MIN)).value = 0;
      }),
    );
    expect(msg).toContain(`3行目・『${MIN}』`);
  });
});

describe('名簿のブック', () => {
  it('書き出し → 読み込みで変わらない。列で入れた値を読み、列が無ければ今のまま', async () => {
    const d = withTravelData(base());
    const same = rok(
      await importRoster(await (await exportRosterWorkbook(d, 'client')).arrayBuffer(), d, 'client', 'merge'),
    );
    expect(same.updated).toEqual([]);
    expect(same.data).toEqual(d);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await (await exportRosterWorkbook(d, 'client')).arrayBuffer());
    const ws = sheet(wb, personSheetNames(d.org.terms).client);
    ws.getCell(4, col(ws, MIN)).value = '９０';
    ws.getCell(4, col(ws, FAR)).value = '○';
    ws.getCell(2, col(ws, FAR)).value = null;
    const r = rok(await importRoster((await wb.xlsx.writeBuffer()) as ArrayBuffer, d, 'client', 'merge'));
    expect(r.data.clients[2]!.place).toMatchObject({ travelMinutes: 90, farTrip: true });
    expect(r.data.clients[0]!.place.travelMinutes).toBe(180);
    expect('farTrip' in r.data.clients[0]!.place).toBe(false);

    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(await (await exportRosterWorkbook(d, 'client')).arrayBuffer());
    const ws2 = sheet(wb2, personSheetNames(d.org.terms).client);
    ws2.spliceColumns(col(ws2, FAR), 1);
    ws2.spliceColumns(col(ws2, MIN), 1);
    const kept = rok(await importRoster((await wb2.xlsx.writeBuffer()) as ArrayBuffer, d, 'client', 'merge'));
    expect(kept.data.clients[0]!.place).toMatchObject({ travelMinutes: 180, farTrip: true });
  });
});

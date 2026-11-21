// 紹介元の相談員の列（PRD D461。ADR-0117）：全体のブックと名簿のブック
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { DemoData, ImportError, RosterImportResult } from '../contracts/data';
import { base, col, editAndImport, ok, sheet, toBuffer } from './excel.testkit';
import { exportRosterWorkbook, importRoster, importWorkbook } from './index';
import { personSheetNames } from './text';

const PERSON = '紹介元の相談員';

/** 1人目に相談員 */
const withPerson = (d: DemoData): DemoData => ({
  ...d,
  clients: d.clients.map((c, i) => (i === 0 ? { ...c, referrer: { ...c.referrer, person: '青葉（架空）' } } : c)),
});

const rok = (r: RosterImportResult | ImportError): RosterImportResult => {
  if ('code' in r) throw new Error(`読み込めなかった：${r.message}`);
  return r;
};

describe('全体のブック', () => {
  it('列は「紹介元」の次。書き出し → 読み込みで同じに戻り、空の人は欄を省く', async () => {
    const d = withPerson(base());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await toBuffer(d));
    const ws = sheet(wb, personSheetNames(d.org.terms).client);
    expect(col(ws, PERSON)).toBe(col(ws, '紹介元') + 1);
    expect(ws.getRow(2).getCell(col(ws, PERSON)).value).toBe('青葉（架空）');
    const r = ok(await importWorkbook(await toBuffer(d), d));
    expect(r.clients[0]!.referrer.person).toBe('青葉（架空）');
    expect('person' in r.clients[1]!.referrer).toBe(false);
  });

  it('列が無い古いブックは省く（今のデータと同じ形）', async () => {
    const d = withPerson(base());
    const r = ok(
      await editAndImport(d, (wb) => {
        const ws = sheet(wb, personSheetNames(d.org.terms).client);
        ws.spliceColumns(col(ws, PERSON), 1);
      }),
    );
    expect(r.clients.every((c) => !('person' in c.referrer))).toBe(true);
  });
});

describe('名簿のブック', () => {
  it('書き出し → 読み込みで変わらない。列で入れた値を読み、列が無ければ今のまま', async () => {
    const d = withPerson(base());
    const same = rok(
      await importRoster(await (await exportRosterWorkbook(d, 'client')).arrayBuffer(), d, 'client', 'merge'),
    );
    expect(same.updated).toEqual([]);
    expect(same.data).toEqual(d);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await (await exportRosterWorkbook(d, 'client')).arrayBuffer());
    const ws = sheet(wb, personSheetNames(d.org.terms).client);
    ws.getCell(3, col(ws, PERSON)).value = '泉（架空）';
    ws.getCell(2, col(ws, PERSON)).value = null;
    const r = rok(await importRoster((await wb.xlsx.writeBuffer()) as ArrayBuffer, d, 'client', 'merge'));
    expect(r.data.clients[1]!.referrer.person).toBe('泉（架空）');
    expect('person' in r.data.clients[0]!.referrer).toBe(false);

    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(await (await exportRosterWorkbook(d, 'client')).arrayBuffer());
    const ws2 = sheet(wb2, personSheetNames(d.org.terms).client);
    ws2.spliceColumns(col(ws2, PERSON), 1);
    const kept = rok(await importRoster((await wb2.xlsx.writeBuffer()) as ArrayBuffer, d, 'client', 'merge'));
    expect(kept.data.clients[0]!.referrer.person).toBe('青葉（架空）');
  });
});

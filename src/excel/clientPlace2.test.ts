// 〈利用者さん〉の期間つきの訪問先（住所2。PRD D439。ADR-0105）の列：全体のブックと名簿のブック
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { DemoData, ImportError, RosterImportResult } from '../contracts/data';
import { base, col, editAndImport, fail, ok, sheet, toBuffer, withoutPlans } from './excel.testkit';
import { exportRosterWorkbook, importRoster, importWorkbook } from './index';
import { personSheetNames } from './text';

const P2 = {
  address: '架空市駅前2丁目',
  postalCode: '1000005',
  lat: 35.6,
  lng: 139.6,
  from: '2026-08-01',
  to: '2026-08-30',
};

/** 1人目に住所2 */
const withPlace2 = (d: DemoData): DemoData => ({
  ...d,
  clients: d.clients.map((c, i) => (i === 0 ? { ...c, place2: P2 } : c)),
});

const rok = (r: RosterImportResult | ImportError): RosterImportResult => {
  if ('code' in r) throw new Error(`読み込めなかった：${r.message}`);
  return r;
};

describe('全体のブック', () => {
  it('書き出し → 読み込みで同じに戻る（無い人は空・住所2 なし）', async () => {
    const d = withPlace2(base());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await toBuffer(d));
    const ws = sheet(wb, personSheetNames(d.org.terms).client);
    expect(ws.getRow(2).getCell(col(ws, '住所2')).value).toBe(P2.address);
    expect(ws.getRow(2).getCell(col(ws, '住所2の開始日')).value).toBe('2026-08-01');
    const r = ok(await importWorkbook(await toBuffer(d), d));
    expect(r.clients[0]!.place2).toEqual(P2);
    expect('place2' in r.clients[1]!).toBe(false);
    expect(r).toEqual(withoutPlans(d));
  });

  it('列が無い古いブックは住所2 なし。読めない日付・逆の期間は行付きで止める', async () => {
    const d = withPlace2(base());
    const r = ok(
      await editAndImport(d, (wb) => {
        const ws = sheet(wb, personSheetNames(d.org.terms).client);
        ws.spliceColumns(col(ws, '住所2'), 6);
      }),
    );
    expect(r.clients.every((c) => c.place2 === undefined)).toBe(true);
    const bad = fail(
      await editAndImport(d, (wb) => {
        const ws = sheet(wb, personSheetNames(d.org.terms).client);
        ws.getRow(2).getCell(col(ws, '住所2の終了日')).value = '2026-07-01';
      }),
    );
    expect(bad).toContain('住所2の終了日');
    expect(bad).toContain('開始日より前');
  });
});

describe('名簿のブック', () => {
  it('書き出し → 読み込みで変わらない。列が無ければ今のまま、住所2 を空にすれば無し', async () => {
    const d = withPlace2(base());
    const buf = await (await exportRosterWorkbook(d, 'client')).arrayBuffer();
    const same = rok(await importRoster(buf, d, 'client', 'merge', '2026-08-15'));
    expect(same.updated).toEqual([]);
    expect(same.data.clients[0]!.place2).toEqual(P2);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0]!;
    ws.getRow(2).getCell(col(ws, '住所2')).value = null;
    const out = Buffer.from(await wb.xlsx.writeBuffer());
    const cleared = rok(
      await importRoster(
        out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer,
        d,
        'client',
        'merge',
        '2026-08-15',
      ),
    );
    expect(cleared.data.clients[0]!.place2).toBeUndefined();
  });
});

// 名簿のブックの「書き方」「記入例」のシート（PRD D103）
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { DemoData, RosterKind } from '../contracts/data';
import { applyTemplate } from '../lib/features';
import { createBlankData, REGULAR_VISIT_TYPES } from '../seed/blank';
import { base, sheet } from './excel.testkit';
import { exportRosterWorkbook, importRoster } from './index';
import { personSheetNames } from './text';

const KINDS: RosterKind[] = ['client', 'staff'];

async function load(d: DemoData, kind: RosterKind): Promise<{ wb: ExcelJS.Workbook; buf: ArrayBuffer }> {
  const buf = await (await exportRosterWorkbook(d, kind)).arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf.slice(0));
  return { wb, buf };
}

/** 項目はそのままで、人だけいない（テンプレート） */
const noPeople = (): DemoData => ({ ...base(), staff: [], clients: [], visits: [] });

const text = (v: ExcelJS.CellValue): string => (typeof v === 'string' ? v : String(v ?? ''));

describe('名簿のブックの書き方・記入例', () => {
  it('人のシート・書き方・記入例の順で、人がいても0人でも付く', async () => {
    for (const d of [base(), noPeople()]) {
      for (const kind of KINDS) {
        const { wb } = await load(d, kind);
        expect(wb.worksheets.map((w) => w.name)).toEqual([personSheetNames(d.org.terms)[kind], '書き方', '記入例']);
      }
    }
  });

  it('書き方に手順と全列の行（列名・何を書くか・例・空のとき）がある', async () => {
    const d = base();
    for (const kind of KINDS) {
      const { wb } = await load(d, kind);
      const name = personSheetNames(d.org.terms)[kind];
      const guide = sheet(wb, '書き方');
      expect(text(guide.getCell(1, 1).value)).toBe(`『${name}』のシートに1行に1人ずつ書きます。`);
      expect(text(guide.getCell(2, 1).value)).toContain('［CSV・Excel を読み込む］');
      expect(text(guide.getCell(4, 1).value)).toContain('読み込みません');
      const headerRow = [1, 2, 3, 4].map((c) => text(guide.getCell(6, c).value));
      expect(headerRow).toEqual(['列の名前', '何を書くか', '例', '空のとき']);
      const listed = new Map<string, ExcelJS.Row>();
      guide.eachRow((r, n) => {
        if (n > 6) listed.set(text(r.getCell(1).value), r);
      });
      const headers = (sheet(wb, name).getRow(1).values as ExcelJS.CellValue[]).slice(1).map(text);
      expect([...listed.keys()]).toEqual(headers);
      for (const r of listed.values()) expect(text(r.getCell(2).value)).not.toBe('');
      // 既定値が入るのは新しい人の空だけ（今いる人の行の空は今までどおり）
      if (kind === 'staff') expect(text(listed.get('移動手段')?.getCell(4).value)).toBe('新しい人で空なら車');
      if (kind === 'client') expect(text(listed.get('段階')?.getCell(4).value)).toBe('新しい人で空なら利用中');
      expect(text(listed.get('住所')?.getCell(4).value)).toBe('空のまま');
    }
  });

  it('勤務の「空のとき」は使い方の既定（単発の予約は毎日 7:00〜22:00、ほかは月〜金 9:00〜18:00。PRD D428）', async () => {
    const blankOf = async (d: DemoData) => {
      const guide = sheet((await load(d, 'staff')).wb, '書き方');
      const out = new Map<string, string>();
      guide.eachRow((r) => out.set(text(r.getCell(1).value), text(r.getCell(4).value)));
      return [out.get('勤務する曜日'), out.get('勤務開始'), out.get('勤務終了')];
    };
    const d = base();
    expect(await blankOf({ ...d, org: { ...d.org, features: applyTemplate('oneOff') } })).toEqual([
      '新しい人で空なら 毎日',
      '新しい人で空なら 7:00',
      '新しい人で空なら 22:00',
    ]);
    expect(await blankOf({ ...d, org: { ...d.org, features: applyTemplate('basic') } })).toEqual([
      '新しい人で空なら 月火水木金',
      '新しい人で空なら 9:00',
      '新しい人で空なら 18:00',
    ]);
  });

  it('項目の列は今のデータの項目から作る', async () => {
    const d = base();
    const { wb } = await load(d, 'staff');
    const keys = new Set<string>();
    sheet(wb, '書き方').eachRow((r) => keys.add(text(r.getCell(1).value)));
    for (const it of d.items.filter((i) => i.target === 'staff'))
      expect(keys.has(`特性：${it.name}`) || [...keys].some((k) => k.startsWith(`特性：${it.name}`))).toBe(true);
    for (const it of d.items.filter((i) => i.target === 'client')) expect(keys.has(`必要条件：${it.name}`)).toBe(true);
  });

  it('記入例は人のシートと同じ列で、名前は「記入例」で始まる', async () => {
    const d = base();
    for (const kind of KINDS) {
      const { wb } = await load(d, kind);
      const name = personSheetNames(d.org.terms)[kind];
      const sample = sheet(wb, '記入例');
      expect(sample.getRow(1).values).toEqual(sheet(wb, name).getRow(1).values);
      expect(sample.rowCount).toBeGreaterThanOrEqual(3);
      const nameCol = kind === 'staff' ? '名前' : '表示名';
      const c = (sample.getRow(1).values as ExcelJS.CellValue[]).indexOf(nameCol);
      for (let n = 2; n <= sample.rowCount; n++) expect(text(sample.getRow(n).getCell(c).value)).toMatch(/^記入例 /);
    }
  });

  it('書き出したブックをそのまま読み込んでも、記入例の人は足されない', async () => {
    for (const d of [base(), noPeople()]) {
      for (const kind of KINDS) {
        const { buf } = await load(d, kind);
        const r = await importRoster(buf, d, kind, 'merge');
        // 人のいないテンプレートは「行がありません」で止まる（記入例を読んでいれば足されてしまう）
        if ('code' in r) {
          expect(d.staff.length + d.clients.length).toBe(0);
          expect(r.message).toContain('行がありません');
          continue;
        }
        expect(r.added).toEqual([]);
        expect(JSON.stringify(r.data)).not.toContain('記入例');
      }
    }
  });

  it('0人のテンプレートに名前だけ書き足すと読める', async () => {
    const d = noPeople();
    for (const kind of KINDS) {
      const { wb } = await load(d, kind);
      const ws = sheet(wb, personSheetNames(d.org.terms)[kind]);
      const nameCol = kind === 'staff' ? 2 : 2;
      ws.getRow(2).getCell(nameCol).value = '山田 花子';
      const r = await importRoster((await wb.xlsx.writeBuffer()) as ArrayBuffer, d, kind, 'merge');
      if ('code' in r) throw new Error(r.message);
      expect(r.added).toHaveLength(1);
      const added = kind === 'staff' ? r.data.staff : r.data.clients;
      expect(added).toHaveLength(1);
    }
  });
});

describe('空の事業所のデータでも書き出せる', () => {
  it('項目が無くても書き方・記入例が付く', async () => {
    const d = createBlankData(
      '2026-10-13',
      { industry: 'care', terms: base().org.terms, features: base().org.features },
      REGULAR_VISIT_TYPES,
    );
    for (const kind of KINDS) {
      const { wb } = await load(d, kind);
      expect(wb.worksheets).toHaveLength(3);
    }
  });
});

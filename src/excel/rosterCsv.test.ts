// 名簿の CSV（ADR-0068）：書き出し → 読み込みで変わらない・文字コードを見分ける・名簿のブックと同じ読み方
import { describe, expect, it } from 'vitest';
import type { ImportError, RosterImportResult } from '../contracts/data';
import { decodeText, parseCsv, toCsv } from '../lib/csv';
import { base } from './excel.testkit';
import { exportRosterCsv, importRoster } from './index';

const rok = (r: RosterImportResult | ImportError): RosterImportResult => {
  if ('code' in r) throw new Error(`読み込めなかった：${r.message}`);
  return r;
};
const csvBuf = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

describe('名簿の CSV（ADR-0068）', () => {
  it('書き出しは BOM 付きの UTF-8 で、読み込むと変わらない（すべて変更なし。データも同じ）', async () => {
    const d = base();
    for (const kind of ['client', 'staff'] as const) {
      const buf = await exportRosterCsv(d, kind).arrayBuffer();
      expect([...new Uint8Array(buf.slice(0, 3))]).toEqual([0xef, 0xbb, 0xbf]);
      const r = rok(await importRoster(buf, d, kind, 'merge'));
      expect(r.source).toEqual({ format: 'csv', encoding: 'UTF-8' });
      expect(r.added).toEqual([]);
      expect(r.updated).toEqual([]);
      expect(r.unchanged).toBe(kind === 'client' ? d.clients.length : d.staff.length);
      expect(r.data).toEqual(d);
    }
  });

  it('CSV で直した名前・足した行が入る（ID の空の行は新しい人）', async () => {
    const d = base();
    const { text } = decodeText(new Uint8Array(await exportRosterCsv(d, 'staff').arrayBuffer()));
    const rows = parseCsv(text);
    const head = rows[0]!;
    const nameAt = head.indexOf('名前');
    const idAt = head.indexOf('ID');
    // 足す行は1人目の写し（ID は空・名前は別）
    const added = [...rows[1]!];
    added[idAt] = '';
    added[nameAt] = '足した人';
    rows[1]![nameAt] = '名前を直した人';
    rows.push(added);
    const r = rok(await importRoster(csvBuf(toCsv(rows)), d, 'staff', 'merge'));
    expect(r.updated).toEqual(['名前を直した人']);
    expect(r.added).toEqual(['足した人']);
    expect(r.data.staff.find((s) => s.id === rows[1]![idAt])?.name).toBe('名前を直した人');
  });

  it("Excel で開いて保存し先頭の0が落ちた郵便番号は7桁に戻す。数式よけの「'」は外す", async () => {
    const d = base();
    const c = d.clients[0]!;
    d.clients[0] = { ...c, place: { ...c.place, postalCode: '0380000' }, note: '-鍵はポスト' };
    const { text } = decodeText(new Uint8Array(await exportRosterCsv(d, 'client').arrayBuffer()));
    expect(text).toContain("'-鍵はポスト");
    const rows = parseCsv(text);
    const at = rows[0]!.indexOf('郵便番号');
    rows[1]![at] = '380000';
    const r = rok(await importRoster(csvBuf(toCsv(rows)), d, 'client', 'merge'));
    expect(r.updated).toEqual([]);
    expect(r.data.clients[0]?.place.postalCode).toBe('0380000');
    expect(r.data.clients[0]?.note).toBe('-鍵はポスト');
  });

  it('全体の列が無い CSV（名前だけ）でも読み、知らない列は場所付きで止める', async () => {
    const d = base();
    const r = rok(await importRoster(csvBuf('名前\r\n新しい人\r\n'), d, 'staff', 'merge'));
    expect(r.added).toEqual(['新しい人']);
    const bad = await importRoster(csvBuf('名前,特性：知らない項目\r\n新しい人,あり\r\n'), d, 'staff', 'merge');
    expect('code' in bad && bad.message).toContain('知らない項目');
  });

  it('壊れた .xlsx・空の CSV は読めないと返す（データは変えない）', async () => {
    const d = base();
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]).buffer;
    expect(await importRoster(zip, d, 'client', 'merge')).toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await importRoster(csvBuf(''), d, 'client', 'merge')).toMatchObject({
      message: 'CSV のファイルが空です',
    });
  });
});

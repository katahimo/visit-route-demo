// 予約の CSV の読み込みの文（ADR-0075。PRD D408）
import { describe, expect, it } from 'vitest';
import type { BookingImportResult, DemoData } from '../contracts/data';
import {
  bookingConfirmBody,
  bookingDoneText,
  bookingHasChanges,
  bookingProblems,
  bookingSummary,
  pastUnassignedCount,
  pastUnassignedNote,
} from './bookingScreen';

const result = (over: Partial<BookingImportResult> = {}): BookingImportResult => ({
  data: {} as DemoData,
  added: 2,
  updated: 1,
  removed: 0,
  keptMissing: false,
  unchanged: 3,
  cancelledSkipped: 0,
  unmatched: [],
  badRows: [],
  source: { format: 'csv', encoding: 'UTF-16LE' },
  otherForm: { label: '予約システムの予約', skippedColumns: ['支払金額'] },
  ...over,
});
const keep = { kept: true, why: null };

describe('予約の読み込みの文', () => {
  it('件数と変更の有無', () => {
    expect(bookingSummary(result())).toBe('追加 2件・更新 1件・削除 0件・変更なし 3件');
    expect(bookingHasChanges(result())).toBe(true);
    expect(bookingHasChanges(result({ added: 0, updated: 0 }))).toBe(false);
    expect(bookingHasChanges(result({ added: 0, updated: 0, removed: 1 }))).toBe(true);
  });

  it('入れなかった予約・読めなかった行は5件まで出し、残りは件数', () => {
    expect(bookingProblems(result(), 'お客様')).toEqual([]);
    const names = ['A（1件）', 'B（1件）', 'C（1件）', 'D（1件）', 'E（1件）', 'F（2件）', 'G（1件）'];
    expect(bookingProblems(result({ unmatched: names, badRows: ['3行目：予約日がありません'] }), 'お客様')).toEqual([
      '入れなかった行（お客様に名前が無い・同じ名前が2人以上）：A（1件）・B（1件）・C（1件）・D（1件）・E（1件） ほか 2件',
      '読めなかった行：3行目：予約日がありません',
    ]);
  });

  it('勤務に入らない予約の文があれば、入れなかった行の次に添える（PRD D428）', () => {
    const lines = bookingConfirmBody({
      fileName: 'a.csv',
      r: result(),
      clientTerm: 'お客様',
      keep,
      outsideNote:
        '1件はどのシッターの勤務日・時間にも入りません（勤務時間外 1。例：11/5（木）17:00〜20:00）。シッターの勤務時間を広げると組めます',
    }).split('\n');
    expect(lines[2]).toContain('1件はどのシッターの勤務日・時間にも入りません');
  });

  it('この読み込みで足した・直した今日より前の担当なしだけ数える（取り消し・担当あり・前からある訪問は数えない。PRD D372）', () => {
    const v = (id: string, date: string, staffId: string | null, cancelled = false) => ({
      id,
      date,
      staffId,
      cancelled,
    });
    const old = v('old', '2026-11-01', null);
    const before = { visits: [old] } as unknown as Pick<DemoData, 'visits'>;
    const after = {
      visits: [
        old,
        v('a', '2026-11-06', null),
        v('b', '2026-11-06', 's1'),
        v('c', '2026-11-05', null, true),
        v('d', '2026-11-07', null),
      ],
    } as unknown as Pick<DemoData, 'visits'>;
    expect(pastUnassignedCount(before, after, '2026-11-07')).toBe(1);
    expect(pastUnassignedNote(0)).toBeNull();
    const note = pastUnassignedNote(13)!;
    expect(note).toContain('今日より前の日の担当なし 13件は、担当なしのまま入ります（今日より前の訪問は見るだけです');
    const body = bookingConfirmBody({ fileName: 'a.csv', r: result(), clientTerm: 'お客様', keep, pastNote: note });
    expect(body).toContain(note);
  });

  it('確認の本文に形・読まなかった列・担当なしを出す（文字コードは出さない）', () => {
    const body = bookingConfirmBody({ fileName: 'Reserve.csv', r: result(), clientTerm: 'お客様', keep });
    expect(body).toContain('「Reserve.csv」を訪問として読み込みます（予約システムの予約の CSV）。');
    expect(body).not.toContain('文字コード');
    expect(body).toContain('読まなかった列：支払金額');
    expect(body).toContain('総入れ替えです');
    expect(body).not.toContain('取り消し済みで');
    expect(
      bookingConfirmBody({ fileName: 'a.csv', r: result({ cancelledSkipped: 2 }), clientTerm: 'お客様', keep }),
    ).toContain('取り消し済みで、まだ入れていない 2件は入れません。');
    expect(body).toContain('直前の状態に戻す');
  });

  it('知らせ（控えを残せなければ理由を添える）', () => {
    expect(bookingDoneText(result(), keep)).toBe(
      '訪問を読み込みました（追加 2件・更新 1件・削除 0件）。担当なしは自動で組みます',
    );
    expect(bookingDoneText(result(), { kept: false, why: '容量が足りません' })).toContain('（容量が足りません）');
  });
});

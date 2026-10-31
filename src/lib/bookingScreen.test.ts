// 予約の CSV の読み込みの文（ADR-0075。PRD D398）
import { describe, expect, it } from 'vitest';
import type { BookingImportResult, DemoData } from '../contracts/data';
import {
  bookingConfirmBody,
  bookingDoneText,
  bookingHasChanges,
  bookingProblems,
  bookingSummary,
} from './bookingScreen';

const result = (over: Partial<BookingImportResult> = {}): BookingImportResult => ({
  data: {} as DemoData,
  added: 2,
  updated: 1,
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
    expect(bookingSummary(result())).toBe('追加 2件・更新 1件・変更なし 3件');
    expect(bookingHasChanges(result())).toBe(true);
    expect(bookingHasChanges(result({ added: 0, updated: 0 }))).toBe(false);
  });

  it('入れなかった予約・読めなかった行は5件まで出し、残りは件数', () => {
    expect(bookingProblems(result(), 'お客様')).toEqual([]);
    const names = ['A（1件）', 'B（1件）', 'C（1件）', 'D（1件）', 'E（1件）', 'F（2件）', 'G（1件）'];
    expect(bookingProblems(result({ unmatched: names, badRows: ['3行目：予約日がありません'] }), 'お客様')).toEqual([
      '入れなかった予約（お客様に名前が無い・同じ名前が2人以上）：A（1件）・B（1件）・C（1件）・D（1件）・E（1件） ほか 2件',
      '読めなかった行：3行目：予約日がありません',
    ]);
  });

  it('確認の本文に形・文字コード・読まなかった列・担当なしを出す', () => {
    const body = bookingConfirmBody({ fileName: 'Reserve.csv', r: result(), clientTerm: 'お客様', keep });
    expect(body).toContain(
      '「Reserve.csv」の予約を訪問として読み込みます。CSV（文字コード UTF-16LE）・予約システムの予約の形として読みました。',
    );
    expect(body).toContain('読まなかった列：支払金額');
    expect(body).toContain('担当は決めません');
    expect(body).not.toContain('取り消し済みの予約');
    expect(
      bookingConfirmBody({ fileName: 'a.csv', r: result({ cancelledSkipped: 2 }), clientTerm: 'お客様', keep }),
    ).toContain('取り消し済みの予約 2件は入れません。');
    expect(body).toContain('直前の状態に戻す');
  });

  it('知らせ（控えを残せなければ理由を添える）', () => {
    expect(bookingDoneText(result(), { expert: true }, keep)).toBe(
      '予約を読み込みました（追加 2件・更新 1件）。担当は「担当を組む」で組めます',
    );
    expect(bookingDoneText(result(), { expert: false }, keep)).toContain('予定の上の要対応の帯の「担当なしを組む」');
    expect(bookingDoneText(result(), { expert: true }, { kept: false, why: '容量が足りません' })).toContain(
      '（容量が足りません）',
    );
  });
});

// 日の予定のメールの欄の行と確定の文：lib/dayMail
import { describe, expect, it } from 'vitest';
import { client, DATE, makeData, staff, visit } from '../matching/fixtures';
import { dayMailProgress, dayMailRows, sendableKeys } from './dayMail';
import { MAILTO_LIMIT } from './mailto';

const data = () =>
  makeData({
    staff: [
      staff('s2', 38.27, 140.88, { name: '佐藤 一' }),
      staff('s1', 38.26, 140.87, { name: '山田 花', email: 'hana@example.com' }),
      staff('s3', 38.27, 140.88, { name: '鈴木 三', email: 's3@example.com' }),
    ],
    clients: [client('c1', 38.265, 140.875, { displayName: '青葉', keyNote: 'キーボックス 1234', entryNote: '2回' })],
    visits: [
      visit('v1', 'c1', '13:00', '13:00', { windowKind: 'fixed', staffId: 's1' }),
      visit('v2', 'c1', '09:00', '09:00', { windowKind: 'fixed', staffId: 's2' }),
    ],
  });
const opts = { notesOn: true, mapsOn: true, includeKeys: false, confirming: false, limit: MAILTO_LIMIT };

describe('dayMailRows（日の予定のメールの行）', () => {
  it('その日に訪問のある人を名前の順に。アドレスの無い人はメール無し', () => {
    const { rows, mailSource } = dayMailRows(data(), DATE, opts);
    expect(rows.map((r) => r.key)).toEqual(['s2', 's1']);
    expect(rows.map((r) => r.summary)).toEqual(['訪問 1件', '訪問 1件']);
    expect(rows[0]?.mail).toBeNull();
    expect(rows[1]?.mail).not.toBeNull();
    expect(mailSource).toBe('plan');
    expect(sendableKeys(rows)).toEqual(['s1']);
  });
  it('確定の欄から送るなら「確定した担当」。鍵は選んだときだけ、決まりごとを切れば入れない', () => {
    const body = (o: Partial<typeof opts>) =>
      dayMailRows(data(), DATE, { ...opts, ...o }).rows[1]?.mail?.fullBody ?? '';
    expect(dayMailRows(data(), DATE, { ...opts, confirming: true }).mailSource).toBe('confirmed');
    expect(body({ includeKeys: true })).toContain('キーボックス 1234');
    expect(body({})).not.toContain('キーボックス 1234');
    expect(body({ notesOn: false, includeKeys: true })).not.toContain('キーボックス 1234');
    expect(body({ notesOn: false })).not.toContain('入り方');
  });
});

describe('dayMailProgress（確定の文）', () => {
  it('確定済み・送れる人がいない・元に戻したあと・途中', () => {
    const x = { state: 'none' as const, sendable: 2, sent: 1, autoDone: false };
    expect(dayMailProgress({ ...x, state: 'told' })).toBe('この日は確定（伝えた）済みです。');
    expect(dayMailProgress({ ...x, sendable: 0 })).toContain('メールを送れる人がいません');
    expect(dayMailProgress({ ...x, autoDone: true })).toContain('確定を元に戻しました');
    expect(dayMailProgress(x)).toBe('メールを作った人 1/2人。全員分を作ると、この日を確定（伝えた）にします。');
    expect(dayMailProgress({ ...x, state: 'changed' })).toContain('（伝えたあとの変更も伝えた扱い）');
  });
});

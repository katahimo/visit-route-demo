// 連絡を貼り付けて入れるの読み（PRD D418。ADR-0084）
import { describe, expect, it } from 'vitest';
import { client, staff } from '../matching/fixtures.testkit';
import {
  absenceSpan,
  findPerson,
  type NoticeAction,
  noticePeople,
  READ_REASONS,
  readNotice,
  readNotices,
  resolveDate,
  timeOf,
} from './pasteNotices';

/** 今日（月曜） */
const TODAY = '2026-10-12';

const people = noticePeople(
  [
    staff('s1', 0, 0, { name: '田中 花子' }),
    staff('s2', 0, 0, { name: '佐藤 次郎' }),
    staff('s3', 0, 0, { name: '鈴木 一' }),
    staff('s4', 0, 0, { name: '鈴木 二郎' }),
    staff('s9', 0, 0, { name: '休止 中', active: false }),
  ],
  [
    client('c1', 0, 0, { displayName: '図書館 ふみ', kana: 'としょかん ふみ' }),
    client('c2', 0, 0, { displayName: '泉図書館 いずみ', kana: 'いずみとしょかん いずみ' }),
    client('c3', 0, 0, { displayName: '山田 太郎' }),
  ],
);

const read = (line: string) => readNotice(line, people, TODAY);
const action = (line: string): NoticeAction | null => read(line)?.action ?? null;
const reason = (line: string): string | null => read(line)?.reason ?? null;

describe('日付', () => {
  it('年のある日付はそのまま、実在しなければ null', () => {
    expect(resolveDate({ y: 2026, m: 12, d: 3 }, TODAY)).toBe('2026-12-03');
    expect(resolveDate({ y: 2026, m: 2, d: 30 }, TODAY)).toBeNull();
  });
  it('年の無い日付は今日以降でいちばん近い日（今日を含む）', () => {
    expect(resolveDate({ y: null, m: 12, d: 3 }, TODAY)).toBe('2026-12-03');
    expect(resolveDate({ y: null, m: 10, d: 12 }, TODAY)).toBe('2026-10-12');
    expect(resolveDate({ y: null, m: 10, d: 11 }, TODAY)).toBe('2027-10-11');
    expect(resolveDate({ y: null, m: 2, d: 29 }, TODAY)).toBe('2028-02-29');
    expect(resolveDate({ y: null, m: 13, d: 1 }, TODAY)).toBeNull();
  });
  it('日だけは今月か、その日のある次の月', () => {
    expect(resolveDate({ y: null, m: null, d: 20 }, TODAY)).toBe('2026-10-20');
    expect(resolveDate({ y: null, m: null, d: 3 }, TODAY)).toBe('2026-11-03');
    expect(resolveDate({ y: null, m: null, d: 31 }, '2026-11-05')).toBe('2026-12-31');
    expect(resolveDate({ y: null, m: null, d: 40 }, TODAY)).toBeNull();
  });
  it('行の日付の書き方：12/3・12月3日・2026/12/3・2026年12月3日・3日・全角・曜日つき', () => {
    for (const line of [
      '12/3 田中 休み',
      '12月3日 田中 休み',
      '2026/12/3 田中 休み',
      '2026年12月3日 田中 休み',
      '2026-12-03 田中 休み',
      '１２／３ 田中 休み',
      '12/3（木）田中 休み',
      '12/3(木曜) 田中 休み',
    ])
      expect(action(line), line).toMatchObject({ kind: 'absence', date: '2026-12-03' });
    expect(action('20日 田中 休み')).toMatchObject({ date: '2026-10-20' });
  });
  it('日付が無い・読めない・過ぎた日・2つ', () => {
    expect(reason('田中 休み')).toBe(READ_REASONS.noDate);
    expect(reason('2026/2/30 田中 休み')).toBe(READ_REASONS.badDate);
    expect(reason('2026/10/1 田中 休み')).toBe(READ_REASONS.past);
    expect(reason('12/3 12/4 田中 休み')).toBe(READ_REASONS.twoDates);
  });
});

describe('名前', () => {
  it('名前・姓・よみで当てる。様・さんは付いていてもよい。空白の有無を問わない', () => {
    expect(action('12/3 田中花子 休み')).toMatchObject({ staffId: 's1' });
    expect(action('12/3 田中さん 休み')).toMatchObject({ staffId: 's1' });
    expect(action('12/3 図書館様 中止')).toMatchObject({ kind: 'cancel', clientId: 'c1' });
    expect(action('12/3 としょかん ふみ様 中止')).toMatchObject({ clientId: 'c1' });
    expect(action('12/3 トショカン様 キャンセル')).toMatchObject({ clientId: 'c1' });
    expect(action('12/3山田様キャンセル')).toMatchObject({ clientId: 'c3' });
  });
  it('長い名前の中の短い名前は数えない（泉図書館 と 図書館）', () => {
    expect(action('12/3 泉図書館様 中止')).toMatchObject({ clientId: 'c2' });
    expect(findPerson('いずみとしょかん', people)).toMatchObject({ person: { id: 'c2' } });
  });
  it('同じ姓が2人は読めない。名前まで書けば読める', () => {
    expect(reason('12/3 鈴木 休み')).toBe(READ_REASONS.sameName);
    expect(action('12/3 鈴木二郎 休み')).toMatchObject({ staffId: 's4' });
  });
  it('名前が無い・2つある・休止中の人は当てない', () => {
    expect(reason('12/3 高橋 休み')).toBe(READ_REASONS.noName);
    expect(reason('12/3 田中 佐藤 休み')).toBe(READ_REASONS.twoNames);
    expect(reason('12/3 休止 休み')).toBe(READ_REASONS.noName);
  });
  it('名前と言葉の読めない行は名前を返す', () => {
    expect(read('12/3 田中 よろしく')).toMatchObject({ name: '田中 花子', reason: READ_REASONS.noWord });
  });
});

describe('言葉と時間帯', () => {
  it('〈スタッフ〉＋休み・休・欠勤・希望休＝その日の欠勤（終日）。希望休はメモ「希望休」', () => {
    for (const w of ['休み', '休', '欠勤', 'お休み', 'やすみ'])
      expect(action(`12/3 田中 ${w}`), w).toEqual({
        kind: 'absence',
        staffId: 's1',
        date: '2026-12-03',
        from: null,
        to: null,
        note: '',
      });
    expect(action('12/3 田中 希望休')).toMatchObject({ from: null, to: null, note: '希望休' });
    expect(action('12/3 田中 希望休 午前')).toMatchObject({ from: null, to: null, note: '希望休' });
  });
  it('時間帯：午前・午後・〇時から・〇時まで・時刻〜時刻', () => {
    expect(action('12/3 田中 午前 休み')).toMatchObject({ from: null, to: '12:00' });
    expect(action('12/3 田中 午後休み')).toMatchObject({ from: '12:00', to: null });
    expect(action('12/3 田中 10時から休み')).toMatchObject({ from: '10:00', to: null });
    expect(action('12/3 田中 15時まで欠勤')).toMatchObject({ from: null, to: '15:00' });
    expect(action('12/3 田中 10:00〜12:00 休み')).toMatchObject({ from: '10:00', to: '12:00' });
    expect(action('12/3 田中 10時半～12時 休み')).toMatchObject({ from: '10:30', to: '12:00' });
    expect(action('12/3 田中 午後3時から休み')).toMatchObject({ from: '15:00', to: null });
  });
  it('時刻の文', () => {
    expect(timeOf('9時')).toBe('09:00');
    expect(timeOf('9:30')).toBe('09:30');
    expect(timeOf('10時30分')).toBe('10:30');
    expect(timeOf('午後1時半')).toBe('13:30');
    expect(timeOf('25時')).toBeNull();
    expect(absenceSpan(' 何も ')).toEqual({ from: null, to: null, bad: false, text: '' });
    expect(reason('12/3 田中 25時から休み')).toBe(READ_REASONS.badTime);
  });
  it('〈利用者さん〉＋中止・キャンセル・休み・お休み＝その日の訪問の取り消し', () => {
    for (const w of ['中止', 'キャンセル', '休み', 'お休み'])
      expect(action(`12/3 山田様 ${w}`), w).toEqual({ kind: 'cancel', clientId: 'c3', date: '2026-12-03' });
    expect(action('12/3 山田様 ワクチンで中止')).toMatchObject({ kind: 'cancel' });
  });
  it('〈利用者さん〉＋入院・ショート＋期間＝休み（メモは理由）', () => {
    expect(action('12/3〜12/10 山田様 入院')).toEqual({
      kind: 'leave',
      clientId: 'c3',
      from: '2026-12-03',
      to: '2026-12-10',
      note: '入院',
    });
    expect(action('12/3 山田様 ショートステイ 〜12/10')).toMatchObject({
      from: '2026-12-03',
      to: '2026-12-10',
      note: 'ショートステイ',
    });
    expect(action('山田様 入院のためお休み 〜12/10')).toMatchObject({ kind: 'leave', from: TODAY, to: '2026-12-10' });
    expect(action('山田様 12/10まで入院')).toMatchObject({ from: TODAY, to: '2026-12-10' });
    // 終わりの年が無ければ始まりの日以降でいちばん近い日
    expect(action('12/28〜1/5 山田様 入院')).toMatchObject({ from: '2026-12-28', to: '2027-01-05' });
  });
  it('休みの終わりが無い・前後が逆・言葉が無い', () => {
    expect(reason('12/3 山田様 入院')).toBe(READ_REASONS.noEnd);
    expect(reason('2026/12/10〜2026/12/3 山田様 入院')).toBe(READ_REASONS.badDate);
    expect(reason('12/3 山田様 よろしく')).toBe(READ_REASONS.noWord);
    expect(reason('12/3 田中 入院')).toBe(READ_REASONS.noWord);
  });
});

describe('まとめて読む', () => {
  it('1行ずつ読み、空の行は飛ばす', () => {
    const rows = readNotices('12/3 田中 休み\n\n  \r\n11/5 山田様 中止\nお疲れさまです', people, TODAY);
    expect(rows.map((r) => r.reason)).toEqual([null, null, READ_REASONS.noDate]);
    expect(rows[2]!.line).toBe('お疲れさまです');
  });
});

// 組み方の標準の画面のための計算（行の並び・曜日・勤務中の人・登録の確認文）
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Pattern } from '../contracts/documents';
import { client, makeData, staff } from '../matching/fixtures.testkit';
import {
  effectiveDiff,
  endsBeforeIds,
  registerLines,
  standardRows,
  standardWeekdays,
  workingStaff,
} from './standardView';

const TODAY = '2026-10-07';
const MON = '2026-10-12';
const pattern = (over: Partial<Pattern> = {}): Pattern => ({
  id: 'p1',
  clientId: 'c1',
  typeId: null,
  weekdays: [1, 3],
  everyWeeks: 1,
  repeat: 'weekly',
  monthWeeks: [],
  dayTimes: [],
  windowKind: 'window',
  earliestStart: '09:00',
  latestStart: '12:00',
  durationMinutes: 60,
  from: '2026-10-01',
  to: null,
  usualStaffId: 's1',
  note: '',
  ...over,
});
const data = (over: Partial<DemoData> = {}): DemoData =>
  makeData({
    staff: [staff('s1', 38.26, 140.87)],
    clients: [client('c1', 38.261, 140.871)],
    visits: [],
    patterns: [pattern()],
    ...over,
  });

describe('standardView', () => {
  it('standardRows は〈利用者さん〉の名前順、同じなら最初の曜日（月曜はじまり）順', () => {
    const d = data({
      clients: [
        client('c1', 38.261, 140.871, { displayName: 'ん' }),
        client('c2', 38.261, 140.871, { displayName: 'あ' }),
      ],
      patterns: [
        pattern({ id: 'p1', clientId: 'c1', weekdays: [1] }),
        pattern({ id: 'p2', clientId: 'c2', weekdays: [0, 3] }),
        pattern({ id: 'p3', clientId: 'c2', weekdays: [2] }),
      ],
    });
    expect(standardRows(d, TODAY).map((p) => p.id)).toEqual(['p3', 'p2', 'p1']);
  });
  it('standardWeekdays は行が使う曜日だけを月曜はじまりで返す', () => {
    expect(standardWeekdays([{ weekdays: [0, 3] }, { weekdays: [1] }])).toEqual([1, 3, 0]);
    expect(standardWeekdays([])).toEqual([]);
  });
  it('workingStaff は勤務中の人だけを名前順に', () => {
    expect(
      workingStaff([
        { id: 'a', name: 'い', active: true },
        { id: 'b', name: 'あ', active: false },
        { id: 'c', name: 'あ', active: true },
      ]),
    ).toEqual([
      { id: 'c', name: 'あ' },
      { id: 'a', name: 'い' },
    ]);
  });
  it('endsBeforeIds・effectiveDiff は、いつからより前に終わる繰り返しのマスを除く', () => {
    const ends = endsBeforeIds(
      [
        { id: 'a', to: '2026-10-11' },
        { id: 'b', to: '2026-10-12' },
        { id: 'c', to: null },
      ],
      MON,
    );
    expect([...ends]).toEqual(['a']);
    const diff = [
      { patternId: 'a', weekday: 1, kind: 'staff' as const },
      { patternId: 'b', weekday: 1, kind: 'time' as const },
    ];
    expect(effectiveDiff(diff, ends)).toEqual([diff[1]]);
  });
  it('registerLines は件数・予定の扱い・考え方の行を並べ、空の行を入れない', () => {
    const changes = [
      { patternId: 'a', weekday: 1, kind: 'staff' as const },
      { patternId: 'a', weekday: 3, kind: 'time' as const },
      { patternId: 'b', weekday: 1, kind: 'time' as const },
    ];
    const plain = registerLines(changes, MON, 0, 'drop', null);
    expect(plain).toHaveLength(3);
    expect(plain[0]).toBe(
      '今の標準と違う 3か所（繰り返し 2件）を書き換えます。曜日で担当が違う繰り返しは曜日ごとに分けます。',
    );
    expect(plain[1]).toBe('10/12から先の予定は、この表の担当・時刻で並びます。');
    const full = registerLines(changes, MON, 2, 'pin', '品質重視');
    expect(full).toHaveLength(5);
    expect(full[2]).toBe('すでに入っている予定で新しい標準と違う 2件は、今の担当のまま固定（ピン）します。');
    expect(full[3]).toBe('標準の考え方（点数の基準）を「品質重視」にします。');
    expect(registerLines(changes, MON, 1, 'drop', null)[2]).toBe(
      'すでに入っている予定で新しい標準と違う 1件は、消して標準どおりにします。',
    );
  });
});

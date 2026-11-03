// 日の予定のチャット用の文（PRD D419。ADR-0085）の形
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { addDays } from '../domain/time';
import { client, DATE, makeData, staff, visit } from '../matching/fixtures.testkit';
import { dayChatText } from './chatText';

const NOTES = {
  entryNote: 'インターホンは2回',
  keyNote: 'キーボックス 1234',
  parkingNote: '前の道に停めない',
  cautionNote: '犬がいます',
};

/** 山田（s1）が泉（9:00）と青葉（13:00）、佐藤（s2）が宮城野（11:00）、担当なしが若林（15:00・90分）。履歴は past で足す */
function data(over: { past?: DemoData['visits']; told?: boolean } = {}): DemoData {
  return makeData({
    staff: [staff('s1', 38.26, 140.87, { name: '山田 花' }), staff('s2', 38.27, 140.88, { name: '佐藤 一' })],
    clients: [
      client('c1', 38.265, 140.875, {
        displayName: '青葉',
        place: { address: '仙台市青葉区1-1', lat: 38.265, lng: 140.875, postalCode: '' },
        ...NOTES,
      }),
      client('c2', 38.266, 140.876, { displayName: '泉', ...NOTES }),
      client('c3', 38.267, 140.877, { displayName: '宮城野' }),
      client('c4', 38.268, 140.878, { displayName: '若林' }),
    ],
    visits: [
      visit('v1', 'c1', '13:00', '13:00', { windowKind: 'fixed', staffId: 's1' }),
      visit('v2', 'c2', '09:00', '09:00', { windowKind: 'fixed', staffId: 's1' }),
      visit('v3', 'c3', '11:00', '11:00', { windowKind: 'fixed', staffId: 's2' }),
      visit('v4', 'c4', '15:00', '15:00', { windowKind: 'fixed', staffId: null, durationMinutes: 90 }),
      ...(over.past ?? []),
    ],
    ...(over.told ? { snapshots: { [DATE]: { date: DATE, at: 1, visits: [] } } } : {}),
  });
}

/** 先週 s1 が泉（c2）を担当した（泉は初めてでない） */
const past = [visit('p1', 'c2', '09:00', '09:00', { date: addDays(DATE, -7), staffId: 's1' })];

describe('dayChatText', () => {
  it('見出し・■名前（名前の順）・時刻・様・所要・担当なし。決まりごとは初めての訪問先の行の下だけ・住所は入れない・鍵は既定で入れない', () => {
    const text = dayChatText(data({ past }), DATE, { notesOn: true, includeKeys: false });
    expect(text).toBe(
      [
        '10/12（月）の予定',
        '■佐藤 一',
        '11:00 宮城野様（60分）',
        '■山田 花',
        ' 9:00 泉様（60分）',
        '13:00 青葉様（60分）',
        '   入り方：インターホンは2回',
        '   駐車場：前の道に停めない',
        '   注意：犬がいます',
        '■担当なし',
        '15:00 若林様（90分）',
      ].join('\n'),
    );
    expect(text).not.toContain('仙台市');
    expect(text).not.toContain('鍵');
  });

  it('鍵は「鍵の情報も入れる」のときだけ（初めての訪問先の行の下）', () => {
    const text = dayChatText(data({ past }), DATE, { notesOn: true, includeKeys: true });
    expect(text).toContain('13:00 青葉様（60分）\n   入り方：インターホンは2回\n   鍵：キーボックス 1234\n');
    expect(text.match(/鍵：/g)).toHaveLength(1);
  });

  it('訪問先の決まりごとを切っていれば決まりごとを添えない', () => {
    const text = dayChatText(data(), DATE, { notesOn: false, includeKeys: true });
    expect(text).not.toContain('入り方');
    expect(text).not.toContain('鍵');
  });

  it('伝えた日も、伝えていない日（今の担当）も、訪問の担当から作る', () => {
    const plan = dayChatText(data({ past }), DATE, { notesOn: true, includeKeys: false });
    const told = dayChatText(data({ past, told: true }), DATE, { notesOn: true, includeKeys: false });
    expect(told).toBe(plan);
    expect(plan).toContain('■佐藤 一\n11:00 宮城野様（60分）');
  });

  it('訪問が無い日は「訪問はありません」', () => {
    expect(dayChatText(data(), addDays(DATE, 1), { notesOn: true, includeKeys: false })).toBe(
      '10/13（火）の予定\n訪問はありません',
    );
  });
});

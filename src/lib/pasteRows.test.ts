// 連絡を貼り付けて入れるの一覧と書き込み（PRD D418。ADR-0084）
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import { client, DATE, makeData, staff, visit } from '../matching/fixtures.testkit';
import { findVisit } from '../patterns';
import { READ_REASONS } from './pasteNotices';
import {
  actionText,
  applyPasteRows,
  leaveOffReason,
  pasteApplyLabel,
  pasteCareCount,
  pasteDoneText,
  pasteRowKeys,
  pasteRows,
  ROW_REASONS,
} from './pasteRows';

/** DATE（2026-10-12）は月曜。s1・s2 は平日勤務（10/17 は土曜） */
const TUE = '2026-10-13';

function data(over: Partial<DemoData> = {}): DemoData {
  return makeData({
    staff: [staff('s1', 38.26, 140.87, { name: '田中 花子' }), staff('s2', 38.27, 140.88, { name: '佐藤 次郎' })],
    clients: [
      client('c1', 38.265, 140.875, { displayName: '山田 太郎' }),
      client('c2', 38.266, 140.876, { displayName: '川口 春' }),
    ],
    visits: [
      visit('v1', 'c1', '10:00', '10:00', { date: TUE, staffId: 's1', start: '10:00' }),
      visit('v2', 'c1', '14:00', '14:00', { date: TUE, staffId: 's2', start: '14:00' }),
      visit('v3', 'c2', '10:00', '10:00', { date: DATE, staffId: 's2', start: '10:00' }),
    ],
    ...over,
  });
}

let n = 0;
const ids = (prefix: string) => `${prefix}-${++n}`;

describe('一覧', () => {
  it('読めた行は読んだ内容、読めない行は理由', () => {
    const rows = pasteRows(data(), '10/13 田中 休み\n10/13 山田様 中止\n10/13〜10/20 川口様 入院\n田中 休み', DATE);
    expect(rows.map((r) => r.text)).toEqual([
      '10/13（火）田中 花子 終日の欠勤',
      '10/13（火）山田 太郎 訪問の取り消し（2件）',
      '10/13（火）〜10/20（火）川口 春 休み（入院）',
      '田中 休み',
    ]);
    expect(rows.map((r) => r.reason)).toEqual([null, null, null, READ_REASONS.noDate]);
    expect(rows[1]!.visitIds).toEqual(['v1', 'v2']);
  });

  it('内容の文：時間帯・希望休・取り消し1件', () => {
    expect(
      actionText({ kind: 'absence', staffId: 's1', date: TUE, from: '10:00', to: '12:00', note: '' }, '田中', DATE),
    ).toBe('10/13（火）田中 欠勤 10:00〜12:00');
    expect(
      actionText({ kind: 'absence', staffId: 's1', date: TUE, from: null, to: null, note: '希望休' }, '田中', DATE),
    ).toBe('10/13（火）田中 希望休');
    expect(actionText({ kind: 'cancel', clientId: 'c1', date: TUE }, '山田', DATE)).toBe(
      '10/13（火）山田 訪問の取り消し',
    );
  });

  it('すでに入っている：同じ日の欠勤・取り消し済み・重なる休み', () => {
    const d = data({
      absences: [{ id: 'a1', staffId: 's1', date: TUE, from: null, to: '12:00', note: '' }],
      visits: [visit('v1', 'c1', '10:00', '10:00', { date: TUE, cancelled: true })],
      clientLeaves: [{ id: 'l1', clientId: 'c2', from: '2026-10-18', to: '2026-10-25', note: '' }],
    });
    const rows = pasteRows(d, '10/13 田中 休み\n10/13 山田様 中止\n10/13〜10/20 川口様 入院', DATE);
    expect(rows.map((r) => r.reason)).toEqual([ROW_REASONS.already, ROW_REASONS.already, ROW_REASONS.already]);
    // 理由のある行も読んだ内容を出す
    expect(rows[0]!.text).toBe('10/13（火）田中 花子 終日の欠勤');
  });

  it('その日に訪問が無い・勤務の無い日・30分単位でない・上の行と同じ', () => {
    const rows = pasteRows(
      data(),
      '10/14 山田様 中止\n10/17 田中 休み\n10/13 田中 10:15から休み\n10/13 佐藤 休み\n10/13 佐藤 午前休み',
      DATE,
    );
    expect(rows.map((r) => r.reason)).toEqual([
      ROW_REASONS.noVisit,
      ROW_REASONS.noShift,
      ROW_REASONS.badTime,
      null,
      ROW_REASONS.same,
    ]);
  });

  it('同じ貼り付けの中で重なる休みは2つ目から「上の行と重なる」。同じ期間は「上の行と同じ」', () => {
    const rows = pasteRows(
      data(),
      '10/13〜10/20 川口様 入院\n10/15〜10/22 川口様 入院\n10/13〜10/20 川口様 入院\n10/21〜10/25 川口様 入院\n10/15〜10/22 山田様 入院',
      DATE,
    );
    expect(rows.map((r) => r.reason)).toEqual([null, ROW_REASONS.overlap, ROW_REASONS.same, null, null]);
  });

  it('今年でない日は年も出す', () => {
    const rows = pasteRows(data(), '12/28〜1/5 川口様 入院', DATE);
    expect(rows[0]!.text).toBe('12/28（月）〜2027/1/5（火）川口 春 休み（入院）');
  });

  it('チェックの鍵は文と同じ文の何回目か（上に行を足しても変わらない）', () => {
    const a = pasteRowKeys([{ line: 'x' }, { line: 'y' }, { line: 'x' }]);
    const b = pasteRowKeys([{ line: 'z' }, { line: 'x' }, { line: 'y' }, { line: 'x' }]);
    expect(a).toEqual(['0:x', '0:y', '1:x']);
    expect(b.slice(1)).toEqual(a);
  });

  it('機能が切：欠勤・キャンセルが切なら欠勤と取り消し、休みが切なら休みの行が読めない', () => {
    const off = data();
    off.org = { ...off.org, features: { sudden: false, clientLeave: false } };
    const rows = pasteRows(off, '10/13 田中 休み\n10/13 山田様 中止\n10/13〜10/20 川口様 入院', DATE);
    expect(rows.map((r) => r.reason)).toEqual([
      ROW_REASONS.suddenOff,
      ROW_REASONS.suddenOff,
      leaveOffReason('利用者さん'),
    ]);
    expect(leaveOffReason('利用者さん')).toBe('利用者さんの休みの機能が切');
  });
});

describe('入れる', () => {
  it('欠勤・取り消し・休みを1回で書く（担当は変えない）。読めない行は書かない', () => {
    const d = data();
    const rows = pasteRows(
      d,
      '10/13 田中 10時から休み\n10/13 山田様 中止\n10/13〜10/20 川口様 ショート\n高橋 休み',
      DATE,
    );
    const out = applyPasteRows(d, rows, DATE, ids);
    expect(out.absences).toEqual([
      { id: expect.stringMatching(/^a-/), staffId: 's1', date: TUE, from: '10:00', to: null, note: '' },
    ]);
    expect(findVisit(out, 'v1')).toMatchObject({ cancelled: true, cancelKind: null, staffId: 's1' });
    expect(findVisit(out, 'v2')).toMatchObject({ cancelled: true });
    expect(out.clientLeaves).toEqual([
      { id: expect.stringMatching(/^leave-/), clientId: 'c2', from: TUE, to: '2026-10-20', note: 'ショートステイ' },
    ]);
    expect(findVisit(out, 'v3')).toMatchObject({ cancelled: false, staffId: 's2' });
    // 元のデータは変えない
    expect(d.absences).toEqual([]);
  });

  it('今日の取り消しは当日キャンセル', () => {
    const d = data();
    const out = applyPasteRows(d, pasteRows(d, '10/12 川口様 中止', DATE), DATE, ids);
    expect(findVisit(out, 'v3')).toMatchObject({ cancelled: true, cancelKind: 'sameDay' });
  });

  it('要対応の件数：欠勤の日の、担当が休みになった訪問', () => {
    const d = data();
    const rows = pasteRows(d, '10/13 田中 休み', DATE);
    const out = applyPasteRows(d, rows, DATE, ids);
    expect(pasteCareCount(d, rows, DATE)).toBe(0);
    expect(pasteCareCount(out, rows, DATE)).toBe(1);
  });

  it('ボタンと知らせの文', () => {
    expect(pasteApplyLabel(3)).toBe('3件を入れる');
    expect(pasteDoneText(3, 1)).toBe('3件を入れました。要対応 1件');
  });
});

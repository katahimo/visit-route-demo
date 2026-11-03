import { describe, expect, it } from 'vitest';
import type { ClientVisitMark, DayMarks, DayStatus, StaffDay } from './month';
import {
  clientVisitShort,
  type DayCellInput,
  dayCellText,
  hoursText,
  longDate,
  namesShort,
  OFF_STATE_TEXT,
  oneOrCount,
  restMarkOf,
  staffShiftOf,
} from './monthCell';

// 2026-11-03 は火曜
const D = '2026-11-03';

const status = (over: Partial<DayStatus> = {}): DayStatus => ({
  date: D,
  count: 3,
  state: 'none',
  unassigned: 0,
  issues: new Map(),
  care: 0,
  changes: 0,
  absence: false,
  overSpan: [],
  needsCare: false,
  ...over,
});

const marks = (over: Partial<DayMarks> = {}): DayMarks => ({
  types: [],
  off: [],
  absent: [],
  requested: [],
  starts: [],
  ends: [],
  leaves: [],
  lastDays: [],
  ...over,
});

const staffDayOf = (over: Partial<StaffDay> = {}): StaffDay => ({
  date: D,
  slots: [{ start: '09:00', end: '17:00' }],
  off: false,
  absence: null,
  requested: false,
  retired: false,
  count: 0,
  target: null,
  travel: 0,
  minutes: 480,
  types: [],
  bar: [],
  ...over,
});

const cvisit = (over: Partial<ClientVisitMark> = {}): ClientVisitMark => ({
  visitId: 'v1',
  start: 9 * 60,
  typeId: null,
  staffId: 's1',
  substitute: false,
  edited: false,
  cancelled: false,
  sameDay: false,
  leave: false,
  unassigned: false,
  ...over,
});

const input = (over: Partial<DayCellInput> = {}): DayCellInput => ({
  date: D,
  status: status(),
  today: '2026-11-01',
  making: false,
  focus: 'all',
  marks: marks(),
  loadText: undefined,
  staffDay: undefined,
  clientDay: undefined,
  offState: undefined,
  attention: 0,
  usualRest: 0,
  listed: false,
  typeName: (id) => (id === null ? '種類なし' : `種類${id}`),
  staffName: (id) => (id === 's1' ? '消防 まもる' : ''),
  staffTerm: 'スタッフ',
  clientTerm: '利用者さん',
  ...over,
});

describe('短い文字', () => {
  it('longDate・hoursText', () => {
    expect(longDate(D)).toBe('11月3日（火）');
    expect(hoursText(90)).toBe('1.5時間');
    expect(hoursText(100)).toBe('1.7時間');
  });
  it('namesShort：1人は短い名前、2人以上は「ほか N人」', () => {
    expect(namesShort([])).toBe('');
    expect(namesShort(['消防 まもる'])).toBe('消防');
    expect(namesShort(['消防 まもる', '山田 花子', '佐藤'])).toBe('消防 ほか2人');
  });
  it('oneOrCount：1人は短い名前、2人以上は人数', () => {
    expect(oneOrCount(['消防 まもる'])).toBe('消防');
    expect(oneOrCount(['a', 'b'])).toBe('2人');
  });
  it('「休みを追加」の説明はどの扱いにもある', () => {
    expect(OFF_STATE_TEXT.open).toBe('押すと希望休にします');
    expect(OFF_STATE_TEXT.past).toContain('押せません');
  });
});

describe('restMarkOf', () => {
  it('人数・内訳（希望休が先）・ふだんより多い日だけ見せる', () => {
    const r = restMarkOf({ off: ['A', 'B'], requested: ['C'] }, 2);
    expect(r).toEqual({ resting: 3, detail: '希望休：C／勤務なし：A・B', shown: true });
    expect(restMarkOf({ off: ['A', 'B'], requested: [] }, 2).shown).toBe(false);
    expect(restMarkOf({ off: [], requested: [] }, 0)).toEqual({ resting: 0, detail: '', shown: false });
  });
});

describe('staffShiftOf', () => {
  it('勤務がふつうの日は短い文字なし（時刻は読み上げだけ）', () => {
    expect(staffShiftOf(staffDayOf())).toEqual({ short: null, text: '9:00〜17:00', covered: false });
  });
  it('休み・欠勤・欠勤あり・希望休・最終勤務日の後', () => {
    expect(staffShiftOf(staffDayOf({ slots: [], off: true })).short).toBe('休');
    const absence = { id: 'a', staffId: 's1', date: D, from: null, to: null, note: '' };
    expect(staffShiftOf(staffDayOf({ slots: [], absence }))).toMatchObject({ short: '欠勤', text: '欠勤' });
    expect(staffShiftOf(staffDayOf({ absence }))).toMatchObject({ short: '欠勤あり', text: '欠勤あり 9:00〜17:00' });
    expect(staffShiftOf(staffDayOf({ slots: [], absence, requested: true })).text).toBe('希望休');
    expect(staffShiftOf(staffDayOf({ retired: true })).short).toBe('最終勤務日の後');
  });
  it('勤務の無い日の「休」は、バーが全部休みなら見た目では隠す', () => {
    const bar = [{ start: 9 * 60, state: 'rest' as const }];
    expect(staffShiftOf(staffDayOf({ slots: [], off: true, bar })).covered).toBe(true);
  });
});

describe('clientVisitShort', () => {
  const name = (id: string) => (id === 's1' ? '消防 まもる' : '');
  it('取り消し・休み・担当・担当なし', () => {
    expect(clientVisitShort(cvisit({ cancelled: true, sameDay: true }), name)).toBe('当日取消');
    expect(clientVisitShort(cvisit({ cancelled: true }), name)).toBe('取消');
    expect(clientVisitShort(cvisit({ leave: true }), name)).toBe('休み');
    expect(clientVisitShort(cvisit(), name)).toBe('消防');
    expect(clientVisitShort(cvisit({ staffId: null }), name)).toBe('担当なし');
  });
});

describe('dayCellText', () => {
  it('全体：状態・要対応・印・混み具合の順に読む', () => {
    const t = dayCellText(
      input({
        status: status({
          unassigned: 1,
          needsCare: true,
          issues: new Map([
            ['v1', [{ kind: 'unassigned', label: '担当なし' }]],
            ['v2', [{ kind: 'off', label: '担当が休み' }]],
          ]),
          changes: 2,
          overSpan: ['s1'],
        }),
        attention: 3,
        marks: marks({ types: [{ typeId: 't1', count: 2 }], off: ['A'], requested: ['B'], starts: ['C'] }),
        loadText: '混み具合：どの時間も空き2人以上か働く人なし',
        making: true,
      }),
    );
    expect(t.label).toBe(
      [
        '11月3日（火）',
        '訪問 3件',
        'まだ伝えていない',
        '要対応 3',
        '担当なし 1件',
        '担当が休み 1件',
        '未連絡の変更 2件',
        '出勤〜退勤（拘束）が上限を超える 1人',
        '組んでいます',
        '種類：種類t1 2件',
        '休むスタッフ 2人（希望休：B／勤務なし：A）',
        '始まる C',
        '混み具合：どの時間も空き2人以上か働く人なし',
      ].join('・'),
    );
    expect(t.care).toBe(true);
    expect(t.attention).toBe(3);
    expect(t.otherIssues).toEqual(['担当が休み 1']);
    expect(t.tipText).toBe(
      `${t.label.split('・').slice(1).join('・')}（押すとこの日の訪問を右の欄に出します。もう一度押すと「日の予定」）`,
    );
    expect(t.guide).toContain('赤い枠＝要対応（担当なし・担当が休み・条件に合わない・時間に間に合わない）');
    expect(t.guide.some((l) => l.startsWith('下の3段の棒'))).toBe(true);
  });
  it('今日より前の日は要対応にしない。混み具合が数えられない日はそう読む', () => {
    const t = dayCellText(
      input({ today: '2026-11-10', status: status({ needsCare: true }), attention: 2, loadText: null }),
    );
    expect(t.past).toBe(true);
    expect(t.care).toBe(false);
    expect(t.attention).toBe(0);
    expect(t.label).toContain('混み具合は数えられません');
    expect(t.guide).toContain('棒が無い＝この日は空きを数えられない');
  });
  it('訪問なし・一覧を開いている・休みを入れるとき', () => {
    expect(dayCellText(input({ status: status({ count: 0 }) })).label).toBe('11月3日（火）・訪問なし');
    expect(dayCellText(input({ listed: true })).tipText).toContain('もう一度押すとこの日の「日の予定」を開きます');
    const off = dayCellText(input({ offState: 'open' }));
    expect(off.label.endsWith('押すと希望休にします')).toBe(true);
    expect(off.tipText.endsWith('押すと希望休にします')).toBe(true);
  });
  it('〈スタッフ〉：勤務・担当・目安・移動・時間帯', () => {
    const t = dayCellText(input({ focus: 'staff', staffDay: staffDayOf({ count: 2, target: 2.345, travel: 30 }) }));
    expect(t.shift?.short).toBeNull();
    expect(t.label).toContain('9:00〜17:00・担当 2件・目安 2.3件・移動 30分・時間帯：');
    expect(t.label).not.toContain('種類');
  });
  it('〈利用者さん〉：訪問ごとの時刻・種類・担当（代・この回だけ変更）', () => {
    const t = dayCellText(
      input({
        focus: 'client',
        clientDay: {
          date: D,
          visits: [
            cvisit({ substitute: true, edited: true, typeId: 't1' }),
            cvisit({ visitId: 'v2', cancelled: true }),
          ],
        },
      }),
    );
    expect(t.label).toContain('9:00 種類t1 消防 まもるさん（いつもの担当でない）（この回だけ変更）');
    expect(t.label).toContain('9:00 種類なし 取り消し');
    expect(t.guide).toContain('「代」＝いつもの担当でない');
    expect(t.guide).toContain('「変」＝この回だけ変更した訪問');
  });
});

import { describe, expect, it } from 'vitest';
import { type CellGuideInput, cellGuide, createTipStore } from './monthGuide';

const base: CellGuideInput = {
  focus: 'all',
  count: 0,
  stateText: null,
  care: false,
  types: false,
  resting: 0,
  requested: 0,
  absent: false,
  starts: false,
  ends: false,
  leaves: false,
  lastDays: false,
  loadBar: null,
  unassigned: false,
  issues: false,
  changed: false,
  overSpan: false,
  staffTerm: 'スタッフ',
  clientTerm: '利用者さん',
};

describe('cellGuide', () => {
  it('訪問の無い日：背景だけ', () => {
    expect(cellGuide(base)).toEqual(['白い背景＝訪問の無い日']);
  });
  it('出ている印だけを、呼び方を入れて書く（休 N・希望休・棒）', () => {
    const lines = cellGuide({
      ...base,
      count: 12,
      stateText: 'まだ伝えていない',
      types: true,
      resting: 2,
      requested: 1,
      loadBar: 'load',
    });
    expect(lines[0]).toBe('背景の色＝日の状態（まだ伝えていない）');
    expect(lines).toContain('右上の「N件」＝この日の訪問の件数');
    expect(lines).toContain('「休 N」＝休むスタッフの人数・「（希 N）」＝そのうち希望休の人数');
    expect(lines.some((l) => l.startsWith('下の3段の棒＝30分ごとの空きの人数') && l.includes('8〜12時'))).toBe(true);
    expect(lines.some((l) => l.includes('欠勤'))).toBe(false);
  });
  it('希望休が無ければ希の説明は書かない。数えられない日は棒が無い理由', () => {
    const lines = cellGuide({ ...base, count: 3, stateText: 'まだ伝えていない', resting: 1, loadBar: 'noPlan' });
    expect(lines).toContain('「休 N」＝休むスタッフの人数');
    expect(lines).toContain('棒が無い＝この日は空きを数えられない');
    expect(lines.some((l) => l.startsWith('赤い点'))).toBe(false);
    const red = cellGuide({ ...base, count: 3, stateText: 'まだ伝えていない', care: true, unassigned: true });
    expect(red).toContain('赤い点・赤い枠＝要対応（担当なし・担当が休み・条件に合わない・時間に間に合わない）');
  });
  it('要対応の札（N）があるときは赤い点を言わず、札の読み方を足す。休 N を出していないときは書かない（PRD D295）', () => {
    const lines = cellGuide({
      ...base,
      count: 3,
      stateText: 'まだ伝えていない',
      care: true,
      attention: 2,
      resting: 2,
      restShown: false,
    });
    expect(lines).toContain('赤い枠＝要対応（担当なし・担当が休み・条件に合わない・時間に間に合わない）');
    expect(lines.some((l) => l.startsWith('赤い「要対応 N」の札'))).toBe(true);
    expect(lines.some((l) => l.startsWith('「休 N」'))).toBe(false);
    const shown = cellGuide({ ...base, count: 3, stateText: 'まだ伝えていない', resting: 2, restShown: true });
    expect(shown).toContain('「休 N」＝休むスタッフの人数');
  });
  it('手当ての印（担当なし・担当の問題・未連絡・拘束超）', () => {
    const lines = cellGuide({
      ...base,
      count: 3,
      stateText: 'まだ伝えていない',
      unassigned: true,
      issues: true,
      changed: true,
      overSpan: true,
    });
    expect(lines.filter((l) => /^「(担当なし|担当が休み|未連絡|拘束超)/.test(l))).toHaveLength(4);
  });
  it('切（confirmStep が false）：要対応は帯の3種類と「変更あり」で言い、条件に合わない・拘束超は言わない（PRD D384）', () => {
    const lines = cellGuide({
      ...base,
      count: 3,
      stateText: '変更あり',
      care: true,
      attention: 2,
      unassigned: true,
      changed: true,
      overSpan: true,
      confirmStep: false,
    });
    expect(lines).toContain('赤い枠＝要対応（担当なし・重なり・休みの人）');
    expect(lines).toContain(
      '赤い「要対応 N」の札＝要対応の件数（右の「要対応」の欄の行の数。担当なし・重なり・休みの人・変更あり）',
    );
    expect(lines.some((l) => l.startsWith('「変更あり N」'))).toBe(true);
    expect(lines.some((l) => l.includes('条件に合わない') || l.includes('拘束') || l.includes('確定'))).toBe(false);
    // 入（省略）は今のまま
    const full = cellGuide({ ...base, count: 3, stateText: 'x', care: true, overSpan: true });
    expect(full.some((l) => l.includes('条件に合わない'))).toBe(true);
    expect(full.some((l) => l.startsWith('「拘束超 N」'))).toBe(true);
  });
  it('〈スタッフ〉・〈利用者さん〉の表示：全体の印（件数・休 N）は書かず、その表示の棒・印', () => {
    const staff = cellGuide({ ...base, focus: 'staff', count: 3, stateText: 'まだ伝えていない', resting: 2 });
    expect(staff.some((l) => l.startsWith('棒＝この人の時間帯ごとの状態'))).toBe(true);
    expect(staff.some((l) => l.startsWith('「休 N」'))).toBe(false);
    const client = cellGuide({ ...base, focus: 'client', count: 3, stateText: 'まだ伝えていない', substitute: true });
    expect(client).toContain('時刻と名前＝この利用者さんの訪問の時刻と担当');
    expect(client).toContain('「代」＝いつもの担当でない');
    expect(client.some((l) => l.startsWith('「変」'))).toBe(false);
  });
});

describe('createTipStore', () => {
  it('日付で引く。同じ中身なら同じものを返し知らせない。変われば新しい文と知らせ', () => {
    const st = createTipStore();
    let n = 0;
    const off = st.subscribe(() => n++);
    const a = { head: '10月21日', text: '訪問 3件', lines: ['休 N'] };
    st.set('2026-10-21', a);
    expect(st.get('2026-10-21')).toBe(a);
    st.set('2026-10-21', { ...a, lines: ['休 N'] });
    expect(st.get('2026-10-21')).toBe(a);
    expect(n).toBe(1);
    st.set('2026-10-21', { ...a, text: '訪問 3件・希望休' });
    expect(st.get('2026-10-21')?.text).toBe('訪問 3件・希望休');
    expect(n).toBe(2);
    expect(st.get('2026-10-22')).toBeNull();
    off();
    st.set('2026-10-22', a);
    expect(n).toBe(2);
  });
});

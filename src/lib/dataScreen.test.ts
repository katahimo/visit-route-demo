import { describe, expect, it } from 'vitest';
import { createDemoData } from '../seed';
import {
  excelFileName,
  keepNote,
  keptSuffix,
  otherFormSkippedText,
  otherOrgOf,
  rosterConfirmBody,
  rosterDefaultHoursNote,
  rosterDoneText,
  rosterFileName,
  rosterHasChanges,
  rosterHowText,
  rosterIsEmpty,
  termsCheck,
  tidyConfirmBody,
  tidyHasAny,
  tidyPreviewText,
  withoutOrgState,
  workbookConfirmBody,
  workbookCountsText,
} from './dataScreen';
import { applyTemplate } from './features';
import { tidyMonthLabel } from './tidy';

describe('keepNote・keptSuffix（1世代の控えの文）', () => {
  it('残せるなら戻せることを書き、知らせには何も添えない', () => {
    expect(keepNote({ kept: true, why: null })).toBe('元に戻すときは、データの画面の［直前の状態に戻す］を押します。');
    expect(keepNote({ kept: true, why: null }, '読み込む前の状態に戻す')).toBe(
      '読み込む前の状態に戻すときは、データの画面の［直前の状態に戻す］を押します。',
    );
    expect(keptSuffix({ kept: true, why: null })).toBe('');
  });
  it('残せないなら理由（無ければ既定の文）', () => {
    expect(keepNote({ kept: false, why: '容量が足りません' })).toBe('容量が足りません。');
    expect(keepNote({ kept: false, why: null })).toBe('控えを残せません。');
    expect(keptSuffix({ kept: false, why: '容量が足りません' })).toBe('（容量が足りません）');
    expect(keptSuffix({ kept: false, why: null })).toBe('（控えを残せません）');
  });
});

describe('termsCheck（呼び方の入力）', () => {
  const saved = { client: '利用者', staff: 'スタッフ' };
  it('同じ呼び方は使えない（前後の空白は除いて比べる）', () => {
    expect(termsCheck({ client: ' 人 ', staff: '人' }, saved)).toEqual({ same: true, ok: false, changed: true });
  });
  it('空なら変えられない（同じとは言わない）', () => {
    expect(termsCheck({ client: '', staff: '' }, saved)).toEqual({ same: false, ok: false, changed: true });
  });
  it('保存した呼び方と同じなら変わっていない', () => {
    expect(termsCheck({ client: '利用者 ', staff: 'スタッフ' }, saved)).toEqual({
      same: false,
      ok: true,
      changed: false,
    });
  });
});

describe('workbookCountsText・excelFileName・rosterFileName', () => {
  it('読み込んだデータの呼び方で件数を並べる', () => {
    const d = createDemoData('2026-10-12');
    const t = d.org.terms;
    expect(workbookCountsText(d)).toBe(
      `${t.staff} ${d.staff.length}人・${t.client} ${d.clients.length}人・訪問 ${d.visits.length}件・項目 ${d.items.length}件・条件 ${d.rules.length}件`,
    );
  });
  it('ファイル名は英字だけ', () => {
    expect(excelFileName('2026-10-12')).toBe('staff-assign-demo-2026-10-12.xlsx');
    expect(rosterFileName('staff', 'xlsx', '2026-10-12')).toBe('staff-assign-demo-staff-2026-10-12.xlsx');
    expect(rosterFileName('client', 'csv', '2026-10-12')).toBe('staff-assign-demo-clients-2026-10-12.csv');
    // 0人のとき（テンプレート）は日付の代わりに template
    expect(rosterFileName('client', 'xlsx', '2026-10-12', true)).toBe('staff-assign-demo-clients-template.xlsx');
    expect(rosterFileName('staff', 'csv', '2026-10-12', true)).toBe('staff-assign-demo-staff-template.csv');
  });
});

describe('名簿の読み込みの文', () => {
  it('足す・直す・終了／休止のどれかがあれば変更あり', () => {
    expect(rosterHasChanges({ added: [], updated: [], retired: [] })).toBe(false);
    expect(rosterHasChanges({ added: ['a'], updated: [], retired: [] })).toBe(true);
    expect(rosterHasChanges({ added: [], updated: ['a'], retired: [] })).toBe(true);
    expect(rosterHasChanges({ added: [], updated: [], retired: ['a'] })).toBe(true);
  });
  it('読み込み方の名前', () => {
    expect(rosterHowText('merge')).toBe('追加・更新');
    expect(rosterHowText('replace')).toBe('総入れ替え');
  });
  it('確認の本文：気をつけることがあれば先頭に空行を挟んで置く', () => {
    const base = {
      fileName: 'a.xlsx',
      term: 'スタッフ',
      how: '追加・更新',
      summary: '追加 1人',
      source: { format: 'xlsx' } as const,
      empty: false,
      keep: { kept: true, why: null },
    };
    const without = rosterConfirmBody({ ...base, warning: null });
    expect(without.split('\n')).toEqual([
      '「a.xlsx」のスタッフの名簿を読み込みます（追加・更新）。Excel ファイルを読みました。',
      '追加 1人',
      '予定は消えません。',
      '読み込む前の状態に戻すときは、データの画面の［直前の状態に戻す］を押します。',
    ]);
    expect(rosterConfirmBody({ ...base, warning: '注意' })).toBe(`注意\n\n${without}`);
  });
  it('いまの一覧が0人なら、消えない・戻せるの文は出さない（控えを残せない理由も出さない）', () => {
    const base = {
      warning: null,
      fileName: 'a.xlsx',
      term: 'スタッフ',
      how: '追加・更新',
      summary: '追加 1人',
      source: { format: 'xlsx' } as const,
      empty: true,
    };
    const lines = ['「a.xlsx」のスタッフの名簿を読み込みます（追加・更新）。Excel ファイルを読みました。', '追加 1人'];
    expect(rosterConfirmBody({ ...base, keep: { kept: true, why: null } }).split('\n')).toEqual(lines);
    expect(rosterConfirmBody({ ...base, keep: { kept: false, why: '容量が足りません' } }).split('\n')).toEqual(lines);
  });
  it('読み込んだあと自動で地図に置くときは、最後に送ることの1文を足す（PRD D427。押す前に分かるように）', () => {
    const base = {
      warning: null,
      fileName: 'a.csv',
      term: '利用者さん',
      how: '追加・更新',
      summary: '追加 1人',
      source: { format: 'xlsx' } as const,
      empty: true,
      keep: { kept: true, why: null },
    };
    expect(
      rosterConfirmBody({ ...base, autoPlace: true })
        .split('\n')
        .at(-1),
    ).toBe('読み込んだあと、住所から緯度・経度を探します（住所を郵便番号の検索と国土地理院の地図の検索に使います）');
    expect(rosterConfirmBody({ ...base, autoPlace: false })).not.toContain('緯度・経度を探します');
    expect(rosterConfirmBody(base)).not.toContain('緯度・経度を探します');
  });
  it('勤務の列が無く既定にした人がいれば、単発の予約のときだけ1文を足す（PRD D428。ADR-0095）', () => {
    const f = applyTemplate('oneOff');
    const note = rosterDefaultHoursNote({ names: ['A', 'B'], features: f, staffTerm: 'スタッフ' });
    expect(note).toBe(
      '勤務する曜日・時間のどれかが空の2人は、空の所を既定（毎日 7:00〜22:00）にしました。スタッフの画面の勤務時間で直せます',
    );
    expect(rosterDefaultHoursNote({ names: [], features: f, staffTerm: 'スタッフ' })).toBeNull();
    expect(
      rosterDefaultHoursNote({ names: ['A'], features: applyTemplate('basic'), staffTerm: 'スタッフ' }),
    ).toBeNull();
    const base = {
      warning: null,
      fileName: 'a.csv',
      term: 'スタッフ',
      how: '追加・更新',
      summary: '追加 2人',
      source: { format: 'csv', encoding: 'UTF-8' } as const,
      empty: true,
      keep: { kept: true, why: null },
    };
    expect(
      rosterConfirmBody({ ...base, hoursNote: note })
        .split('\n')
        .at(-1),
    ).toBe(note);
  });
  it('rosterIsEmpty：その一覧が0人か', () => {
    const d = createDemoData('2026-10-13');
    expect(rosterIsEmpty(d, 'staff')).toBe(false);
    expect(rosterIsEmpty({ ...d, clients: [] }, 'client')).toBe(true);
    expect(rosterIsEmpty({ ...d, clients: [] }, 'staff')).toBe(false);
  });
  it('読んだファイルの形：CSV なら CSV と書く（文字コードは出さない）', () => {
    const body = rosterConfirmBody({
      warning: null,
      fileName: 'a.csv',
      term: '利用者',
      how: '追加・更新',
      summary: '追加 1人',
      source: { format: 'csv', encoding: 'Shift_JIS' },
      empty: false,
      keep: { kept: true, why: null },
    });
    expect(body.split('\n')[0]).toBe('「a.csv」の利用者の名簿を読み込みます（追加・更新）。CSV ファイルを読みました。');
  });
  it('顧客台帳の形なら、読んだ形と読まなかった列を出す（ADR-0073）', () => {
    const body = rosterConfirmBody({
      warning: null,
      fileName: 'a.csv',
      term: '利用者',
      how: '追加・更新',
      summary: '追加 1人',
      source: { format: 'csv', encoding: 'UTF-8' },
      otherForm: { label: '顧客台帳', skippedColumns: ['請求方法', '口座番号'] },
      empty: false,
      keep: { kept: true, why: null },
    });
    expect(body.split('\n').slice(0, 3)).toEqual([
      '「a.csv」の利用者の名簿を読み込みます（追加・更新）。顧客台帳の形の CSV ファイルを読みました。',
      '読まなかった列：請求方法・口座番号',
      '追加 1人',
    ]);
    expect(otherFormSkippedText({ label: '顧客台帳', skippedColumns: [] })).toBe('読まなかった列：なし');
  });
  it('読み込んだあとの知らせ：最終勤務日の入った人がいれば添え、控えを残せなければ理由', () => {
    const keep = { kept: true, why: null };
    expect(rosterDoneText({ term: '利用者', staffTerm: 'スタッフ', hasLastDay: false, keep })).toBe(
      '利用者の名簿を読み込みました',
    );
    expect(rosterDoneText({ term: 'スタッフ', staffTerm: 'スタッフ', hasLastDay: true, keep })).toBe(
      'スタッフの名簿を読み込みました。最終勤務日の入ったスタッフがいます。「最終勤務日のあるスタッフ」の欄から担当を振り直してください',
    );
    expect(
      rosterDoneText({ term: '利用者', staffTerm: 'スタッフ', hasLastDay: false, keep: { kept: false, why: '理由' } }),
    ).toBe('利用者の名簿を読み込みました（理由）');
  });
});

describe('古い訪問の片づけの文', () => {
  const none = { visits: 0, snapshots: 0, days: 0, chars: 0 };
  const some = { visits: 3, snapshots: 2, days: 4, chars: 2048 };
  it('訪問か確定した内容があれば消せる', () => {
    expect(tidyHasAny(none)).toBe(false);
    expect(tidyHasAny({ ...none, visits: 1 })).toBe(true);
    expect(tidyHasAny({ ...none, snapshots: 1 })).toBe(true);
  });
  it('見込みの文：消せるものが無ければその旨', () => {
    expect(tidyPreviewText('2026-07', none)).toBe(`${tidyMonthLabel('2026-07')}に消せる訪問の記録はありません`);
    expect(tidyPreviewText('2026-07', some)).toMatch(/^4日分の訪問 3件・確定した内容 2日分（.+空きます）$/);
  });
  it('確認の本文に件数と戻せないことを書く', () => {
    const body = tidyConfirmBody(some);
    expect(body).toMatch(/^4日分の、担当を組んだ・変えた訪問 3件と確定した内容 2日分を消します/);
    expect(body).toContain('消したものは戻せません');
  });
});

describe('別の事業所の Excel（ADR-0006）', () => {
  const org = (name: string) => ({ org: { ...createDemoData('2026-10-01').org, name } });

  it('otherOrgOf：事業所名が同じなら null（前後の空白は問わない）、違えば両方の名前', () => {
    expect(otherOrgOf(org('みどり訪問'), org(' みどり訪問 '))).toBeNull();
    expect(otherOrgOf(org('みどり訪問'), org('あおば訪問'))).toEqual({ current: 'みどり訪問', read: 'あおば訪問' });
  });

  it('withoutOrgState：伝えた内容・振り直し・組み方の標準の記録を外し、ほかは変えない', () => {
    const d = createDemoData('2026-10-01');
    const withState = {
      ...d,
      standard: { at: 1, presetId: d.presets[0]!.id, from: '2026-10-05', weeks: 1 },
    };
    const r = withoutOrgState(withState);
    expect(r.snapshots).toEqual({});
    expect(r.reassigns).toEqual({});
    expect(r.standard).toBeUndefined();
    expect(r.visits).toBe(d.visits);
    expect(r.staff).toBe(d.staff);
  });

  it('workbookConfirmBody：同じ事業所なら記録を残すと書き、別の事業所なら名前と消すことを書く', () => {
    const same = workbookConfirmBody({ fileName: 'a.xlsx', counts: '3人', otherOrg: null, keep: '控え' });
    expect(same).toContain('担当は Excel の内容');
    expect(same).toContain('そのまま残します');
    expect(same).not.toContain('別の事業所');
    const other = workbookConfirmBody({
      fileName: 'a.xlsx',
      counts: '3人',
      otherOrg: { current: 'みどり', read: 'あおば' },
      keep: '控え',
    });
    expect(other).toContain('「あおば」は、いまの「みどり」と違います');
    expect(other).toContain('消します');
    expect(other.endsWith('控え')).toBe(true);
  });
});

// 位置の無い人をまとめて地図に置く（PRD D89・D427。ADR-0016・ADR-0094）。外部には出さず、検索の偽物で確かめる
import { describe, expect, it } from 'vitest';
import type { Client, Staff } from '../contracts/documents';
import { client, makeData, staff } from '../matching/fixtures.testkit';
import { UNPLACED_TRAVEL_MIN } from '../matching/travel';
import type { GeoHit, LookupResult, PostalHit } from './geocode';
import {
  AUTO_PLACE_NOTE,
  autoPlaceAfterRoster,
  canSearchOne,
  hasAddressNotFound,
  keepStorePlace,
  NO_PLACE_NOTE,
  noPlaceIds,
  type PlaceAllResult,
  type PlacePerson,
  placeAll,
  placeAllRunLabel,
  placeAllTargets,
  placeAllTexts,
  placePeople,
  sleep,
  withFoundPlace,
} from './placeAll';

const noPlace = (id: string, address: string, postalCode = '', over: Partial<Client> = {}) =>
  client(id, 0, 0, { displayName: id, place: { address, lat: null, lng: null, postalCode }, ...over });
const noHome = (id: string, address: string, over: Partial<Staff> = {}) =>
  staff(id, 0, 0, { name: id, home: { address, lat: null, lng: null }, ...over });
/** まとめて置く人の形（〈利用者さん〉） */
const person = (c: Client): PlacePerson => placePeople({ clients: [c], staff: [] }, 'client')[0]!;
const people = (...cs: Client[]) => cs.map(person);
const ids = (ps: { id: string }[]) => ps.map((p) => p.id);

const geo = (lat: number, lng: number, title = 't'): LookupResult<GeoHit> => ({
  ok: true,
  hits: [{ title, lat, lng }],
});

describe('placeAllTargets（まとめて置く対象）', () => {
  it('〈利用者さん〉：位置が無く、終了でない人のうち、住所か郵便番号のある人。無い人は skipped。表示名の順', () => {
    const cs = [
      noPlace('い', '宮城県仙台市'),
      noPlace('あ', '', '9800811'),
      noPlace('う', ''),
      noPlace('え', '宮城県', '', { stage: 'ended', active: false }),
      client('お', 38, 140),
    ];
    const { targets, skipped } = placeAllTargets({ clients: cs, staff: [] }, 'client');
    expect(ids(targets)).toEqual(['あ', 'い']);
    expect(ids(skipped)).toEqual(['う']);
  });
  it('〈スタッフ〉：自宅の位置が無く、休止でない人のうち、住所のある人（郵便番号は持たないので住所だけ）', () => {
    const ss = [
      noHome('し', '宮城県仙台市青葉区'),
      noHome('さ', ''),
      noHome('す', '宮城県', { active: false }),
      staff('せ', 38, 140),
    ];
    const { targets, skipped } = placeAllTargets({ clients: [noPlace('a', '宮城県')], staff: ss }, 'staff');
    expect(ids(targets)).toEqual(['し']);
    expect(ids(skipped)).toEqual(['さ']);
    expect(targets[0]!.place.postalCode).toBe('');
  });
});

describe('noPlaceIds・canSearchOne（一覧の「位置なし」）', () => {
  it('数える人のうち位置の無い人（住所の有無は問わない）', () => {
    const d = {
      clients: [noPlace('a', ''), noPlace('b', '', '', { stage: 'ended', active: false }), client('c', 38, 140)],
      staff: [noHome('s', ''), noHome('t', '', { active: false }), staff('u', 38, 140)],
    };
    expect([...noPlaceIds(d, 'client')]).toEqual(['a']);
    expect([...noPlaceIds(d, 'staff')]).toEqual(['s']);
  });
  it('1人だけ探せるのは、検索が入・置いている最中でない・住所か郵便番号がある人', () => {
    const on = { geocodeOn: true, running: false };
    expect(canSearchOne(person(noPlace('a', '宮城県')), on)).toBe(true);
    expect(canSearchOne(person(noPlace('a', '', '9800811')), on)).toBe(true);
    expect(canSearchOne(person(noPlace('a', ' ')), on)).toBe(false);
    expect(canSearchOne(person(noPlace('a', '宮城県')), { ...on, geocodeOn: false })).toBe(false);
    expect(canSearchOne(person(noPlace('a', '宮城県')), { ...on, running: true })).toBe(false);
  });
});

describe('placeAllRunLabel・placeAllTexts（まとめて置く欄の文）', () => {
  it('はじめは「住所から緯度・経度を入れる（N人）」、一度探したあとは「続きを探す（N人）」、0人は人数なし', () => {
    expect(placeAllRunLabel({ targets: 3, tried: false })).toBe('住所から緯度・経度を入れる（3人）');
    expect(placeAllRunLabel({ targets: 2, tried: true })).toBe('続きを探す（2人）');
    expect(placeAllRunLabel({ targets: 0, tried: true })).toBe('住所から緯度・経度を入れる');
  });
  it('種類ごとの見出しと数えない人の注記。担当は組める補足（ADR-0093）', () => {
    const terms = { client: '利用者さん', staff: 'スタッフ' };
    expect(placeAllTexts('client', terms).heading).toBe('緯度・経度が未登録の利用者さん');
    expect(placeAllTexts('staff', terms).heading).toBe('自宅の緯度・経度が未登録のスタッフ');
    expect(placeAllTexts('staff', terms).has).toBe('住所あり');
    // 分数は計算の見込み（UNPLACED_TRAVEL_MIN）から作る
    expect(NO_PLACE_NOTE).toContain(`移動${UNPLACED_TRAVEL_MIN}分`);
    expect(NO_PLACE_NOTE).toContain('移動30分');
  });
});

describe('autoPlaceAfterRoster（名簿のあと自動で置くか。PRD D427）', () => {
  it('検索が入で、読み込んだあとに対象がいるときだけ', () => {
    const next = { clients: [noPlace('a', '宮城県')], staff: [noHome('s', '')] };
    expect(autoPlaceAfterRoster({ geocodeOn: true, next, kind: 'client' })).toBe(true);
    expect(autoPlaceAfterRoster({ geocodeOn: false, next, kind: 'client' })).toBe(false);
    // 住所の無い〈スタッフ〉しかいない → 送るものが無い
    expect(autoPlaceAfterRoster({ geocodeOn: true, next, kind: 'staff' })).toBe(false);
    expect(AUTO_PLACE_NOTE).toBe(
      '読み込んだあと、住所から緯度・経度を探します（住所を郵便番号の検索と国土地理院の地図の検索に使います）',
    );
  });
});

describe('hasAddressNotFound（市区町村の1行を足すか）', () => {
  const from = { address: '', postalCode: '' };
  const fail = (step: 'postal' | 'address', reason: 'notFound' | 'network'): PlaceAllResult => ({
    personId: 'a',
    ok: false,
    reason,
    step,
    foundAddress: null,
    from,
  });
  it('住所から位置が見つからなかった人がいるときだけ', () => {
    expect(hasAddressNotFound([fail('address', 'notFound')])).toBe(true);
    expect(hasAddressNotFound([fail('postal', 'notFound'), fail('address', 'network')])).toBe(false);
    expect(hasAddressNotFound([])).toBe(false);
  });
});

describe('placeAll（順に置く）', () => {
  it('1人ずつ順に呼び、呼ぶたびに間隔をあける（最初の前はあけない）。住所が空なら先に郵便番号から住所', async () => {
    const log: string[] = [];
    const results: PlaceAllResult[] = [];
    const r = await placeAll(people(noPlace('a', '宮城県仙台市青葉区'), noPlace('b', '', '9800811')), {
      search: async (q) => {
        log.push(`search:${q}`);
        return geo(38.26, 140.87, `${q}の位置`);
      },
      lookup: async (code): Promise<LookupResult<PostalHit>> => {
        log.push(`lookup:${code}`);
        return { ok: true, hits: [{ address: '宮城県仙台市青葉区一番町' }, { address: '別の町' }] };
      },
      wait: async (ms) => {
        log.push(`wait:${ms}`);
      },
      intervalMs: 300,
      onResult: (x) => results.push(x),
    });
    expect(r).toEqual({ stopped: false });
    expect(log).toEqual([
      'search:宮城県仙台市青葉区',
      'wait:300',
      'lookup:9800811',
      'wait:300',
      'search:宮城県仙台市青葉区一番町',
    ]);
    expect(results).toEqual([
      {
        personId: 'a',
        ok: true,
        lat: 38.26,
        lng: 140.87,
        address: '宮城県仙台市青葉区',
        title: '宮城県仙台市青葉区の位置',
        from: { address: '宮城県仙台市青葉区', postalCode: '' },
      },
      {
        personId: 'b',
        ok: true,
        lat: 38.26,
        lng: 140.87,
        address: '宮城県仙台市青葉区一番町',
        title: '宮城県仙台市青葉区一番町の位置',
        from: { address: '', postalCode: '9800811' },
      },
    ]);
  });
  it('失敗した人は理由と段階を返して次へ進む', async () => {
    const results: PlaceAllResult[] = [];
    await placeAll(
      people(
        noPlace('a', '', '0000000'),
        noPlace('b', 'どこにもない'),
        noPlace('c', '宮城県'),
        noPlace('d', '', '1111111'),
      ),
      {
        search: async (q) => (q.includes('どこにもない') ? { ok: false, reason: 'notFound' } : geo(38, 140)),
        lookup: async (code) =>
          code === '1111111' ? { ok: true, hits: [{ address: 'どこにもない町' }] } : { ok: false, reason: 'timeout' },
        wait: async () => {},
        onResult: (x) => results.push(x),
      },
    );
    expect(
      results.map((x) => (x.ok ? `${x.personId}:ok` : `${x.personId}:${x.step}:${x.reason}:${x.foundAddress ?? '-'}`)),
    ).toEqual(['a:postal:timeout:-', 'b:address:notFound:-', 'c:ok', 'd:address:notFound:どこにもない町']);
  });
  it('止めたら次の呼び出しから止める（止めた呼び出しの結果は返さない）', async () => {
    const ctrl = new AbortController();
    const results: PlaceAllResult[] = [];
    let searches = 0;
    const r = await placeAll(people(noPlace('a', 'A'), noPlace('b', 'B'), noPlace('c', 'C')), {
      search: async () => {
        searches += 1;
        if (searches === 2) ctrl.abort();
        return geo(38, 140);
      },
      lookup: async () => ({ ok: false, reason: 'notFound' }),
      wait: (ms, signal) => sleep(ms, signal),
      intervalMs: 1,
      signal: ctrl.signal,
      onResult: (x) => results.push(x),
    });
    expect(r).toEqual({ stopped: true });
    expect(searches).toBe(2);
    expect(results.map((x) => x.personId)).toEqual(['a']);
  });
});

describe('sleep', () => {
  it('止めたらすぐ戻る', async () => {
    const ctrl = new AbortController();
    const t = Date.now();
    const p = sleep(10_000, ctrl.signal);
    ctrl.abort();
    await p;
    expect(Date.now() - t).toBeLessThan(1000);
  });
});

describe('withFoundPlace（見つけた位置を書く）', () => {
  const from = (c: Client) => ({ address: c.place.address, postalCode: c.place.postalCode });
  it('まだ位置の無い人だけに書く。住所が空なら見つけた住所も書く', () => {
    const d = makeData();
    d.clients = [noPlace('a', '宮城県仙台市', '9800811'), noPlace('b', '', '9800811'), client('c', 38.1, 140.1)];
    const found = { lat: 38.26, lng: 140.87, address: '宮城県仙台市青葉区一番町' };
    const a = withFoundPlace(d, 'client', 'a', from(d.clients[0]), found);
    expect(a.clients[0].place).toEqual({ address: '宮城県仙台市', lat: 38.26, lng: 140.87, postalCode: '9800811' });
    const b = withFoundPlace(d, 'client', 'b', from(d.clients[1]), found);
    expect(b.clients[1].place).toEqual({ ...found, postalCode: '9800811' });
    // 位置のある人・いない人は変えない（同じ data）
    expect(withFoundPlace(d, 'client', 'c', from(d.clients[2]), found)).toBe(d);
    expect(withFoundPlace(d, 'client', 'zz', { address: '', postalCode: '' }, found)).toBe(d);
  });
  it('探したときと住所・郵便番号が違えば書かない（その間に利用者が直した）', () => {
    const d = makeData();
    d.clients = [noPlace('a', '宮城県仙台市太白区', '')];
    const found = { lat: 38.26, lng: 140.87, address: '宮城県仙台市太白区' };
    expect(withFoundPlace(d, 'client', 'a', { address: '宮城県仙台市', postalCode: '' }, found)).toBe(d);
    expect(withFoundPlace(d, 'client', 'a', { address: '宮城県仙台市太白区', postalCode: '9800811' }, found)).toBe(d);
  });
  it('位置が null なら住所だけ書く（郵便番号で住所は見つかったが位置が見つからない人）', () => {
    const d = makeData();
    d.clients = [noPlace('a', '', '9800811'), noPlace('b', '宮城県', '')];
    const a = withFoundPlace(d, 'client', 'a', from(d.clients[0]), {
      lat: null,
      lng: null,
      address: '宮城県仙台市青葉区一番町',
    });
    expect(a.clients[0].place).toEqual({
      address: '宮城県仙台市青葉区一番町',
      lat: null,
      lng: null,
      postalCode: '9800811',
    });
    expect(withFoundPlace(d, 'client', 'b', from(d.clients[1]), { lat: null, lng: null, address: 'x' })).toBe(d);
  });
});

describe('withFoundPlace（〈スタッフ〉の自宅）', () => {
  it('自宅に位置を書く。休止・位置のある人・住所を直した人は変えない', () => {
    const d = makeData();
    d.staff = [noHome('s', '宮城県仙台市'), staff('t', 38.1, 140.1)];
    const from = { address: '宮城県仙台市', postalCode: '' };
    const found = { lat: 38.26, lng: 140.87, address: '宮城県仙台市' };
    const x = withFoundPlace(d, 'staff', 's', from, found);
    expect(x.staff[0]!.home).toEqual({ address: '宮城県仙台市', lat: 38.26, lng: 140.87 });
    expect('postalCode' in x.staff[0]!.home).toBe(false);
    expect(x.clients).toBe(d.clients);
    expect(withFoundPlace(d, 'staff', 't', { address: '', postalCode: '' }, found)).toBe(d);
    expect(withFoundPlace(d, 'staff', 's', { address: '宮城県', postalCode: '' }, found)).toBe(d);
  });
});

describe('keepStorePlace（欄を保存するとき、まとめて置いた位置を消さない）', () => {
  const p = (address: string, lat: number | null, lng: number | null) => ({ address, lat, lng, postalCode: '9800811' });
  it('欄で位置・住所を触っていなければ store の値を残す', () => {
    const opened = p('', null, null);
    const stored = p('宮城県仙台市青葉区一番町', 38.26, 140.87);
    expect(keepStorePlace(opened, opened, stored)).toEqual(stored);
  });
  it('欄で触った項目は欄の値のまま', () => {
    const opened = p('', null, null);
    const stored = p('宮城県仙台市青葉区一番町', 38.26, 140.87);
    expect(keepStorePlace(p('宮城県', 38.1, 140.1), opened, stored)).toEqual(p('宮城県', 38.1, 140.1));
    expect(keepStorePlace(p('宮城県', null, null), opened, stored)).toEqual(p('宮城県', 38.26, 140.87));
    // 開いたときに位置があって欄で消した → 消したまま
    const had = p('宮城県', 38.1, 140.1);
    expect(keepStorePlace(p('宮城県', null, null), had, had)).toEqual(p('宮城県', null, null));
    expect(keepStorePlace(opened, opened, undefined)).toBe(opened);
  });
});

describe('郵便番号の既定値（ADR-0016）', () => {
  it('郵便番号の無い古いデータは空で読める。7桁でない値は契約に合わない', async () => {
    const { createDemoData } = await import('../seed');
    const { migrate, isImportError } = await import('../store');
    const d = createDemoData('2026-10-13');
    const old = JSON.parse(JSON.stringify(d));
    for (const c of old.clients) delete c.place.postalCode;
    const x = migrate(old);
    expect(isImportError(x)).toBe(false);
    if (!isImportError(x)) expect(x.clients.every((c) => c.place.postalCode === '')).toBe(true);
    const bad = JSON.parse(JSON.stringify(d));
    bad.clients[0].place.postalCode = '980-0811';
    expect(isImportError(migrate(bad))).toBe(true);
  });
});

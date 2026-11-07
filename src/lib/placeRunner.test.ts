// 住所から位置をまとめて探す入れ物（lib/placeRunner。PRD D427・D445）：画面に縛られず続ける・1本の列・探し終えてから1回組む・差し替えで止める。
// 外部には出さず、検索の偽物で確かめる
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Client } from '../contracts/documents';
import { client, makeData } from '../matching/fixtures.testkit';
import type { GeoHit, LookupResult } from './geocode';
import { createPlaceRunner, type PlaceHost, placeRunText } from './placeRunner';

const noPlace = (id: string) =>
  client(id, 0, 0, { displayName: id, place: { address: `架空市${id}`, lat: null, lng: null, postalCode: '' } });
const hit: LookupResult<GeoHit> = { ok: true, hits: [{ title: 't', lat: 35.1, lng: 139.1 }] };

/** 検索の偽物：呼ばれた住所を覚え、release を呼ぶまで待たせる（gate が true のとき） */
function fakeDeps(gate = false) {
  const calls: string[] = [];
  let release: () => void = () => undefined;
  let blocker = gate
    ? new Promise<void>((r) => {
        release = r;
      })
    : Promise.resolve();
  return {
    calls,
    release: () => {
      release();
      blocker = Promise.resolve();
    },
    deps: {
      search: async (address: string) => {
        calls.push(address);
        await blocker;
        return hit;
      },
      lookup: async () => ({ ok: false as const, reason: 'notFound' as const }),
      wait: async () => undefined,
    },
  };
}

function fakeHost(clients: Client[]) {
  let data: DemoData = makeData({ clients });
  const arranged: DemoData[] = [];
  const host: PlaceHost = {
    get: () => data,
    update: (fn) => {
      data = fn(data);
    },
    arrange: (d) => arranged.push(d),
  };
  return { host, arranged, data: () => data };
}

describe('placeRunner', () => {
  it('まとめて探して位置を入れたら、探し終えてから1回組む（入れた位置のデータで）', async () => {
    const f = fakeDeps();
    const h = fakeHost([noPlace('a'), noPlace('b')]);
    const r = createPlaceRunner(f.deps);
    r.connect(h.host);
    await r.run('client');
    expect(f.calls).toEqual(['架空市a', '架空市b']);
    expect(h.data().clients.every((c) => c.place.lat === 35.1)).toBe(true);
    expect(h.arranged).toHaveLength(1);
    expect(h.arranged[0]).toBe(h.data());
    expect(r.state.client.get()).toMatchObject({ running: false, total: 2, tried: true, stopped: false });
    expect(r.done.get()).toEqual({ kind: 'client', placed: 2, stopped: false });
  });

  it('1人だけ探す（行の［住所から探す］）ときは組まない', async () => {
    const h = fakeHost([noPlace('a'), noPlace('b')]);
    const r = createPlaceRunner(fakeDeps().deps);
    r.connect(h.host);
    await r.run('client', ['a']);
    expect(h.data().clients.find((c) => c.id === 'a')?.place.lat).toBe(35.1);
    expect(h.arranged).toHaveLength(0);
  });

  it('探すあいだに待たせた組み（読み込みのあと）は、探し終えてから組む。走っていなければ busy でない', async () => {
    const f = fakeDeps(true);
    const h = fakeHost([noPlace('a')]);
    const r = createPlaceRunner(f.deps);
    r.connect(h.host);
    expect(r.busy()).toBe(false);
    const p = r.run('client');
    expect(r.busy()).toBe(true);
    r.holdArrange();
    expect(h.arranged).toHaveLength(0);
    f.release();
    await p;
    expect(r.busy()).toBe(false);
    expect(h.arranged).toHaveLength(1);
  });

  it('データを丸ごと差し替えたら止め、書かず・組まない', async () => {
    const f = fakeDeps(true);
    const h = fakeHost([noPlace('a'), noPlace('b')]);
    const r = createPlaceRunner(f.deps);
    r.connect(h.host);
    const p = r.run('client');
    r.holdArrange();
    r.abort();
    f.release();
    await p;
    expect(h.data().clients.every((c) => c.place.lat === null)).toBe(true);
    expect(h.arranged).toHaveLength(0);
    expect(r.done.get()).toBeNull();
    expect(r.busy()).toBe(false);
  });

  it('探している途中で止めたら、止めたと知らせる', async () => {
    const f = fakeDeps(true);
    const h = fakeHost([noPlace('a'), noPlace('b')]);
    const r = createPlaceRunner(f.deps);
    r.connect(h.host);
    const p = r.run('client');
    while (f.calls.length === 0) await new Promise((z) => setTimeout(z, 0));
    r.stop('client');
    f.release();
    await p;
    expect(r.state.client.get().stopped).toBe(true);
    expect(r.done.get()?.stopped).toBe(true);
  });

  it('帯の文', () => {
    expect(placeRunText('お客様', { results: [{} as never, {} as never], total: 400 })).toBe(
      'お客様の緯度・経度を探しています 2/400人',
    );
  });
});

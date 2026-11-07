// 住所から位置をまとめて探す入れ物（lib/placeRunner。PRD D427・D445）：画面に縛られず続ける・1本の列・探し終えてから1回組む・差し替えで止める。
// 外部には出さず、検索の偽物で確かめる
import { describe, expect, it } from 'vitest';
import type { DemoData } from '../contracts/data';
import type { Client } from '../contracts/documents';
import { client, makeData, visit } from '../matching/fixtures.testkit';
import { type AutoRun, autoArrangeIdle } from './autoArrangeBatch';
import type { GeoHit, LookupResult } from './geocode';
import { createPlaceRunner, type PlaceHost, placeRunText } from './placeRunner';
import { createValueStore } from './valueStore';

const TODAY = '2026-11-07';
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

/** 組む範囲（今日〜翌月末）の予定（組みに効く〈利用者さん〉にする） */
const visitOf = (clientId: string, date = '2026-11-20') => visit(`v-${clientId}`, clientId, '10:00', '10:00', { date });

function fakeHost(clients: Client[], visitFor: string[] = []) {
  let data: DemoData = makeData({ clients, visits: visitFor.map((id) => visitOf(id)) });
  const arranged: DemoData[] = [];
  const host: PlaceHost = {
    get: () => data,
    update: (fn) => {
      data = fn(data);
    },
    arrange: (d) => arranged.push(d),
    today: () => TODAY,
    settle: async () => undefined,
  };
  return { host, arranged, data: () => data };
}

describe('placeRunner', () => {
  it('まとめて探して位置を入れたら、探し終えてから1回組む（入れた位置のデータで）', async () => {
    const f = fakeDeps();
    const h = fakeHost([noPlace('a'), noPlace('b')], ['a', 'b']);
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
    const h = fakeHost([noPlace('a')], ['a']);
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
    const h = fakeHost([noPlace('a'), noPlace('b')], ['a']);
    const r = createPlaceRunner(f.deps);
    r.connect(h.host);
    const p = r.run('client');
    r.holdArrange();
    r.abort();
    expect(r.busy()).toBe(false);
    expect(r.state.client.get()).toMatchObject({ running: false, results: [], total: 0 });
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

  it('予定のある人を先に探し、探し終えた時点で組む（残りの人は続けて探す。PRD D445）', async () => {
    const f = fakeDeps();
    const h = fakeHost([noPlace('a'), noPlace('b'), noPlace('c')], ['c']);
    const r = createPlaceRunner(f.deps);
    r.connect(h.host);
    let arrangedAt = -1;
    const arrange = h.host.arrange;
    h.host.arrange = (d) => {
      arrangedAt = f.calls.length;
      arrange(d);
    };
    const p = r.run('client');
    r.holdArrange();
    await p;
    expect(f.calls).toEqual(['架空市c', '架空市a', '架空市b']);
    // c（予定あり）を探し終えた時点で1回だけ組む
    expect(arrangedAt).toBe(1);
    expect(h.arranged).toHaveLength(1);
    expect(h.arranged[0]?.clients.find((x) => x.id === 'c')?.place.lat).toBe(35.1);
  });

  it('予定の無い人だけに位置を入れても組まない。もう組める段階なら待たせた組みはすぐ組む', async () => {
    const h = fakeHost([noPlace('a')]);
    const r = createPlaceRunner(fakeDeps().deps);
    r.connect(h.host);
    await r.run('client');
    expect(h.arranged).toHaveLength(0);
    const f = fakeDeps(true);
    const h2 = fakeHost([noPlace('a')]);
    const r2 = createPlaceRunner(f.deps);
    r2.connect(h2.host);
    const p = r2.run('client');
    r2.holdArrange();
    expect(h2.arranged).toHaveLength(1);
    f.release();
    await p;
    expect(h2.arranged).toHaveLength(1);
  });

  it('差し替えのあとに待たせた組みは、古い依頼の終わりで組む（なくさない）', async () => {
    const f = fakeDeps(true);
    const h = fakeHost([noPlace('a')], ['a']);
    const r = createPlaceRunner(f.deps);
    r.connect(h.host);
    const p = r.run('client');
    r.abort();
    r.holdArrange();
    f.release();
    await p;
    expect(h.arranged).toHaveLength(1);
  });

  it('帯の文', () => {
    expect(placeRunText('お客様', { results: [{} as never, {} as never], total: 400 })).toBe(
      'お客様の緯度・経度を探しています 2/400人',
    );
  });
});

describe('autoArrangeIdle', () => {
  it('組んでいなければすぐ、組んでいれば終わってから進む（PRD D445）', async () => {
    const run = createValueStore<AutoRun | null>(null);
    await autoArrangeIdle({ run });
    run.set({ index: 0, total: 3, waiting: 0 });
    let resolved = false;
    const p = autoArrangeIdle({ run }).then(() => {
      resolved = true;
    });
    run.set({ index: 1, total: 3, waiting: 0 });
    await Promise.resolve();
    expect(resolved).toBe(false);
    run.set(null);
    await p;
    expect(resolved).toBe(true);
  });
});

// 住所から位置をまとめて探す処理の入れ物（PRD D427・D445。ADR-0016・ADR-0094）：画面ではなくアプリで1つ持ち、画面を移っても続ける
// （〈利用者さん〉400人などで数分かかる間に、予定の画面へ移っても止めない）。〈利用者さん〉と〈スタッフ〉は1本の列に並べ、外部の検索は同時に1本。
// 置けた人は1人ごとに store の update で書く（1回の「まとめて探す」は全体の「元に戻す」の1手）。
// 探し終えたら、位置のそろったデータで担当なし・要対応を自動で1回組む（まとめて探して位置を入れた人がいたとき・探すあいだに読み込みの自動の組みを
// 待たせたとき。探すあいだに組むと、位置が変わり続けて日を飛ばす・位置なし（移動30分）で決まった担当が残るため）。
// データを丸ごと差し替えたら（読み込み・直前の状態に戻すなど）止め、あとで組まない。画面は依頼・止める・進み具合を読むだけ
import type { DemoData } from '../contracts/data';
import { requestImportArrange } from './autoArrangeBatch';
import { lookupPostalCode, searchAddress } from './geocode';
import {
  type PlaceAllOptions,
  type PlaceAllResult,
  type PlaceKind,
  placeAll,
  placeAllTargets,
  sleep,
  withFoundPlace,
} from './placeAll';
import { createPlaceLane, createPlaceRunGate, type PlaceRunGate } from './placeRunQueue';
import { createValueStore, type ReadableStore, type ValueStore } from './valueStore';

/** 1つの種類の進み具合 */
export type PlaceRunState = {
  /** 走っている（ほかの種類が終わるのを待っている間も） */
  running: boolean;
  /** ほかの種類の置く処理が終わるのを待っている */
  waiting: boolean;
  /** 今回の対象の数（続けて探した分も足す） */
  total: number;
  results: readonly PlaceAllResult[];
  /** 止めて終わった */
  stopped: boolean;
  /** 一度でも探したか（ボタンを「続きを探す」にする） */
  tried: boolean;
};

export const PLACE_IDLE: PlaceRunState = {
  running: false,
  waiting: false,
  total: 0,
  results: [],
  stopped: false,
  tried: false,
};

/** 終わった知らせ（終わるたびに新しい物。画面はこれを見てトーストを出す） */
export type PlaceRunDone = { kind: PlaceKind; placed: number; stopped: boolean };

/** データの持ち主（App の直下でつなぐ） */
export type PlaceHost = {
  get(): DemoData;
  update(fn: (d: DemoData) => DemoData, label: string, opts: { group: object }): void;
  /** 担当なし・要対応を自動で組む（lib/autoArrangeBatch の requestBandArrange） */
  arrange(data: DemoData): void;
};

/** 外部の検索（テストは差し替える） */
export type PlaceDeps = Pick<PlaceAllOptions, 'search' | 'lookup' | 'wait'>;

export type PlaceRunner = {
  state: Record<PlaceKind, ReadableStore<PlaceRunState>>;
  done: ReadableStore<PlaceRunDone | null>;
  /** まとめて置く。ids を渡せばその人だけ（一覧の行の［住所から探す］）。走っている最中なら終わったあと残りを続けて探す */
  run(kind: PlaceKind, ids?: readonly string[]): Promise<void>;
  /** 止める（今の1人の検索を取り消す。待っている間なら待つのをやめる） */
  stop(kind: PlaceKind): void;
  /** どちらかの種類が走っている・待っているか */
  busy(): boolean;
  /** 探し終えたら自動で組む（読み込みのあとの自動の組みを、探し終えるまで待たせる。PRD D442・D445） */
  holdArrange(): void;
  /** データを丸ごと差し替えた：止めて、あとで組まない */
  abort(): void;
  connect(host: PlaceHost): () => void;
};

const LABEL = '住所をまとめて探す';

/** 上の帯の文（「お客様の緯度・経度を探しています 120/400人」） */
export const placeRunText = (who: string, s: Pick<PlaceRunState, 'results' | 'total'>): string =>
  `${who}の緯度・経度を探しています ${s.results.length}/${s.total}人`;

export function createPlaceRunner(deps: PlaceDeps): PlaceRunner {
  const state: Record<PlaceKind, ValueStore<PlaceRunState>> = {
    client: createValueStore(PLACE_IDLE),
    staff: createValueStore(PLACE_IDLE),
  };
  const done = createValueStore<PlaceRunDone | null>(null);
  const lane = createPlaceLane();
  const gates: Record<PlaceKind, PlaceRunGate> = { client: createPlaceRunGate(), staff: createPlaceRunGate() };
  const ctrl: Record<PlaceKind, AbortController | null> = { client: null, staff: null };
  let host: PlaceHost | null = null;
  /** 差し替えの世代（abort で進め、前の世代は書かず・組まない） */
  let generation = 0;
  /** 探し終えたら組む */
  let arrangeAfter = false;
  const set = (kind: PlaceKind, patch: Partial<PlaceRunState> | ((s: PlaceRunState) => Partial<PlaceRunState>)) =>
    state[kind].set((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  const anyRunning = () => state.client.get().running || state.staff.get().running;

  /** 1回分を置く。done はこの続きで探し終えた人（見つからなかった人を続きで探し直さない）。対象がいなければ null */
  const batch = async (
    kind: PlaceKind,
    c: AbortController,
    ids: readonly string[] | undefined,
    seen: Set<string>,
    gen: number,
    onPlaced: () => void,
  ) => {
    const h = host;
    if (c.signal.aborted || !h) return null;
    const all = placeAllTargets(h.get(), kind).targets.filter((p) => !seen.has(p.id));
    const list = ids ? all.filter((p) => ids.includes(p.id)) : all;
    if (list.length === 0) return null;
    for (const p of list) seen.add(p.id);
    set(kind, (s) => ({ waiting: false, tried: true, total: s.total + list.length }));
    const group = {};
    const write = (x: PlaceAllResult, found: { lat: number | null; lng: number | null; address: string }) => {
      if (gen !== generation) return;
      h.update((d) => withFoundPlace(d, kind, x.personId, x.from, found), LABEL, { group });
    };
    return placeAll(list, {
      ...deps,
      signal: c.signal,
      onResult: (x) => {
        set(kind, (s) => ({ results: [...s.results, x] }));
        if (x.ok) {
          onPlaced();
          write(x, x);
        } else if (x.foundAddress !== null) {
          // 郵便番号で住所は見つかったが位置が見つからない人は、住所だけ書く
          write(x, { lat: null, lng: null, address: x.foundAddress });
        }
      },
    });
  };

  const run = async (kind: PlaceKind, ids?: readonly string[]) => {
    const h = host;
    if (!h) return;
    const has = placeAllTargets(h.get(), kind).targets.some((p) => !ids || ids.includes(p.id));
    if (!has || !gates[kind].request()) return;
    const c = new AbortController();
    ctrl[kind] = c;
    const gen = generation;
    const seen = new Set<string>();
    let placed = 0;
    let any = false;
    let pick = ids;
    state[kind].set({ ...PLACE_IDLE, running: true });
    do {
      set(kind, { waiting: lane.busy() });
      const once = await lane.run(
        () =>
          batch(kind, c, pick, seen, gen, () => {
            placed += 1;
          }),
        c.signal,
      );
      if (once) any = true;
      pick = undefined;
    } while (gates[kind].finish(c.signal.aborted));
    if (ctrl[kind] === c) ctrl[kind] = null;
    const current = gen === generation;
    set(kind, { running: false, waiting: false, stopped: current && any && c.signal.aborted });
    if (!current) return;
    if (any) done.set({ kind, placed, stopped: c.signal.aborted });
    // まとめて探して位置を入れた人がいれば、探し終えたあとに組む（1人だけ探す行の［住所から探す］では組まない）
    if (placed > 0 && ids === undefined) arrangeAfter = true;
    // 両方の種類が終わってから、位置のそろったデータで1回組む
    if (arrangeAfter && !anyRunning() && host) {
      arrangeAfter = false;
      host.arrange(host.get());
    }
  };

  const stop = (kind: PlaceKind) => ctrl[kind]?.abort();

  return {
    state,
    done,
    run,
    stop,
    busy: anyRunning,
    holdArrange: () => {
      arrangeAfter = true;
    },
    abort: () => {
      generation++;
      arrangeAfter = false;
      stop('client');
      stop('staff');
    },
    connect: (h) => {
      host = h;
      return () => {
        if (host !== h) return;
        host = null;
        generation++;
        arrangeAfter = false;
        stop('client');
        stop('staff');
      };
    },
  };
}

/** アプリで1つの入れ物 */
export const placeRunner: PlaceRunner = createPlaceRunner({
  search: searchAddress,
  lookup: lookupPostalCode,
  wait: sleep,
});

/**
 * 読み込み・取り込みのあとの自動の組み（PRD D442）。住所を探しているあいだは組まずに待たせ、探し終えてから位置のそろったデータで組む（PRD D445）
 */
export function arrangeAfterImport(before: DemoData, after: DemoData, today: string): void {
  if (placeRunner.busy()) placeRunner.holdArrange();
  else requestImportArrange(before, after, today);
}

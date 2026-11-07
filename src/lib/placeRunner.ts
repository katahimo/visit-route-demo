// 住所から位置をまとめて探す処理の入れ物（PRD D427・D445。ADR-0016・ADR-0094）：画面ではなくアプリで1つ持ち、画面を移っても続ける
// （〈利用者さん〉400人などで数分かかる間に、予定の画面へ移っても止めない）。外部の検索は鍵で同時に1本、人数の少ない〈スタッフ〉を先に探す。
// 置けた人は1人ごとに store の update で書く（1回の「まとめて探す」は全体の「元に戻す」の1手）。
// 組みに効く人（予定のある〈利用者さん〉・〈スタッフ〉。lib/placePriority）を先に探し、探し終えた時点で位置のそろったデータで担当なし・要対応を自動で1回組む（組みに効く人に位置を入れたとき・探すあいだに読み込みの自動の組みを
// 待たせたとき。探すあいだに組むと、位置が変わり続けて日を飛ばす・位置なし（移動30分）で決まった担当が残るため）。
// データを丸ごと差し替えたら（読み込み・直前の状態に戻すなど）止め、あとで組まない。画面は依頼・止める・進み具合を読むだけ
import type { DemoData } from '../contracts/data';
import { requestImportArrange } from './autoArrangeBatch';
import { lookupPostalCode, searchAddress } from './geocode';
import {
  PLACE_ALL_INTERVAL_MS,
  type PlaceAllOptions,
  type PlaceAllResult,
  type PlaceKind,
  type PlacePerson,
  placeAll,
  placeAllTargets,
  sleep,
  withFoundPlace,
} from './placeAll';
import { arrangeReady, mattersForArrange, placeOrder } from './placePriority';
import { createPlaceLock, createPlaceRunGate, type PlaceLock, type PlaceRunGate } from './placeRunQueue';
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
  /** 今日（YYYY-MM-DD。探す順・組める段階を決める） */
  today(): string;
  /**
   * 自動の組みが終わるまで待つ（組んでいるあいだに位置を書くと、組みがその日を「組み始めたときと違う」として飛ばすので、
   * 途中で組んだら次の人を探す前に待つ）
   */
  settle(signal: AbortSignal): Promise<void>;
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
  /**
   * 組みに効く人（予定のある〈利用者さん〉・〈スタッフ〉）を探し終えたら自動で組む（読み込みのあとの自動の組みを、それまで待たせる。PRD D442・D445）。
   * もう探し終えていればすぐ組む
   */
  holdArrange(before: DemoData, after: DemoData): void;
  /** データを丸ごと差し替えた：止めて、あとで組まない */
  abort(): void;
  connect(host: PlaceHost): () => void;
};

const LABEL = '住所をまとめて探す';

/** 上の帯の文（「お客様の緯度・経度を探しています 120/400人」） */
export const placeRunText = (who: string, s: Pick<PlaceRunState, 'results' | 'total'>): string =>
  `${who}の緯度・経度を探しています ${s.results.length}/${s.total}人`;

/**
 * 1人ずつ順に探す（placeAll を1人ずつ呼び、あいだに間隔をあける）。探す前に毎回いまのデータで探す順を決め直す
 * （lib/placePriority の placeOrder。探すあいだに予約を読み込んでも、予定のある人を先に探す）。止めたら stopped。
 * 外部の検索は鍵（lock）で同時に1本。〈スタッフ〉は少ないので、走り出したら終わるまで鍵を持ち、〈利用者さん〉は1人ごとに取り直す
 * （〈利用者さん〉を探している途中で〈スタッフ〉を頼まれたら、今の1人のあとに〈スタッフ〉を先に探す。PRD D445）
 */
async function placeEach(x: {
  deps: PlaceDeps;
  host: PlaceHost;
  kind: PlaceKind;
  signal: AbortSignal;
  lock: PlaceLock;
  /** 鍵を待ち始めた・取れた */
  onWait: (waiting: boolean) => void;
  /** まだ探していない対象（いまのデータで） */
  remaining: () => PlacePerson[];
  onResult: (r: PlaceAllResult) => void;
  /** 探す人を決めた（続きで探し直さないよう、探す前に印を付ける） */
  onPick: (id: string) => void;
  /** 1人探し終えた（見つからなかった人も） */
  onSearched: (id: string) => void;
  /** 1人探し終えたあとの、まだ探していない人の数（対象の数を直す。名簿で増えた・手で置いた人も合う） */
  onRemaining: (n: number) => void;
}): Promise<{ stopped: boolean }> {
  const holdAll = x.kind === 'staff';
  const take = () => x.lock.acquire(holdAll ? 0 : 1, x.signal, x.onWait);
  const whole = holdAll ? await take() : null;
  if (holdAll && !whole) return { stopped: true };
  try {
    for (let list = x.remaining(); list.length > 0; list = x.remaining()) {
      const release = holdAll ? null : await take();
      if (!holdAll && !release) return { stopped: true };
      try {
        await x.host.settle(x.signal);
        if (x.signal.aborted) return { stopped: true };
        const now = x.remaining();
        if (now.length === 0) break;
        const next = placeOrder(x.host.get(), x.kind, now, x.host.today())[0]!;
        x.onPick(next.id);
        const r = await placeAll([next], { ...x.deps, signal: x.signal, onResult: x.onResult });
        if (r.stopped) return r;
        x.onSearched(next.id);
        const left = x.remaining().length;
        x.onRemaining(left);
        // 次の検索まで間隔をあける（鍵を持ったまま。外部の検索の間隔は種類をまたいでそろえる。最後の人のあとはあけない）
        if (left > 0) await x.deps.wait(PLACE_ALL_INTERVAL_MS, x.signal);
      } finally {
        release?.();
      }
    }
    // みな探し終えた（最後の人のあとに止めても、探し終えたので止めたとしない）
    return { stopped: false };
  } finally {
    whole?.();
  }
}

/** まだ探していない対象（ids を渡せばその人だけ） */
function remainingTargets(
  d: DemoData,
  kind: PlaceKind,
  seen: ReadonlySet<string>,
  ids: readonly string[] | undefined,
): PlacePerson[] {
  const all = placeAllTargets(d, kind).targets.filter((p) => !seen.has(p.id));
  return ids ? all.filter((p) => ids.includes(p.id)) : all;
}

/** 書く場所（見つかった位置。郵便番号で住所は見つかったが位置が見つからない人は住所だけ。何も無ければ null） */
function foundOf(x: PlaceAllResult): { lat: number | null; lng: number | null; address: string } | null {
  if (x.ok) return x;
  return x.foundAddress !== null ? { lat: null, lng: null, address: x.foundAddress } : null;
}

type PlacePatch = Partial<PlaceRunState> | ((s: PlaceRunState) => Partial<PlaceRunState>);

/** 種類ごとの進み具合の入れ物と、一部だけ書き換える手 */
function placeStates() {
  const state: Record<PlaceKind, ValueStore<PlaceRunState>> = {
    client: createValueStore(PLACE_IDLE),
    staff: createValueStore(PLACE_IDLE),
  };
  const set = (kind: PlaceKind, patch: PlacePatch) =>
    state[kind].set((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  return { state, set };
}

export function createPlaceRunner(deps: PlaceDeps): PlaceRunner {
  const { state, set } = placeStates();
  const done = createValueStore<PlaceRunDone | null>(null);
  const lock = createPlaceLock();
  const gates: Record<PlaceKind, PlaceRunGate> = { client: createPlaceRunGate(), staff: createPlaceRunGate() };
  const ctrl: Record<PlaceKind, AbortController | null> = { client: null, staff: null };
  let host: PlaceHost | null = null;
  /** 差し替えの世代（abort で進め、前の世代は書かず・組まない） */
  let generation = 0;
  /** 組む段階になったら組む（読み込みの自動の組みを待たせた・組みに効く人に位置を入れた） */
  let arrangeAfter = false;
  /** 探した人（見つからなかった人も。`${kind}:${id}`。組める段階かを見る。両方の種類が終わったら空にする） */
  const tried = new Set<string>();
  /** 走っている依頼の世代（走っていなければ null） */
  const runGen: Record<PlaceKind, number | null> = { client: null, staff: null };
  /** 今の世代で走っている・待っているか（差し替えで止めた古い依頼は、最後の検索の応答を待つあいだも数えない） */
  const anyRunning = () => runGen.client === generation || runGen.staff === generation;

  /** 組む段階なら組む：組みを待たせていて、組みに効く人をみな探した（PRD D445。残りの人は裏で探し続ける） */
  const arrangeIfReady = (data?: DemoData) => {
    const h = host;
    const d = data ?? h?.get();
    if (!arrangeAfter || !h || !d) return;
    // 位置の無い〈スタッフ〉は、〈スタッフ〉を探しているときだけ待つ（探していなければ待っても入らない）
    if (anyRunning() && !arrangeReady(d, h.today(), tried, { staff: runGen.staff === generation })) return;
    arrangeAfter = false;
    h.arrange(d);
  };

  /** 1回分を置く（seen はこの続きで探し終えた人。見つからなかった人を続きで探し直さない。順は placeEach）。対象がいなければ null */
  const batch = async (
    kind: PlaceKind,
    c: AbortController,
    ids: readonly string[] | undefined,
    seen: Set<string>,
    gen: number,
    onPlaced: () => void,
  ): Promise<{ stopped: boolean } | null> => {
    const h = host;
    if (c.signal.aborted || !h) return null;
    const remaining = () => remainingTargets(h.get(), kind, seen, ids);
    const list = remaining();
    if (list.length === 0) return null;
    set(kind, (s) => ({ waiting: false, tried: true, total: s.total + list.length }));
    const group = {};
    return placeEach({
      deps,
      host: h,
      kind,
      signal: c.signal,
      lock,
      onWait: (waiting) => set(kind, { waiting }),
      remaining,
      onPick: (id) => seen.add(id),
      onResult: (x) => {
        if (gen !== generation) return;
        set(kind, (s) => ({ results: [...s.results, x] }));
        const found = foundOf(x);
        if (found) h.update((d) => withFoundPlace(d, kind, x.personId, x.from, found), LABEL, { group });
        if (!x.ok) return;
        onPlaced();
        // まとめて探して組みに効く人に位置を入れたら、組む段階で組む（1人だけ探す行の［住所から探す］では組まない）
        if (ids === undefined && mattersForArrange(h.get(), kind, x.personId, h.today())) arrangeAfter = true;
      },
      onSearched: (id) => {
        tried.add(`${kind}:${id}`);
        if (gen === generation) arrangeIfReady();
      },
      onRemaining: (n) => set(kind, (s) => ({ total: s.results.length + n })),
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
    runGen[kind] = gen;
    // 「続きを探す」の印（tried）は残す（止めたのが列で待っているあいだでも）
    state[kind].set((s) => ({ ...PLACE_IDLE, tried: s.tried, running: true }));
    do {
      const once = await batch(kind, c, pick, seen, gen, () => {
        placed += 1;
      });
      if (once) any = true;
      pick = undefined;
    } while (gates[kind].finish(c.signal.aborted));
    if (ctrl[kind] === c) ctrl[kind] = null;
    if (runGen[kind] === gen) runGen[kind] = null;
    // 差し替えで止めた古い依頼は、進み具合を書かない（差し替えで空にした。あとの依頼の進み具合を消さない）。差し替えのあとに待たせた組みは組む
    if (gen !== generation) {
      if (!anyRunning()) tried.clear();
      arrangeIfReady();
      return;
    }
    set(kind, { running: false, waiting: false, stopped: any && c.signal.aborted });
    if (any) done.set({ kind, placed, stopped: c.signal.aborted });
    // 両方の種類が終わったら、待たせている組みを組む（組みに効く人の検索を止めた・見つからなかったときも）
    if (!anyRunning()) tried.clear();
    arrangeIfReady();
  };

  const stop = (kind: PlaceKind) => ctrl[kind]?.abort();
  /** 今の依頼を捨てる（書かず・組まない） */
  const drop = () => {
    generation++;
    arrangeAfter = false;
    tried.clear();
    stop('client');
    stop('staff');
  };
  return {
    state,
    done,
    run,
    stop,
    busy: anyRunning,
    holdArrange: (before, after) => {
      arrangeAfter = true;
      // 入れた直後で、描き直す前（つないだデータがまだ入れる前）なら入れたあとのデータで見る
      arrangeIfReady(host?.get() === before ? after : undefined);
    },
    abort: () => {
      drop();
      // 古いデータの進み具合・結果は出さない
      state.client.set(PLACE_IDLE);
      state.staff.set(PLACE_IDLE);
    },
    connect: (h) => {
      host = h;
      return () => {
        if (host !== h) return;
        host = null;
        drop();
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
  if (placeRunner.busy()) placeRunner.holdArrange(before, after);
  else requestImportArrange(before, after, today);
}

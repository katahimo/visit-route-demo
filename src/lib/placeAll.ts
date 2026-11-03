import type { DemoData, RosterKind } from '../contracts/data';
import type { ClientPlace, Place, Terms } from '../contracts/documents';
import { UNPLACED_TRAVEL_MIN } from '../matching/travel';
import { colorOf, initialOf } from './colors';
import { byName, hasLocation } from './common';
import type { GeoHit, LookupFail, LookupOptions, LookupResult, PostalHit } from './geocode';
import { staffColorMap, staffMarkText } from './staffMark';

/**
 * 位置の無い人をまとめて地図に置く（PRD D89・D427。ADR-0016・ADR-0094）。〈利用者さん〉は場所、〈スタッフ〉は自宅。
 * 1人ずつ順に、外部の検索を呼ぶたびに間隔をあける。結果は1人ごとに onResult で返し、書くのは画面（store の update）
 */

/** 呼ぶたびにあける間隔の既定（ミリ秒） */
export const PLACE_ALL_INTERVAL_MS = 400;

/** まとめて置く人の種類（名簿の種類と同じ） */
export type PlaceKind = RosterKind;

/**
 * まとめて置く人（種類をそろえた形）。place.postalCode は〈スタッフ〉では ''（自宅の郵便番号は保存しない。D121）。
 * counted は数える人か（〈利用者さん〉は段階が「終了」でない人・〈スタッフ〉は休止でない人）。mark は地図の点の文字と色
 */
export type PlacePerson = {
  id: string;
  name: string;
  place: ClientPlace;
  counted: boolean;
  mark: { label: string; color: string };
};

/** 画面の文（種類ごと） */
export type PlaceAllTexts = {
  /** 欄の見出し（「緯度・経度が未登録の〈利用者さん〉」） */
  heading: string;
  /** 探す手がかりのある人（「住所・郵便番号あり」） */
  has: string;
  /** 手がかりの無い人（「どちらも無い」） */
  hasNot: string;
  /** 置ける人がいないときの理由 */
  none: string;
  /** ボタンの説明 */
  how: string;
  /** 手がかりの無い人の見出し */
  skipped: string;
  /** 呼び方（〈利用者さん〉・〈スタッフ〉） */
  term: string;
};

/** 種類ごとの違い（分岐はここ1か所） */
type PlaceAccess = {
  people: (d: Pick<DemoData, 'clients' | 'staff'>) => PlacePerson[];
  /** id の人の場所（住所・位置）を書く。郵便番号はそのまま */
  write: (d: DemoData, id: string, p: Place) => DemoData;
  texts: (t: Terms) => PlaceAllTexts;
};

function placeAccess(kind: PlaceKind): PlaceAccess {
  switch (kind) {
    case 'client':
      return {
        people: (d) =>
          d.clients.map((c) => ({
            id: c.id,
            name: c.displayName,
            place: c.place,
            counted: c.stage !== 'ended',
            mark: { label: initialOf(c.displayName), color: colorOf(c.color) },
          })),
        write: (d, id, p) => ({
          ...d,
          clients: d.clients.map((c) => (c.id === id ? { ...c, place: { ...c.place, ...p } } : c)),
        }),
        texts: (t) => ({
          heading: `緯度・経度が未登録の${t.client}`,
          has: '住所・郵便番号あり',
          hasNot: '住所・郵便番号なし',
          none: '住所か郵便番号のある未登録の人がいません',
          how: '住所（無ければ郵便番号）から緯度・経度を探して入れます',
          skipped: `住所も郵便番号もない${t.client}`,
          term: t.client,
        }),
      };
    case 'staff':
      return {
        people: (d) => {
          const colors = staffColorMap(d.staff);
          return d.staff.map((s) => ({
            id: s.id,
            name: s.name,
            place: { ...s.home, postalCode: '' },
            counted: s.active,
            mark: { label: staffMarkText(s), color: colors.get(s.id) ?? '#e8735f' },
          }));
        },
        write: (d, id, p) => ({
          ...d,
          staff: d.staff.map((s) => (s.id === id ? { ...s, home: { ...s.home, ...p } } : s)),
        }),
        texts: (t) => ({
          heading: `自宅の緯度・経度が未登録の${t.staff}`,
          has: '住所あり',
          hasNot: '住所なし',
          none: '住所のある未登録の人がいません',
          how: '自宅の住所から緯度・経度を探して入れます',
          skipped: `自宅の住所が無い${t.staff}`,
          term: t.staff,
        }),
      };
    default: {
      const _: never = kind;
      return _;
    }
  }
}

/** その種類の人すべて（数えない人も。名前・地図の点を引くのに使う） */
export const placePeople = (d: Pick<DemoData, 'clients' | 'staff'>, kind: PlaceKind): PlacePerson[] =>
  placeAccess(kind).people(d);

/** 画面の文 */
export const placeAllTexts = (kind: PlaceKind, terms: Terms): PlaceAllTexts => placeAccess(kind).texts(terms);

/**
 * まとめて置く対象：位置が無く、数える人（〈利用者さん〉は終了でない・〈スタッフ〉は休止でない）のうち、
 * 住所か郵便番号のある人（名前の順）。skipped は住所も郵便番号もない人（〈スタッフ〉は住所の無い人）
 */
export function placeAllTargets(
  d: Pick<DemoData, 'clients' | 'staff'>,
  kind: PlaceKind,
): { targets: PlacePerson[]; skipped: PlacePerson[] } {
  const pool = placePeople(d, kind)
    .filter((p) => p.counted && !hasLocation(p.place))
    .sort(byName);
  const can = (p: PlacePerson) => p.place.address.trim() !== '' || p.place.postalCode !== '';
  return { targets: pool.filter(can), skipped: pool.filter((p) => !can(p)) };
}

/** 位置の無い人（数える人のうち。住所の有無は問わない）。一覧の「位置なし」の絞り込みと行の印に使う（PRD D427） */
export function noPlaceIds(d: Pick<DemoData, 'clients' | 'staff'>, kind: PlaceKind): Set<string> {
  return new Set(
    placePeople(d, kind)
      .filter((p) => p.counted && !hasLocation(p.place))
      .map((p) => p.id),
  );
}

/** 〈利用者さん〉一覧の絞り込みに足すチップ「位置なし」のキー（lib/clientFilter の extra） */
export const NO_PLACE_CHIP = 'noPlace';

/** 位置が無くても担当は組めることの補足（ADR-0093） */
export const NO_PLACE_NOTE = `緯度・経度が未登録の場合、移動${UNPLACED_TRAVEL_MIN}分で計算されます`;

/** 1人だけ探せるか：郵便番号・住所の検索が入で、住所か郵便番号があり、まとめて置いている最中でない */
export const canSearchOne = (p: Pick<PlacePerson, 'place'>, x: { geocodeOn: boolean; running: boolean }): boolean =>
  x.geocodeOn && !x.running && (p.place.address.trim() !== '' || p.place.postalCode !== '');

/**
 * まとめて置くボタンの文言（PRD D427）：一度探したあと（止めた・見つからない人が残った）は「続きを探す（N人）」、
 * はじめは「住所から緯度・経度を入れる（N人）」。対象が0人なら人数を付けない
 */
export function placeAllRunLabel(x: { targets: number; tried: boolean }): string {
  if (x.targets <= 0) return '住所から緯度・経度を入れる';
  return x.tried ? `続きを探す（${x.targets}人）` : `住所から緯度・経度を入れる（${x.targets}人）`;
}

/** 名簿の読み込みの確認に足す1文（PRD D427。ADR-0094。この文を見て［名簿を読み込む］を押すのが送る同意） */
export const AUTO_PLACE_NOTE =
  '読み込んだあと、住所から緯度・経度を探します（住所を郵便番号の検索と国土地理院の地図の検索に使います）';

/**
 * 名簿を読み込んだあと、自動でまとめて置き始めるか（PRD D427）：郵便番号・住所の検索が入（geocodeOn）で、
 * 読み込んだあとのデータにまとめて置く対象が1人以上いるとき
 */
export function autoPlaceAfterRoster(x: {
  geocodeOn: boolean;
  next: Pick<DemoData, 'clients' | 'staff'>;
  kind: PlaceKind;
}): boolean {
  return x.geocodeOn && placeAllTargets(x.next, x.kind).targets.length > 0;
}

/** 探したときの住所・郵便番号（書くときに、いまの値と違えば書かない） */
export type PlaceAllFrom = { address: string; postalCode: string };

export type PlaceAllResult =
  | {
      personId: string;
      ok: true;
      lat: number;
      lng: number;
      /** 検索に使った住所（住所が空だった人は郵便番号から見つけた住所） */
      address: string;
      /** 国土地理院が返した住所の名前 */
      title: string;
      from: PlaceAllFrom;
    }
  | {
      personId: string;
      ok: false;
      reason: LookupFail;
      /** どこで失敗したか（郵便番号から住所・住所から位置） */
      step: 'postal' | 'address';
      /** 郵便番号から住所は見つかったが位置が見つからなかったとき、その住所（住所だけ書く）。それ以外は null */
      foundAddress: string | null;
      from: PlaceAllFrom;
    };

export type PlaceAllOptions = {
  search: (address: string, opts: LookupOptions) => Promise<LookupResult<GeoHit>>;
  lookup: (code: string, opts: LookupOptions) => Promise<LookupResult<PostalHit>>;
  /** 間隔をあける（止めたらすぐ戻ってよい） */
  wait: (ms: number, signal?: AbortSignal) => Promise<void>;
  intervalMs?: number;
  signal?: AbortSignal;
  onResult: (r: PlaceAllResult) => void;
};

/**
 * 住所から位置が見つからなかった人がいるか（PRD D427）。いれば結果に「市区町村の名前が無い住所は見つからないことがある」の1行を足す
 */
export function hasAddressNotFound(results: PlaceAllResult[]): boolean {
  return results.some((r) => !r.ok && r.step === 'address' && r.reason === 'notFound');
}

/** 待つ。signal で止めたらすぐ戻る */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener('abort', done);
  });
}

/**
 * 順に置く。住所が空の人は先に郵便番号から住所（先頭の候補）を探す。外部を呼ぶたびに intervalMs あける（最初の前はあけない）。
 * signal で止めたら、次の呼び出しから止める（stopped: true）。止めた呼び出しの結果は返さない
 */
export async function placeAll(targets: PlacePerson[], opts: PlaceAllOptions): Promise<{ stopped: boolean }> {
  const { signal } = opts;
  const intervalMs = opts.intervalMs ?? PLACE_ALL_INTERVAL_MS;
  let calls = 0;
  const call = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    if (calls > 0) await opts.wait(intervalMs, signal);
    if (signal?.aborted) return null;
    calls += 1;
    const r = await fn();
    return signal?.aborted ? null : r;
  };
  for (const c of targets) {
    if (signal?.aborted) return { stopped: true };
    const from: PlaceAllFrom = { address: c.place.address, postalCode: c.place.postalCode };
    let address = c.place.address.trim();
    let foundAddress: string | null = null;
    if (address === '') {
      const r = await call(() => opts.lookup(c.place.postalCode, { signal }));
      if (r === null) return { stopped: true };
      if (!r.ok) {
        opts.onResult({ personId: c.id, ok: false, reason: r.reason, step: 'postal', foundAddress: null, from });
        continue;
      }
      address = r.hits[0].address;
      foundAddress = address;
    }
    const g = await call(() => opts.search(address, { signal }));
    if (g === null) return { stopped: true };
    if (!g.ok) {
      opts.onResult({ personId: c.id, ok: false, reason: g.reason, step: 'address', foundAddress, from });
      continue;
    }
    const hit = g.hits[0];
    opts.onResult({ personId: c.id, ok: true, lat: hit.lat, lng: hit.lng, address, title: hit.title, from });
  }
  return { stopped: false };
}

/**
 * 見つけた位置・住所をその人に書く（store の update(fn) に渡す純粋関数）。書くのは、まだ位置が無く、
 * 住所・郵便番号が探したとき（from）のままの人だけ（その間に利用者が直した人は上書きしない）。
 * 住所が空だった人は見つけた住所も書く。lat・lng が null なら住所だけ書く（郵便番号で住所は見つかったが位置が見つからない人）。
 * 変えなければ同じ data を返す
 */
export function withFoundPlace(
  data: DemoData,
  kind: PlaceKind,
  personId: string,
  from: PlaceAllFrom,
  found: { lat: number | null; lng: number | null; address: string },
): DemoData {
  const access = placeAccess(kind);
  const now = access.people(data).find((x) => x.id === personId)?.place;
  if (!now || hasLocation(now)) return data;
  if (now.address !== from.address || now.postalCode !== from.postalCode) return data;
  const fillAddress = now.address.trim() === '' && found.address.trim() !== '';
  const fillPin = found.lat !== null && found.lng !== null;
  if (!fillAddress && !fillPin) return data;
  return access.write(data, personId, {
    address: fillAddress ? found.address.slice(0, 200) : now.address,
    lat: fillPin ? found.lat : now.lat,
    lng: fillPin ? found.lng : now.lng,
  });
}

/**
 * 編集の欄を保存するときの場所（ADR-0016）：欄を開いた後に「まとめて地図に置く」が store に位置・住所を書いていて、
 * 欄ではその項目を触っていない（開いたときのまま）なら、store の値を残す（欄の古い値で消さない）
 */
export function keepStorePlace<T extends Place>(form: T, opened: T, stored: T | undefined): T {
  if (!stored) return form;
  let out = form;
  const pinUntouched = form.lat === opened.lat && form.lng === opened.lng;
  if (pinUntouched && !hasLocation(opened) && hasLocation(stored)) out = { ...out, lat: stored.lat, lng: stored.lng };
  if (form.address === opened.address && stored.address !== opened.address && opened.address.trim() === '')
    out = { ...out, address: stored.address };
  return out;
}

// 担当なしの訪問の「組めない理由」（PRD D430。ADR-0098）：型（勤務日外・勤務時間外・重なり・移動が間に合わない など）ごとに、
// 短い理由・直し方の案内（1〜2文）・直す画面へのリンクを決める純粋関数。新しい判定は足さず、matching の可否の理由（problem.reasons の
// Infinity の理由）と、可の人を今の列に入れたときの原因（evaluate の unplacedCauses。explain の担当なしの理由と同じ判定）をまとめる。
// 訪問の詳細の「組めない理由」・要対応の帯の内訳・自動の組みの知らせ・日の予定の担当なしの札・「担当を変える ▾」で同じものを使う
import type { Visit } from '../contracts/documents';
import type { Problem, Reason } from '../contracts/problem';
import { weekday } from '../domain/time';
import { BALANCE_RULE_KEY, unplacedCauses } from '../evaluate';
import {
  ABSENCE_OVERLAP,
  ABSENT_ALL_DAY,
  ABSENT_NO_HOURS,
  AFTER_LAST_DAY,
  ALLOWED_STAFF_RULE_ID,
  DAY_OFF,
  FAR_TRIP_RULE_ID,
  OUTSIDE_HOURS,
  PIN_RULE_ID,
  TRAVEL_TOO_FAR_RULE_ID,
  UNPLACED_TRAVEL_MIN,
} from '../matching';
import { WEEKDAY_LABELS } from './common';
import { clockTime } from './dateText';
import { routesOf } from './dayPlan';
import { clientPageHref, clientTravelHref, type HardLink, staffPageHref, TRAVEL_LINK_LABEL } from './hardLinks';
import { travelReasonOf } from './travelReasons';

/**
 * 組めない型。人ごとの型（その人が入れない原因）と、訪問そのものの型（働ける人がいない・時間の約束の幅が正しくない）。
 * 並びは同じ人数のときの順と、案内を選ぶ順（入れられる人がいれば先に）
 */
export const UNASSIGNED_KINDS = [
  'placeable',
  'overlap',
  'cap',
  'travel',
  'noPlace',
  'farTrip',
  'hours',
  'dayOff',
  'absent',
  'afterLast',
  'allowedStaff',
  'requirement',
  'compat',
  'other',
  'noStaff',
  'badWindow',
] as const;
export type UnassignedKind = (typeof UNASSIGNED_KINDS)[number];

/** 型ごとの短い理由（帯・知らせの内訳と、予約・名簿の読み込みの確認文で同じ言葉。PRD D430） */
export const UNASSIGNED_LABELS: Record<UnassignedKind, string> = {
  placeable: '入れられる人あり',
  overlap: '重なり',
  cap: '1日の上限',
  travel: '移動が間に合わない',
  noPlace: '位置なし',
  farTrip: '遠方（出張）の日',
  hours: '勤務時間外',
  dayOff: '勤務日外',
  absent: '欠勤',
  afterLast: '最終勤務日の後',
  allowedStaff: '担当できる人の限定',
  requirement: '必須の条件',
  compat: '相性×',
  other: 'その他',
  noStaff: '働ける人がいない',
  badWindow: '時間の約束の幅',
};

/** 呼び方（data.org.terms） */
export type ReasonTerms = { client: string; staff: string };

/** 型ごとの人数（多い順） */
export type KindCount = { kind: UnassignedKind; label: string; n: number };

/** 担当なしの訪問1件の組めない理由 */
export type UnassignedReason = {
  /** 主な型（案内とリンクはこの型のもの） */
  kind: UnassignedKind;
  /** 主な型の短い理由 */
  label: string;
  /** 人ごとの型の内訳（「勤務時間外 9人・欠勤 2人」。訪問そのものの型は短い理由だけ） */
  summary: string;
  /** 直し方の案内（1〜2文） */
  guide: string;
  /** 直す画面（切った機能の行き先は呼ぶ側で外す） */
  links: HardLink[];
  counts: KindCount[];
};

/** 1人の原因：型と、その人を入れるのに直すものの数（少ない人ほど近い） */
type PersonCause = { staff: number; kind: UnassignedKind; blockers: number; reason: Reason | null };

const isInf = (r: Reason) => r.points === Number.POSITIVE_INFINITY;
const ABSENT_LABELS: readonly string[] = [ABSENT_ALL_DAY, ABSENT_NO_HOURS, ABSENCE_OVERLAP];

/** 可でない人の Infinity の理由1つの型（直すものの種類） */
function kindOfHard(r: Reason): UnassignedKind {
  if (r.ruleId === 'slot') {
    if (r.label === AFTER_LAST_DAY) return 'afterLast';
    if (ABSENT_LABELS.includes(r.label)) return 'absent';
    if (r.label === DAY_OFF) return 'dayOff';
    if (r.label === OUTSIDE_HOURS) return 'hours';
    return 'other';
  }
  if (r.ruleId === 'time') return 'badWindow';
  if (r.ruleId === ALLOWED_STAFF_RULE_ID) return 'allowedStaff';
  if (r.ruleId === PIN_RULE_ID) return 'other';
  if (r.level !== undefined) return 'compat';
  // 種類の必要条件（VISIT_TYPE_RULE_ID）・〈利用者さん〉と〈スタッフ〉の必須の条件・いつもの担当（必須）
  return 'requirement';
}

/** 人の型の決め方：直しても入れない型（担当の限定・必須の条件・相性）を先に、日・時間の型はあと */
const HARD_ORDER: readonly UnassignedKind[] = [
  'badWindow',
  'allowedStaff',
  'requirement',
  'compat',
  'afterLast',
  'absent',
  'dayOff',
  'hours',
  'other',
];

/** 可の人の原因（evaluate の staffCause の ruleId）の型。位置が未登録の組で移動が間に合わないなら「位置なし」 */
function kindOfSoft(cause: Reason, pair: readonly Reason[]): UnassignedKind {
  switch (cause.ruleId) {
    case FAR_TRIP_RULE_ID:
      return 'farTrip';
    case TRAVEL_TOO_FAR_RULE_ID:
      return pair.some((r) => r.ruleId === 'noPlace') ? 'noPlace' : 'travel';
    case BALANCE_RULE_KEY:
      return 'cap';
    case 'cost':
      return 'placeable';
    default:
      return 'overlap';
  }
}

/** 訪問 v の人ごとの原因 */
function personCauses(problem: Problem, v: number, causes: readonly (Reason | null)[]): PersonCause[] {
  return problem.staff.map((_, s) => {
    const pair = problem.reasons[v]?.[s] ?? [];
    const cause = causes[s] ?? null;
    if (cause) return { staff: s, kind: kindOfSoft(cause, pair), blockers: 0, reason: cause };
    const hard = pair.filter(isInf);
    const kinds = new Set(hard.map(kindOfHard));
    const kind = HARD_ORDER.find((k) => kinds.has(k)) ?? 'other';
    return {
      staff: s,
      kind,
      blockers: Math.max(1, kinds.size),
      reason: hard.find((r) => kindOfHard(r) === kind) ?? null,
    };
  });
}

const order = (k: UnassignedKind) => UNASSIGNED_KINDS.indexOf(k);

/** 型ごとの人数（多い順、同じなら UNASSIGNED_KINDS の順） */
export function countKinds(kinds: Iterable<UnassignedKind>): KindCount[] {
  const n = new Map<UnassignedKind, number>();
  for (const k of kinds) n.set(k, (n.get(k) ?? 0) + 1);
  return [...n]
    .map(([kind, c]) => ({ kind, label: UNASSIGNED_LABELS[kind], n: c }))
    .sort((a, b) => b.n - a.n || order(a.kind) - order(b.kind));
}

/** 内訳の文（「勤務時間外 6・勤務日外 5」。unit は数のあとの言葉：人なら「人」、訪問の件数なら空） */
export const countsText = (counts: readonly KindCount[], unit = ''): string =>
  counts.map((c) => `${c.label} ${c.n}${unit}`).join('・');

/** 分の時間帯の文（「9:00〜18:00」） */
const spanText = (a: number, b: number) => `${clockTime(a)}〜${clockTime(b)}`;

/** 勤務時間外の案内：その人たちの勤務（いちばん広い時間帯）と訪問の時間から、勤務の始まり・終わりをいつにすれば収まるか */
function hoursGuide(problem: Problem, v: number, people: readonly PersonCause[], t: ReasonTerms): string {
  const pv = problem.visits[v]!;
  const needEnd = pv.earliest + pv.duration;
  const spans = people.flatMap((p) => problem.staff[p.staff]!.slots);
  const from = Math.min(...spans.map((x) => x.start));
  const to = Math.max(...spans.map((x) => x.end));
  const ranges = [...new Set(spans.map((x) => spanText(x.start, x.end)))];
  const hours = ranges.length > 2 ? `${ranges.slice(0, 2).join('・')} など` : ranges.join('・');
  const fix: string[] = [];
  if (to < needEnd) fix.push(`勤務の終わりを ${clockTime(needEnd)} 以降に`);
  if (from > pv.latest) fix.push(`勤務の始まりを ${clockTime(pv.latest)} 以前に`);
  const visit = spanText(pv.earliest, pv.latest + pv.duration);
  const how = fix.length > 0 ? fix.join('、') : '勤務の時間帯を訪問に合わせて';
  return `勤務（${hours}）に訪問 ${visit} が収まりません。${t.staff}の${how}すると組めます`;
}

/** 入れない人の名前（3人まで。多ければ「ほか」） */
function namesOf(problem: Problem, people: readonly PersonCause[]): string {
  const names = people.map((p) => problem.staff[p.staff]!.name);
  return names.length > 3 ? `${names.slice(0, 3).join('・')} ほか` : names.join('・');
}

/** 理由の文から末尾の ✗ を除く（「必要条件：資格に保育士を含む」） */
const bare = (label: string) => label.replace(/\s*✗$/, '');

/** 直す〈スタッフ〉の画面：1人ならその人の画面、2人以上なら一覧 */
const staffLink = (problem: Problem, people: readonly PersonCause[], label: string): HardLink =>
  people.length === 1 ? { to: staffPageHref(problem.staff[people[0]!.staff]!.id), label } : { to: '/staff', label };

const AVAILABILITY = '/availability';

/** 〈利用者さん〉の画面の節を開いた URL（画面が `?edit=` を読んで節のあるタブへ移る） */
const clientSectionHref = (clientId: string, sec: 'place' | 'staffing' | 'conds') =>
  `${clientPageHref(clientId)}?edit=${sec}`;

/** 主な型の案内とリンク */
function guideOf(
  problem: Problem,
  v: number,
  kind: UnassignedKind,
  people: readonly PersonCause[],
  t: ReasonTerms,
): { guide: string; links: HardLink[] } {
  const pv = problem.visits[v]!;
  const first = people[0]?.reason?.label ?? '';
  switch (kind) {
    case 'placeable':
      return {
        guide: `入れられる${t.staff}がいます（${namesOf(problem, people)}）。「担当を替える」で選ぶか、もう一度組むと入ります`,
        links: [],
      };
    case 'overlap':
      return {
        guide: `入れる${t.staff}（${namesOf(problem, people)}）は、その時間に別の訪問が入っています。訪問の時間をずらすか、${t.staff}を足すか、ほかの訪問を動かすと組めます`,
        links: [],
      };
    case 'cap':
      return {
        guide: `入れる${t.staff}は1日の件数の上限に達しています。条件の「負担の均等」を必須でなくすか、${t.staff}を足すと組めます`,
        links: [{ to: '/rules', label: '条件の重みを直す' }],
      };
    case 'travel':
    case 'farTrip': {
      const key = kind === 'travel' ? TRAVEL_TOO_FAR_RULE_ID : FAR_TRIP_RULE_ID;
      const hint = travelReasonOf({ ruleId: key, label: first }, t)?.hint ?? '';
      return { guide: hint, links: [{ to: clientTravelHref(pv.clientId), label: TRAVEL_LINK_LABEL }] };
    }
    case 'noPlace':
      return {
        guide: `緯度・経度が未登録なので移動を${UNPLACED_TRAVEL_MIN}分とみると、時間の約束に間に合いません。${t.client}と${t.staff}の自宅の緯度・経度を入れると組めます`,
        links: [{ to: clientSectionHref(pv.clientId, 'place'), label: '緯度・経度を入れる' }],
      };
    case 'hours':
      return {
        guide: hoursGuide(problem, v, people, t),
        links: [
          staffLink(problem, people, `${t.staff}の勤務時間を直す`),
          { to: AVAILABILITY, label: '勤務時間（シフト）を直す' },
        ],
      };
    case 'dayOff': {
      const day = WEEKDAY_LABELS[weekday(problem.date)];
      return {
        guide: `${day}曜はどの${t.staff}の勤務日でもありません。${t.staff}の勤務する曜日に${day}曜を足すか、勤務時間（シフト）でその日だけの勤務を足すと組めます`,
        links: [
          staffLink(problem, people, `${t.staff}の勤務する曜日を直す`),
          { to: AVAILABILITY, label: 'その日だけの勤務を足す' },
        ],
      };
    }
    case 'absent':
      return {
        guide: `入れる${t.staff}（${namesOf(problem, people)}）が欠勤です。欠勤を見直すか、勤務時間（シフト）でほかの${t.staff}の勤務を足すと組めます`,
        links: [{ to: AVAILABILITY, label: '勤務時間（シフト）を直す' }],
      };
    case 'afterLast':
      return {
        guide: `${namesOf(problem, people)}は最終勤務日の後です。最終勤務日を見直すか、${t.staff}を足すと組めます`,
        links: [staffLink(problem, people, '最終勤務日を直す')],
      };
    case 'allowedStaff': {
      const names = /^担当を限る：(.*?)\s*✗?$/.exec(first)?.[1] ?? '';
      return {
        guide: `${t.client}の「担当できる人」で限った人${names ? `（${names}）` : ''}が入れません。担当できる人を足すと組めます`,
        links: [{ to: clientSectionHref(pv.clientId, 'staffing'), label: '担当できる人を直す' }],
      };
    }
    case 'requirement': {
      const type = first.startsWith('種類（');
      return {
        guide: `必須の条件${first ? `（${bare(first)}）` : ''}に合う${t.staff}がいません。条件を必須でなくすか、${t.staff}の項目を見直すと組めます`,
        links: type
          ? [{ to: '/types', label: '訪問の種類を直す' }]
          : [
              { to: clientSectionHref(pv.clientId, 'conds'), label: `${t.client}の条件を直す` },
              { to: '/staff', label: `${t.staff}の項目を直す` },
            ],
      };
    }
    case 'compat':
      return {
        guide: `相性×の${t.staff}しか入れません。相性の表を見直すか、${t.staff}を足すと組めます`,
        links: [{ to: '/compat', label: '相性の表を直す' }],
      };
    case 'noStaff':
      return {
        guide: `この日に働ける${t.staff}がいません（休止中を除く）。${t.staff}を足すか、休止を解くと組めます`,
        links: [{ to: '/staff', label: `${t.staff}の一覧を開く` }],
      };
    case 'badWindow':
      return { guide: '時間の約束の幅（開始の早い・遅い）が正しくありません。訪問の時刻を直してください', links: [] };
    case 'other':
      return { guide: `担当を手で選ぶか、${t.staff}を足すと組めます`, links: [] };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** 訪問 v（添字）の組めない理由。causes は evaluate の unplacedCauses のその訪問の分 */
function reasonOf(problem: Problem, v: number, causes: readonly (Reason | null)[], t: ReasonTerms): UnassignedReason {
  const build = (kind: UnassignedKind, people: PersonCause[], counts: KindCount[], summary: string) => {
    const g = guideOf(problem, v, kind, people, t);
    return { kind, label: UNASSIGNED_LABELS[kind], summary, guide: g.guide, links: g.links, counts };
  };
  if (problem.staff.length === 0) return build('noStaff', [], [], UNASSIGNED_LABELS.noStaff);
  const people = personCauses(problem, v, causes);
  if (people.some((p) => p.kind === 'badWindow')) return build('badWindow', [], [], UNASSIGNED_LABELS.badWindow);
  const counts = countKinds(people.map((p) => p.kind));
  // 主な型：入れるのに直すものがいちばん少ない人たち（近い人）の中で、入れられる人がいればそれ、無ければいちばん多い型
  const fewest = Math.min(...people.map((p) => p.blockers));
  const near = countKinds(people.filter((p) => p.blockers === fewest).map((p) => p.kind));
  const main = near.find((c) => c.kind === 'placeable')?.kind ?? near[0]!.kind;
  // 内訳は主な型を先に
  const sorted = [...counts.filter((c) => c.kind === main), ...counts.filter((c) => c.kind !== main)];
  const summary = countsText(sorted, '人');
  return build(
    main,
    people.filter((p) => p.kind === main),
    sorted,
    summary,
  );
}

/**
 * その日の、どの列にも入っていない訪問ごとの組めない理由（訪問 ID → 理由）。ids を渡せばその訪問だけ。
 * routes は担当 → 訪問 ID の列（担当を替える候補を見るときは、その訪問を除いた列を渡す）
 */
export function unassignedReasons(
  problem: Problem,
  routes: Record<string, string[]>,
  terms: ReasonTerms,
  ids?: ReadonlySet<string>,
): Map<string, UnassignedReason> {
  const out = new Map<string, UnassignedReason>();
  const only = ids ? (v: number) => ids.has(problem.visits[v]!.id) : undefined;
  for (const [v, causes] of unplacedCauses(problem, routes, only)) {
    out.set(problem.visits[v]!.id, reasonOf(problem, v, causes, terms));
  }
  return out;
}

/** 訪問1件の組めない理由（列に入っている訪問・問題に無い訪問は null）。担当を替える候補を見るときは、その訪問を除いた列を渡す */
export function unassignedReasonOf(
  problem: Problem,
  routes: Record<string, string[]>,
  visitId: string,
  terms: ReasonTerms,
): UnassignedReason | null {
  return unassignedReasons(problem, routes, terms, new Set([visitId])).get(visitId) ?? null;
}

/** 担当なしの訪問たちの主な型の内訳（帯・知らせ。「勤務時間外 6・勤務日外 5」）。無ければ空の文 */
export const reasonBreakdown = (reasons: Iterable<UnassignedReason>): string =>
  countsText(countKinds([...reasons].map((r) => r.kind)));

/** 日ごとの問題・訪問と、理由を見る担当なしの訪問の ID */
export type DayUnassigned = { problem: Problem | null; visits: readonly Visit[]; ids: readonly string[] };

/**
 * 日をまたいだ担当なしの訪問の組めない理由（要対応の帯の内訳・自動の組みの知らせ）。列はその日の今の担当（routesOf）。
 * 問題の無い日・列に入っている訪問は飛ばす
 */
export function unassignedAcross(days: readonly DayUnassigned[], terms: ReasonTerms): Map<string, UnassignedReason> {
  const out = new Map<string, UnassignedReason>();
  for (const d of days) {
    if (!d.problem || d.ids.length === 0) continue;
    for (const [id, r] of unassignedReasons(d.problem, routesOf(d.problem, d.visits), terms, new Set(d.ids)))
      out.set(id, r);
  }
  return out;
}

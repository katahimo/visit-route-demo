// 予定の画面の上の「要対応の帯」（PRD D383・D391。ADR-0073・ADR-0074）の決まり。
// 日ごとの状態（lib/month の DayStatus。月の画面のマス・要対応と同じ数え方）から、目立たせる訪問だけを数える純粋関数。データは書き換えない。
// 切の種類は 担当なし・重なり・休みの人。エキスパート機能が入なら、そのあとに 組み方の標準が無い・基本情報が変わった（組み直す）・未確定 N日 を足す
import { addDays } from '../domain/time';
import { autoRange } from './autoArrange';
import type { IssueKind, VisitIssue } from './dayPlan';
import type { DayStatus } from './month';

/** 帯に数える訪問の種類：担当なし・重なり（時間が前の訪問と重なる・間に合わない）・休みの人（休みの人に割り当てた訪問） */
export type VisitBandKind = 'unassigned' | 'overlap' | 'off';

/**
 * 帯に数える種類。訪問のほか、入だけの種類：条件に合わない（必須の違反。訪問）・拘束超（日）・組み方の標準が無い・
 * 基本情報が変わった（組み直す）・未確定の日（確定（伝えた）がまだ。PRD D382）。条件に合わない・拘束超はホームの要対応が知らせていたもの
 */
export type BandKind = VisitBandKind | 'notAllowed' | 'overSpan' | 'noStandard' | 'rebuild' | 'unconfirmed';

/** 帯に出す種類の並びと名前（文の並び・押した先を選ぶ順。入だけの3つは訪問の種類のあと） */
export const BAND_KINDS: readonly { kind: BandKind; label: string; unit: string }[] = [
  { kind: 'unassigned', label: '担当なし', unit: '件' },
  { kind: 'overlap', label: '重なり', unit: '件' },
  { kind: 'off', label: '休みの人', unit: '件' },
  { kind: 'notAllowed', label: '条件に合わない', unit: '件' },
  { kind: 'overSpan', label: '拘束超', unit: '日' },
  { kind: 'noStandard', label: '組み方の標準が無い', unit: '' },
  { kind: 'rebuild', label: '基本情報が変わった（組み直す）', unit: '' },
  { kind: 'unconfirmed', label: '未確定', unit: '日' },
];

/** 1つの訪問が複数に当たるときに数える順（休みの人の訪問は働ける時間が無いので重なりは重ねない） */
const PRIORITY: readonly VisitBandKind[] = ['unassigned', 'off', 'overlap'];

/** 訪問の検査の種類 → 帯の種類（条件に合わない（notAllowed）は帯に数えない：目立たせるのは3つだけ。PRD D384） */
const BAND_OF: Record<IssueKind, VisitBandKind | null> = {
  unassigned: 'unassigned',
  off: 'off',
  late: 'overlap',
  notAllowed: null,
};

/** 帯に数える種類の検査か（担当なし・重なり・休みの人。条件に合わないは数えない）。訪問の札の目立たせ方（lib/visitLook の exceptionsOnly）も同じ分け方 */
export const isBandIssue = (kind: IssueKind): boolean => BAND_OF[kind] !== null;

/**
 * 例外だけ見せる（エキスパート機能が切。PRD D384）ときの日の状態：要対応の検査を帯と同じ分け方（担当なし・重なり・休みの人。条件に合わないは除く）に絞り、
 * 要対応の訪問の件数（care）・赤（needsCare）を数え直し、拘束超は見せない（overSpan を空に）。月のマス・右の欄・進み具合・帯の数がそろう。
 * 元の状態は書き換えない
 */
export function exceptionStatus(s: DayStatus): DayStatus {
  const issues = new Map<string, VisitIssue[]>();
  for (const [id, list] of s.issues) {
    const kept = list.filter((x) => isBandIssue(x.kind));
    if (kept.length > 0) issues.set(id, kept);
  }
  return { ...s, issues, care: issues.size, needsCare: issues.size > 0, overSpan: [] };
}

/** 帯が見る日：今日から翌月末まで（自動の組みの範囲 autoRange と同じ。「その他 ▾」の「担当なしの訪問を組む」と件数の範囲をそろえる） */
export function bandDays(today: string): string[] {
  const { from, to } = autoRange(today);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** 押したときに移る先：to は URL（クエリ付き）、date があれば移る前に選んでいる日付をその日にする、visitId があればその訪問を選んで見える所へ巻く（日の予定） */
export type BandGo = { to: string; date?: string; visitId?: string };

/** 入だけの種類の判定に使うもの（エキスパート機能が入のとき渡す。切のときは渡さない） */
export type ExpertBandInput = {
  /** 組み方の標準を登録しているか（登録していなければ「組み方の標準が無い」） */
  hasStandard: boolean;
  /** 基本情報が最後に組んだあとに変わったか（標準が無い間は知らせない。PRD D363） */
  basisChanged: boolean;
  /** 組む月（「基本情報が変わった」を押したときに「担当を組む」で開く月。YYYY-MM） */
  planYm: string;
  /** 切っていない機能の URL か（切った機能へ向かう種類は出さない。PRD D213） */
  isOn: (href: string) => boolean;
};

/** 帯の中身：種類ごとの件数・合計・文・押したときの移る先 */
export type AttentionBand = {
  counts: Record<BandKind, number>;
  /** 1行の文（0件の種類は書かない。例「担当なし 2件・休みの人 1件・未確定 12日」。入だけの標準・組み直しは件数なしの言葉） */
  text: string;
  /**
   * 押したときの移る先：BAND_KINDS の順で最初に当たる種類。訪問の種類なら、いちばん早い日の、開始（earliest）がいちばん早い該当の訪問（今日以降）。
   * 未確定は、1日だけならその日の日の予定、2日以上なら最初の日の月の右の欄（`do=unconfirmed`。PRD D143 の動き）。
   * 組み直しは担当を組む（組む月）、標準が無いは組み方の標準
   */
  go: BandGo;
};

/**
 * 要対応の帯：今日以降の日（日付の順）の、担当なし・重なり・休みの人の訪問の件数と、エキスパート機能が入なら 未確定の日数
 * （訪問があって伝えていない・未連絡の変更のある日。lib/month の monthProgress の unconfirmed と同じ数え方）・基本情報が変わったか・標準が無いか。
 * 1件も無ければ null（帯を出さない）。1つの訪問は1つの種類に数える（担当なし → 休みの人 → 重なり の順で先に当たったもの）。
 * 最初の訪問は、日付 → 開始時刻（startOf＝その訪問の最早開始の分。無ければ最後）の順でいちばん早いもの（同じなら訪問の検査の並び）
 */
export function attentionBand(
  statuses: readonly DayStatus[],
  today: string,
  startOf: (visitId: string) => number | null = () => null,
  expert?: ExpertBandInput,
): AttentionBand | null {
  const counts: Record<BandKind, number> = {
    unassigned: 0,
    overlap: 0,
    off: 0,
    notAllowed: 0,
    overSpan: 0,
    noStandard: 0,
    rebuild: 0,
    unconfirmed: 0,
  };
  let first: (BandGo & { start: number }) | null = null;
  let firstNa: BandGo | null = null;
  const overSpan: string[] = [];
  const days = statuses.filter((s) => s.date >= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const unconfirmed: string[] = [];
  for (const s of days) {
    if (expert && s.count > 0 && s.state !== 'told') unconfirmed.push(s.date);
    if (expert && s.overSpan.length > 0) overSpan.push(s.date);
    for (const [visitId, issues] of s.issues) {
      const kind = PRIORITY.find((k) => issues.some((x) => BAND_OF[x.kind] === k));
      if (!kind) {
        // 条件に合わないだけの訪問（入だけ数える）
        if (expert && issues.some((x) => x.kind === 'notAllowed')) {
          counts.notAllowed++;
          firstNa ??= { to: '/plan', date: s.date, visitId };
        }
        continue;
      }
      counts[kind]++;
      const start = startOf(visitId) ?? Number.POSITIVE_INFINITY;
      // 日付順に回すので、同じ日の中でだけ開始の早いほうに替える（同じなら先に当たったまま）
      if (!first || (first.date === s.date && start < first.start))
        first = { to: '/plan', date: s.date, visitId, start };
    }
  }
  counts.unconfirmed = unconfirmed.length;
  counts.overSpan = overSpan.length;
  if (expert) {
    counts.noStandard = !expert.hasStandard && expert.isOn('/standard') ? 1 : 0;
    counts.rebuild = expert.hasStandard && expert.basisChanged && expert.isOn('/arrange') ? 1 : 0;
  }
  const present = BAND_KINDS.filter((k) => counts[k.kind] > 0);
  if (present.length === 0) return null;
  const goOf: Record<BandKind, BandGo | null> = {
    unassigned: first,
    overlap: first,
    off: first,
    notAllowed: firstNa,
    overSpan: overSpan[0] === undefined ? null : { to: '/plan', date: overSpan[0] },
    noStandard: { to: '/standard' },
    rebuild: { to: `/arrange?ym=${expert?.planYm ?? ''}` },
    unconfirmed: unconfirmedGo(unconfirmed),
  };
  // 担当なし・重なり・休みの人の訪問は、種類によらず最初の1件（日付の順）へ。種類の順で最初に当たったものの先
  const target = goOf[present[0]!.kind];
  if (!target) return null;
  const text = present.map((k) => (k.unit ? `${k.label} ${counts[k.kind]}${k.unit}` : k.label)).join('・');
  const { to, date, visitId } = target;
  return { counts, text, go: { to, date, visitId } };
}

/** 未確定の日の移る先：1日だけならその日の日の予定、2日以上なら最初の日の月の右の欄 */
function unconfirmedGo(dates: readonly string[]): BandGo | null {
  const [firstDate] = dates;
  if (firstDate === undefined) return null;
  if (dates.length === 1) return { to: '/plan', date: firstDate };
  return { to: `/month?ym=${firstDate.slice(0, 7)}&do=unconfirmed` };
}

// 予定の画面の上の「要対応の帯」（PRD D400・D403・D404。ADR-0073・ADR-0074・ADR-0077）の決まり。
// 日ごとの状態（lib/month の DayStatus。月の画面のマス・要対応と同じ数え方）から、目立たせる訪問だけを数える純粋関数。データは書き換えない。
// 切の種類は 担当なし・間に合わない・重なり・休みの人（分け方は lib/bandIssues。ADR-0089）。エキスパート機能が入なら、そのあとに
// 条件に合わない・拘束超・未確定 N日 を足す
import { rangeDays } from './autoArrange';
import { isBandIssue, type VisitBandKind, visitBandKind } from './bandIssues';
import type { VisitIssue } from './dayPlan';
import type { DayStatus } from './month';

/**
 * 帯に数える種類。訪問のほか、入だけの種類：条件に合わない（必須の違反。訪問）・拘束超（日）・
 * 未確定の日（確定（伝えた）がまだ。PRD D382）。条件に合わない・拘束超はホームの要対応が知らせていたもの
 */
export type BandKind = VisitBandKind | 'notAllowed' | 'overSpan' | 'unconfirmed';

/** 帯に出す種類の並びと名前（文の並び・押した先を選ぶ順。入だけの種類は訪問の種類のあと） */
export const BAND_KINDS: readonly { kind: BandKind; label: string; unit: string }[] = [
  { kind: 'unassigned', label: '担当なし', unit: '件' },
  { kind: 'late', label: '間に合わない', unit: '件' },
  { kind: 'overlap', label: '重なり', unit: '件' },
  { kind: 'off', label: '休みの人', unit: '件' },
  { kind: 'notAllowed', label: '条件に合わない', unit: '件' },
  { kind: 'overSpan', label: '拘束超', unit: '日' },
  { kind: 'unconfirmed', label: '未確定', unit: '日' },
];

/**
 * 例外だけ見せる（エキスパート機能が切。PRD D384）ときの日の状態：要対応の検査を帯と同じ分け方（担当なし・間に合わない・重なり・休みの人。条件に合わないは除く）に絞り、
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

/** 帯が見る日：今日から翌月末まで（自動の組みの範囲 autoRange の日＝lib/autoArrange の rangeDays。要対応の帯の「要対応を組む」と件数の範囲をそろえる） */
export const bandDays = (today: string): string[] => rangeDays(today);

/** 押したときに移る先：to は URL（クエリ付き）、date があれば移る前に選んでいる日付をその日にする、visitId があればその訪問を選んで見える所へ巻く（日の予定） */
export type BandGo = { to: string; date?: string; visitId?: string };

/** 帯の中身：種類ごとの件数・合計・文・押したときの移る先 */
export type AttentionBand = {
  counts: Record<BandKind, number>;
  /** 1行の文（0件の種類は書かない。例「担当なし 2件・休みの人 1件・未確定 12日」） */
  text: string;
  /**
   * 押したときの移る先：BAND_KINDS の順で最初に当たる種類。訪問の種類なら、間に合わない・重なり・休みの人の訪問があればそのうち、無ければ担当なしの訪問のうち、
   * いちばん早い日の、開始（earliest）がいちばん早い訪問（今日以降。PRD D403）。
   * 未確定は、1日だけならその日の日の予定、2日以上なら最初の日の月の右の欄（`do=unconfirmed`。PRD D143 の動き）
   */
  go: BandGo;
  /** 帯の訪問の並び（間に合わない・重なり・休みの人 → 担当なし、それぞれ日付 → 開始。順番に見に行く bandStep が使う） */
  visits: BandVisit[];
};

/** 帯の訪問1件（順番に見に行く並びの1つ）。attend は担当なし以外（間に合わない・重なり・休みの人） */
export type BandVisit = { date: string; visitId: string; start: number; attend: boolean };

/**
 * 要対応の帯：今日以降の日（日付の順）の、担当なし・間に合わない・重なり・休みの人の訪問の件数と、エキスパート機能が入なら 未確定の日数
 * （訪問があって伝えていない・未連絡の変更のある日。lib/month の monthProgress の unconfirmed と同じ数え方）・条件に合わない・拘束超。
 * 1件も無ければ null（帯を出さない）。1つの訪問は1つの種類に数える（担当なし → 休みの人 → 間に合わない → 重なり の順で先に当たったもの）。
 * 最初の訪問は、間に合わない・重なり・休みの人を先に（無ければ担当なし）、日付 → 開始時刻（startOf＝その訪問の最早開始の分。無ければ最後）の順でいちばん早いもの（同じなら訪問の検査の並び）
 */
export function attentionBand(
  statuses: readonly DayStatus[],
  today: string,
  startOf: (visitId: string) => number | null = () => null,
  expert = false,
): AttentionBand | null {
  const counts: Record<BandKind, number> = {
    unassigned: 0,
    late: 0,
    overlap: 0,
    off: 0,
    notAllowed: 0,
    overSpan: 0,
    unconfirmed: 0,
  };
  // 帯の訪問：間に合わない・重なり・休みの人（人の目が要る）と担当なしを分けて集め、あとで並べる（PRD D403）
  const found: BandVisit[] = [];
  let firstNa: BandGo | null = null;
  const overSpan: string[] = [];
  const days = statuses.filter((s) => s.date >= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const unconfirmed: string[] = [];
  for (const s of days) {
    if (expert && s.count > 0 && s.state !== 'told') unconfirmed.push(s.date);
    if (expert && s.overSpan.length > 0) overSpan.push(s.date);
    for (const [visitId, issues] of s.issues) {
      const kind = visitBandKind(issues);
      if (!kind) {
        // 条件に合わないだけの訪問（入だけ数える）
        if (expert && issues.some((x) => x.kind === 'notAllowed')) {
          counts.notAllowed++;
          firstNa ??= { to: '/plan', date: s.date, visitId };
        }
        continue;
      }
      counts[kind]++;
      found.push({
        date: s.date,
        visitId,
        start: startOf(visitId) ?? Number.POSITIVE_INFINITY,
        attend: kind !== 'unassigned',
      });
    }
  }
  counts.unconfirmed = unconfirmed.length;
  counts.overSpan = overSpan.length;
  const present = BAND_KINDS.filter((k) => counts[k.kind] > 0);
  if (present.length === 0) return null;
  // 並べ替えは安定（同じ日・同じ開始なら検査の並びのまま）
  const visits = [...found].sort(bandVisitOrder);
  const visitGo = visits[0] ? visitTo(visits[0]) : null;
  const goOf: Record<BandKind, BandGo | null> = {
    unassigned: visitGo,
    late: visitGo,
    overlap: visitGo,
    off: visitGo,
    notAllowed: firstNa,
    overSpan: overSpan[0] === undefined ? null : { to: '/plan', date: overSpan[0] },
    unconfirmed: unconfirmedGo(unconfirmed),
  };
  // 訪問の種類は、間に合わない・重なり・休みの人の最初の1件（日付の順）、無ければ担当なしの最初の1件へ。種類の順で最初に当たったものの先
  const target = goOf[present[0]!.kind];
  if (!target) return null;
  const text = present.map((k) => `${k.label} ${counts[k.kind]}${k.unit}`).join('・');
  const { to, date, visitId } = target;
  return { counts, text, go: { to, date, visitId }, visits };
}

/** 帯の訪問の並び：間に合わない・重なり・休みの人 → 担当なし、それぞれ日付 → 開始の順（PRD D403） */
function bandVisitOrder(a: BandVisit, b: BandVisit): number {
  if (a.attend !== b.attend) return a.attend ? -1 : 1;
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.start === b.start ? 0 : a.start < b.start ? -1 : 1;
}

/** 帯の訪問の移る先（その日の日の予定で、その訪問を選ぶ・欄を開く） */
export const visitTo = (v: BandVisit): BandGo => ({ to: '/plan', date: v.date, visitId: v.visitId });

/**
 * 順番に見に行く（PRD D403。ADR-0089）：今の帯の訪問の並び（list。押したときの帯から作り直したもの）で、最後に見た訪問（seen）の
 * 次（dir=1）か前（dir=-1）の1件と、その位置（0 から）。まだ見ていなければ次は最初・前は最後。最後の次は最初、最初の前は最後へ。
 * 見た訪問が直して消えていれば、並びの同じ位置（種類の組・日付・開始）から次・前を探す（消えた訪問は飛ばす。同じ日・同じ開始の別の訪問は
 * 飛ばさず、次ならその最初・前ならその最後）。並びが空なら null
 */
export function bandStep(
  list: readonly BandVisit[],
  seen: BandVisit | null,
  dir: 1 | -1,
): { index: number; visit: BandVisit } | null {
  const n = list.length;
  if (n === 0) return null;
  let index: number;
  if (!seen) index = dir === 1 ? 0 : n - 1;
  else {
    const at = list.findIndex((v) => v.visitId === seen.visitId);
    if (at >= 0) index = (at + dir + n) % n;
    else if (dir === 1) {
      const next = list.findIndex((v) => bandVisitOrder(v, seen) >= 0);
      index = next >= 0 ? next : 0;
    } else {
      let prev = n - 1;
      for (let i = n - 1; i >= 0; i--)
        if (bandVisitOrder(list[i]!, seen) <= 0) {
          prev = i;
          break;
        }
      index = prev;
    }
  }
  return { index, visit: list[index]! };
}

/** 順番に見に行くで、見た位置（画面の間だけ覚える。保存しない）：最後に見た訪問と、押した回数 */
export type BandSeen = { visit: BandVisit; presses: number };

/**
 * 帯に出す「n/N」（PRD D403）：2件目から（押した回数が2以上）、見た訪問が今の並びにあるときだけ。無ければ null（数と［‹ 前へ］を出さない）
 */
export function bandPlace(list: readonly BandVisit[], seen: BandSeen | null): { n: number; total: number } | null {
  if (!seen || seen.presses < 2 || list.length < 2) return null;
  const at = list.findIndex((v) => v.visitId === seen.visit.visitId);
  return at < 0 ? null : { n: at + 1, total: list.length };
}

/** 未確定の日の移る先：1日だけならその日の日の予定、2日以上なら最初の日の月の右の欄 */
function unconfirmedGo(dates: readonly string[]): BandGo | null {
  const [firstDate] = dates;
  if (firstDate === undefined) return null;
  if (dates.length === 1) return { to: '/plan', date: firstDate };
  return { to: `/month?ym=${firstDate.slice(0, 7)}&do=unconfirmed` };
}

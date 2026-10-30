// 予定の画面の上の「要対応の帯」（エキスパート機能が切のとき。PRD D383。ADR-0073）の決まり。
// 日ごとの状態（lib/month の DayStatus。月の画面のマス・要対応と同じ数え方）から、目立たせる訪問だけを数える純粋関数。データは書き換えない
import { addDays } from '../domain/time';
import { autoRange } from './autoArrange';
import type { IssueKind } from './dayPlan';
import type { DayStatus } from './month';

/** 帯に数える種類：担当なし・重なり（時間が前の訪問と重なる・間に合わない）・休みの人（休みの人に割り当てた訪問） */
export type BandKind = 'unassigned' | 'overlap' | 'off';

/** 帯に出す種類の並びと名前 */
export const BAND_KINDS: readonly { kind: BandKind; label: string }[] = [
  { kind: 'unassigned', label: '担当なし' },
  { kind: 'overlap', label: '重なり' },
  { kind: 'off', label: '休みの人' },
];

/** 1つの訪問が複数に当たるときに数える順（休みの人の訪問は働ける時間が無いので重なりは重ねない） */
const PRIORITY: readonly BandKind[] = ['unassigned', 'off', 'overlap'];

/** 訪問の検査の種類 → 帯の種類（条件に合わない（notAllowed）は帯に数えない：目立たせるのは3つだけ。PRD D384） */
const BAND_OF: Record<IssueKind, BandKind | null> = {
  unassigned: 'unassigned',
  off: 'off',
  late: 'overlap',
  notAllowed: null,
};

/** 帯が見る日：今日から翌月末まで（自動の組みの範囲 autoRange と同じ。「その他 ▾」の「担当なしの訪問を組む」と件数の範囲をそろえる） */
export function bandDays(today: string): string[] {
  const { from, to } = autoRange(today);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** 帯の中身：種類ごとの訪問の件数・合計・文・押したときに開く最初の訪問 */
export type AttentionBand = {
  counts: Record<BandKind, number>;
  total: number;
  /** 1行の文（0件の種類は書かない。例「担当なし 2件・休みの人 1件」） */
  text: string;
  /** 押したときに開く訪問：いちばん早い日の、開始（earliest）がいちばん早い該当の訪問（今日以降） */
  first: { date: string; visitId: string };
};

/**
 * 要対応の帯：今日以降の日（日付の順）の、担当なし・重なり・休みの人の訪問の件数。1件も無ければ null（帯を出さない）。
 * 1つの訪問は1つの種類に数える（担当なし → 休みの人 → 重なり の順で先に当たったもの。休みの人の訪問に重なりは重ねない）。
 * 最初の訪問は、日付 → 開始時刻（startOf＝その訪問の最早開始の分。無ければ最後）の順でいちばん早いもの（同じなら訪問の検査の並び）
 */
export function attentionBand(
  statuses: readonly DayStatus[],
  today: string,
  startOf: (visitId: string) => number | null = () => null,
): AttentionBand | null {
  const counts: Record<BandKind, number> = { unassigned: 0, overlap: 0, off: 0 };
  let first: (AttentionBand['first'] & { start: number }) | null = null;
  const days = statuses.filter((s) => s.date >= today).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const s of days) {
    for (const [visitId, issues] of s.issues) {
      const kind = PRIORITY.find((k) => issues.some((x) => BAND_OF[x.kind] === k));
      if (!kind) continue;
      counts[kind]++;
      const start = startOf(visitId) ?? Number.POSITIVE_INFINITY;
      // 日付順に回すので、同じ日の中でだけ開始の早いほうに替える（同じなら先に当たったまま）
      if (!first || (first.date === s.date && start < first.start)) first = { date: s.date, visitId, start };
    }
  }
  const total = counts.unassigned + counts.overlap + counts.off;
  if (total === 0 || !first) return null;
  const text = BAND_KINDS.filter((k) => counts[k.kind] > 0)
    .map((k) => `${k.label} ${counts[k.kind]}件`)
    .join('・');
  return { counts, total, text, first: { date: first.date, visitId: first.visitId } };
}

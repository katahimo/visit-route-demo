// 来月の確認（PRD D413。ADR-0081）：エキスパート機能が切で、今日が月の20日以降なら、予定の上の要対応の帯の下に
// 「12月の予定 N件はできています」＋来月の担当なし・重なり・休みの人の数を1行で出す。純粋関数（データは書き換えない）。
// 数え方は要対応の帯（lib/attentionBand の visitBandKind）と同じ。閉じたかは端末に覚える（store/navOpen の鍵 nextMonth:<今月>）
import { type VisitBandKind, visitBandKind } from './attentionBand';
import { monthLabel } from './dateText';
import type { DayStatus } from './month';
import { addMonths, ymOf } from './ym';

/** この日から月末まで出す（月の20日以降） */
export const NEXT_MONTH_FROM_DAY = 20;

/** 来月の確認の中身 */
export type NextMonthCheck = {
  /** 来月（YYYY-MM。［〈来月〉を見る ›］の行き先） */
  ym: string;
  /** 来月の名前（「12月」） */
  label: string;
  /** 来月の訪問の件数（取り消し・休みを除く。DayStatus.count の合計） */
  total: number;
  /** 来月の担当なし・重なり・休みの人の訪問の件数（要対応の帯と同じ数え方） */
  counts: Record<VisitBandKind, number>;
  /** 1行の文（「12月の予定 120件はできています・担当なし 2件・休みの人 1件」。0件の種類は書かない） */
  text: string;
};

/** 来月の要対応の並びと名前（要対応の帯の BAND_KINDS の先頭3つと同じ並び） */
const KINDS: readonly { kind: VisitBandKind; label: string }[] = [
  { kind: 'unassigned', label: '担当なし' },
  { kind: 'overlap', label: '重なり' },
  { kind: 'off', label: '休みの人' },
];

/** 閉じたことを覚える鍵（閉じた月ごと。store/navOpen の「開け閉め」に流用：false＝閉じた。ほかの鍵と重ならない） */
export const nextMonthCheckKey = (today: string): string => `nextMonth:${ymOf(today)}`;

/**
 * 来月の確認を出すなら来月（YYYY-MM）、出さないなら null：エキスパート機能が入・月の20日より前・今月の間に閉じた（stored の鍵が false）なら出さない
 */
export function nextMonthTarget(
  today: string,
  expert: boolean,
  stored: Readonly<Record<string, boolean>>,
): string | null {
  if (expert || Number(today.slice(8, 10)) < NEXT_MONTH_FROM_DAY) return null;
  if (stored[nextMonthCheckKey(today)] === false) return null;
  return addMonths(ymOf(today), 1);
}

/** 来月（ym）の日ごとの状態から、訪問の件数と担当なし・重なり・休みの人の件数を数える。来月に訪問が1件も無ければ null（出さない） */
export function nextMonthCheck(statuses: readonly DayStatus[], ym: string): NextMonthCheck | null {
  const counts: Record<VisitBandKind, number> = { unassigned: 0, overlap: 0, off: 0 };
  let total = 0;
  for (const s of statuses) {
    if (ymOf(s.date) !== ym) continue;
    total += s.count;
    for (const issues of s.issues.values()) {
      const kind = visitBandKind(issues);
      if (kind) counts[kind]++;
    }
  }
  if (total === 0) return null;
  const label = monthLabel(ym);
  const parts = [
    `${label}の予定 ${total}件はできています`,
    ...KINDS.filter((k) => counts[k.kind] > 0).map((k) => `${k.label} ${counts[k.kind]}件`),
  ];
  return { ym, label, total, counts, text: parts.join('・') };
}

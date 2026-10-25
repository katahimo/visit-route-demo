// 写した元：katahimo-dev/visit-route-poc @ a46e7db web/src/features/admin/schedule/model.ts
import type { Visit } from '../contracts/documents';
import type { Slot } from './availability';
import { hhmmToMinutes } from './time';

/**
 * 予定画面の手作業案（担当ごとの訪問の割当）の時刻の見積もり。画面と Firebase に依存しない。
 * 回る順番は開始時刻の順で、手では並べ替えない（PRD R3）
 */

export const NONE = '__none';

const byStart = (a: Visit, b: Visit) =>
  a.earliestStart.localeCompare(b.earliestStart) || a.latestStart.localeCompare(b.latestStart);

/** 訪問IDの列を開始時刻の順に並べる */
export function timeOrder(ids: string[], visitById: Map<string, Visit>): string[] {
  return [...ids].sort((a, b) => {
    const x = visitById.get(a);
    const y = visitById.get(b);
    return x && y ? byStart(x, y) : 0;
  });
}

/**
 * 列の中の訪問の時刻（移動時間は入れない目安）と、時間の重なり。
 * 前の訪問が終わるまで次は始められないとして詰め、約束の時刻（幅があれば最も遅い開始）を過ぎる訪問と、
 * その原因になった前の訪問の両方を「重なり」にする。
 * slots（その人の稼働時間帯）を渡すと、約束の幅の中で、作業が時間帯の1つに収まる最も早い時刻に寄せる
 */
export type Slotted = { start: number; end: number; overlap: boolean };
export function timesOf(ids: string[], visitById: Map<string, Visit>, slots?: Slot[]): Map<string, Slotted> {
  const out = new Map<string, Slotted>();
  let free = 0;
  let prevId: string | null = null;
  for (const id of ids) {
    const v = visitById.get(id);
    if (!v) continue;
    const start = fitInSlots(Math.max(hhmmToMinutes(v.earliestStart), free), v, slots);
    const end = start + v.durationMinutes;
    const overlap = start > hhmmToMinutes(v.latestStart);
    out.set(id, { start, end, overlap });
    const prev = prevId ? out.get(prevId) : undefined;
    if (overlap && prev) prev.overlap = true;
    free = end;
    prevId = id;
  }
  return out;
}

/** 約束の幅（最も遅い開始まで）の中で、作業が時間帯の1つに収まる最も早い開始。無ければそのまま */
function fitInSlots(start: number, v: Visit, slots: Slot[] | undefined): number {
  if (!slots) return start;
  const latest = hhmmToMinutes(v.latestStart);
  for (const s of slots) {
    const at = Math.max(start, hhmmToMinutes(s.start));
    if (at <= latest && at + v.durationMinutes <= hhmmToMinutes(s.end)) return at;
  }
  return start;
}

/** 訪問の時間の表示（幅があれば「10:30〜11:30」に開始） */
export function windowText(v: Visit): string {
  return v.windowKind === 'window' ? `${v.earliestStart}〜${v.latestStart}` : v.earliestStart;
}

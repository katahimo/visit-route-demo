// 訪問の詳細の欄（components/VisitPanel）の文と入力の計算。純粋関数
import type { Visit } from '../contracts/documents';
import { hhmmToMinutes, minutesToHhmm } from '../domain/time';
import { dateText } from './dateText';
import type { AssignFail, VisitDraft } from './visitOps';

const hhmm = (s: string) => /^\d{2}:\d{2}$/.test(s);

/** 分 → "HH:mm"（時刻の入力の上限 23:59 で止める） */
const cappedHhmm = (m: number) => minutesToHhmm(Math.min(m, 23 * 60 + 59));

/** 日時の欄の時刻（幅があれば「早〜遅 の間に開始」） */
export function windowShown(x: Pick<Visit, 'windowKind' | 'earliestStart' | 'latestStart'>): string {
  return x.windowKind === 'window' ? `${x.earliestStart}〜${x.latestStart} の間に開始` : x.earliestStart;
}

/** 開始（早）を変えたときの入力の差分（幅を保って最も遅い開始もずらす。時刻の形でなければ開始だけ） */
export function startPatch(draft: VisitDraft, s: string): Partial<VisitDraft> {
  if (!hhmm(s)) return { earliestStart: s };
  const w =
    draft.windowKind === 'window' && hhmm(draft.latestStart)
      ? hhmmToMinutes(draft.latestStart) - hhmmToMinutes(draft.earliestStart)
      : 0;
  return { earliestStart: s, latestStart: cappedHhmm(hhmmToMinutes(s) + Math.max(0, w)) };
}

/** そのままにする回の文（無ければ空） */
export function keptText(dates: readonly string[]): string {
  if (dates.length === 0) return '';
  const head = dates
    .slice(0, 4)
    .map((x) => dateText(x))
    .join('・');
  return `この回だけ変えた・取り消した ${dates.length}回（${head}${dates.length > 4 ? ' など' : ''}）はそのままです。`;
}

/** 保存したときの知らせの文。label は「M/D HH:MM」、range は範囲（「・これ以降」など。無ければ空） */
export function savedText(isNew: boolean, label: string, range: string, failed: readonly AssignFail[]): string {
  const failText =
    failed.length > 0
      ? `。担当を割り当てられなかった回が ${failed.length}件あります（${failed
          .slice(0, 3)
          .map((x) => `${dateText(x.date)} ${x.why}`)
          .join('、')}）`
      : '';
  return `${isNew ? '訪問を追加しました' : '訪問を保存しました'}（${label}${range}）${failText}`;
}

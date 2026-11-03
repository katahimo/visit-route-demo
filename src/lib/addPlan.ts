// 「予定を入れる」（エキスパート機能が切のとき、月・週の主ボタン。PRD D402。ADR-0073 第4段）の決まり：
// 入れ方（定期＝〈利用者さん〉の繰り返しを足す／単発＝その日の訪問を足す）と、欄の初めの値。
// 入力の確かめと保存は今ある仕組み（繰り返しは parsePatternForm、訪問は applyVisitEdit）で、ここは何を聞くかだけを決める。データは書き換えない
import type { DemoData } from '../contracts/data';
import type { Features } from '../contracts/features';
import { weekday } from '../domain/time';
import { isOn } from './features';
import { isDate } from './isDate';
import { MONTH_WEEKS_ERROR, type PatternForm, patternFormOf } from './patternForm';
import { newDraft, type VisitDraft } from './visitDraft';

/** 入れ方：定期（繰り返しを使う＝曜日・時刻・くり返し）／単発（日付・時刻・所要） */
export type AddPlanKind = 'recurring' | 'oneOff';

/** 繰り返しを使う（定期）なら定期、使わない（単発）なら単発（最初の2問の答えで決まる機能の入り切り。lib/startGuide と同じ見分け方） */
export const addPlanKind = (features: Features): AddPlanKind => (isOn(features, 'patterns') ? 'recurring' : 'oneOff');

/** 選べる〈利用者さん〉（利用中の人） */
export const addPlanClients = (d: Pick<DemoData, 'clients'>) => d.clients.filter((c) => c.active);

/** 初めに開く日：今見ている日（今日より前なら今日） */
export const addPlanDate = (shown: string, today: string): string => (shown < today ? today : shown);

/**
 * 定期の初めの欄：曜日は初めの日（見ている日。今日より前なら今日）の曜日、開始日は今日（ADR-0083）、くり返しは毎週、
 * 時刻は 10:00、所要は 60分。種類は選ばない（種類なし）
 */
export function addPlanPatternForm(date: string, today: string): PatternForm {
  return { ...patternFormOf(null, today, 60), weekdays: [weekday(date)], from: today };
}

/** 単発の初めの欄：初めの日・10:00・60分 */
export const addPlanVisitDraft = (d: Pick<DemoData, 'clients'>, date: string, clientId?: string): VisitDraft =>
  newDraft(d, date, clientId, '10:00');

/** 入れたあとの知らせ（when は「月・木 10:00」「11/2 10:00」。auto は担当を自動で組む依頼を出したか） */
export const addPlanDone = (when: string, auto: boolean): string =>
  `予定を入れました（${when}${auto ? '・担当を自動で組みます' : ''}）`;

/** 誤りの欄（引き出しの欄の名前） */
export type AddPlanField = 'client' | 'weekdays' | 'monthWeeks' | 'from' | 'start' | 'date' | 'duration';

/** 誤り：文と、誤った欄（欄と結べないものは field 無し） */
export type AddPlanError = { text: string; field?: AddPlanField };

/** 所要の誤りの文（定期・単発で同じ。契約の範囲 5〜720分） */
export const DURATION_ERROR = '所要は5〜720分で入れてください';

/** 開始日の誤りの文（今日より前・日付でない。ADR-0083） */
export const FROM_ERROR = '開始日は今日以降の日付にしてください';

/**
 * 保存の前に確かめる欄（〈利用者さん〉・定期は曜日と第N（毎月のとき）と開始日（今日以降）・所要）。よければ null。
 * 時刻・日付の確かめは今ある仕組み（parsePatternForm・applyVisitEdit）に任せ、その文は addPlanFieldOf で欄に結ぶ
 */
export function addPlanError(
  kind: AddPlanKind,
  v: {
    clientId: string;
    duration: number;
    form: Pick<PatternForm, 'weekdays' | 'repeat' | 'monthWeeks' | 'from'>;
    today: string;
  },
  clientTerm: string,
): AddPlanError | null {
  if (!v.clientId) return { text: `${clientTerm}を選んでください`, field: 'client' };
  if (kind === 'recurring') {
    if (v.form.weekdays.length === 0) return { text: '曜日を1つ以上選んでください', field: 'weekdays' };
    if (v.form.repeat === 'monthly' && v.form.monthWeeks.length === 0)
      return { text: MONTH_WEEKS_ERROR, field: 'monthWeeks' };
    if (!isDate(v.form.from) || v.form.from < v.today) return { text: FROM_ERROR, field: 'from' };
  }
  if (!Number.isInteger(v.duration) || v.duration < 5 || v.duration > 720)
    return { text: DURATION_ERROR, field: 'duration' };
  return null;
}

/** 今ある仕組みの誤りの文から、誤った欄（定期の開始日・単発の日付・時刻）。分からなければ無し */
export function addPlanFieldOf(text: string, kind: AddPlanKind): AddPlanField | undefined {
  if (/開始日|日付|日にはできません/.test(text)) return kind === 'recurring' ? 'from' : 'date';
  if (/時刻|開始/.test(text)) return 'start';
  return undefined;
}

/** 描画のあとにデータが変わっていて入れられないときの誤りの文 */
export const STALE_ERROR = 'ほかの操作で予定が変わりました。もう一度入れてください';

/** 単発を入れられなかったときの誤りの文：描画のあとでデータが変わっていた（stale）なら入れ直しを促す文、そうでなければ今ある仕組みの文 */
export const addPlanSaveError = (error: string, stale: boolean): string => (stale ? STALE_ERROR : error);

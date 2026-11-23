// 同行（2人体制・研修同行。PRD D473〜D477。ADR-0120）の画面と文のための純粋関数：コピーの欄の選び方・保存の前の確かめ・
// 帯の印と連絡の文に添える一言。組の判定は domain/companion（compile と同じ）。データは書き換えない
import type { DemoData } from '../contracts/data';
import { ACCOMPANY_LABELS, type AccompanyKind, type Visit } from '../contracts/documents';
import { type CompanionOf, companionsOf, hasCompanionBase } from '../domain/companion';
import { visitsOn } from '../patterns';
import { draftOf, type VisitDraft } from './visitDraft';

/** コピーの欄の見出し */
export const COPY_VISIT_LABEL = '訪問をコピー';

/** コピーの欄の「同行」の選び方（'' はふつうのコピー＝別の日時・別の人へ） */
export const COPY_ACCOMPANY_CHOICES: readonly { value: AccompanyKind | ''; label: string; hint: string }[] = [
  { value: '', label: 'ふつうのコピー', hint: '日時・担当を変えて、別の訪問として入れます' },
  { value: 'pair', label: '2人体制', hint: '同じ時刻にもう1人入ります。2人目は AI が選ぶか、ここで選びます' },
  {
    value: 'trainee',
    label: '研修同行',
    hint: '新人が同じ時刻に同行します。同行する人をここで選びます（資格・担当を限る などの条件は見ません）',
  },
];

/** 元の訪問が今日より前で、同行を選べないときの説明 */
export const PAST_ACCOMPANY_HINT = '今日より前の訪問には付けられません（同じ日に訪問を足せないため）';

/** 欄の「同行」の値（'' は無し） */
export const accompanyOf = (x: string): AccompanyKind | undefined => (x === 'pair' || x === 'trainee' ? x : undefined);

/**
 * 同行として足す前の確かめ（新しい訪問だけ）：元の訪問と同じ日・同じ開始（早）でないと組にならない。研修同行は同行する人を選ぶ。
 * よければ null
 */
export function companionError(
  d: DemoData,
  draft: Pick<Visit, 'date' | 'clientId' | 'earliestStart' | 'accompany'>,
  staff: string | null | undefined,
): { text: string; field: 'earliestStart' | 'staff' } | null {
  if (!draft.accompany) return null;
  const label = ACCOMPANY_LABELS[draft.accompany];
  if (!hasCompanionBase(visitsOn(d, draft.date), draft))
    return { text: `${label}は、元の訪問と同じ日・同じ開始時刻にしてください`, field: 'earliestStart' };
  if (draft.accompany === 'trainee' && !staff)
    return { text: `${label}は、同行する${d.org.terms.staff}を選んでください`, field: 'staff' };
  return null;
}

/** 組の相手（担当の名前。担当なしは null）と、研修同行の分か */
export type CompanionPartner = { name: string | null; trainee: boolean };

/**
 * 組の1件に添える一言（帯の印の説明・連絡の文）：「2人体制（佐藤さんと）」「研修同行（佐藤さんが同行）」「研修同行（小幡さんに同行）」。
 * 元・2人体制・研修同行の3件の組なら、元と2人体制の訪問は「2人体制（佐藤さんと）・研修同行（新井さんが同行）」
 * （研修同行の人だけを「が同行」に並べる）。研修同行の人は研修同行でない相手に「に同行」。担当なしは「担当なし」
 */
export function companionText(c: CompanionOf, partners: readonly CompanionPartner[]): string {
  const names = (xs: readonly CompanionPartner[]) => xs.map((x) => (x.name ? `${x.name}さん` : '担当なし')).join('・');
  const group = partners.filter((x) => !x.trainee);
  const trainees = partners.filter((x) => x.trainee);
  if (c.role === 'trainee') return `${ACCOMPANY_LABELS.trainee}（${names(group)}に同行）`;
  const parts: string[] = [];
  if (group.length > 0) parts.push(`${ACCOMPANY_LABELS.pair}（${names(group)}と）`);
  if (trainees.length > 0) parts.push(`${ACCOMPANY_LABELS.trainee}（${names(trainees)}が同行）`);
  return parts.join('・');
}

/**
 * 元の訪問（同行の印の無い訪問）を取り消すとき一緒に取り消す、同じ組の同行の訪問の ID（ADR-0120）。
 * 取り消すと組に印の無い訪問が残らない（同行の訪問だけが単独で残り、AI に組まれ連絡文にも出る）ときだけ、組の印付きの訪問を返す。
 * 取り消すのが同行の訪問なら、ほかの訪問は残す（空の配列）
 */
export function companionsToCancel(d: DemoData, v: Pick<Visit, 'id' | 'date' | 'accompany'>): string[] {
  if (v.accompany !== undefined) return [];
  const visits = visitsOn(d, v.date);
  const c = companionsOf(visits).get(v.id);
  if (!c) return [];
  const byId = new Map(visits.map((x) => [x.id, x]));
  const partners = c.partners.flatMap((id) => byId.get(id) ?? []);
  return partners.some((x) => x.accompany === undefined) ? [] : partners.map((x) => x.id);
}

/** 帯の印の短い文字（2人体制は「2人」、研修同行は「同行」） */
export const companionShort = (c: CompanionOf): string => (c.kind === 'pair' ? '2人' : '同行');

/**
 * その日の訪問の同行の一言（訪問ID → 文）。staffOf は訪問の担当（伝えた内容で書くときはその担当）、nameOf は〈スタッフ〉の名前。
 * 組でない訪問は入れない
 */
export function companionTexts(
  visits: readonly (Pick<Visit, 'id' | 'date' | 'clientId' | 'earliestStart' | 'cancelled'> &
    Partial<Pick<Visit, 'accompany'>>)[],
  staffOf: (visitId: string) => string | null,
  nameOf: (staffId: string) => string,
): Map<string, { short: string; text: string }> {
  const out = new Map<string, { short: string; text: string }>();
  const trainee = new Set(visits.filter((v) => v.accompany === 'trainee').map((v) => v.id));
  for (const [id, c] of companionsOf(visits)) {
    const partners = c.partners.map((p) => {
      const s = staffOf(p);
      return { name: s ? nameOf(s) : null, trainee: trainee.has(p) };
    });
    out.set(id, { short: companionShort(c), text: companionText(c, partners) });
  }
  return out;
}

/**
 * コピーの欄を開く頼み（今の欄の入力 draft（保存していない直しも含む。無ければ元の訪問の中身）の日時・所要・種類・メモ。
 * 同行は選び直す。日付は今日より前なら今日）。components/VisitPanel の VisitPanelRequest の形
 */
export function copyRequest(
  v: Visit,
  today: string,
  input: VisitDraft = draftOf(v),
): {
  newVisit: { date: string; clientId: string; start: string };
  draft: VisitDraft;
  copyOf: string;
} {
  const date = input.date < today ? today : input.date;
  const { accompany: _a, ...draft } = input;
  return {
    newVisit: { date, clientId: draft.clientId, start: draft.earliestStart },
    draft: { ...draft, date },
    copyOf: v.id,
  };
}

/** 元の訪問に同行（2人体制・研修同行）を付けられるか：元の訪問が今日以降（今日より前の日には訪問を足せないので、組にできない） */
export const canAccompany = (source: Pick<Visit, 'date'> | null, today: string): boolean =>
  source !== null && source.date >= today;

/**
 * コピーの欄で「コピーの使い方」を選んだときの直し：同行は日時を元の訪問にそろえる（同じ日・同じ開始でないと組にならない）。
 * ふつうのコピーに戻したら、日付が今日より前なら今日にする。元の訪問が今日より前なら同行は選べない（null）
 */
export function copyAccompanyPatch(
  source: Pick<Visit, 'date' | 'windowKind' | 'earliestStart' | 'latestStart'> | null,
  accompany: AccompanyKind | undefined,
  draft: Pick<VisitDraft, 'date'>,
  today: string,
): Partial<VisitDraft> | null {
  if (!accompany) return { accompany, ...(draft.date < today ? { date: today } : {}) };
  if (!source || !canAccompany(source, today)) return null;
  return {
    accompany,
    date: source.date,
    windowKind: source.windowKind,
    earliestStart: source.earliestStart,
    latestStart: source.latestStart,
  };
}

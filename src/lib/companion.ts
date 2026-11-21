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

/**
 * 組の1件に添える一言（帯の印の説明・連絡の文）：「2人体制（佐藤さんと）」「研修同行（佐藤さんが同行）」「研修同行（小幡さんに同行）」。
 * 相手の名前は組のほかの訪問の担当（担当なしは「担当なし」）
 */
export function companionText(c: CompanionOf, partnerNames: readonly (string | null)[]): string {
  const names = partnerNames.map((n) => (n ? `${n}さん` : '担当なし')).join('・');
  if (c.kind === 'pair') return `${ACCOMPANY_LABELS.pair}（${names}と）`;
  return `${ACCOMPANY_LABELS.trainee}（${names}${c.role === 'trainee' ? 'に' : 'が'}同行）`;
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
  for (const [id, c] of companionsOf(visits)) {
    const names = c.partners.map((p) => {
      const s = staffOf(p);
      return s ? nameOf(s) : null;
    });
    out.set(id, { short: companionShort(c), text: companionText(c, names) });
  }
  return out;
}

/**
 * コピーの欄を開く頼み（元の訪問の日時・所要・種類・メモ。同行は選び直す。日付は今日より前なら今日）。
 * components/VisitPanel の VisitPanelRequest の形
 */
export function copyRequest(
  v: Visit,
  today: string,
): {
  newVisit: { date: string; clientId: string; start: string };
  draft: VisitDraft;
  copyOf: string;
} {
  const date = v.date < today ? today : v.date;
  const { accompany: _a, ...draft } = draftOf(v);
  return { newVisit: { date, clientId: v.clientId, start: v.earliestStart }, draft: { ...draft, date }, copyOf: v.id };
}

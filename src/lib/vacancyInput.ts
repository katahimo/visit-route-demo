// 空き状況の入力をタブの間だけ覚える（PRD D258。design.md §4 pages「空き状況と問い合わせの試算」）。
// sessionStorage に置く（Storage は呼ぶ側が渡す。store/appSessionStorage）：ほかの画面へ移って戻っても残り、タブ・ブラウザを閉じれば消える。データ（DemoData）・書き出しには入れない。
// 読めない値（壊れた・古い形）は項目ごとに既定に戻す（例外を投げない。時間帯のチップ（D411）を足す前の入力も読める。
// 前の既定の開始の幅 9:00〜17:00 で覚えた入力もそのまま読む）
import { z } from 'zod';
import { conditionSchema } from '../contracts/rules';
import { VACANCY_WEEKS_DEFAULT, VACANCY_WEEKS_MAX, VACANCY_WEEKS_MIN } from '../contracts/vacancy';
import { defaultWishRange, WISH_BAND_IDS } from './vacancyBands';

export const VACANCY_INPUT_KEY = 'vrdemo:vacancy:input';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const inputSchema = z.object({
  typeId: z.string().max(100),
  /** 所要（分）は入れかけの文字のまま（正しくなければ画面が知らせる） */
  duration: z.string().max(10),
  requirements: z.array(conditionSchema).max(20),
  place: z.object({
    address: z.string().max(200),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    postalCode: z.string().max(10),
    pinnedAddress: z.string().max(200),
  }),
  weeks: z.number().int().min(VACANCY_WEEKS_MIN).max(VACANCY_WEEKS_MAX),
  /** 開始日は入れかけ（空）も覚える */
  from: z.string().max(10),
  wishDays: z.array(z.number().int().min(0).max(6)).max(7),
  wishFrom: hhmm,
  wishTo: hhmm,
  /** 時間帯のチップ（PRD D411。空＝指定なし。足す前に覚えた入力には無いので既定の空になる） */
  wishBands: z.array(z.enum(WISH_BAND_IDS)).max(3),
  perWeek: z.number().int().min(1).max(7),
  noticePeriod: z.enum(['thisWeek', 'nextWeek', 'fourWeeks']),
  noticeTypeId: z.string().max(100),
});

export type VacancyInput = z.infer<typeof inputSchema>;

/** 既定の所要（分） */
const DEFAULT_DURATION = 60;

/** 既定の入力（開始日は今日。開始の幅は時間帯のチップの全体で、所要を足して 20:00 に収まる開始まで。PRD D411） */
export function defaultVacancyInput(today: string): VacancyInput {
  const range = defaultWishRange(DEFAULT_DURATION);
  return {
    typeId: '',
    duration: String(DEFAULT_DURATION),
    requirements: [],
    place: { address: '', lat: null, lng: null, postalCode: '', pinnedAddress: '' },
    weeks: VACANCY_WEEKS_DEFAULT,
    from: today,
    wishDays: [],
    wishFrom: range.from,
    wishTo: range.to,
    wishBands: [],
    perWeek: 1,
    noticePeriod: 'nextWeek',
    noticeTypeId: '',
  };
}

type SessionLike = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * 覚えた入力（無い・読めなければ既定）。項目ごとに確かめ、読めない項目だけ既定にする。
 * 開始日が今日より前なら今日にする（前の日に開いたタブを使い続けたとき）。typeIds を渡すと、無くなった種類（消した種類）は捨てる
 */
export function loadVacancyInput(
  today: string,
  typeIds: ReadonlySet<string> | null,
  store: SessionLike | null,
): VacancyInput {
  const base = defaultVacancyInput(today);
  let raw: unknown;
  try {
    const text = store?.getItem(VACANCY_INPUT_KEY);
    if (!text) return base;
    raw = JSON.parse(text);
  } catch {
    return base;
  }
  if (typeof raw !== 'object' || raw === null) return base;
  const out: Record<string, unknown> = { ...base };
  const shape = inputSchema.shape;
  for (const k of Object.keys(shape) as (keyof VacancyInput)[]) {
    const r = shape[k].safeParse((raw as Record<string, unknown>)[k]);
    if (r.success) out[k] = r.data;
  }
  const v = out as VacancyInput;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v.from) && v.from < today) v.from = today;
  if (typeIds) {
    if (v.typeId !== '' && !typeIds.has(v.typeId)) v.typeId = '';
    if (v.noticeTypeId !== '' && !typeIds.has(v.noticeTypeId)) v.noticeTypeId = '';
  }
  return v;
}

/** 入力を覚える（書けなければ何もしない：容量・プライベートブラウズ） */
export function saveVacancyInput(input: VacancyInput, store: SessionLike | null): void {
  try {
    store?.setItem(VACANCY_INPUT_KEY, JSON.stringify(input));
  } catch {
    // 覚えられなくても画面はそのまま使える
  }
}

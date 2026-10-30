// 人も訪問も無い空のデータ（PRD D381。ADR-0073）と、単発・定期のデモが共有する土台。
// 「自分のデータで始める」は、この空のデータ（訪問の種類と呼び名だけ）から始める。人・訪問は入れない
import type { DemoData } from '../contracts/data';
import { DATA_VERSION } from '../contracts/data';
import { type Org, SPAN_LIMIT_DEFAULT_HOURS, type VisitType } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { INITIAL_VISIT_TYPES } from './patterns';
import { INITIAL_ITEMS, INITIAL_RULES } from './people';
import { INITIAL_PRESETS, initialPresets } from './presets';

/** 自分のデータで始めるときの事業所名（あとで設定で直せる） */
export const OWN_ORG_NAME = '自分の事業所';

/** 空のデータの元になる事業所の設定（呼び名・業種・機能の入り切り） */
export type BlankOrg = Pick<Org, 'industry' | 'terms'> & { features: Features; name?: string };

/** 定期の空のデータの訪問の種類（今の初期データと同じ：介護・リハビリ） */
export const REGULAR_VISIT_TYPES: readonly VisitType[] = INITIAL_VISIT_TYPES;

/** 単発の訪問の種類（日ごとの単発の予約。担当に必要な条件は付けない） */
export const ONE_OFF_VISIT_TYPES: readonly VisitType[] = [
  { id: 'oneoff', name: '見守り・保育', color: 0, durationMinutes: 120, requirements: [], note: '' },
];

/**
 * 空のデータ：人・訪問・繰り返しは無く、訪問の種類と呼び名・機能の入り切りだけ決まっている（特性の項目・条件・点数の基準は
 * 今の初期データと同じ）。today は基準日（日付だけで決まる。Date.now は使わない）
 */
export function createBlankData(today: string, org: BlankOrg, visitTypes: readonly VisitType[]): DemoData {
  return {
    version: DATA_VERSION,
    baseDate: today,
    seed: 1,
    org: {
      name: org.name ?? OWN_ORG_NAME,
      industry: org.industry,
      terms: { ...org.terms },
      fareYenPerKm: 10,
      spanLimitHours: SPAN_LIMIT_DEFAULT_HOURS,
      features: { ...org.features },
    },
    items: INITIAL_ITEMS.map((i) => ({ ...i, options: [...i.options] })),
    rules: INITIAL_RULES.map((r) => ({ ...r })),
    staff: [],
    clients: [],
    compat: {},
    visits: [],
    availability: [],
    absences: [],
    clientLeaves: [],
    visitTypes: visitTypes.map((t) => ({ ...t, requirements: t.requirements.map((c) => ({ ...c })) })),
    patterns: [],
    snapshots: {},
    reassigns: {},
    presets: initialPresets(),
    scorePresetId: INITIAL_PRESETS[0]!.id,
  };
}

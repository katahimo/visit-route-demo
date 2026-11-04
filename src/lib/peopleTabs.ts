// 〈利用者さん〉・〈スタッフ〉の小さいタブ（入切とも。PRD D394。ADR-0073 第4段・ADR-0074 段3）の決まり：
// 〈スタッフ〉＝一覧・勤務（勤務時間・シフト／勤務の見込み）・相性、〈利用者さん〉＝一覧・予定と相性・相性（ADR-0099）。
// 相性は〈利用者さん〉×〈スタッフ〉の1つの表なので、どちらから来たかを覚えて（lib の外。components/peopleSide）タブとメニューの印を決める。
// 画面はここを読み、切／入の判定を画面ごとに持たない。データは書き換えない
import type { Terms } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { isHrefOn } from './features';

/** どちらの人の画面か */
export type PeopleSide = 'clients' | 'staff';

type PeopleTabDef = { to: string; label: string; match: readonly string[] };

/** 並び（作業の順）。勤務は勤務時間（シフト）と勤務の見込みの2画面をまとめて1つのタブにする */
const TABS: Record<PeopleSide, readonly PeopleTabDef[]> = {
  clients: [
    { to: '/clients', label: '一覧', match: ['/clients'] },
    { to: '/basics', label: '予定と相性', match: ['/basics'] },
    { to: '/compat', label: '相性', match: ['/compat'] },
  ],
  staff: [
    { to: '/staff', label: '一覧', match: ['/staff'] },
    { to: '/availability', label: '勤務', match: ['/availability', '/workload'] },
    { to: '/compat', label: '相性', match: ['/compat'] },
  ],
};

/** 切っていない機能のタブ（切った機能の画面へは出さない） */
export const peopleTabs = (side: PeopleSide, features: Features): PeopleTabDef[] =>
  TABS[side].filter((t) => isHrefOn(features, t.to));

/** タブのナビの名前（呼び名は terms から。例「〈スタッフ〉の画面の切り替え」） */
export const peopleTabsLabel = (side: PeopleSide, terms: Pick<Terms, 'client' | 'staff'>): string =>
  `${side === 'clients' ? terms.client : terms.staff}の画面の切り替え`;

/** 相性は両方のタブに出る。どちらの画面かが決まるパスはそのまま、相性だけ覚えた側（まだ無ければ〈利用者さん〉） */
export function peopleSideOf(pathname: string, remembered: PeopleSide | undefined): PeopleSide | null {
  if (pathname === '/clients' || pathname === '/basics') return 'clients';
  if (pathname === '/staff' || pathname === '/availability' || pathname === '/workload') return 'staff';
  if (pathname === '/compat') return remembered ?? 'clients';
  return null;
}

/** 覚えておく側：その画面が〈利用者さん〉・〈スタッフ〉の専用の画面ならその側、相性などほかは今のまま */
export function rememberedSide(pathname: string, remembered: PeopleSide | undefined): PeopleSide | undefined {
  return pathname === '/compat' ? remembered : (peopleSideOf(pathname, undefined) ?? remembered);
}

/**
 * メニューの〈利用者さん〉・〈スタッフ〉が受け持つ画面（今の画面の印。相性は覚えた側）。
 * 予定と相性（/basics）は入切とも〈利用者さん〉（PRD D401・D394。ADR-0099）
 */
export function peopleMatch(side: PeopleSide, remembered: PeopleSide | undefined): string[] {
  const compat = (remembered ?? 'clients') === side ? ['/compat'] : [];
  return side === 'clients'
    ? ['/clients', '/basics', ...compat]
    : ['/staff', '/availability', '/workload', ...compat];
}

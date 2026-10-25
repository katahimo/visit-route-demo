// 地図で選んだ担当・区間・訪問を持つフック（予定 #/plan・比較 #/compare・案の帯で共通。ADR-0009）。
// 状態の遷移は lib/routeView の routeSelect（純粋関数。テストあり）
import { useEffect, useState } from 'react';
import {
  NO_ROUTE_SEL,
  type RouteSel,
  type RouteSelAction,
  type RouteSelState,
  routeSelect,
  sameRouteSel,
} from '../lib/routeView';

/**
 * 地図で見る担当（focusStaff。null は全員）・強調する区間（focusLeg）・選んだ訪問（picked）。日付が変わったら外す。
 * ownerOf(set, 訪問ID) は、その集まりでの担当
 */
export function useRouteSelection(date: string, ownerOf: (set: string, visitId: string) => string | undefined) {
  const [sel, setSel] = useState<RouteSelState>(NO_ROUTE_SEL);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付を変えたら選んだものを外す
  useEffect(() => {
    setSel(NO_ROUTE_SEL);
  }, [date]);
  const act = (a: RouteSelAction) => setSel((s) => routeSelect(s, a, ownerOf));
  const { focusStaff, focusLeg, picked } = sel;
  /** 地図で見る担当を変える（null は全員）。選んでいた区間・訪問がその人のものでなければ外す */
  const focusOn = (staffId: string | null) => act({ type: 'focus', staffId });
  return {
    focusStaff,
    focusLeg,
    picked,
    focusOn,
    /** 訪問を押した：選ぶ（その人に地図を合わせる）か、もう一度押して外す */
    togglePick: (x: RouteSel) => act({ type: 'pick', sel: x }),
    /** 区間を押した：強調する（その人に地図を合わせる）か、もう一度押して外す */
    toggleLeg: (x: RouteSel) => act({ type: 'leg', sel: x }),
    /** 「全員のルートを見る」：担当の絞り込みを外す（focusOn(null) と同じ。選んだ訪問は残し、区間の強調は外す） */
    clear: () => focusOn(null),
    /** 選んだものをすべて外す（案が入れ替わったとき・比べる案を変えたとき） */
    reset: () => act({ type: 'reset' }),
    /** 訪問の担当が変わった（to：新しい担当、null は未割当）。選択を新しい担当に合わせる */
    follow: (visitId: string, to: string | null) => act({ type: 'follow', visitId, to }),
    isPicked: (x: RouteSel) => sameRouteSel(picked, x),
    isLeg: (x: RouteSel) => sameRouteSel(focusLeg, x),
    /** MapDock の focusKey（選んだものが変わったら開く） */
    focusKey: [focusStaff, focusLeg && `${focusLeg.set}:${focusLeg.id}`, picked && `${picked.set}:${picked.id}`]
      .filter(Boolean)
      .join('|'),
  };
}

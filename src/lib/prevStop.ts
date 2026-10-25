// 道順の起点（PRD D100。ADR-0018）：担当のその日の並び（開始の順）で、その訪問の前の訪問先。1件目は担当の自宅。
// 訪問の詳細の欄・スタッフの画面（・日の予定）で同じ計算を使う。純粋関数
import type { DemoData } from '../contracts/data';
import type { Place, Staff } from '../contracts/documents';
import { isOnLeave } from '../domain/leaves';
import { findVisit, visitsOn } from '../patterns';
import { HOME_LABEL } from './mapsLink';

/** 前の場所：担当・前の場所（前の訪問先の〈利用者さん〉が見つからなければ無し）・その言葉（HOME_LABEL か名前（「さん」なし）） */
export type PrevStop = { staff: Staff; from: Place | undefined; fromName: string };

/**
 * その訪問の道順の起点（担当が無い・取り消した・担当が見つからない訪問は null）。並びは担当のその日の訪問から
 * 取り消し・〈利用者さん〉の休み（ADR-0013）の回を除いたもの（この訪問は休みでも並びに入れる）
 */
export function prevStopOf(
  data: Pick<DemoData, 'visits' | 'patterns' | 'clients' | 'clientLeaves' | 'staff'>,
  visitId: string,
): PrevStop | null {
  const v = findVisit(data, visitId);
  if (!v || v.cancelled || !v.staffId) return null;
  const staff = data.staff.find((s) => s.id === v.staffId);
  if (!staff) return null;
  const order = visitsOn(data, v.date).filter(
    (x) => !x.cancelled && x.staffId === staff.id && (x.id === v.id || !isOnLeave(data.clientLeaves, x)),
  );
  const i = order.findIndex((x) => x.id === v.id);
  const prev = i > 0 ? order[i - 1] : undefined;
  if (!prev) return { staff, from: staff.home, fromName: HOME_LABEL };
  const c = data.clients.find((x) => x.id === prev.clientId);
  return { staff, from: c?.place, fromName: c?.displayName ?? '（不明）' };
}

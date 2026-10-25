// 連絡の一覧（PRD D35。ADR-0011）：元の案と今の案の差から、誰に何を連絡するかをまとめる。
// どれも純粋関数で決定的。DemoData は読まない・書かない
import type { ContactList, ContactsOf, ContactVisit, StaffContact } from '../contracts/reassign';
import { timesOf } from './diff';

/**
 * 元の案と今の案の差から、連絡の一覧を作る（時刻は lenient。開始の変化は四捨五入で1分以上。reassignDiff と同じ）。
 * 訪問の順は今の案の開始（無ければ元の案の開始）の順
 */
export const contactsOf: ContactsOf = (before, after) => {
  const a = timesOf(before.problem, before.routes).at;
  const b = timesOf(after.problem, after.routes).at;
  const clientOf = new Map<string, string>();
  for (const v of [...before.problem.visits, ...after.problem.visits]) clientOf.set(v.id, v.clientId);
  const ids = [...clientOf.keys()];
  const staffChanged: ContactVisit[] = [];
  const timeChanged: ContactVisit[] = [];
  const order = [...new Set([...after.problem.staff, ...before.problem.staff].map((s) => s.id))];
  const byStaff = new Map<string, StaffContact>();
  const of = (staffId: string) => {
    let c = byStaff.get(staffId);
    if (!c) {
      c = { staffId, added: [], removed: [], shifted: [] };
      byStaff.set(staffId, c);
    }
    return c;
  };
  for (const id of ids) {
    const x = a.get(id);
    const y = b.get(id);
    if (!x && !y) continue;
    const item: ContactVisit = {
      visitId: id,
      clientId: clientOf.get(id)!,
      fromStaffId: x?.staffId ?? null,
      toStaffId: y?.staffId ?? null,
      fromStart: x?.start ?? null,
      toStart: y?.start ?? null,
    };
    if (item.fromStaffId !== item.toStaffId) {
      staffChanged.push(item);
      if (item.fromStaffId) of(item.fromStaffId).removed.push(item);
      if (item.toStaffId) of(item.toStaffId).added.push(item);
      continue;
    }
    if (x && y && Math.round(y.start - x.start) !== 0) {
      timeChanged.push(item);
      of(y.staffId).shifted.push(item);
    }
  }
  const when = (c: ContactVisit) => c.toStart ?? c.fromStart ?? 0;
  const sort = (xs: ContactVisit[]) => xs.sort((p, q) => when(p) - when(q) || p.visitId.localeCompare(q.visitId));
  const byStart = (xs: ContactVisit[]) =>
    xs.sort((p, q) => (p.fromStart ?? 0) - (q.fromStart ?? 0) || p.visitId.localeCompare(q.visitId));
  const staff = order
    .filter((id) => byStaff.has(id))
    .map((id) => {
      const c = byStaff.get(id)!;
      return { staffId: id, added: sort(c.added), removed: byStart(c.removed), shifted: sort(c.shifted) };
    });
  const list: ContactList = { staffChanged: sort(staffChanged), timeChanged: sort(timeChanged), staff };
  return list;
};

// 〈スタッフ〉の画面の節の編集と保存（PRD D299・D308〜D310。ADR-0014・ADR-0050・ADR-0052）：節ごとの項目・新しい人の既定・
// 保存の前の検査（名前・メールアドレス・アイコン）・保存したデータ・休止にするときに「担当できる人」から外す〈利用者さん〉・
// 日ごとに変えた勤務。純粋関数（データは書き換えない）
import type { DemoData } from '../contracts/data';
import type { Availability, Client, Staff } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { nameTaken, newId } from './common';
import { normalizeEmail } from './mailto';
import { defaultStaffHours } from './staffDefaultHours';
import { staffIconError } from './staffMark';

/** 節ごとに直す項目（基本情報・勤務時間のタブの節） */
export const STAFF_SECTIONS = {
  basic: ['name', 'icon', 'email', 'travelMode', 'active'],
  lastDay: ['lastDay'],
  home: ['home'],
  traits: ['traits'],
  conds: ['requirements', 'preferences'],
  hours: ['workDays', 'shiftStart', 'shiftEnd'],
} as const satisfies Record<string, readonly (keyof Staff)[]>;
export type StaffSecKey = keyof typeof STAFF_SECTIONS;

/** 新しい人の既定（`#/staff/new`。id は新しく振る）。勤務日・勤務時間は使い方で決まる（単発の予約は毎日 7:00〜22:00。PRD D428） */
export const blankStaff = (features: Features = {}): Staff => ({
  id: newId('s'),
  name: '',
  home: { address: '', lat: null, lng: null },
  travelMode: 'DRIVE',
  ...defaultStaffHours(features),
  active: true,
  traits: {},
  requirements: [],
  preferences: [],
  lastDay: null,
  email: '',
  icon: '',
});

/** 保存の前の検査の結果：誤り（文と欄）か、整えたメールアドレスとアイコン */
export type StaffFieldsCheck =
  | { ok: false; error: { text: string; field: string } }
  | { ok: true; email: string; icon: string };

/**
 * 保存の前の検査（名前の重なり → メールアドレス → アイコンの順）。検査するのは keys の項目だけ
 * （ほかの節の古い値で保存を止めない）。アイコンは前後の空白を落とす
 */
export function checkStaffFields(
  all: Staff[],
  base: Staff,
  keys: readonly (keyof Staff)[],
  staffTerm: string,
): StaffFieldsCheck {
  const touches = (k: keyof Staff) => keys.includes(k);
  if (touches('name') && nameTaken(all, (x) => x.name, base.name, base.id))
    return {
      ok: false,
      error: { text: `「${base.name.trim()}」と同じ名前の${staffTerm}がいます。名前を変えてください`, field: 'name' },
    };
  const email = touches('email') ? normalizeEmail(base.email) : base.email;
  if (email === null)
    return {
      ok: false,
      error: { text: 'メールアドレスの形ではありません（例 name@example.com）。空でも構いません', field: 'email' },
    };
  const icon = base.icon.trim();
  const iconErr = touches('icon') ? staffIconError(icon) : null;
  if (iconErr) return { ok: false, error: { text: iconErr, field: 'icon' } };
  return { ok: true, email, icon };
}

/** 〈スタッフ〉の並びに入れる（同じ id があれば置き換え、無ければ最後に足す） */
export function withStaff(staff: Staff[], s: Staff): Staff[] {
  return staff.some((x) => x.id === s.id) ? staff.map((x) => (x.id === s.id ? s : x)) : [...staff, s];
}

/** 保存したデータ：〈スタッフ〉を入れ、休止なら〈利用者さん〉の「担当できる人」から外す（ADR-0014） */
export function savedStaffData(d: DemoData, s: Staff): DemoData {
  return {
    ...d,
    staff: withStaff(d.staff, s),
    clients: s.active
      ? d.clients
      : d.clients.map((c) =>
          c.allowedStaffIds.includes(s.id) ? { ...c, allowedStaffIds: c.allowedStaffIds.filter((x) => x !== s.id) } : c,
        ),
  };
}

/**
 * 休止にするときに「担当できる人」から外す〈利用者さん〉（利用中なら空）と、
 * そのうち利用中のほかの人が「担当できる人」に残らない〈利用者さん〉
 */
export function pauseTargets(
  data: Pick<DemoData, 'staff' | 'clients'>,
  s: Staff,
): { limited: Client[]; emptied: Client[] } {
  const limited = s.active ? [] : data.clients.filter((c) => c.allowedStaffIds.includes(s.id));
  const activeOther = new Set(data.staff.filter((x) => x.active && x.id !== s.id).map((x) => x.id));
  const emptied = limited.filter((c) => !c.allowedStaffIds.some((sid) => activeOther.has(sid)));
  return { limited, emptied };
}

/** その人の今日からの日ごとに変えた勤務（日付の順） */
export function staffOverrides(availability: Availability[], staffId: string, today: string): Availability[] {
  return availability
    .filter((a) => a.staffId === staffId && a.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

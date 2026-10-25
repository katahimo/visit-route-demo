import { useEffect, useMemo } from 'react';
import type { Client } from '../contracts/documents';
import { countAmong, defaultStaffOf } from '../lib/search';
import type { ClientPickerProps } from './clientPickerTypes';

/** ClientPicker が props から引く索引・人数（選んでいる人・〈スタッフ〉ごとの担当人数・近道の対象） */
export function usePickerLookups({
  clients,
  selected,
  byStaff,
  period,
  pickedStaff,
}: {
  clients: readonly Client[];
  selected: readonly string[];
  byStaff: ClientPickerProps['byStaff'];
  period: ClientPickerProps['period'];
  /** 近道で選んだ〈スタッフ〉（null＝まだ選んでいない） */
  pickedStaff: string | null;
}) {
  const byId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const chosen = useMemo(() => selected.flatMap((id) => byId.get(id) ?? []), [selected, byId]);
  const tentativeCount = useMemo(() => clients.filter((c) => c.tentative).length, [clients]);
  /** 〈スタッフ〉ごとの、候補の中で担当する人の数（select に出す） */
  const staffCount = useMemo(
    () => new Map(byStaff ? byStaff.staff.map((s) => [s.id, countAmong(byStaff.clientIdsOf(s.id), clients)]) : []),
    [byStaff, clients],
  );
  const staffId =
    pickedStaff !== null && byStaff?.staff.some((s) => s.id === pickedStaff)
      ? pickedStaff
      : defaultStaffOf(byStaff?.staff ?? [], (id) => staffCount.get(id) ?? 0);
  const staffSet = useMemo(() => (byStaff && staffId ? byStaff.clientIdsOf(staffId) : null), [byStaff, staffId]);
  const periodCount = useMemo(() => (period ? countAmong(period.clientIds, clients) : 0), [period, clients]);

  return { byId, chosen, tentativeCount, staffCount, staffId, staffSet, periodCount };
}

/** ClientPicker の副作用：候補が変わったら先頭を指す・上限が変わったら文を消す・指している人を見える所へ */
export function usePickerEffects({
  options,
  max,
  open,
  active,
  optId,
  setActive,
  setMessage,
}: {
  options: readonly Client[];
  max: number | undefined;
  open: boolean;
  active: number;
  optId: (id: string) => string;
  setActive: (i: number) => void;
  setMessage: (m: string | null) => void;
}) {
  // 候補が変わったら先頭を指す
  // biome-ignore lint/correctness/useExhaustiveDependencies: 候補の並びが変わったときだけ
  useEffect(() => {
    setActive(0);
  }, [options.map((c) => c.id).join(',')]);

  // 上限が変わったら（週間の時間軸 ⇄ 表）上限の文を消す
  // biome-ignore lint/correctness/useExhaustiveDependencies: 上限が変わったときだけ
  useEffect(() => {
    setMessage(null);
  }, [max]);
  // 候補の中の指している人を見えるところへ（開いた・指す人が変わったときだけ。
  // 毎回の再描画で行うと、開いたままページを動かしたときに画面が引き戻される）
  const activeId = open ? options[active]?.id : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 指している人が変わったときだけ
  useEffect(() => {
    if (activeId) document.getElementById(optId(activeId))?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);
}

import { useMemo } from 'react';
import type { Client } from '../contracts/documents';
import {
  type ClientFilterState,
  chipCounts,
  cityChips,
  endedVisible,
  extraCounts,
  type FilterChip,
  type FilterFacts,
  filterClients,
  resolveStaffId,
  staffCounts,
  townGroups,
  typeChips,
} from '../lib/clientFilter';
import { useFeature } from './useFeature';

type Input = {
  clients: readonly Client[];
  state: ClientFilterState;
  facts: FilterFacts;
  staff: readonly { id: string; name: string }[];
  visitTypes: readonly { id: string; name: string }[];
  extraChips: readonly { key: string }[];
};

/** 絞り込みの欄（ClientFilter）に出す人数・チップ・地区の計算（判定は lib/clientFilter。ここは入力が変わったときだけ計算し直す） */
export function useClientFilterModel({ clients, state, facts, staff, visitTypes, extraChips }: Input) {
  const staffId = useMemo(() => resolveStaffId(state, staff, facts, clients), [state, staff, facts, clients]);
  const shown = useMemo(() => filterClients(clients, state, facts, staffId), [clients, state, facts, staffId]);
  const total = useMemo(() => clients.filter((c) => endedVisible(c, state, facts)).length, [clients, state, facts]);
  const counts = useMemo(() => chipCounts(clients, state, facts, staffId), [clients, state, facts, staffId]);
  const cities = useMemo(() => cityChips(clients, state, facts, staffId), [clients, state, facts, staffId]);
  const towns = useMemo(() => townGroups(clients, state, facts, staffId), [clients, state, facts, staffId]);
  /** select の「（N人）」：その〈スタッフ〉で押したら何人になるか（チップの人数と同じ数え方） */
  const staffCount = useMemo(() => staffCounts(clients, state, facts, staff), [clients, state, facts, staff]);
  const types = useMemo(
    () => typeChips(clients, state, facts, staffId, visitTypes),
    [clients, state, facts, staffId, visitTypes],
  );
  const extraKeys = useMemo(() => extraChips.map((x) => x.key), [extraChips]);
  const extraCount = useMemo(
    () => extraCounts(clients, state, facts, staffId, extraKeys),
    [clients, state, facts, staffId, extraKeys],
  );
  // 機能の入り切り（ADR-0028）：〈利用者さん〉の休みを切れば「休み」、担当を限るを切れば「担当を限る」のチップを出さない
  // （URL などで押したまま来たときは外せるように出す）
  const leaveOn = useFeature('clientLeave');
  const limitOn = useFeature('allowedStaff');
  const hiddenChip = (chip: FilterChip) => (chip === 'leave' && !leaveOn) || (chip === 'limited' && !limitOn);
  return { hiddenChip, staffId, shown, total, counts, cities, towns, staffCount, types, extraCount };
}

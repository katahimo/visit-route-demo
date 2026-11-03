// 一覧の行の「位置なし」（PRD D427。ADR-0094）に渡す値を作る：位置の無い人・1人だけ探せるか・探す（usePlaceAllRun の run に
// その人だけ渡す。進み具合と見つからなかった理由はまとめて置く欄に出る）・地図で置く（その人の画面の場所・自宅の欄へ）
import { useMemo } from 'react';
import { canSearchOne, noPlaceIds, placePeople } from '../lib/placeAll';
import { useDemoData } from '../store';
import type { NoPlaceRow } from './NoPlaceActions';
import type { PlaceAllRun } from './usePlaceAllRun';

export function useNoPlaceRow(x: { run: PlaceAllRun; geocodeOn: boolean; onMap: (id: string) => void }): NoPlaceRow {
  const { run, geocodeOn, onMap } = x;
  const { data } = useDemoData();
  const { kind, running } = run;
  const missing = useMemo(() => noPlaceIds(data, kind), [data, kind]);
  const people = useMemo(() => new Map(placePeople(data, kind).map((p) => [p.id, p])), [data, kind]);
  return {
    missing,
    canSearch: (id) => {
      const p = people.get(id);
      return p !== undefined && canSearchOne(p, { geocodeOn, running });
    },
    onSearch: (id) => void run.run([id]),
    onMap,
  };
}

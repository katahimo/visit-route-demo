// 名簿を読み込んだあと、位置の無い人を自動でまとめて置き始める（PRD D427。ADR-0094）：名簿の欄を閉じ、
// まとめて置く欄（panelRef の先）へ移ってフォーカスし、まとめて置く（usePlaceAllRun の run）を始める。
// 送る同意は、読み込みの確認（「読み込んだあと、住所から地図の位置を探します」の1文つき）の［名簿を読み込む］を押したこと（ADR-0016）
import { useRef } from 'react';
import type { PlaceAllRun } from './usePlaceAllRun';

/**
 * geocodeOn は郵便番号・住所の検索（ADR-0028 の geocode）が入か。onStart は始める前にすること（名簿の欄を閉じる。欄を開け閉めしない登録の案内は渡さない）。
 * onPlace は名簿の欄（RosterCard）に渡す。切なら undefined（確認に1文を足さず、読み込んでも送らない）
 */
export function useRosterAutoPlace(x: { run: PlaceAllRun; geocodeOn: boolean; onStart?: () => void }) {
  const { run, geocodeOn, onStart } = x;
  const panelRef = useRef<HTMLDivElement>(null);
  const start = () => {
    onStart?.();
    void run.run();
    requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
      panelRef.current?.scrollIntoView({ block: 'start' });
    });
  };
  return { onPlace: geocodeOn ? start : undefined, panelRef };
}

// 名簿を読み込んだあとの「位置の無い N人を地図に置く」（PRD D399。ADR-0076）の状態と処理：名簿が入ったら導線を立て、
// 押したら導線を消し、まとめて置く欄（panelRef の先）へ移ってフォーカスし、まとめて置く（usePlaceAllRun の run）を始める。
// 読み込みだけでは送らない（押したときだけ。ADR-0016）
import { useEffect, useRef, useState } from 'react';
import { placeAllLead } from '../lib/placeAll';
import type { PlaceAllRun } from './usePlaceAllRun';

/** geocodeOn は郵便番号・住所の検索（ADR-0028 の geocode）が入か。onStart は押したときに先にすること（名簿の欄を閉じる） */
export function useRosterPlaceLead(x: { run: PlaceAllRun; geocodeOn: boolean; onStart: () => void }) {
  const { run, geocodeOn, onStart } = x;
  const panelRef = useRef<HTMLDivElement>(null);
  const [asked, setAsked] = useState(false);
  // 欄の「まとめて地図に置く」で始めたときも導線を下ろす（置き終えたあと、置けなかった人をまた送らせない）
  useEffect(() => {
    if (run.running) setAsked(false);
  }, [run.running]);
  /** ボタンの文言（出さないときは null） */
  const label = placeAllLead({ asked, geocodeOn, running: run.running, targets: run.targets.length });
  /** 名簿が入ったと見届けたとき */
  const onImported = () => setAsked(true);
  /** 導線を押した（まとめて置く欄の「まとめて地図に置く」はもう押させない） */
  const start = () => {
    setAsked(false);
    onStart();
    void run.run();
    requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
      panelRef.current?.scrollIntoView({ block: 'start' });
    });
  };
  return { label, onImported, start, panelRef };
}

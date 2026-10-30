// 時間軸の帯の小さな印（予定の画面の時間軸と、組み方の標準の日で見るの時間軸で同じ見た目。routeTimeline.css の .tl-mark）
import type { ReactNode } from 'react';

/** 印の色：赤（要対応）・注意（時刻の変化）・ピン・仮・担当の入れ替わり */
export type TlMarkTone = 'is-red' | 'is-warn' | 'is-pin' | 'is-tentative' | 'is-move';

export function TlMark({
  tone,
  title,
  testId,
  toldDate,
  children,
}: {
  tone: TlMarkTone;
  title: string;
  testId?: string;
  /** 押すとその日の連絡の一覧を開く「変更あり」の印の日付（expert 切。components/openTold） */
  toldDate?: string;
  children: ReactNode;
}) {
  return (
    <span className={`tl-mark ${tone}`} title={title} data-testid={testId} data-told-date={toldDate}>
      {children}
    </span>
  );
}

/** 開始の変化の短い文（「+30分」「−15分」） */
export const shiftShort = (minutes: number): string => (minutes > 0 ? `+${minutes}分` : `−${-minutes}分`);

/**
 * 画面への意見（PRD D449・D450。ADR-0114）。使っている人が画面のボタンで残し、あとでまとめて書き出して送る。
 * DemoData には入れない（このブラウザの別の保存場所。控え・Excel・初期状態に戻すに入れない）
 */
export type FeedbackItem = {
  id: string;
  /** 残した時刻（ミリ秒） */
  at: number;
  /** 画面の URL（hash。例 `#/month?m=2026-11`） */
  path: string;
  /** 画面の名前（見出し） */
  screen: string;
  comment: string;
  /** 画面の画像（JPEG の data URL）。付けなかった・撮れなかったときは null */
  image: string | null;
  /** 画面の大きさ（CSS ピクセル） */
  width: number;
  height: number;
  /** アプリの版 */
  version: string;
  userAgent: string;
};

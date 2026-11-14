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
  /** 直す・調べるときの手がかり（環境・画面の状態・直前のエラー・データの件数）。古いご意見には無い */
  meta?: FeedbackMeta;
};

/** このタブを開いてから起きたエラー */
export type FeedbackError = {
  at: number;
  kind: 'error' | 'unhandledrejection' | 'console';
  message: string;
  stack?: string;
};

/**
 * 残したときの画面の状態の記録。データの一覧は件数だけ、入力欄の中身は入れない。
 * 見出し・操作中の部品の文字は画面の文をそのまま写すので、画面に出ている名前が入りうる（画像と同じ扱い）
 */
export type FeedbackMeta = {
  /** 完全な URL（origin・hash・query） */
  url: string;
  title: string;
  /** 画面の見出し（h1・h2。上から最大12） */
  headings: string[];
  /** 見えている部品の data-testid（最大40。コードの場所を探す手がかり） */
  testIds: string[];
  /** 押したとき操作していた部品（タグ・data-testid・id・aria-label・文字の先頭。入力欄の中身は入れない） */
  activeElement: string | null;
  openDialogs: number;
  /** 文書全体の高さと、巻いている位置（CSS ピクセル） */
  scroll: { x: number; y: number; docHeight: number };
  env: {
    language: string;
    timeZone: string;
    devicePixelRatio: number;
    screen: { width: number; height: number };
    colorScheme: 'light' | 'dark';
    reducedMotion: boolean;
    maxTouchPoints: number;
    online: boolean;
    standalone: boolean;
    mode: string;
    /** 領域（?space=）。無ければ null */
    space: string | null;
  };
  /** データの版・基準日と、各一覧の件数（中身は入れない） */
  data: { version: number; baseDate: string; counts: Record<string, number> };
  /** 直前までのエラー（新しい順に最大10） */
  recentErrors: FeedbackError[];
};

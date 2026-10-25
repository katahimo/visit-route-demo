import type { Client } from '../contracts/documents';

/** 候補の上限（PRD D61） */
export const PICKER_LIMIT = 10;
/** 「最近選んだ人」の上限（画面の状態） */
export const RECENT_LIMIT = 10;

export type ClientPickerProps = {
  /** 候補にする〈利用者さん〉。この順で候補を並べる（呼ぶ側で利用中に絞って並べておく） */
  clients: readonly Client[];
  /** 選んでいる〈利用者さん〉の ID（この順でチップを並べる）。clients にいない ID は出さない */
  selected: readonly string[];
  /**
   * 選び直したとき。新しい選択の ID の配列（選んだ順）。
   * 1人のとき（multiple が false）は 0件（チップの × で外した）か 1件
   */
  onChange: (ids: string[]) => void;
  /** 複数選ぶ（週間・〈利用者さん〉の画面）。既定 false＝1人（選ぶと入れ替わり、候補を閉じる） */
  multiple?: boolean;
  /**
   * 選べる人数の上限（multiple のときだけ）。上限を超える選択（1人・近道のまとめて選ぶ）はせず、maxMessage を出す
   * 例：週間の時間軸は 8（PRD D62）
   */
  max?: number;
  /** 上限を超えたときの文。既定「{max}人まで選べます」 */
  maxMessage?: string;
  /** 検索欄のラベル（画面に出す。例「〈利用者さん〉」） */
  label: string;
  /** 検索欄の薄い文字。既定「名前・よみで探す」 */
  placeholder?: string;
  /**
   * 近道「この〈期間〉に訪問がある人」。label は「この週」「この月」、clientIds はその期間に（取り消しでない）訪問がある人。
   * 渡さなければ出さない
   */
  period?: { label: string; clientIds: ReadonlySet<string> };
  /**
   * 近道「〈スタッフ〉が担当する人」。staffLabel は呼び方（org.terms.staff）、staff は選べる〈スタッフ〉、
   * clientIdsOf はその人が担当する〈利用者さん〉の ID（呼ぶ側で決める。例：期間の案の担当・いつもの担当）。渡さなければ出さない
   */
  byStaff?: {
    staffLabel: string;
    staff: readonly { id: string; name: string }[];
    clientIdsOf: (staffId: string) => ReadonlySet<string>;
  };
  /** 近道「仮押さえの人」を出す（月間。週間の時間軸では出さない。PRD D111・D112） */
  tentativeShortcut?: boolean;
  /** 選んだ人のチップの名前を押すと詳細の吹き出しを出す（PRD D123） */
  details?: boolean;
  /**
   * 選んだ人のチップを出すか（既定 true）。週間の時間軸は選んだ人を上のチップ（PickChips）で見せるので出さない（PRD D137）
   */
  showChips?: boolean;
  /** 部品の外枠の data-testid（候補は `${testId}-option`、チップは `${testId}-chip`） */
  testId?: string;
};

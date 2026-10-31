// 予約の1件と、形から写した結果の型（ADR-0075）。形ごとのファイル（reserveBookings など）と bookingForms・importBookings が使う
/** 予約の1件（形によらない中身） */
export interface Booking {
  /** 予約番号（形の中で重ならない。読み直したとき同じ訪問を直すのに使う） */
  ref: string;
  /** 元のファイルの行番号（1行目が列名） */
  row: number;
  /** 日付（YYYY-MM-DD） */
  date: string;
  /** 開始（HH:mm） */
  start: string;
  /** 所要（分） */
  durationMinutes: number;
  /** 〈利用者さん〉の名前（名簿の表示名と突き合わせる） */
  clientName: string;
  /** 取り消した予約か */
  cancelled: boolean;
  /** 訪問のメモ（メニュー名など） */
  note: string;
}

/** 形から写した結果 */
export interface BookingTable {
  bookings: Booking[];
  /** 読めなかった行（「N行目：理由」） */
  badRows: string[];
  /** 読まなかった列の名前 */
  skipped: string[];
}

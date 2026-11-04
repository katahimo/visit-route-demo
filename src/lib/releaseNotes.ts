// デモの更新の知らせ（PRD D437。ADR-0102）の純粋な部分：更新の一覧と、前に見た更新から何を知らせるか。
// 画面は components/FirstRunPage（更新のときは2問の画面の上に変わったところを出す）、見た更新の印は store/start（localStorage を触るのは store だけ）。
// 利用者の目に見える変更を出すときは、RELEASE_NOTES の先頭に1件足す（id は出す日。同じ日に2回出すなら -2 などを付ける）

/** 更新1回分（id は 'YYYY-MM-DD'（同じ日の2回目からは '-2' などを付ける）。並べ替えに使うので形をそろえる） */
export type ReleaseNote = { id: string; items: readonly string[] };

/** 更新の一覧（新しい順。先頭が今の版） */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    id: '2026-11-04',
    items: [
      '更新したときは、この画面で「今のデータを使い続ける」か、デモ・自分のデータで始め直すかを選べます',
      '車の移動時間を、道路にそった道のりから見積もれます（管理者設定の「移動時間の見積もり方」）',
    ],
  },
];

/** 今の版（先頭の更新の id） */
export const LATEST_RELEASE: string = RELEASE_NOTES[0]?.id ?? '';

/**
 * 前に見た更新（seen）のあとの更新（新しい順）。seen が無い（印の前から使っている人）なら先頭の1件だけ。
 * seen が今の版と同じ・それより新しい（別のタブで先に新しい版を開いた）なら空
 */
export function notesSince(seen: string | null, notes: readonly ReleaseNote[] = RELEASE_NOTES): ReleaseNote[] {
  if (seen === null) return notes.slice(0, 1);
  return notes.filter((n) => n.id > seen);
}

/** 更新の画面の見出しと、変わったところの見出し */
export const RELEASE_TITLE = 'デモを更新しました';
export const RELEASE_CHANGES = '変わったところ';
/** 問1のいちばん上に足す選択肢（初めに選んでおく）。選ぶと2問目を出さず、今のデータのまま開く */
export const RELEASE_KEEP_LABEL = '今のデータを使い続ける';
export const RELEASE_KEEP_DESC = 'これまでに入れた・直したデータのまま開きます';
/** 今のデータを使い続けるときの主ボタン（ほかは「はじめる」） */
export const RELEASE_KEEP_SUBMIT = '開く';
/** 更新のときの問1（どのデータで続けるか） */
export const RELEASE_Q1 = '1. どのデータで続けますか';
/** デモ・自分のデータを選んだときに畳まずに出す注意（今のデータは1世代の控えに残る） */
export const RELEASE_WARN = 'いまのデータは消えます（データの画面の「直前の状態に戻す」で1回だけ戻せます）。';

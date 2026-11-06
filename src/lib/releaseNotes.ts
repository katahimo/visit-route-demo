// デモの更新の知らせ（PRD D437。ADR-0102）の純粋な部分：更新の一覧と、前に見た更新から何を知らせるか。
// 画面は components/FirstRunPage（更新のときは2問の画面の上に変わったところを出す）、見た更新の印は store/start（localStorage を触るのは store だけ）。
// 利用者の目に見える変更を出すときは、RELEASE_NOTES の先頭に1件足す（id は出す日。同じ日に2回出すなら -2 などを付ける）

/** 更新1回分（id は 'YYYY-MM-DD'（同じ日の2回目からは '-2' などを付ける）。並べ替えに使うので形をそろえる） */
export type ReleaseNote = { id: string; items: readonly string[] };

/** 更新の一覧（新しい順。先頭が今の版） */
export const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    id: '2026-11-06-3',
    items: [
      '最初の設定に答えたあと、上の帯の「戻る」で最初の設定の画面へ戻れます（「閉じる」で今のデータのまま戻ります）',
      '「始め方を選び直す」の呼び方を、画面の見出しにそろえて「最初の設定をやり直す」にしました',
    ],
  },
  {
    id: '2026-11-06-2',
    items: [
      '期間つきの訪問先（住所2）を登録できます。期間内の訪問は住所2 へ行き、移動時間・地図・道順・メールも住所2 で出します。予約システムの顧客の CSV の「住所2」と適用開始日・終了日を読みます',
      'アプリが新しくなった直後に Excel・CSV を読み込むと止まっていたのを、画面を自動で読み直してから同じファイルで続けるようにしました',
    ],
  },
  {
    id: '2026-11-06',
    items: [
      '上の帯の左端に「戻る」「進む」のボタンを置きました（前の画面に戻れます）',
      '日の予定の下の大きな地図を、エキスパート機能が切のときも出します',
      '資格など選択肢の多い特性は、横幅いっぱいに列をそろえて並べます',
    ],
  },
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
  return notes.filter((n) => compareRelease(n.id, seen) > 0);
}

/** id の新旧（a が新しければ正）。日付で比べ、同じ日は後ろの番号（無ければ1）で比べる（文字の順だと -10 が -2 より古くなる） */
export function compareRelease(a: string, b: string): number {
  const parse = (id: string): [string, number] => {
    const m = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?$/.exec(id);
    return m ? [m[1]!, m[2] ? Number(m[2]) : 1] : [id, 1];
  };
  const [da, na] = parse(a);
  const [db, nb] = parse(b);
  if (da !== db) return da < db ? -1 : 1;
  return na - nb;
}

/** 更新の画面の見出しと、変わったところの見出し */
export const RELEASE_TITLE = 'デモを更新しました';
export const RELEASE_CHANGES = '変わったところ';
/** 問1のいちばん上に足す選択肢（初めに選んでおく）。選ぶと2問目を出さず、今のデータのまま開く */
export const RELEASE_KEEP_LABEL = '今のデータを使い続ける';
export const RELEASE_KEEP_DESC = 'これまでに入れた・直したデータのまま開きます';
/** 今のデータを使い続けるときの主ボタン（ほかは「はじめる」） */
export const RELEASE_KEEP_SUBMIT = '開く';
/** 更新のときの問1（どのデータで続けるか）。問2を出すときだけ番号を付ける */
export const releaseQ1 = (numbered: boolean): string => `${numbered ? '1. ' : ''}どのデータで続けますか`;
/** デモ・自分のデータを選んだときに畳まずに出す注意（今のデータは1世代の控えに残る） */
export const RELEASE_WARN = 'いまのデータは消えます（データの画面の「直前の状態に戻す」で1回だけ戻せます）。';

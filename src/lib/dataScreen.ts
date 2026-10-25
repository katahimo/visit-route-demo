// データの画面（PRD D227・D103〜D107・D209。ADR-0006・0020・0032）の文と判定の純粋関数。
// 確認の本文・知らせの文・呼び方の入力の判定・Excel のファイル名を組み立てる。データの書き換えは画面が store で行う
import type { DemoData, RosterImportResult, RosterKind, RosterMode } from '../contracts/data';
import type { TidyPreview } from './tidy';
import { sizeText, tidyMonthLabel } from './tidy';

/** 1世代の控えの見込み・結果（store の canKeepPrevious・keepPrevious の戻り値のうち文に要るところ） */
type KeepState = { kept: boolean; why: string | null };

/**
 * 置き換える確認の本文に添える、1世代の控えの文（PRD D227。残せなければ理由）。
 * 控えは確認で OK になってから残すので、渡すのは見込み（canKeepPrevious）
 */
export const keepNote = (k: KeepState): string =>
  k.kept
    ? 'いまのデータは控えとして1つだけ残し、この画面の「直前の状態に戻す」で戻せます。'
    : `${k.why ?? '控えを残せません'}。`;

/** 操作のあとの知らせに添える文：見込みに反して控えを残せなかったら理由（操作は止めない） */
export const keptSuffix = (k: KeepState): string => (k.kept ? '' : `（${k.why ?? '控えを残せません'}）`);

/** 画面を開いたあとに新しい版が公開されて、Excel の部品を読めなかったとき */
export const EXCEL_STALE_TEXT =
  '新しい版が公開されたため、Excel の部品を読み込めませんでした。「画面を読み直す」を押してから、もう一度お試しください（データはそのままです）';

/** 呼び方の入力の判定：2つが同じだと項目の対象・Excel のシートを区別できない（PRD D250） */
export function termsCheck(
  input: { client: string; staff: string },
  saved: { client: string; staff: string },
): { same: boolean; ok: boolean; changed: boolean } {
  const client = input.client.trim();
  const staff = input.staff.trim();
  const same = client !== '' && client === staff;
  return {
    same,
    ok: client !== '' && staff !== '' && !same,
    changed: client !== saved.client || staff !== saved.staff,
  };
}

/** Excel 全体の読み込みの確認に出す件数（読み込んだデータの呼び方で） */
export function workbookCountsText(
  r: Pick<DemoData, 'org' | 'staff' | 'clients' | 'visits' | 'items' | 'rules'>,
): string {
  const t = r.org.terms;
  return `${t.staff} ${r.staff.length}人・${t.client} ${r.clients.length}人・訪問 ${r.visits.length}件・項目 ${r.items.length}件・条件 ${r.rules.length}件`;
}

/** 書き出す Excel のファイル名。英字だけ（呼び方の文字を入れると、Chromium で保存名が「download」になったため） */
export function excelFileName(kind: 'all' | RosterKind, date: string): string {
  if (kind === 'all') return `visit-route-demo-${date}.xlsx`;
  return `visit-route-demo-${kind === 'staff' ? 'staff' : 'clients'}-${date}.xlsx`;
}

/** 名簿の読み込みで、足す・直す・終了／休止にする人がいるか */
export const rosterHasChanges = (r: Pick<RosterImportResult, 'added' | 'updated' | 'retired'>): boolean =>
  r.added.length > 0 || r.updated.length > 0 || r.retired.length > 0;

/** 名簿の読み込み方の名前（確認の題・控えの理由） */
export const rosterHowText = (mode: RosterMode): string => (mode === 'replace' ? '総入れ替え' : '追加・更新');

/** 名簿の読み込みの確認の本文（気をつけることがあれば先頭に） */
export function rosterConfirmBody(x: {
  warning: string | null;
  fileName: string;
  term: string;
  how: string;
  summary: string;
  keep: KeepState;
}): string {
  return [
    ...(x.warning ? [x.warning, ''] : []),
    `「${x.fileName}」の${x.term}の名簿を読み込みます（${x.how}）。`,
    x.summary,
    '訪問の担当・確定（伝えた内容）・訪問はそのままです。',
    keepNote(x.keep),
  ].join('\n');
}

/** 名簿を読み込んだあとの知らせ（最終勤務日の入った人がいれば Excel の欄に名前を出したと添える。PRD D209） */
export function rosterDoneText(x: { term: string; staffTerm: string; hasLastDay: boolean; keep: KeepState }): string {
  return (
    (x.hasLastDay
      ? `${x.term}の名簿を読み込みました。最終勤務日の入った${x.staffTerm}がいます。Excel の欄に名前を出しました`
      : `${x.term}の名簿を読み込みました`) + keptSuffix(x.keep)
  );
}

/** 古い訪問の片づけで消せるものがあるか */
export const tidyHasAny = (p: Pick<TidyPreview, 'visits' | 'snapshots'>): boolean => p.visits + p.snapshots > 0;

/** 古い訪問の片づけの見込みの文（消せるものが無ければその旨） */
export function tidyPreviewText(ym: string, p: TidyPreview): string {
  return tidyHasAny(p)
    ? `${p.days}日分の訪問 ${p.visits}件・確定した内容 ${p.snapshots}日分（${sizeText(p.chars)}空きます）`
    : `${tidyMonthLabel(ym)}に消せる訪問の記録はありません`;
}

/** 古い訪問の片づけの確認の本文（戻せない・控えも残さないことを書く） */
export function tidyConfirmBody(p: TidyPreview): string {
  return `${p.days}日分の、担当を組んだ・変えた訪問 ${p.visits}件と確定した内容 ${p.snapshots}日分を消します（${sizeText(p.chars)}空きます）。繰り返しの回は繰り返しのとおりに戻り（担当・取り消しは消えます）、単発の訪問は消えます。人・繰り返し・条件は消えません。消したものは戻せません（容量を空けるため、直前の状態の控えも残しません）。`;
}

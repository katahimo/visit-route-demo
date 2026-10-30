// データの画面（PRD D227・D103〜D107・D209。ADR-0006・0020・0032）の文と判定の純粋関数。
// 確認の本文・知らせの文・呼び方の入力の判定・Excel・名簿（Excel・CSV。ADR-0068）のファイル名を組み立てる。データの書き換えは画面が store で行う
import type { DemoData, LedgerRead, RosterImportResult, RosterKind, RosterMode, RosterSource } from '../contracts/data';
import type { TidyPreview } from './tidy';
import { sizeText, tidyMonthLabel } from './tidy';

/** 1世代の控えの見込み・結果（store の canKeepPrevious・keepPrevious の戻り値のうち文に要るところ） */
type KeepState = { kept: boolean; why: string | null };

/**
 * 置き換える確認の本文に添える、1世代の控えの文（PRD D227。残せなければ理由）。
 * 控えは確認で OK になってから残すので、渡すのは見込み（canKeepPrevious）。place は「直前の状態に戻す」のある画面の呼び方
 */
export const keepNote = (k: KeepState, place = 'この画面'): string =>
  k.kept
    ? `いまのデータは控えとして1つだけ残し、${place}の「直前の状態に戻す」で戻せます。`
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

/** 書き出す Excel（全体）のファイル名。英字だけ（呼び方の文字を入れると、Chromium で保存名が「download」になったため） */
export const excelFileName = (date: string): string => `visit-route-demo-${date}.xlsx`;

/** 書き出す名簿のファイル名（Excel か CSV。ADR-0068）。英字だけ（excelFileName と同じ理由） */
export const rosterFileName = (kind: RosterKind, format: RosterSource['format'], date: string): string =>
  `visit-route-demo-${kind === 'staff' ? 'staff' : 'clients'}-${date}.${format}`;

/** 読んだ名簿のファイルの形の文（確認の本文に添える。CSV なら見分けた文字コード） */
const rosterSourceText = (s: RosterSource): string =>
  s.format === 'xlsx' ? 'Excel のブックとして読みました。' : `CSV（文字コード ${s.encoding}）として読みました。`;

/** 顧客台帳の形で読まなかった列の文（確認の本文に出す。ADR-0073） */
export const ledgerSkippedText = (l: LedgerRead): string =>
  l.skippedColumns.length === 0 ? '読まなかった列：なし' : `読まなかった列：${l.skippedColumns.join('・')}`;

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
  source: RosterSource;
  /** 顧客台帳の形で読んだときの結果（読まなかった列を出す。ADR-0073）。名簿の形は null */
  ledger?: LedgerRead | null;
  keep: KeepState;
}): string {
  return [
    ...(x.warning ? [x.warning, ''] : []),
    `「${x.fileName}」の${x.term}の名簿を読み込みます（${x.how}）。${rosterSourceText(x.source)}${x.ledger ? '顧客台帳の形として読みました。' : ''}`,
    ...(x.ledger ? [ledgerSkippedText(x.ledger)] : []),
    x.summary,
    '訪問の担当・確定（伝えた内容）・訪問はそのままです。',
    // 名簿は一覧の画面から読むので、戻す場所はデータの画面
    keepNote(x.keep, 'データの画面'),
  ].join('\n');
}

/** 名簿を読み込んだあとの知らせ（最終勤務日の入った人がいれば、一覧の「最終勤務日のある人」の欄で振り直せると添える。PRD D209） */
export function rosterDoneText(x: { term: string; staffTerm: string; hasLastDay: boolean; keep: KeepState }): string {
  return (
    (x.hasLastDay
      ? `${x.term}の名簿を読み込みました。最終勤務日の入った${x.staffTerm}がいます。「最終勤務日のある${x.staffTerm}」の欄から担当を振り直してください`
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

/**
 * Excel の全体のブックの事業所名が、いまのデータと違うか（別の事業所のブックの見込み。ADR-0006）。
 * 違えば両方の名前、同じなら null。事業所に ID は無いので名前で見る（前後の空白は問わない）
 */
export function otherOrgOf(
  current: Pick<DemoData, 'org'>,
  read: Pick<DemoData, 'org'>,
): { current: string; read: string } | null {
  const a = current.org.name.trim();
  const b = read.org.name.trim();
  return a === b ? null : { current: a, read: b };
}

/**
 * 読み込んだデータから、いまの事業所の運用の記録（伝えた内容・振り直し・組み方の標準の記録）を外す。
 * Excel にはこれらのシートが無く、読み込みは今のものを残すため、別の事業所のブックではここで消す
 */
export function withoutOrgState(d: DemoData): DemoData {
  const { standard: _standard, ...rest } = d;
  return { ...rest, snapshots: {}, reassigns: {} };
}

/** Excel の全体のブックで置き換える確認の本文（PRD D227。ADR-0006） */
export function workbookConfirmBody(x: {
  fileName: string;
  counts: string;
  otherOrg: { current: string; read: string } | null;
  keep: string;
}): string {
  const lines = [
    `「${x.fileName}」の内容（${x.counts}）で、いまのデータを置き換えます。訪問の担当は Excel の内容になります。`,
  ];
  if (x.otherOrg) {
    lines.push(
      `このファイルの事業所名「${x.otherOrg.read}」は、いまの「${x.otherOrg.current}」と違います。別の事業所のデータとして読み込み、いまの確定（伝えた内容）・振り直し・組み方の標準の記録は消します。`,
    );
  } else {
    lines.push(
      '確定（伝えた内容）・振り直し・組み方の標準の記録はそのまま残します（Excel と違う所は「未連絡の変更」になります）。',
    );
  }
  lines.push(x.keep);
  return lines.join('\n');
}

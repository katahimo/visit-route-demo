// 月の日のマスの文（PRD D53〜D55・D69・D177・D295）：読み上げ（aria-label）・読み方の吹き出しの文と行・印の短い文字を
// マスに出す印から決める純粋関数。データは書き換えない。画面は pages/monthCell.tsx（DayCell）
import { slotsText } from '../domain/availability';
import { weekday } from '../domain/time';
import { inBar, withEdges } from './barRows';
import { WEEKDAY_LABELS } from './common';
import { clockTime } from './dateText';
import {
  type ClientDay,
  type ClientVisitMark,
  type DayMarks,
  type DayStatus,
  issueBreakdown,
  type StaffDay,
  shortName,
} from './month';
import { cellGuide } from './monthGuide';
import { DAY_STATE_TEXT } from './monthList';
import { showRestMark } from './monthRest';
import { type OffDayState, REQUESTED_OFF_NOTE } from './requestedOff';
import { isAllRest, staffEdgeTexts, staffSlotSummary } from './staffBar';

/** 表示の選択の種類：全体／〈スタッフ〉1人／〈利用者さん〉1人 */
export type MonthFocusKind = 'all' | 'staff' | 'client';

/** 「11月3日（火）」 */
export const longDate = (d: string): string =>
  `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日（${WEEKDAY_LABELS[weekday(d)]}）`;

/** 分を「1.5時間」に（小数1桁） */
export const hoursText = (minutes: number): string => `${Math.round((minutes / 60) * 10) / 10}時間`;

/** 名前の並びを短く（「消防」「消防 ほか1人」） */
export function namesShort(names: readonly string[]): string {
  if (names.length === 0) return '';
  const first = shortName(names[0]!);
  return names.length === 1 ? first : `${first} ほか${names.length - 1}人`;
}

/** 1人なら短い名前、2人以上なら「N人」（始まる・終わる・休みの印） */
export function oneOrCount(names: readonly string[]): string {
  return names.length === 1 ? shortName(names[0]!) : `${names.length}人`;
}

/** 「休みを入れる」のときのマスの説明（読み上げ・title。一覧の行の補足にも） */
export const OFF_STATE_TEXT: Record<OffDayState, string> = {
  open: `押すと${REQUESTED_OFF_NOTE}にします`,
  requested: `${REQUESTED_OFF_NOTE}です。押すと外します`,
  noShift: '勤務の無い日です（押せません）',
  past: '今日より前の日です（押せません）',
  absent: 'ほかの欠勤が入っています。日の予定で直してください（押せません）',
};

/** 休む人の印（「休 N」）：人数・内訳の文（希望休か勤務なしか・名前）・見た目に出すか（ふだんより多い日だけ。PRD D295） */
export type RestMark = { resting: number; detail: string; shown: boolean };

export function restMarkOf(mk: Pick<DayMarks, 'off' | 'requested'>, usual: number): RestMark {
  const resting = mk.off.length + mk.requested.length;
  const detail = [
    mk.requested.length > 0 ? `${REQUESTED_OFF_NOTE}：${mk.requested.join('・')}` : '',
    mk.off.length > 0 ? `勤務なし：${mk.off.join('・')}` : '',
  ]
    .filter(Boolean)
    .join('／');
  return { resting, detail, shown: showRestMark({ resting, requested: mk.requested.length, usual }) };
}

/**
 * 選んだ〈スタッフ〉のその日の勤務の文。short：休み・欠勤・最終勤務日の後だけの短い文字（勤務がふつうの日は null。
 * 時刻は3段バーで見せる。PRD D75）。text：読み上げの文。covered：勤務の無い日の「休」がバーの「休み」（PRD D85）と
 * 重なるので見た目では隠す（週の表と同じ）
 */
export type StaffShift = { short: string | null; text: string; covered: boolean };

export function staffShiftOf(x: StaffDay): StaffShift {
  const short = x.retired
    ? '最終勤務日の後'
    : x.absence
      ? x.requested
        ? REQUESTED_OFF_NOTE
        : x.slots.length === 0
          ? '欠勤'
          : '欠勤あり'
      : x.off
        ? '休'
        : null;
  const text =
    short === null
      ? slotsText(x.slots)
      : x.absence && x.slots.length > 0 && !x.requested
        ? `${short} ${slotsText(x.slots)}`
        : short;
  return { short, text, covered: short === '休' && isAllRest(x.bar) };
}

/** 〈利用者さん〉の訪問1件の担当の読み上げ（「消防 まもるさん（いつもの担当でない）」など） */
function clientVisitWho(v: ClientVisitMark, staffName: (id: string) => string): string {
  if (v.cancelled) return v.sameDay ? '当日キャンセル' : '取り消し';
  if (v.leave) return '休みのため無し';
  if (v.staffId) return `${staffName(v.staffId)}さん${v.substitute ? '（いつもの担当でない）' : ''}`;
  return '担当なし';
}

/** 〈利用者さん〉の訪問1件のマスの短い文字（「当日取消」「消防」など） */
export function clientVisitShort(v: ClientVisitMark, staffName: (id: string) => string): string {
  if (v.cancelled) return v.sameDay ? '当日取消' : '取消';
  if (v.leave) return '休み';
  if (v.staffId) return shortName(staffName(v.staffId));
  return '担当なし';
}

/** 〈利用者さん〉のマスに並べる訪問の数（それより多い分は「ほか N件」） */
export const CLIENT_VISITS_MAX = 4;

export type DayCellInput = {
  date: string;
  status: DayStatus;
  today: string;
  making: boolean;
  focus: MonthFocusKind;
  marks: DayMarks;
  /** 全体のときの混み具合の読み上げ（null＝案が無く数えられない、undefined＝出さない） */
  loadText: string | null | undefined;
  staffDay: StaffDay | undefined;
  clientDay: ClientDay | undefined;
  offState: OffDayState | undefined;
  /** 要対応の札「要対応 N」の N（今日より前の日は出さない） */
  attention: number;
  /** 同じ月の同じ曜日の「ふだん」の休みの人数 */
  usualRest: number;
  /** その日の回の一覧を開いている（吹き出しの文の「もう一度押すと」） */
  listed: boolean;
  typeName: (id: string | null) => string;
  staffName: (id: string) => string;
  staffTerm: string;
  clientTerm: string;
};

export type DayCellText = {
  past: boolean;
  /** 要対応（赤は要対応だけ。PRD D228） */
  care: boolean;
  /** 要対応の札の N（0＝札なし） */
  attention: number;
  /** 担当なしのほかの要対応の内訳（「担当が休み 1」など） */
  otherIssues: string[];
  rest: RestMark;
  /** 〈スタッフ〉を選んでいるときのその日の勤務（それ以外は null） */
  shift: StaffShift | null;
  /** 読み上げ（aria-label。選んだ件数は画面で足す） */
  label: string;
  /** 読み方の吹き出しの文（日付の後ろ） */
  tipText: string;
  /** 読み方の吹き出しの行（lib/monthGuide） */
  guide: string[];
};

/** 日付の後ろの、日の状態と要対応の文 */
function statusParts(s: DayStatus, attn: number, care: boolean, otherIssues: readonly string[], making: boolean) {
  const parts: string[] = [];
  if (s.count > 0) parts.push(`訪問 ${s.count}件`, DAY_STATE_TEXT[s.state]);
  else parts.push('訪問なし');
  if (attn > 0) parts.push(`要対応 ${attn}`);
  else if (care) parts.push('要対応');
  if (s.unassigned > 0) parts.push(`担当なし ${s.unassigned}件`);
  for (const x of otherIssues) parts.push(`${x}件`);
  if (s.changes > 0) parts.push(`未連絡の変更 ${s.changes}件`);
  if (s.overSpan.length > 0) parts.push(`出勤〜退勤（拘束）が上限を超える ${s.overSpan.length}人`);
  if (making) parts.push('組んでいます');
  return parts;
}

/** 全体のときの印の文（種類・休む人・欠勤・始まる／終わる・休み・最終勤務日・混み具合） */
function allParts(x: DayCellInput, rest: RestMark): string[] {
  const mk = x.marks;
  const parts: string[] = [];
  if (mk.types.length > 0)
    parts.push(`種類：${mk.types.map((t) => `${x.typeName(t.typeId)} ${t.count}件`).join('・')}`);
  // 読み上げにも内訳（希望休か勤務なしか・名前）を入れる。見た目の「休 N」を絞っても人数は残す（PRD D295）
  if (rest.resting > 0) parts.push(`休む${x.staffTerm} ${rest.resting}人（${rest.detail}）`);
  if (mk.absent.length > 0) parts.push(`欠勤 ${mk.absent.join('・')}`);
  if (mk.starts.length > 0) parts.push(`始まる ${mk.starts.join('・')}`);
  if (mk.ends.length > 0) parts.push(`終わる ${mk.ends.join('・')}`);
  if (mk.leaves.length > 0) parts.push(`${x.clientTerm}の休み ${mk.leaves.join('・')}`);
  if (mk.lastDays.length > 0) parts.push(`最終勤務日 ${mk.lastDays.join('・')}`);
  // 8〜20時のまとめ＋8時より前・20時以降の端の文（PRD D82。二重に読まない）
  if (x.loadText) parts.push(x.loadText);
  else if (x.loadText === null) parts.push('混み具合は数えられません');
  return parts;
}

/** 〈スタッフ〉を選んでいるときの文（勤務・担当・目安・移動・時間帯） */
function staffParts(x: StaffDay, shift: StaffShift): string[] {
  const parts = [shift.text];
  if (x.count > 0 || x.target !== null) {
    parts.push(`担当 ${x.count}件`);
    if (x.target !== null) parts.push(`目安 ${Math.round(x.target * 10) / 10}件`);
  }
  if (x.travel > 0) parts.push(`移動 ${x.travel}分`);
  parts.push(withEdges(`時間帯：${staffSlotSummary(inBar(x.bar))}`, staffEdgeTexts(x.bar)));
  return parts;
}

/** 〈利用者さん〉を選んでいるときの文（訪問ごとに時刻・種類・担当） */
function clientParts(x: ClientDay, input: DayCellInput): string[] {
  return x.visits.map(
    (v) =>
      `${clockTime(v.start)} ${input.typeName(v.typeId)} ${clientVisitWho(v, input.staffName)}${v.edited ? '（この回だけ変更）' : ''}`,
  );
}

/** 日のマスの読み上げ・吹き出しの文と行（印の順は見た目と同じ） */
export function dayCellText(x: DayCellInput): DayCellText {
  const { date: d, status: s, marks: mk, focus } = x;
  const past = d < x.today;
  const care = s.needsCare && !past;
  const attention = past ? 0 : x.attention;
  const otherIssues = issueBreakdown(s.issues).filter((t) => !t.startsWith('担当なし'));
  const rest = restMarkOf(mk, x.usualRest);
  const shift = focus === 'staff' && x.staffDay ? staffShiftOf(x.staffDay) : null;
  const parts = [longDate(d), ...statusParts(s, attention, care, otherIssues, x.making)];
  if (focus === 'all') parts.push(...allParts(x, rest));
  else if (x.staffDay && shift) parts.push(...staffParts(x.staffDay, shift));
  else if (focus === 'client' && x.clientDay) parts.push(...clientParts(x.clientDay, x));
  if (x.offState) parts.push(OFF_STATE_TEXT[x.offState]);
  // マスの読み方（PRD D177）：出ている印だけの説明
  const cv = focus === 'client' ? (x.clientDay?.visits ?? []).slice(0, CLIENT_VISITS_MAX) : [];
  const guide = cellGuide({
    focus,
    count: s.count,
    stateText: s.count > 0 ? DAY_STATE_TEXT[s.state] : null,
    care,
    attention,
    types: focus === 'all' && mk.types.length > 0,
    resting: rest.resting,
    restShown: rest.shown,
    requested: mk.requested.length,
    absent: mk.absent.length > 0,
    starts: mk.starts.length > 0,
    ends: mk.ends.length > 0,
    leaves: mk.leaves.length > 0,
    lastDays: mk.lastDays.length > 0,
    loadBar: focus !== 'all' ? null : x.loadText ? 'load' : x.loadText === null ? 'noPlan' : null,
    unassigned: s.unassigned > 0,
    issues: otherIssues.length > 0,
    changed: s.changes > 0,
    overSpan: s.overSpan.length > 0,
    substitute: cv.some((v) => v.substitute),
    edited: cv.some((v) => v.edited && !v.cancelled),
    staffTerm: x.staffTerm,
    clientTerm: x.clientTerm,
  });
  const tipText = `${parts.slice(1).join('・')}${
    x.offState
      ? ''
      : x.listed
        ? '（もう一度押すとこの日の「日の予定」を開きます）'
        : '（押すとこの日の訪問を右の欄に出します。もう一度押すと「日の予定」）'
  }`;
  return { past, care, attention, otherIssues, rest, shift, label: parts.join('・'), tipText, guide };
}

// 訪問の帯・行の共通の部品（PRD D339〜D341。ADR-0056）：日・週・月・人の予定表で同じものを使う。
// - VisitMarks：帯の印（要対応・資格✗／限✗・未連絡の変更・ピン・この回だけ変更・仮押さえ。lib/visitLook）
// - useVisitLooks：期間の訪問の見た目（日の状態 useDayStatuses から。画面ごとに判定を持たない）
// - useVisitSelection・useVisitItem：選ぶ（Shift／Ctrl＋クリック・Shift／Ctrl＋Enter・スマホは長押しか「選ぶ」）と、キーで動かす・押して開く
// - 札の3段の大きさ（PRD D342。ADR-0057）：大＝日の時間軸の帯（data-size="l"）・中＝リストの行 VisitRow（"m"）・小＝表のマスの札 VisitChip（"s"）。
//   印（VisitMarks）・選ぶ・キー・ドラッグは3段とも同じ部品。入れ物は時間軸・表（マスに積む ChipStack）・リスト（行）の3種類
// - VisitRow：1行1訪問の行（スマホの日ごとのリスト・人の予定表の2段目・月のその日の回の一覧・表のマスの「+N」の一覧）
// - useVisitDrag・DropShadow：ドラッグの落とし先の判定（lib/visitDrop）と影
// データを書くのは store の update だけ（キーは components/visitKeys、選んだ訪問の操作は SelectionBar、落としたあとは欄）
// 部品は分けたファイルにあり、ここから同じ名前で出し直す（呼ぶ側は visitParts から import する）：
// useVisitLooks（useVisitLooks.ts）・useVisitSelection／useVisitItem（useVisitItem.ts）・ChipStack（ChipStack.tsx）・useVisitDrag／DropShadow（useVisitDrag.tsx）
import { CheckSquare, MessageSquareText, Pin, Square, TriangleAlert } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { Staff } from '../contracts/documents';
import type { LookMarkKind, VisitLook } from '../lib/visitLook';
import { selectedText } from '../lib/visitSelect';
import { StaffMark } from './StaffMark';
import type { VisitItemProps } from './useVisitItem';
import './visitParts.css';

export { CHIPS_PER_CELL, ChipStack } from './ChipStack';
export { type DropHover, DropShadow, useVisitDrag, type VisitDrag } from './useVisitDrag';
export {
  LONG_PRESS_MS,
  useVisitItem,
  useVisitSelection,
  type VisitItemProps,
  type VisitSelection,
} from './useVisitItem';
export { useVisitLooks } from './useVisitLooks';

// ---- 見た目 ----

const ICONS: Partial<Record<LookMarkKind, (size: number) => ReactNode>> = {
  issue: (n) => <TriangleAlert size={n} aria-hidden="true" />,
  told: (n) => <MessageSquareText size={n} aria-hidden="true" />,
  pin: (n) => <Pin size={n} strokeWidth={2.4} aria-hidden="true" />,
};

/**
 * 帯の印（形と文字で分ける。色だけにしない）。読み上げは帯・行の aria-label に look.text を入れるので、印は aria-hidden。
 * testIdPrefix を渡すと印ごとに `${prefix}-${種類}`（日ごとのリストの day-mark-issue など）
 */
export function VisitMarks({
  look,
  size = 12,
  testIdPrefix,
  className = '',
}: {
  look: VisitLook | undefined;
  size?: number;
  testIdPrefix?: string;
  className?: string;
}) {
  if (!look || look.marks.length === 0) return null;
  return (
    <span className={`vmarks ${className}`} aria-hidden="true" data-testid="visit-marks" data-marks={look.kinds}>
      {look.marks.map((m) => (
        <span
          key={`${m.kind}-${m.short}`}
          className={`vmark is-${m.tone}`}
          title={m.title}
          data-kind={m.kind}
          data-told-date={m.toldDate}
          data-testid={testIdPrefix ? `${testIdPrefix}-${m.kind}` : undefined}
        >
          {/* 「変更あり」の印（expert 切）は文字で出し、押すとその日の連絡の一覧（札のクリックの中で見分ける。components/openTold） */}
          {m.toldDate ? m.short : (ICONS[m.kind]?.(size) ?? m.short)}
        </span>
      ))}
    </span>
  );
}

/**
 * スマホの「選ぶ」（選ぶ形に入る・抜ける。PRD D334・D340）。日の予定の日ごとのリスト・週の表・人の予定表で同じボタン
 */
export function SelectToggle({
  selecting,
  onChange,
  disabled,
  testId,
}: {
  selecting: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <button
      type="button"
      className={`btn btn-small select-toggle${selecting ? ' is-on' : ''}`}
      aria-pressed={selecting}
      onClick={() => onChange(!selecting)}
      data-testid={testId}
      disabled={disabled}
    >
      {selecting ? <CheckSquare size={14} aria-hidden="true" /> : <Square size={14} aria-hidden="true" />}
      {selecting ? '選び終える' : '選ぶ'}
    </button>
  );
}

// ---- 1行1訪問の行 ----

/** 行の中身 */
export type VisitRowData = {
  visitId: string;
  /** 「9:00〜10:00」 */
  time: string;
  /** 大きく出す名前（ふつうは〈利用者さん〉。〈スタッフ〉の画面でも〈利用者さん〉） */
  title: string;
  /** 担当（印。担当なし・〈スタッフ〉の画面では null） */
  staff: Staff | null;
  /** 2行目の文字（担当の名前。空なら「担当なし」） */
  staffName: string;
  /** 取り消し・休みの文（無ければ null） */
  state: string | null;
  look: VisitLook | undefined;
  /** 種類の色（左の線） */
  color: string | null;
  /** 2行目に担当を出さない（〈スタッフ〉の画面：その人の回だけなので要らない） */
  hideStaff?: boolean;
};

/** 行の読み上げ（時刻・名前・担当・状態・印・選択） */
export function visitRowLabel(r: VisitRowData, selecting: boolean, selected: boolean): string {
  return [
    r.time,
    `${r.title}さん`,
    r.hideStaff ? null : r.staffName ? `担当 ${r.staffName}` : '担当なし',
    r.state,
    r.look?.text || null,
    selecting ? (selected ? '選択中' : '選んでいない') : null,
  ]
    .filter(Boolean)
    .join('・');
}

/**
 * 1行1訪問の行（PRD D334・D340）：［選ぶの印］時刻｜〈利用者さん〉と担当の印・名前（取り消し・休みの札）｜印。
 * スマホの日ごとのリスト・人の予定表の2段目（日ごとのリスト）・月のその日の回の一覧で同じ形。押し方は呼ぶ側の props（useVisitItem）
 */
export function VisitRow({
  row: r,
  selecting,
  selected,
  props,
  testId,
  markPrefix,
  extraClass = '',
}: {
  row: VisitRowData;
  selecting: boolean;
  selected: boolean;
  props: VisitItemProps;
  testId: string;
  /** 印の data-testid の前（日ごとのリストは day-mark） */
  markPrefix?: string;
  extraClass?: string;
}) {
  const tone = r.look?.tone;
  return (
    <button
      type="button"
      className={[
        'vrow',
        tone === 'issue' || tone === 'unassigned' ? 'is-issue' : '',
        !r.hideStaff && r.staffName === '' && !r.state ? 'is-unassigned' : '',
        r.state ? 'is-off' : '',
        selected ? 'is-multi' : '',
        extraClass,
      ].join(' ')}
      style={r.color ? ({ borderLeftColor: r.color } as CSSProperties) : undefined}
      aria-label={visitRowLabel(r, selecting, selected)}
      data-testid={testId}
      data-visit={r.visitId}
      data-size="m"
      data-marks={r.look?.kinds ?? ''}
      {...props}
    >
      {selecting && (
        <span className="vrow-check" aria-hidden="true">
          {selected ? <CheckSquare size={18} /> : <Square size={18} />}
        </span>
      )}
      <span className="vrow-time">{r.time}</span>
      <span className="vrow-main">
        <span className="vrow-title">{r.title}</span>
        {(!r.hideStaff || r.state) && (
          <span className="vrow-staff">
            {r.hideStaff ? null : r.staffName !== '' ? (
              <>
                <StaffMark staff={r.staff ?? undefined} size="xs" />
                {r.staffName}
              </>
            ) : (
              <span className="vrow-none">担当なし</span>
            )}
            {r.state && <span className="chip chip-red">{r.state}</span>}
          </span>
        )}
      </span>
      <VisitMarks look={r.look} size={14} testIdPrefix={markPrefix} className="vrow-marks" />
    </button>
  );
}

// ---- 小さな札（表のマス） ----

/**
 * 小さな札（表のマスに積む。PRD D342）：「9:00 図」（時刻と頭文字）と印。印・選ぶ・キー・ドラッグは時間軸の帯・リストの行と同じ部品で、
 * 押し方は呼ぶ側の props（useVisitItem・useVisitDrag の source）。label は読み上げ（時刻・名前・担当・印・選択）
 */
export function VisitChip({
  visitId,
  time,
  short,
  label,
  title,
  look,
  color,
  selected,
  unassigned = false,
  off = false,
  props,
  testId,
}: {
  visitId: string;
  /** 「9:00」 */
  time: string;
  /** 頭文字（〈スタッフ〉×曜日の表は〈利用者さん〉の頭文字、〈利用者さん〉×曜日の表は担当の印） */
  short: ReactNode;
  label: string;
  title?: string;
  look: VisitLook | undefined;
  /** 種類の色（左の線） */
  color: string | null;
  selected: boolean;
  unassigned?: boolean;
  /** 取り消し・休み（薄く・動かさない） */
  off?: boolean;
  props: VisitItemProps;
  testId: string;
}) {
  const tone = look?.tone;
  return (
    <button
      type="button"
      className={[
        'vchip',
        tone === 'issue' || tone === 'unassigned' ? 'is-issue' : '',
        unassigned ? 'is-unassigned' : '',
        off ? 'is-off' : '',
        selected ? 'is-multi' : '',
      ].join(' ')}
      style={color ? ({ borderLeftColor: color } as CSSProperties) : undefined}
      aria-label={label}
      title={title ?? label}
      data-testid={testId}
      data-visit={visitId}
      data-size="s"
      data-marks={look?.kinds ?? ''}
      {...props}
    >
      <span className="vchip-time">{time}</span>
      <span className="vchip-short">{short}</span>
      <VisitMarks look={look} size={9} className="vchip-marks" />
    </button>
  );
}

/** 選んだ訪問の読み上げの添え（帯の aria-label の後ろ） */
export { selectedText };

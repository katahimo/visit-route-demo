// 月のカレンダーの日のマス（PRD D53〜D55・D69・D177・D295・D340・D341）：日の状態を背景・枠と印で、種類の積み上げバー・
// 休み欠勤の印・始まる▶終わる■の印・混み具合バー（全体）／その人の時間帯（〈スタッフ〉）／訪問の並び（〈利用者さん〉）。
// 文（読み上げ・読み方の吹き出し）は lib/monthCell の dayCellText
import { BedSingle, CalendarOff, CircleAlert, Lock, PencilLine, Timer, UserX } from 'lucide-react';
import { memo, type KeyboardEvent as ReactKeyboardEvent, useLayoutEffect } from 'react';
import { LoadBar, loadSummary, TypeStack } from '../components/loadBar';
import { toldDateOf, useOpenTold } from '../components/openTold';
import { StaffBar } from '../components/staffBar';
import { useConfirmStep } from '../components/useFeature';
import type { DropHover } from '../components/visitParts';
import type { Staff, VisitType } from '../contracts/documents';
import { inBar, loadEdgeTexts, withEdges } from '../lib/barRows';
import { colorOf } from '../lib/colors';
import { clockTime } from '../lib/dateText';
import type { ClientDay, DayMarks, DayStatus, StaffDay } from '../lib/month';
import {
  CLIENT_VISITS_MAX,
  clientVisitShort,
  type DayCellText,
  dayCellText,
  longDate,
  type MonthFocusKind,
  namesShort,
  oneOrCount,
  type StaffShift,
} from '../lib/monthCell';
import type { TipStore } from '../lib/monthGuide';
import type { OffDayState } from '../lib/requestedOff';
import { changedFlagText, shownDayState } from '../lib/settledView';
import { dropShadowText, dropTone } from '../lib/visitDrop';
import { isMultiClick } from '../lib/visitSelect';
import type { DayLoadSlot } from '../vacancy';

/** どのマスでも同じもの（月の画面で覚えておき、変わらなければマスを描き直さない） */
export type CellContext = {
  /** マスの読み方の文の置き場（日付で引く。MonthCellTip） */
  tipStore: TipStore;
  today: string;
  focus: MonthFocusKind;
  typeById: ReadonlyMap<string, VisitType>;
  staffById: ReadonlyMap<string, Staff>;
  /** 〈利用者さん〉の呼び方（org.terms.client。休みの印の title） */
  clientTerm: string;
  /** 〈スタッフ〉の呼び方（org.terms.staff。休む人の印の title） */
  staffTerm: string;
  onOpen: (date: string) => void;
  onToggleOff: (date: string) => void;
  /** マスのキー（←→↑↓・Enter・Shift／Ctrl＋Enter。PRD D340） */
  onKey: (e: ReactKeyboardEvent, date: string) => void;
  /** Shift／Ctrl＋クリックでその日の訪問をまとめて選ぶ・外す */
  onMulti: (date: string) => void;
};

type CellProps = {
  date: string;
  ctx: CellContext;
  status: DayStatus;
  picked: boolean;
  making: boolean;
  marks: DayMarks;
  /** 全体のときだけ（null＝案なし） */
  load: DayLoadSlot[] | null | undefined;
  staffDay: StaffDay | undefined;
  clientDay: ClientDay | undefined;
  /** 「休みを入れる」のときのその日の扱い（PRD D69。それ以外は undefined＝押すと日の画面へ） */
  offState: OffDayState | undefined;
  /** 要対応の札「要対応 N」の N（0＝札なし。今日より前の日は出さない。PRD D295） */
  attention: number;
  /** 同じ月の同じ曜日の「ふだん」の休みの人数（「休 N」はこれより多い日だけ出す。PRD D295） */
  usualRest: number;
  /** その日の選んだ訪問の件数（0＝無し） */
  selected: number;
  /** その日の回の一覧を開いている */
  listed: boolean;
  /** ドラッグの落とし先の影（この日の上にあるときだけ） */
  drop: DropHover | undefined;
};

/** 担当なし・ほかの要対応・未連絡・拘束超・組んでいます の札 */
function CellFlags({
  s,
  otherIssues,
  making,
  ctx,
  confirmStep,
}: {
  s: DayStatus;
  otherIssues: readonly string[];
  making: boolean;
  ctx: CellContext;
  /** 確定の段階を出すか（切は札を「変更あり N」にする） */
  confirmStep: boolean;
}) {
  return (
    <span className="month-flags">
      {s.unassigned > 0 && (
        <span className="month-flag is-red" data-testid="month-unassigned">
          <CircleAlert size={12} aria-hidden="true" />
          担当なし {s.unassigned}
        </span>
      )}
      {otherIssues.map((x) => (
        <span key={x} className="month-flag is-red" data-testid="month-issue">
          <CircleAlert size={12} aria-hidden="true" />
          {x}
        </span>
      ))}
      {s.changes > 0 && (
        <span
          className="month-flag is-warn"
          title="確定（伝えた）あとに担当・時刻が変わった訪問です。日の予定の連絡の一覧で確かめてください"
          data-testid="month-changed"
        >
          <PencilLine size={12} aria-hidden="true" />
          {changedFlagText(s.changes, confirmStep)}
        </span>
      )}
      {s.overSpan.length > 0 && (
        <span
          className="month-flag is-warn"
          title={`出勤〜退勤（拘束）が上限を超える${ctx.staffTerm}：${s.overSpan
            .map((id) => ctx.staffById.get(id)?.name ?? '')
            .join('・')}`}
          data-testid="month-over-span"
        >
          <Timer size={12} aria-hidden="true" />
          拘束超 {s.overSpan.length}
        </span>
      )}
      {making && <span className="month-flag is-warn">組んでいます…</span>}
    </span>
  );
}

/** 全体のときの印（休む人・欠勤・始まる／終わる・〈利用者さん〉の休み・最終勤務日） */
function AllMarks({ mk, text, ctx }: { mk: DayMarks; text: DayCellText; ctx: CellContext }) {
  const { rest } = text;
  return (
    <span className="month-marks">
      {rest.shown && (
        <span
          className={`month-mark${mk.requested.length > 0 ? ' is-requested' : ''}`}
          title={`休む${ctx.staffTerm} ${rest.resting}人（${rest.detail}）`}
          data-testid="month-resting"
        >
          休 {rest.resting}
          {/* 希望休は色だけでなく文字でも分ける */}
          {mk.requested.length > 0 && `（希${mk.requested.length}）`}
        </span>
      )}
      {mk.absent.length > 0 && (
        <span className="month-mark is-absent" title={`欠勤：${mk.absent.join('・')}`} data-testid="month-absent">
          欠 {namesShort(mk.absent)}
        </span>
      )}
      {mk.starts.length > 0 && (
        <span className="month-mark" title={`始まる：${mk.starts.join('・')}`}>
          ▶{` ${oneOrCount(mk.starts)}`}
        </span>
      )}
      {mk.ends.length > 0 && (
        <span className="month-mark" title={`終わる：${mk.ends.join('・')}`}>
          ■{` ${oneOrCount(mk.ends)}`}
        </span>
      )}
      {mk.leaves.length > 0 && (
        <span
          className="month-mark is-leave"
          title={`${ctx.clientTerm}の休み（訪問は無し）：${mk.leaves.join('・')}`}
          data-testid="month-leave"
        >
          <BedSingle size={11} aria-hidden="true" />
          {oneOrCount(mk.leaves)}
        </span>
      )}
      {mk.lastDays.length > 0 && (
        <span
          className="month-mark is-lastday"
          title={`最終勤務日（翌日から勤務なし）：${mk.lastDays.join('・')}`}
          data-testid="month-lastday"
        >
          最終 {namesShort(mk.lastDays)}
        </span>
      )}
    </span>
  );
}

/** 〈スタッフ〉を選んでいるときの勤務の短い文字（休み・欠勤・最終勤務日の後だけ）と時間帯のバー */
function StaffCellBody({ x, shift }: { x: StaffDay; shift: StaffShift }) {
  const tone = x.retired ? ' is-retired' : x.absence ? (x.requested ? ' is-requested' : ' is-absent') : ' is-off';
  return (
    <>
      {shift.short !== null && (
        // 勤務の無い日の「休」は、バーに重ねた「休み」（PRD D85）と二重にしないよう読み上げだけ（週の表と同じ。
        // 欠勤・希望休・最終勤務日の後は理由の文字なので残す）
        <span className={`month-shift${tone}${shift.covered ? ' sr-only' : ''}`} data-testid="month-shift">
          {x.absence &&
            (x.requested ? <CalendarOff size={12} aria-hidden="true" /> : <UserX size={12} aria-hidden="true" />)}
          {shift.short}
        </span>
      )}
      <span className="month-load is-staff">
        <StaffBar slots={x.bar} />
      </span>
    </>
  );
}

/** 〈利用者さん〉を選んでいるときの訪問の並び（時刻・担当・代・変。多い日は「ほか N件」） */
function ClientCellBody({ x, ctx }: { x: ClientDay; ctx: CellContext }) {
  const staffName = (id: string) => ctx.staffById.get(id)?.name ?? '';
  return (
    <span className="month-cvisits">
      {x.visits.slice(0, CLIENT_VISITS_MAX).map((v) => {
        const t = v.typeId === null ? undefined : ctx.typeById.get(v.typeId);
        return (
          <span
            key={v.visitId}
            className={`month-cvisit${v.cancelled ? ' is-cancelled' : ''}${v.leave ? ' is-leave' : ''}`}
          >
            <span
              className="month-type-dot"
              style={{ background: t ? colorOf(t.color) : '#cfc4bb' }}
              aria-hidden="true"
            />
            <span className="month-cvisit-time">{clockTime(v.start)}</span>
            <span className="month-cvisit-who">{clientVisitShort(v, staffName)}</span>
            {v.substitute && (
              <span className="month-badge is-sub" title="いつもの担当でない">
                代
              </span>
            )}
            {v.edited && !v.cancelled && (
              <span className="month-badge" title="この回だけ変更">
                変
              </span>
            )}
          </span>
        );
      })}
      {x.visits.length > CLIENT_VISITS_MAX && <span className="sub">ほか{x.visits.length - CLIENT_VISITS_MAX}件</span>}
    </span>
  );
}

/** マスの見出しの行（日付・今日・確定の鍵・未連絡の印・要対応の札・件数・選んだ件数） */
function CellHead({
  d,
  s,
  text,
  ctx,
  selected,
}: {
  d: string;
  s: DayStatus;
  text: DayCellText;
  ctx: CellContext;
  selected: number;
}) {
  // expert 切は「確定済み」の鍵を出さない（変更ありだけ。ADR-0073）
  const confirmStep = useConfirmStep();
  const shown = shownDayState(s.state, confirmStep);
  return (
    <span className="month-cell-head">
      <span className="month-day">
        {Number(d.slice(8, 10))}
        {d === ctx.today && <span className="month-today">今日</span>}
      </span>
      {s.count > 0 && shown === 'told' && <Lock size={12} className="month-lock" aria-hidden="true" />}
      {/* 未連絡の変更あり（淡い黄）は色だけで分けない */}
      {s.count > 0 && shown === 'changed' && (
        // expert 切：押すとその日の日の予定の連絡の一覧（マスのクリックの中で見分ける。components/openTold。ADR-0073）
        <span
          className={confirmStep ? undefined : 'month-told-btn'}
          data-told-date={confirmStep ? undefined : d}
          title={confirmStep ? undefined : '変更あり（押すと連絡の一覧）'}
        >
          <PencilLine size={12} className="month-diff-icon" aria-hidden="true" data-testid="month-diff-mark" />
        </span>
      )}
      {text.attention > 0 ? (
        <span className="month-attn" data-testid="month-attn">
          要対応 {text.attention}
        </span>
      ) : (
        text.care && <span className="month-dot" aria-hidden="true" />
      )}
      {s.count > 0 && ctx.focus === 'all' && <span className="month-count">{s.count}件</span>}
      {selected > 0 && (
        <span className="month-selected" data-testid="month-selected">
          選択 {selected}
        </span>
      )}
    </span>
  );
}

/** 日のマス（memo。範囲の AI で組むの進み具合などで、変わらないマスは描き直さない） */
export const DayCell = memo(function DayCell(props: CellProps) {
  const { date: d, status: s, ctx, making, marks: mk, load, offState } = props;
  const { today, focus, typeById, staffById } = ctx;
  const confirmStep = useConfirmStep();
  const openTold = useOpenTold();
  const text = dayCellText({
    confirmStep,
    date: d,
    status: s,
    today,
    making,
    focus,
    marks: mk,
    // 読み上げ：8〜20時のまとめ＋8時より前・20時以降の端の文（PRD D82。二重に読まない）
    loadText: load ? withEdges(loadSummary(inBar(load)), loadEdgeTexts(load)) : load,
    staffDay: props.staffDay,
    clientDay: props.clientDay,
    offState,
    attention: props.attention,
    usualRest: props.usualRest,
    listed: props.listed,
    typeName: (id) => (id === null ? '種類なし' : (typeById.get(id)?.name ?? '種類なし')),
    staffName: (id) => staffById.get(id)?.name ?? '',
    staffTerm: ctx.staffTerm,
    clientTerm: ctx.clientTerm,
  });
  const { tipText, guide } = text;
  const guideKey = guide.join('\n');
  // 描いたあとに、日付をキーに読み方の文を置く（吹き出しは日付で引く。描画中に DOM を読まない）
  // biome-ignore lint/correctness/useExhaustiveDependencies: 文（guideKey）が変わったときだけ置き直す
  useLayoutEffect(() => {
    ctx.tipStore.set(d, { head: longDate(d), text: tipText, lines: guide });
  }, [ctx.tipStore, d, tipText, guideKey]);
  const offPress = offState === 'open' || offState === 'requested';
  const flags = <CellFlags s={s} otherIssues={text.otherIssues} making={making} ctx={ctx} confirmStep={confirmStep} />;
  return (
    <td
      className={[
        'month-cell',
        s.count > 0 ? `is-state-${shownDayState(s.state, confirmStep)}` : 'is-novisit',
        text.past ? 'is-past' : '',
        text.care ? 'is-care' : '',
        d === today ? 'is-today' : '',
        props.picked ? 'is-picked' : '',
        making ? 'is-making' : '',
        focus === 'staff' && props.staffDay && props.staffDay.slots.length === 0 ? 'is-rest' : '',
        offState ? `is-off-${offState}` : '',
        props.selected > 0 ? 'is-selected' : '',
        props.listed ? 'is-listed' : '',
        props.drop ? `is-drop-${dropTone(props.drop.verdict)}` : '',
      ].join(' ')}
    >
      <button
        type="button"
        className="month-cell-btn"
        data-testid="month-day"
        data-date={d}
        data-state={s.count > 0 ? s.state : 'empty'}
        data-off={offState}
        aria-label={`${text.label}${props.selected > 0 ? `・選択中 ${props.selected}件` : ''}`}
        aria-pressed={offState ? offState === 'requested' : undefined}
        aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Enter Shift+Enter"
        data-selected={props.selected > 0 ? props.selected : undefined}
        // 押せない日も Tab で届き、理由（aria-label）が読み上がるよう disabled にしない。押しても何もしない
        aria-disabled={offState !== undefined && !offPress ? true : undefined}
        // 見た目の説明は title ではなく読み方の吹き出し（MonthCellTip。title と二重に出さない）
        data-tip="cell"
        onClick={(e) => {
          // 「変更あり」の印（expert 切）：その日の連絡の一覧へ（日を選ぶのではなく移る）
          const toldDate = toldDateOf(e.target);
          if (toldDate !== null && !offState) {
            e.preventDefault();
            openTold(toldDate);
            return;
          }
          // Shift／Ctrl＋クリックはその日の訪問をまとめて選ぶ（休みを入れる間は今どおり）
          if (!offState && isMultiClick(e)) {
            e.preventDefault();
            ctx.onMulti(d);
            return;
          }
          if (!offState) ctx.onOpen(d);
          else if (offPress) ctx.onToggleOff(d);
        }}
        onKeyDown={(e) => ctx.onKey(e, d)}
      >
        <CellHead d={d} s={s} text={text} ctx={ctx} selected={props.selected} />
        {focus === 'all' && (
          <>
            <TypeStack types={mk.types} typeById={typeById} />
            <AllMarks mk={mk} text={text} ctx={ctx} />
            {flags}
            <span className="month-load">
              <LoadBar load={load ?? null} />
            </span>
          </>
        )}
        {focus === 'staff' && props.staffDay && text.shift && <StaffCellBody x={props.staffDay} shift={text.shift} />}
        {focus === 'client' && props.clientDay && <ClientCellBody x={props.clientDay} ctx={ctx} />}
        {focus !== 'all' && flags}
        {props.drop && (
          <span className={`vdrop is-${dropTone(props.drop.verdict)} month-drop`} data-testid="month-drop">
            <span className="vdrop-text">
              {dropShadowText(props.drop.verdict, { fit: props.drop.fit, time: false })}
            </span>
          </span>
        )}
      </button>
    </td>
  );
});

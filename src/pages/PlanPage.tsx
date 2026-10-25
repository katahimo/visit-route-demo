import {
  ArrowRightLeft,
  Ban,
  BedSingle,
  CalendarDays,
  CircleOff,
  Clock,
  Info,
  Map as MapIcon,
  MessageSquareText,
  PanelRightOpen,
  Pin,
  PinOff,
  Plus,
  ShieldAlert,
  Square,
  TriangleAlert,
  UserRoundX,
} from 'lucide-react';
import { type DragEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { useDay } from '../components/day';
import { DayLines } from '../components/dayLines';
import { DayList, type DayListRow } from '../components/dayList';
import { MapDock } from '../components/MapDock';
import { MenuButton, type MenuItem } from '../components/MenuButton';
import { useMailLimit } from '../components/mailParts';
import { VisitRouteLinks } from '../components/mapsLinks';
import { PersonButton, PersonInfo } from '../components/PersonPopover';
import type { IssueRow } from '../components/PlanIssueCount';
import { ClientName } from '../components/parts';
import { RouteMap } from '../components/RouteMap';
import { RouteTimeline, type TimelineBand, type TimelineColumn } from '../components/routeTimeline';
import { LegLine, StaffFocusButton, StaffLegend, VisitCard } from '../components/routeView';
import { ScheduleNav } from '../components/ScheduleNav';
import { StaffMark, StaffMarkById } from '../components/StaffMark';
import { ScheduleToolbar, SelectionBar } from '../components/scheduleParts';
import { Term } from '../components/Term';
import { useToast } from '../components/Toast';
import { shiftShort, TlMark, type TlMarkTone } from '../components/timelineMarks';
import { Empty, Hint, IconButton, PageHeader, SectionTitle, WithIcon } from '../components/ui';
import { useHistoryOps, useUndoAction } from '../components/undo';
import { useDayModel } from '../components/useDayModel';
import { useFeature } from '../components/useFeature';
import { COMPACT_QUERY, useMedia } from '../components/useMedia';
import { useRouteSelection } from '../components/useRouteSelection';
import { useOpenVisit } from '../components/VisitPanel';
import { VisitRules } from '../components/VisitRules';
import { useValueStore } from '../components/valueStore';
import { KeyMoveBand, useVisitKeys } from '../components/visitKeys';
import { useVisitSelection } from '../components/visitParts';
import { TypeMark } from '../components/visitType';
import type { DemoData } from '../contracts/data';
import type { Client, Visit, VisitType } from '../contracts/documents';
import type { Problem } from '../contracts/problem';
import { slotsText } from '../domain/availability';
import { leaveOn } from '../domain/leaves';
import { NONE, timeOrder, windowText } from '../domain/scheduleModel';
import { hhmmToMinutes, jstDate, minutesToHhmm } from '../domain/time';
import { achievements, ruleLowerBounds, score, toHundred } from '../evaluate';
import { absenceText } from '../lib/absences';
import { colorOf } from '../lib/colors';
import { attempt, own } from '../lib/common';
import { confirmDay } from '../lib/confirmDay';
import { dayContactWords } from '../lib/contacts';
import { clockTime, dateText } from '../lib/dateText';
import { dayLineRange, dayLines } from '../lib/dayLine';
import {
  changeCount,
  ownerOf,
  pinsOf,
  routesOf,
  toldChanges,
  toldStateOf,
  type VisitIssue,
  visitIssues,
  writeRoutes,
} from '../lib/dayPlan';
import { deferredDragStart } from '../lib/dragStart';
import { hardLinks } from '../lib/hardLinks';
import { isDate } from '../lib/isDate';
import { linkIfOn, UNASSIGNED_DO } from '../lib/links';
import { contactMailText, mailTo } from '../lib/mail';
import { HOME_LABEL } from '../lib/mapsLink';
import { issueBreakdown } from '../lib/month';
import { scrollBehavior } from '../lib/motion';
import { typeOf } from '../lib/patternText';
import { leavePeople } from '../lib/personLinks';
import { droppedRowsOf, hardLabelsOf, hardRowsOf, planColumns, toldMarksOf, unplacedReasons } from '../lib/planView';
import { CURRENT_TEXT, hardReasonLabels, NONE_TEXT, notAllowedText, reassignChoices } from '../lib/reassignMenu';
import { buildRouteMap, homeLegKey, homeTravel } from '../lib/routeView';
import { reasonFace, reasonOfRoutes } from '../lib/scoreReason';
import { spansOf } from '../lib/spans';
import { type LegSpan, legsOf, shadowOf } from '../lib/timeline';
import type { ReadableStore } from '../lib/valueStore';
import { dayLooks } from '../lib/visitLook';
import { cancelVisitOp } from '../lib/visitOps';
import { canSelectVisit } from '../lib/visitSelect';
import { workStats } from '../lib/workload';
import { bestInsertion } from '../matching';
import { placeVisit, type ReassignCandidate } from '../reassign';
import { CancelVisitPanel } from './cancelVisitPanel';
import { PlanBands } from './planBands';
import { PlanDetailPanel } from './planDetail';
import { PlanConfirmActions, PlanHelp, PlanOneLine } from './planHeader';
import './plan.css';
import './schedule.css';
import { CandidateBox, leftReasonText, ReassignBar } from './absenceParts';
import { ContactPanel } from './contactPanel';
import { DayMailPanel } from './mailPanels';
import { explainMap, ReasonBox } from './planParts';
import { AnnealBox, ContactButton, ReassignDock } from './reassignParts';
import { SuddenPanel } from './SuddenPanel';
import type { PlanProgress } from './usePlanRun';
import { reassignShown, useReassignFlow } from './useReassignFlow';
import { EMPTY_CONTACTS, useSuddenEntry, useSuddenFlow, useSuddenState } from './useSuddenFlow';

/**
 * 日の予定（D4・D13・D18。版2：ADR-0053）：その日の訪問と担当を1画面で扱う。担当・開始・ピンは訪問が持ち、列はその日の訪問の
 * 担当と開始の並び（lib/dayPlan の routesOf）。担当を替える（ドラッグ・「担当を変える ▾」）と最も費用の少ない位置に入れてピンにし、
 * 訪問に書く（writeRoutes）。日の予定では AI で組まない（手で直す。AI は「担当を組む」の画面。ADR-0063）。そこで組んだ範囲の提案は帯で見て反映できる。
 * 「確定」は〈スタッフ〉に伝えた内容を残す（DaySnapshot）。そのあとに変えた訪問は「未連絡の変更」になり、連絡の一覧に出る。
 * 要対応は訪問ごとの検査（担当なし・担当が休み・条件に合わない・時間に間に合わない）。点数（100点満点）は点数の基準の物差し（ADR-0010）
 */

/** 予定の画面の地図・選択で使うルートの集まりのキー（今の担当の並びは1つだけ） */
const PLAN_SET = 'plan';

/**
 * 計算の進み具合のバーと回数（PRD D249）。進み具合は外の入れ物から読み、変わってもここだけ描き直す
 */
function PlanProgressText({ store, prefix }: { store: ReadableStore<PlanProgress | null>; prefix: string }) {
  const progress = useValueStore(store);
  return (
    <>
      <progress value={progress?.iteration ?? 0} max={progress?.total ?? 1} />
      <span className="sub">
        {prefix}
        {progress
          ? `${progress.iteration.toLocaleString()} / ${progress.total.toLocaleString()} 回${progress.hundred === null ? '' : `・いまの最良 ${progress.hundred}点`}`
          : '準備中…'}
      </span>
    </>
  );
}

/** 日付の短い表示（2026-10-13 → 10/13） */
function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

export default function PlanPage() {
  const { date, setDate, dates } = useDay();
  const m = useDayModel(date);
  /** 上のナビの行の日付（PRD D347）：データの日付から選ぶ。今日はデータに無くても選べる（setDate は選んだ日を足す） */
  const todayDate = jstDate(Date.now());
  const dayOptions = useMemo(
    () => [...new Set([...dates, date])].sort().map((d) => ({ value: d, text: dateText(d) })),
    [dates, date],
  );
  /** 切った機能（稼働の見込み）の画面へ移るボタン・リンクは出さない（PRD D213。ADR-0028） */
  const workloadOn = useFeature('workload');
  /**
   * 画面の中の欄・ボタン（ADR-0028）：欠勤・キャンセル（操作の行・列の見出し・当日キャンセルの選択）、メール（ボタン・欄・連絡の一覧）、
   * 条件の重み（点数の横の理由）。欠勤の印・帯（事実）は残す
   */
  const suddenOn = useFeature('sudden');
  const mailOn = useFeature('mail');
  const rulesOn = useFeature('rules');
  const compatOn = useFeature('compat');
  const {
    data,
    update,
    staff,
    staffById,
    clientById,
    colorOfStaff,
    visits,
    visitById,
    compileInput,
    problem,
    scoreProblem,
    scoreScale,
    scoreRulerName,
    scoreRules,
    slotsOf,
  } = m;
  const terms = data.org.terms;
  /** 〈利用者さん〉の休み（ADR-0013）のため無しの訪問の〈利用者さん〉（名前から詳細を開く。理由を添える。PRD D208） */
  const leaveNames = useMemo(
    () => leavePeople(m.leaveVisits, data.clientLeaves, date, (id) => clientById.get(id)?.displayName),
    [m.leaveVisits, data.clientLeaves, date, clientById],
  );
  const toast = useToast();
  const confirmDialog = useConfirm();
  /** 地図で見る担当・強調する区間・選んだ訪問（列の見出し・凡例・訪問・区間を押す） */
  const sel = useRouteSelection(date, (_set, id) => owner.get(id));
  const { focusStaff, focusOn } = sel;
  /** 訪問の詳細の欄（PRD D301〜D304。App の殻の欄を開く） */
  const openVisitPanel = useOpenVisit();
  /** スマホの幅（600px 以下）は訪問を足さない（ADR-0051 の決定5） */
  const compact = useMedia(COMPACT_QUERY);
  /** 操作の行の「使い方」（スマホは「その他 ▾」の中）で開いた説明（PRD D279・D344。保存しない） */
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (helpOpen) helpRef.current?.focus();
  }, [helpOpen]);
  /** 「欠勤・キャンセル」の欄の開け閉め（PRD D167〜D172） */
  const suddenState = useSuddenState(date);
  /** 取り消しの欄を開いている訪問（PRD D74。null：閉じている）と、当日キャンセルか */
  const [cancelFor, setCancelFor] = useState<Visit | null>(null);
  const [cancelSameDay, setCancelSameDay] = useState(false);
  const location = useLocation();
  /** ページの中の地図のカード（画面の外なら右下に浮かせる） */
  const mapCardRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  /** ドラッグの始まりの更新を dragstart の外へ出す（未割当の列が足されて Chrome がドラッグをやめるため） */
  const dragStart = useRef(deferredDragStart()).current;
  const [dropTo, setDropTo] = useState<string | null>(null);
  /** 表示（PRD D58・D63）：時間軸／順番／一覧（訪問の一覧の表）。画面の状態（初期値：時間軸） */
  const [colView, setColView] = useState<'timeline' | 'order' | 'list'>('timeline');
  /** 狭い幅（900px 以下）・印刷では時間軸の代わりに順番にする（一覧はそのまま） */
  const narrowOrPrint = useNarrowOrPrint();
  /**
   * スマホ（600px 以下）の表示（PRD D334）：日ごとのリスト（既定）・順番・一覧。「その他 ▾」の「表示」で選ぶ（操作の行を1段にする）
   */
  const [mView, setMView] = useState<'day' | 'order' | 'list'>('day');
  const shownView: 'timeline' | 'order' | 'list' | 'day' = compact
    ? mView
    : narrowOrPrint && colView === 'timeline'
      ? 'order'
      : colView;
  /** 表示を替える（スマホは時間軸の代わりに順番） */
  const setView = (v: 'timeline' | 'order' | 'list') => {
    if (compact) setMView(v === 'timeline' ? 'order' : v);
    else setColView(v);
  };
  /** スマホの日ごとのリストの「選ぶ」（長押しでも入る。日付を変えたら抜ける） */
  const [selecting, setSelecting] = useState(false);
  /** 右の欄（PRD D63）：'detail'＝詳しく、'mail'＝予定をメールで送る */
  const [panel, setPanel] = useState<'detail' | 'mail' | null>(null);
  /** 地図は本体の下に全幅で大きく置く（PRD D300）。広い画面は地図を高くする */
  const wideMap = useMedia(WIDE_MAP_QUERY);
  /** 「担当なしの訪問」の列（帯の近道の行き先） */
  const noneColId = useId();
  /** いちばん新しいデータ（書く前のデータと比べる） */
  const dataRef = useRef(data);
  dataRef.current = data;
  /** 複数選択（Shift・Ctrl＋クリック。日付を変えたら外す。PRD D330） */
  const multi = useVisitSelection(date);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付を変えたらスマホの「選ぶ」を抜ける（選んだ訪問は useVisitSelection が外す）
  useEffect(() => {
    setSelecting(false);
  }, [date]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付を変えたら開いた欄を閉じる
  useEffect(() => {
    setCancelFor(null);
    setToldOpen(false);
    setPanel(null);
  }, [date]);
  /** いま見ている日（計算が終わったときに、まだその日を見ているか） */
  const dateRef = useRef(date);
  dateRef.current = date;

  /** 計算に入れる訪問があるか（無い日は担当の列を出さない） */
  const hasVisits = visits.length > 0 && (!problem || problem.visits.length > 0);
  /** 今の担当の並び（版2：訪問の担当と開始の並び） */
  const routes = useMemo(() => (problem ? routesOf(problem, m.allVisits) : {}), [problem, m.allVisits]);
  /** ピン（訪問ID → 担当） */
  const pins = useMemo(() => pinsOf(m.allVisits), [m.allVisits]);
  /** 今の担当の並びがあるか（計算に入れる訪問がある日） */
  const hasPlan = hasVisits && !!problem;

  // 採点はどれも点数の基準の物差し（ADR-0010）
  const curScore = useMemo(
    () => (scoreProblem && hasPlan ? attempt(() => score(scoreProblem, routes)) : null),
    [scoreProblem, hasPlan, routes],
  );
  const explained = useMemo(() => explainMap(hasPlan ? problem : null, routes), [problem, hasPlan, routes]);
  /** 今の担当の条件ごとの達成の件数（D25。点数の基準の物差し。ADR-0010） */
  const curAch = useMemo(
    () => (scoreProblem && hasPlan ? (attempt(() => achievements(scoreProblem, routes)).value ?? []) : []),
    [scoreProblem, hasPlan, routes],
  );
  /** 訪問ごとの検査（要対応。lib/dayPlan の visitIssues） */
  const issues = useMemo(
    () => (problem && hasPlan ? visitIssues(problem, routes, m.allVisits) : new Map<string, VisitIssue[]>()),
    [problem, hasPlan, routes, m.allVisits],
  );

  const staffName = (id: string) => staffById.get(id)?.name ?? '（不明）';
  const clientOf = (visitId: string) => {
    const v = visitById.get(visitId);
    return v ? clientById.get(v.clientId) : undefined;
  };
  /**
   * 訪問の詳細の経路のリンク（PRD D100。ADR-0018）：担当の今の並びの順番で、前の場所（前の訪問先、1件目は担当の自宅）から・今いる場所から。
   * 担当の決まっていない訪問は出さない。伝えたあとに変わった日（未連絡の変更あり）は「今の順番（未連絡）」と添える
   */
  const routeLinksOf = (id: string, sid: string | null) => {
    const s = sid ? staffById.get(sid) : undefined;
    if (!s || !sid) return null;
    const order = own(routes, sid) ?? [];
    const i = order.indexOf(id);
    if (i < 0) return null;
    const prevClient = i > 0 ? clientOf(order[i - 1] ?? '') : undefined;
    return (
      <VisitRouteLinks
        to={clientOf(id)?.place}
        toName={clientOf(id)?.displayName ?? '（不明）'}
        from={i > 0 ? prevClient?.place : s.home}
        fromName={i > 0 ? (prevClient?.displayName ?? '（不明）') : HOME_LABEL}
        mode={s.travelMode}
        note={toldState === 'changed' ? '今の順番（未連絡の変更あり）' : undefined}
      />
    );
  };
  const visitLabel = (id: string) =>
    `${visitById.get(id)?.earliestStart ?? ''} ${clientOf(id)?.displayName ?? '（不明）'}`;
  /** visitLabel と同じ見た目で、〈利用者さん〉の名前から詳細を開く（欠勤の人に残る訪問。PRD D206） */
  const visitNode = (id: string) => {
    const c = clientOf(id);
    return (
      <>
        {visitById.get(id)?.earliestStart ?? ''}{' '}
        {c ? <PersonButton kind="client" id={c.id} name={c.displayName} testId="left-client" /> : '（不明）'}
      </>
    );
  };

  // ---- ?do= の入口（欠勤・キャンセル・担当なしの訪問）----
  const [params, setParams] = useSearchParams();
  const doParam = params.get('do');
  useSuddenEntry({
    date,
    setDate,
    knownStaff: (sid) => data.staff.some((s) => s.id === sid),
    works: (sid) => (slotsOf.get(sid)?.baseSlots.length ?? 0) > 0,
    open: suddenState.open,
  });
  // ?date= だけのリンク（空き状況の「その日の予定を見る」。新しいタブでも開ける。PRD D204）：その日を選び、?date= を消す
  const dateParam = params.get('date');
  // biome-ignore lint/correctness/useExhaustiveDependencies: ?date= が付いたときだけ
  useEffect(() => {
    if (dateParam === null || doParam !== null) return;
    if (isDate(dateParam) && dateParam !== date) setDate(dateParam);
    setParams(
      (p) => {
        p.delete('date');
        return p;
      },
      { replace: true },
    );
  }, [dateParam]);
  // 月の要対応の「担当なし」から（?date=…&do=unassigned。PRD D201）：その日を選び、URL から ?date= と ?do= を消し、
  // 担当なしの訪問の列へ巻く（1回だけ。担当なしの訪問が無くなっていれば巻かない）
  const pendingNone = useRef<string | null>(null);
  /** ?do=unassigned を受けた回数（同じ日を開いたままでも、巻く effect を走らせる） */
  const [noneAsked, setNoneAsked] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ?do= が付いたときだけ
  useEffect(() => {
    if (doParam !== UNASSIGNED_DO) return;
    const raw = params.get('date');
    const target = raw && isDate(raw) ? raw : date;
    if (target !== date) setDate(target);
    pendingNone.current = target;
    setNoneAsked((n) => n + 1);
    setParams(
      (p) => {
        p.delete('do');
        p.delete('date');
        return p;
      },
      { replace: true },
    );
  }, [doParam]);

  // ---- 手直し：訪問を担当へ移す（最も費用の少ない位置に入れてピン）----
  const allowedFor = (visitId: string, staffId: string): boolean => {
    if (!problem) return true;
    const vi = problem.visits.findIndex((v) => v.id === visitId);
    const si = problem.staff.findIndex((s) => s.id === staffId);
    if (vi < 0) return true;
    return si >= 0 && problem.allowed[vi]?.[si] === true;
  };
  const owner = useMemo(() => ownerOf(routes), [routes]);
  /** 週間の帯から開いたときに選ぶ訪問（並びが出たら1回だけ選んで見える所へ） */
  const wantVisit = useRef<string | null>((location.state as { visitId?: string } | null)?.visitId ?? null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 並びが出たときに1回だけ
  useEffect(() => {
    const id = wantVisit.current;
    if (!id || !hasPlan) return;
    wantVisit.current = null;
    if (owner.has(id)) sel.togglePick({ id, set: PLAN_SET });
    requestAnimationFrame(() =>
      document.querySelector(`[data-visit="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center' }),
    );
  }, [hasPlan, owner]);
  /**
   * 書く：fn で書いたデータにする（全体の「元に戻す」の1手。label は手の名前。PRD D329）。変わらなければ false
   */
  const writeWith = (label: string, fn: (d: DemoData) => DemoData) => {
    const before = dataRef.current;
    const next = fn(before);
    if (next === before) return false;
    update((d) => (d === before ? next : fn(d)), label);
    return true;
  };
  /** 担当の並びとピンを訪問に書く（手直し） */
  const writeDay = (
    p: Problem,
    _visitId: string,
    nextRoutes: Record<string, string[]>,
    nextPins: Record<string, string>,
    label = '担当を替える',
  ) => writeWith(label, (d) => writeRoutes(d, date, p, nextRoutes, { pins: nextPins }));
  // ---- 急な欠勤と振り直し（ADR-0011。PRD D26〜D35）：差の欄・案A／案B・連絡の一覧・振り直す前に戻す ----
  const flow = useReassignFlow({
    date,
    data,
    update,
    writeWith,
    problem,
    routes,
    hasPlan,
    compileInput,
    scoreProblem,
    scoreScale,
    staffName,
    visitById,
    resetSelection: sel.reset,
    closeSudden: () => suddenState.setSudden(null),
  });
  const {
    info: reassignInfo,
    diff: rDiff,
    marks: reassignMarks,
    cancelled: absenceCancelled,
    absentStaff,
    left,
    leftById,
    barId,
    goToBar,
    contacts,
    contactsOpen,
    setContactsOpen,
    error,
  } = flow;
  const { running, runningFor, progressStore } = flow.planRun;
  const annealDisabled = flow.anneal.disabled;
  const { annealBox, leftContacts, contactsTotal, annealRecommended } = reassignShown(flow, visitById);
  /**
   * 「担当を変える ▾」で移したあとのフォーカス（PRD D217）：選んだ項目・ボタンは移した訪問の詳細ごと消える（列が替わる・
   * 選択が外れる）ので、移した先のカード、無ければ「元に戻す」、それも無ければ移した先の列の見出しへ
   */
  const focusAfterMove = (visitId: string, staffId: string | null) => {
    requestAnimationFrame(() => {
      const v = CSS.escape(visitId);
      const target =
        document.querySelector<HTMLElement>(
          `.route-item[data-visit="${v}"] .route-btn, .tl-band[data-visit="${v}"] .tl-band-btn`,
        ) ??
        document.querySelector<HTMLElement>('[data-testid="undo-btn"]') ??
        (staffId ? colHeadOf(staffId) : null);
      target?.focus();
    });
  };
  /**
   * 訪問の詳細の欄を開く（PRD D301。null は新しい訪問をこの日に）。閉じたあとのフォーカスは開いた帯・カード（保存で作り直した回は
   * 新しい ID の帯）、無ければ一覧の行の「開く」、それも無ければ開く前の要素
   */
  const openVisit = (id: string | null) =>
    openVisitPanel({
      ...(id ? { visitId: id } : { newVisit: { date } }),
      returnFocus: (vid) => {
        const v = vid ? CSS.escape(vid) : null;
        const el = v
          ? document.querySelector<HTMLElement>(
              `.tl-band[data-visit="${v}"] .tl-band-btn, .route-item[data-visit="${v}"] .route-btn, [data-testid="visit-row-open"][data-visit="${v}"], .day-row[data-visit="${v}"]`,
            )
          : null;
        // 新しく足したときは「訪問を追加」のボタンへ（スマホの「その他 ▾」は閉じた一覧の項目の代わりに「その他」のボタンへ）
        return (
          el ??
          (id ? null : document.querySelector<HTMLElement>('[data-testid="plan-visit-add"], [data-testid="plan-more"]'))
        );
      },
    });
  /** 時間軸の帯にフォーカスを戻す（キーで動かしたあと。日付を移ったときは描き終わるまで待つ） */
  const focusBand = (visitId: string) => {
    let n = 0;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`.tl-band[data-visit="${CSS.escape(visitId)}"] .tl-band-btn`);
      if (el) {
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return;
      }
      if (++n < 30) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  /**
   * 時間軸の帯のキーボード（PRD D333）：↑↓ 15分・←→ 1日（その日の予定へ移る）・Shift+←→ 隣の担当の列（列の順）・Enter で欄・
   * Delete で取り消し（確認）。どれも全体の「元に戻す」の1手。動かしたらフォーカスは動かした帯、取り消したら「元に戻す」
   */
  const visitKeys = useVisitKeys({
    staffOrder: () => columns,
    onOpen: (id) => openVisit(id),
    onMoved: (r) => {
      if (r.date !== date) setDate(r.date);
      focusBand(r.visitId);
    },
    onCancelled: () =>
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-testid="undo-btn"]')?.focus()),
  });
  /** 帯・カードの詳細の「詳細・変更」（訪問の詳細の欄を開く） */
  const openOf = (id: string) => (
    <button
      type="button"
      className="btn btn-small"
      onClick={() => openVisit(id)}
      title="日時・担当・取り消しを変える欄を開く"
      data-testid="visit-open"
    >
      <WithIcon icon={PanelRightOpen} size={14}>
        詳細・変更
      </WithIcon>
    </button>
  );
  /** トーストの「元に戻す」（全体の履歴を1手戻す。PRD D218・D329） */
  const undoAction = useUndoAction();
  const historyOps = useHistoryOps();
  /**
   * 手直しのトーストの「元に戻す」：全体の履歴を1手戻し、トーストから押したら（ボタンが消えるので）戻した訪問の帯・カードへフォーカス
   * （from は戻したあとの担当。PRD D217）
   */
  const undoMove = (visitId: string, from: string | null) => ({
    ...undoAction,
    onClick: () => {
      const ae = document.activeElement;
      const fromToast = !ae || ae === document.body || !!ae.closest('.toast');
      historyOps.undo();
      sel.follow(visitId, from);
      if (fromToast) focusAfterMove(visitId, from);
    },
  });
  const moveTo = (visitId: string, staffId: string) => {
    if (!problem || !hasPlan || running) return;
    if (owner.get(visitId) === staffId && own(pins, visitId) === staffId) return;
    const p = problem;
    const prev = owner.get(visitId) ?? null;
    const saved = writeDay(
      p,
      visitId,
      owner.get(visitId) === staffId ? routes : bestInsertion(p, routes, visitId, staffId),
      { ...pins, [visitId]: staffId },
    );
    // 移した訪問を選んでいたら、地図の絞り込みを新しい担当に合わせる
    sel.follow(visitId, staffId);
    const opts = saved ? { action: undoMove(visitId, prev) } : undefined;
    if (!allowedFor(visitId, staffId)) {
      toast(
        `${staffName(staffId)}さんへ移しました。${notAllowedText(hardReasonLabels(p, visitId, staffId))}ので、要対応に出ます`,
        opts,
      );
    } else {
      toast(`${staffName(staffId)}さんへ移しました`, opts);
    }
  };
  /** 担当なしへ移す（列から外す。ピンは担当のピンなので外す） */
  const unassign = (visitId: string) => {
    if (!problem || !hasPlan || running || !owner.has(visitId)) return;
    const { [visitId]: _had, ...rest } = pins;
    const prev = owner.get(visitId) ?? null;
    const saved = writeDay(
      problem,
      visitId,
      Object.fromEntries(Object.entries(routes).map(([s, ids]) => [s, ids.filter((x) => x !== visitId)])),
      rest,
      '担当なしにする',
    );
    sel.follow(visitId, null);
    toast('担当なしにしました', saved ? { action: undoMove(visitId, prev) } : undefined);
  };
  const unpin = (visitId: string) => {
    if (!problem) return;
    const { [visitId]: _had, ...rest } = pins;
    writeDay(problem, visitId, routes, rest, 'ピンを外す');
  };
  // ---- 確定＝〈スタッフ〉に伝えた内容（ADR-0053）----
  /** 伝えた内容と今の違い（未連絡の変更。伝えていない日は null） */
  const told = useMemo(
    () =>
      attempt(() => toldChanges(data, date, problem && hasPlan ? problem : null, problem && hasPlan ? routes : {}))
        .value ?? null,
    [data, date, problem, hasPlan, routes],
  );
  /** 伝えた状態：none＝まだ伝えていない・told＝伝えた・changed＝伝えたあとに変わった */
  const toldState = toldStateOf(data, date, told);
  const toldCount = changeCount(told);
  /** 訪問ごとの未連絡の変更の文（「担当 A→B」「時刻 9:00→9:30」） */
  const toldMarks = useMemo(() => toldMarksOf(told, (id) => staffById.get(id)?.name ?? '（不明）'), [told, staffById]);
  /** 訪問の見た目（要対応・未連絡の変更・ピンなど。週・月・人の予定表と同じ判定。lib/visitLook） */
  const looks = useMemo(
    () =>
      dayLooks({ issues, told, problem: hasPlan ? problem : null }, m.allVisits, {
        staffName: (sid) => staffById.get(sid)?.name ?? '（不明）',
        leaveOf: (v) => m.leaveVisits.some((x) => x.id === v.id),
        tentativeOf: (cid) => !!clientById.get(cid)?.tentative,
        past: date < jstDate(Date.now()),
      }),
    [date, issues, told, hasPlan, problem, m.allVisits, m.leaveVisits, clientById, staffById],
  );
  /** 未連絡の変更の連絡の一覧を開いている */
  const [toldOpen, setToldOpen] = useState(false);
  /** 確定する（伝えた内容を残す。確定したら true） */
  const adopt = async (): Promise<boolean> => {
    // 伝えた日の訪問を全部取り消した日も、「外れる」を伝えたら確定し直せる（伝えた訪問は無し）
    if ((!hasPlan || !problem) && toldState !== 'changed') return false;
    const care = hasPlan ? issues.size : 0;
    const ok = await confirmDialog({
      title:
        toldState === 'changed' ? '変更を伝えたので、確定し直しますか？' : 'この担当と時刻を伝えたので、確定しますか？',
      body: `${care > 0 ? `要対応の訪問が ${care}件あります。\n\n` : ''}今の担当と時刻を〈${terms.staff}〉に伝えた内容として残します。このあとに変えた訪問は「未連絡の変更」になり、連絡の一覧に出ます。`,
      confirmLabel: '確定する',
    });
    if (!ok) return false;
    if (flow.planRun.busy()) return false;
    const p = hasPlan ? problem : null;
    const at = Date.now();
    update(
      (d) =>
        p ? confirmDay(d, date, p, at) : { ...d, snapshots: { ...d.snapshots, [date]: { date, at, visits: [] } } },
      '確定（伝えた）',
    );
    setToldOpen(false);
    toast('確定しました（伝えた内容を残しました）');
    return true;
  };

  /** 全員分のメールを作ったので確定する（PRD D346。確認は出さず、知らせの「元に戻す」で戻せる） */
  const confirmByMail = () => {
    if ((!hasPlan || !problem) && toldState !== 'changed') return;
    if (flow.planRun.busy()) return;
    const p = hasPlan ? problem : null;
    const at = Date.now();
    update(
      (d) =>
        p ? confirmDay(d, date, p, at) : { ...d, snapshots: { ...d.snapshots, [date]: { date, at, visits: [] } } },
      '確定（メールを作った）',
    );
    setToldOpen(false);
    const care = hasPlan ? issues.size : 0;
    toast(
      `全員分のメールを作ったので、この日を確定（伝えた）にしました${care > 0 ? `（要対応の訪問 ${care}件あり）` : ''}`,
      { action: undoAction },
    );
  };

  /** この端末の mailto の長さの目安（ADR-0017） */
  const mailLimit = useMailLimit();
  const contactWords = dayContactWords({
    date,
    staffWord: terms.staff,
    orgName: data.org.name,
    staffName,
    clientById,
    visits: m.allVisits,
  });
  /** 〈スタッフ〉あての連絡のメール（PRD D94。メールを切っていれば出さない） */
  const staffMail = mailOn
    ? (staffId: string, text: string) =>
        mailTo(staffById.get(staffId)?.email ?? '', contactMailText(data.org, date, text), mailLimit)
    : undefined;
  const onCopied = (ok: boolean, what: string) =>
    toast(ok ? `${what}をコピーしました` : 'コピーできませんでした。文を選んでコピーしてください');
  /** 列の見出し（欠勤の欄を閉じたとき、フォーカスの戻り先が消えていたらここへ） */
  const colHeadOf = (sid: string) =>
    document.querySelector<HTMLElement>(`.route-col[data-staff="${CSS.escape(sid)}"] .col-focus`);

  /**
   * 担当なしの訪問を候補の人に入れる（ピン。時刻は変えない。間に合わなければ要対応の赤い枠）。
   * その人の既存の訪問の開始が遅れるときは確認を出す
   */
  const placeCandidate = async (visitId: string, c: ReassignCandidate) => {
    if (!problem || !hasPlan || running) return;
    const staffId = c.staffId;
    if (
      c.delayedCount > 0 &&
      !(await confirmDialog({
        title: `${staffName(staffId)}さんに入れますか？`,
        body: `${staffName(staffId)}さんの訪問 ${c.delayedCount}件の開始が最大 +${c.maxDelayMinutes}分 遅れます。`,
        confirmLabel: '遅れても入れる',
      }))
    )
      return;
    if (flow.planRun.busy()) return;
    const p = problem;
    const saved = writeDay(
      p,
      visitId,
      placeVisit(p, routes, visitId, staffId),
      { ...pins, [visitId]: staffId },
      '受けられる人に入れる',
    );
    sel.follow(visitId, staffId);
    toast(`${staffName(staffId)}さんに入れました`, saved ? { action: undoMove(visitId, null) } : undefined);
  };

  // ---- 訪問の取消 ----
  /** 取り消しの欄を開く（取り消しの種類を選ぶ。PRD D74） */
  const cancelVisit = (v: Visit) => {
    setCancelFor(v);
    setCancelSameDay(false);
  };
  /** 取り消しの欄の「取り消す」 */
  const doCancel = () => {
    if (!cancelFor) return;
    applyCancel(cancelFor.id, cancelSameDay);
    setCancelFor(null);
  };
  /**
   * 訪問を取り消す（取り消しの欄・「欠勤・キャンセル」の欄で共通）。当日キャンセルなら取り消しの種類 'sameDay'
   * （回数を数えるだけ。請求はしない。ADR-0015）。ほかの担当はそのままで、この訪問は計算から外れる
   */
  const applyCancel = (visitId: string, sameDay: boolean) => {
    const v = m.allVisits.find((x) => x.id === visitId && !x.cancelled);
    if (!v) return;
    writeWith(sameDay ? '当日キャンセル' : '訪問を取り消す', (d) => cancelVisitOp(d, visitId, sameDay));
    toast(sameDay ? '当日キャンセルとして取り消しました' : '取り消しました', { action: undoAction });
  };
  /** 拘束が上限を超える人（稼働の見込み。PRD D72。ADR-0015）。今の担当の並びで見る */
  const overSpan = useMemo(() => {
    if (!problem || !hasPlan) return [];
    return workStats(problem, routes, data.org).filter((x) => x.over);
  }, [problem, hasPlan, routes, data.org]);

  // ---- 列：その日に働く人（と、訪問の担当になっている人）----
  const columns = useMemo(
    () =>
      planColumns(
        problem,
        routes,
        staff.map((s) => s.id),
        slotsOf,
      ),
    [problem, routes, staff, slotsOf],
  );
  /** 担当なしの訪問（問題の訪問のうち列に無いもの。問題の順） */
  const unassigned = useMemo(() => {
    if (!problem || !hasPlan) return [];
    return problem.visits.map((v) => v.id).filter((id) => !owner.has(id));
  }, [problem, hasPlan, owner]);
  /** 要対応の文（担当なし・担当が休みなど）の訪問ごとの一覧（カード・帯の赤い印） */
  const hardOf = useMemo(() => hardLabelsOf(issues), [issues]);
  /** 要対応の件数と内訳 */
  const careCount = issues.size;
  const careParts = useMemo(() => issueBreakdown(issues), [issues]);

  const dropProps = (to: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!dragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropTo !== to) setDropTo(to);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTo(null);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain') || dragging;
      dragStart.end();
      setDragging(null);
      setDropTo(null);
      if (!id) return;
      if (to === NONE) unassign(id);
      else if (owner.get(id) !== to) moveTo(id, to);
    },
  });
  const dragProps = (id: string) => ({
    draggable: !running,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      // ここで setDragging すると、未割当の列が先頭に足されて列がずれ、Chrome がドラッグをすぐ終わらせる
      dragStart.start(() => setDragging(id));
    },
    onDragEnd: () => {
      dragStart.end();
      setDragging(null);
      setDropTo(null);
    },
  });

  // ---- 地図：今の担当の並び（担当ごとの色の実線）----
  const { points, lines } = useMemo(
    () =>
      hasPlan
        ? buildRouteMap({
            sets: [{ key: PLAN_SET, routes }],
            staffOrder: columns,
            staffById,
            visitById,
            clientById,
            colorOfStaff,
            focusStaff,
            picked: sel.picked,
            focusLeg: sel.focusLeg,
            emphasize: reassignMarks.emphasize,
          })
        : { points: [], lines: [] },
    [
      hasPlan,
      columns,
      routes,
      staffById,
      colorOfStaff,
      visitById,
      clientById,
      focusStaff,
      sel.picked,
      sel.focusLeg,
      reassignMarks,
    ],
  );

  /** 列の最後の「自宅まで N分」（押すと地図でその区間を強調。もう一度押すと外す。自宅の位置が無い人は出さない） */
  const homeLeg = (sid: string) => {
    const t = homeTravel(problem, staffById.get(sid), routes);
    if (t === null) return null;
    const x = { id: homeLegKey(sid), set: PLAN_SET };
    return <LegLine kind="toHome" minutes={t} on={sel.isLeg(x)} onToggle={() => sel.toggleLeg(x)} />;
  };

  const sortedVisits = useMemo(() => timeOrder([...visitById.keys()], visitById), [visitById]);
  const notInProblem = problem ? visits.filter((v) => !problem.visits.some((p) => p.id === v.id)) : [];
  const cs = curScore?.value ?? null;

  /**
   * 訪問の詳細の〈利用者さん〉・担当の名前（押すと詳細の吹き出し。PRD D124）。順番のカードの詳細・時間軸の帯の詳細で共通。
   * withClient が false のときは担当だけ（時間軸は見出しの行に〈利用者さん〉の名前がある）
   */
  const whoOf = (id: string, sid: string | null, withClient = true) => {
    const client = clientOf(id);
    const s = sid ? staffById.get(sid) : undefined;
    if (!(withClient && client) && !s) return null;
    return (
      <div className="row visit-who" data-testid="visit-who">
        {withClient && client && (
          <span>
            {terms.client}：<PersonButton kind="client" id={client.id} name={client.displayName} />
          </span>
        )}
        {s && (
          <span className="with-staff-mark">
            担当：
            <StaffMark staff={s} size="xs" />
            <PersonButton kind="staff" id={s.id} name={s.name} />
          </span>
        )}
      </div>
    );
  };

  /**
   * 訪問の印（欠勤の人のまま・代行・+N分・固定・必須の違反）と「固定を外す」。順番のカードの中・時間軸の帯の説明で共通。
   * pinHint：「固定」に用語の説明を付ける（順番の表示では並びで最初の固定の訪問だけ。押して開く説明は別に数える。PRD D241）
   */
  const tagsOf = (id: string, pinHint = true) => {
    const pin = own(pins, id);
    const hard = hardOf.get(id);
    const subFrom = reassignMarks.substitute.get(id);
    const shift = reassignMarks.shifted.get(id);
    const stay = leftById.get(id);
    const told = toldMarks.get(id);
    if (!(pin || hard || subFrom || shift !== undefined || stay || told)) return null;
    return (
      <div className="row visit-tags">
        {stay && (
          <span
            className="chip chip-red"
            data-testid="left-mark"
            title="欠勤と重なっています。別の人へドラッグするか、「もう一度振り直す」を押してください"
          >
            <TriangleAlert size={12} aria-hidden="true" />
            {leftReasonText(stay)}（対応が必要）
          </span>
        )}
        {subFrom && (
          <span className="chip chip-move" title={`元の担当：${staffName(subFrom)}`} data-testid="substitute">
            代行
            <span className="sr-only">（元の担当：{staffName(subFrom)}さん）</span>
          </span>
        )}
        {shift !== undefined && (
          <span className="chip chip-warn" title="振り直す前の開始時刻からの変化" data-testid="shifted">
            {shift > 0 ? `+${shift}分` : `−${-shift}分`}
          </span>
        )}
        {pin && (
          <span className="chip chip-pin" title={pinHint ? undefined : 'ピン（AI で組み直しても担当を変えない）'}>
            <Pin size={12} strokeWidth={2.4} aria-hidden="true" />
            <Term k="pinned" plain={!pinHint} />
          </span>
        )}
        {told && (
          <span className="chip chip-warn" title={`未連絡の変更：${told}`} data-testid="told-mark">
            <MessageSquareText size={12} aria-hidden="true" />
            未連絡
            <span className="sr-only">（{told}）</span>
          </span>
        )}
        {hard?.map((h) => (
          <span key={h} className="chip chip-red" title="要対応" data-testid="issue-mark">
            <ShieldAlert size={12} aria-hidden="true" />
            {h}
          </span>
        ))}
        {pin && (
          <IconButton
            icon={PinOff}
            label="ピンを外す"
            className="icon-btn-sm"
            onClick={() => unpin(id)}
            data-testid="unpin"
            disabled={!!running}
          />
        )}
      </div>
    );
  };

  /**
   * 訪問の詳細の「担当を変える ▾」（PRD D217）。順番のカード・時間軸の帯の詳細で共通。
   * 入らない訪問で「受けられる人」（振り直しの候補）を出しているものは重ねない
   */
  const reassignOf = (id: string, ownerId: string | null) => {
    if (!problem || !hasPlan) return null;
    if (!ownerId && reassignMarks.unplaced.has(id)) return null;
    return (
      <ReassignMenu
        problem={problem}
        routes={routes}
        visitId={id}
        ownerId={ownerId}
        pinned={!!own(pins, id)}
        staffIds={columns}
        staffName={staffName}
        staffTerm={terms.staff}
        busy={running ? '計算中は選べません' : false}
        onMove={(sid) => {
          moveTo(id, sid);
          focusAfterMove(id, sid);
        }}
        onNone={() => {
          unassign(id);
          focusAfterMove(id, null);
        }}
      />
    );
  };

  /** 順番の表示で最初（入らなかった訪問 → 列の順）の固定の訪問。「固定」の説明はこのカードだけ（PRD D241） */
  const firstPinnedCard = [...unassigned, ...columns.flatMap((sid) => own(routes, sid) ?? [])].find((id) =>
    own(pins, id),
  );
  /** 訪問カード（ドラッグで担当を移す。押すと理由） */
  const card = (id: string) => {
    const pin = own(pins, id);
    const hard = hardOf.get(id);
    const ownerId = owner.get(id) ?? null;
    const x = { id, set: PLAN_SET };
    return (
      <VisitCard
        key={id}
        visitId={id}
        timing={explained.get(id)?.timing ?? null}
        fallbackTime={visitById.get(id)?.earliestStart ?? ''}
        client={clientOf(id)}
        first={own(routes, ownerId ?? '')?.[0] === id}
        legOn={sel.isLeg(x)}
        onLeg={() => sel.toggleLeg(x)}
        picked={sel.isPicked(x)}
        onPick={() => sel.togglePick(x)}
        multi={multi.has(id)}
        onMulti={() => multi.toggle(id)}
        tone={hard ? 'red' : pin ? 'pinned' : null}
        drag={dragProps(id)}
        dragging={dragging === id}
        detail={
          <>
            {openOf(id)}
            {whoOf(id, ownerId)}
            {reassignOf(id, ownerId)}
            <VisitRules client={clientOf(id)} />
            {routeLinksOf(id, ownerId)}
            <ReasonBox explain={explained.get(id)} />
          </>
        }
        mark={<TypeMark type={typeOf(data.visitTypes, visitById.get(id)?.typeId)} compact />}
      >
        {tagsOf(id, id === firstPinnedCard)}
      </VisitCard>
    );
  };

  /**
   * 時間軸の帯（PRD D58）：時刻は今の案の lenient（explain の timing。無ければ訪問の開始（早）と所要）、色は種類。
   * 印は小さなアイコンと title、押すと帯の下に印の説明と理由
   */
  const bandOf = (id: string, sid: string): TimelineBand => {
    const v = visitById.get(id);
    const t = explained.get(id)?.timing ?? null;
    const start = t?.start ?? hhmmToMinutes(v?.earliestStart ?? '00:00');
    const end = t?.end ?? start + (v?.durationMinutes ?? 0);
    const type = typeOf(data.visitTypes, v?.typeId);
    const client = clientOf(id);
    const pin = own(pins, id);
    const hard = hardOf.get(id);
    const subFrom = reassignMarks.substitute.get(id);
    const shift = reassignMarks.shifted.get(id);
    const stay = leftById.get(id);
    const notes: string[] = [];
    const icons: ReactNode[] = [];
    const mark = (key: string, tone: TlMarkTone, title: string, body: ReactNode, testId?: string) => {
      notes.push(title);
      icons.push(
        <TlMark key={key} tone={tone} title={title} testId={testId}>
          {body}
        </TlMark>,
      );
    };
    if (type) notes.push(`種類：${type.name}`);
    if (stay)
      mark(
        'left',
        'is-red',
        `${leftReasonText(stay)}（対応が必要）`,
        <TriangleAlert size={11} aria-hidden="true" />,
        'left-mark',
      );
    // 要対応・資格✗／限✗・未連絡の変更・ピン・この回だけ変更・仮押さえは、週・月・人の予定表と同じ判定と印（lib/visitLook）
    const look = looks.get(id);
    for (const lm of look?.marks ?? [])
      mark(
        `${lm.kind}-${lm.short}`,
        lm.tone === 'red' ? 'is-red' : lm.tone === 'warn' ? 'is-warn' : lm.tone === 'pin' ? 'is-pin' : 'is-tentative',
        lm.title,
        lm.kind === 'issue' ? (
          <ShieldAlert size={11} aria-hidden="true" />
        ) : lm.kind === 'told' ? (
          <MessageSquareText size={11} aria-hidden="true" />
        ) : lm.kind === 'pin' ? (
          <Pin size={11} strokeWidth={2.4} aria-hidden="true" />
        ) : (
          lm.short
        ),
        lm.kind === 'issue' ? 'issue-mark' : lm.kind === 'told' ? 'told-mark' : undefined,
      );
    if (subFrom) mark('sub', 'is-move', `代行（元の担当：${staffName(subFrom)}さん）`, '代', 'substitute');
    if (shift !== undefined) {
      const txt = shiftShort(shift);
      mark('shift', 'is-warn', `振り直す前の開始時刻からの変化 ${txt}`, txt, 'shifted');
    }
    const x = { id, set: PLAN_SET };
    return {
      visitId: id,
      start,
      end,
      name: client?.displayName ?? '（不明）',
      color: type ? colorOf(type.color) : null,
      // 今日より前の日は要対応の赤にしない（印と同じ。月・ホームと同じ決まり）
      tone: look?.tone === 'issue' || (hard && date >= jstDate(Date.now())) ? 'red' : pin ? 'pinned' : null,
      kinds: look?.kinds ?? '',
      picked: sel.isPicked(x),
      dragging: dragging === id,
      onPick: () => sel.togglePick(x),
      multi: multi.has(id),
      onMulti: () => multi.toggle(id),
      onKey: (ev) => visitKeys(ev, id),
      drag: dragProps(id),
      marks: icons.length > 0 ? icons : undefined,
      note: notes.join('・') || undefined,
      detail: (
        <>
          {openOf(id)}
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            <strong>
              {client ? <PersonButton kind="client" id={client.id} name={client.displayName} /> : '（不明）'}
            </strong>
            <TypeMark type={type} compact />
          </div>
          {whoOf(id, sid, false)}
          {reassignOf(id, sid)}
          {tagsOf(id)}
          <VisitRules client={client} />
          {routeLinksOf(id, sid)}
          <ReasonBox explain={explained.get(id)} />
        </>
      ),
    };
  };

  /** 列の要素の class（落とす先・必須に合わない予告・薄い列・地図の絞り込み）。順番・時間軸で共通 */
  const colClass = (sid: string) =>
    [
      dropTo === sid ? 'is-drop' : '',
      dropTo === sid && dragging !== null && !allowedFor(dragging, sid) ? 'is-red' : '',
      rDiff && !reassignMarks.changed.has(sid) ? 'is-unchanged' : '',
      focusStaff === sid ? 'is-focus' : '',
      focusStaff && focusStaff !== sid ? 'is-dim-col' : '',
    ].join(' ');
  /** 列の見出し（名前・件数・稼働時間帯・欠勤・欠勤の人の近道・必須に合わない予告）。順番・時間軸で共通 */
  const colHeader = (sid: string) => {
    const ids = own(routes, sid) ?? [];
    const notAllowed = dropTo === sid && dragging !== null && !allowedFor(dragging, sid);
    const avail = slotsOf.get(sid);
    const s = staffById.get(sid);
    return (
      <>
        <div className="spread">
          <StaffFocusButton
            staff={s}
            name={staffName(sid)}
            on={focusStaff === sid}
            onToggle={() => focusOn(focusStaff === sid ? null : sid)}
          />
          <span className="chip">{ids.length}件</span>
        </div>
        <div className="col-hours">
          {(avail?.slots.length ?? 0) > 0 ? (
            <span className="sub item-time">
              <Clock size={13} aria-hidden="true" />
              {slotsText(avail?.slots ?? [])}
            </span>
          ) : avail?.absence ? null : (
            <span className="chip chip-off">{s && !s.active ? '休止中' : '休み'}</span>
          )}
          {avail?.absence && (
            <span className="chip chip-red" title={avail.absence.note || undefined} data-testid="absence-mark">
              <UserRoundX size={12} aria-hidden="true" />
              {absenceText(avail.absence, avail.baseSlots)}
            </span>
          )}
          {avail?.overridden && <span className="chip chip-warn">この日だけ変更</span>}
          {suddenOn && (avail?.baseSlots.length ?? 0) > 0 && (
            <button
              type="button"
              className="link-btn absence-btn"
              onClick={() => suddenState.open({ kind: 'staff', staffId: sid })}
              aria-label={
                avail?.absence ? `${staffName(sid)}さんの欠勤を直す` : `この人の欠勤を登録（${staffName(sid)}さん）`
              }
            >
              {/* 入口の呼び方（PRD D231）：欠勤が無ければ「この人の欠勤を登録」、あれば「欠勤を直す」 */}
              {/* 狭い列では「この人の／欠勤を登録」の区切りで折り返す（plan.css の keep-all と wbr） */}
              {avail?.absence ? (
                '欠勤を直す'
              ) : (
                <>
                  この人の
                  <wbr />
                  欠勤を登録
                </>
              )}
            </button>
          )}
          {/*
            詳細の「i」（PRD D124）。見出しのボタン（地図の絞り込み）と入れ子にせず、名前の幅も食わないよう2行目の右端に置く
          */}
          {s && <PersonInfo kind="staff" id={sid} name={s.name} className="col-info" testId="col-info" />}
        </div>
        {reassignInfo && absentStaff.has(sid) && (
          <div className="row col-reassign" data-testid="col-reassign">
            <button type="button" className="link-btn" onClick={goToBar}>
              振り直し済み・入らない（全体） {rDiff?.unplaced.length ?? 0}件
            </button>
            {left.some((x) => x.staffId === sid) && (
              <button type="button" className="chip chip-red chip-btn" onClick={goToBar}>
                欠勤の人のまま {left.filter((x) => x.staffId === sid).length}件
              </button>
            )}
            {annealRecommended && !annealDisabled && (
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  flow.anneal.start();
                  goToBar();
                }}
              >
                案B を作る
              </button>
            )}
          </div>
        )}
        {notAllowed && problem && dragging !== null && (
          <div className="drop-warning" data-testid="drop-warning">
            ここに移すと：{notAllowedText(hardReasonLabels(problem, dragging, sid))}
          </div>
        )}
      </>
    );
  };
  /** 「担当なしの訪問」の列（ドラッグの受け口にもなる） */
  const noneCol = (
    <div
      className={[
        'route-col route-col-none',
        // ドラッグの間だけ出す空の列は最後に置き、ほかの列をずらさない（掴んだカードが指の下から逃げない）
        unassigned.length === 0 ? 'is-drag-only' : '',
        dropTo === NONE ? 'is-drop' : '',
      ].join(' ')}
      id={noneColId}
      data-staff={NONE}
      {...dropProps(NONE)}
    >
      <div className="spread">
        <strong className="col-head">
          <CircleOff size={16} aria-hidden="true" />
          担当なしの訪問
        </strong>
        <span className="chip chip-warn">{unassigned.length}件</span>
      </div>
      {unassigned.length === 0 && <span className="sub">ここへドラッグすると担当なしにできます</span>}
      {unassigned.map((id) => {
        const reasons = unplacedReasons(problem, explained, id);
        const client = clientOf(id);
        return (
          <div key={id} className="stack" style={{ gap: 2 }}>
            {card(id)}
            {/* 〈利用者さん〉の名前はカード（押すと選ぶ・ドラッグ）の中なので、詳細は外の i から開く（PRD D205） */}
            <div className="row unplaced-reasons" style={{ flexWrap: 'wrap', gap: 4 }}>
              {client && <PersonInfo kind="client" id={client.id} name={client.displayName} testId="unplaced-info" />}
              {/* 理由の札は符号の無い言葉（PRD D229。内部の値は title にだけ）。
                  担当なしの理由の一覧なので、（担当にできない）は付けない（札の名前が理由そのもの。title に残る） */}
              {reasons.map((r) => {
                const f = reasonFace(r);
                return (
                  <span
                    key={`${r.ruleId}:${r.label}`}
                    className="chip chip-warn"
                    title={f.title}
                    data-testid="unplaced-reason"
                  >
                    {f.text}
                    {f.note && f.note !== '担当にできない' && `（${f.note}）`}
                  </span>
                );
              })}
            </div>
            {problem && reassignMarks.unplaced.has(id) && (
              <CandidateBox
                problem={problem}
                routes={routes}
                visitId={id}
                staffName={staffName}
                visit={visitById.get(id)}
                running={!!running}
                onPlace={(c) => placeCandidate(id, c)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
  /** 時間軸の列（PRD D58） */
  const timelineCol = (sid: string): TimelineColumn => {
    const ids = own(routes, sid) ?? [];
    const avail = slotsOf.get(sid);
    const stops = ids.flatMap((id) => {
      const t = explained.get(id)?.timing;
      return t ? [t] : [];
    });
    const shadow =
      dropTo === sid && dragging !== null && problem && owner.get(dragging) !== sid
        ? shadowOf(problem, routes, dragging, sid)
        : null;
    return {
      staffId: sid,
      className: colClass(sid),
      style: { borderTopColor: colorOfStaff.get(sid) },
      drop: dropProps(sid),
      header: colHeader(sid),
      baseSlots: spansOf(avail?.baseSlots ?? []),
      slots: spansOf(avail?.slots ?? []),
      bands: ids.map((id) => bandOf(id, sid)),
      legs: stops.length === ids.length ? legsOf(stops, homeTravel(problem, staffById.get(sid), routes)) : [],
      shadow,
      emptyText: 'ここへドラッグすると移せます',
    };
  };
  /** 時間軸の区間 → 地図で強調する区間（自宅までは `home:<担当>`、来る区間は行き先の訪問） */
  const legSel = (leg: LegSpan) => ({
    id: leg.kind === 'toHome' ? homeLegKey(owner.get(leg.visitId) ?? '') : leg.visitId,
    set: PLAN_SET,
  });

  // ---- 日の画面の整理（PRD D63）：1行のまとめ・案を変えるメニュー・右の欄・表示の切り替え・地図の横置き ----
  /** 一覧の時刻（今の担当の開始。無ければ約束の開始） */
  const issueTime = (id: string) => {
    const t = explained.get(id)?.timing;
    return t ? minutesToHhmm(t.start) : (visitById.get(id)?.earliestStart ?? '');
  };
  const rowWords = { timeOf: issueTime, clientName: (id: string) => clientOf(id)?.displayName ?? '（不明）' };
  /** 「入らない N」の一覧（PRD D345）：理由は「担当なしの訪問」の列の札と同じ */
  const droppedRows: IssueRow[] = droppedRowsOf(unassigned, (id) => unplacedReasons(problem, explained, id), rowWords);
  /** 「守れない条件 N」の一覧（PRD D345）：訪問ごとに1行。関連の画面は lib/hardLinks（切った機能の行き先は出さない） */
  const hardRows: IssueRow[] = hardRowsOf(
    cs?.hardViolations ?? [],
    (h) => hardLinks(h, clientOf(h.visitId)?.id, terms).filter((l) => linkIfOn(data.org.features, l.to) !== null),
    { ...rowWords, staffName },
  );
  /** 「見る」（入らない訪問）：担当なしの列へ移り、その訪問を選ぶ（選んだままなら外さない） */
  const lookNone = (id: string) => {
    // スマホの日ごとのリストは表示を変えず、その行へ巻く（「担当なしの列へ」と同じ）
    if (shownView === 'day') {
      requestAnimationFrame(() =>
        document
          .querySelector(`.day-row[data-visit="${CSS.escape(id)}"]`)
          ?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }),
      );
      return;
    }
    if (shownView === 'list') setView('timeline');
    const x = { id, set: PLAN_SET };
    if (!sel.isPicked(x)) sel.togglePick(x);
    requestAnimationFrame(() => {
      const col = document.getElementById(noneColId);
      const card = col?.querySelector<HTMLElement>(`[data-visit="${CSS.escape(id)}"]`);
      (card ?? col)?.scrollIntoView({ behavior: scrollBehavior(), block: 'center', inline: 'nearest' });
    });
  };
  /** 「見る」（担当のある訪問）：その人の列の訪問を選んで見える所へ（担当ごとの1日から移るときと同じ） */
  const lookAt = (id: string) => {
    const sid = owner.get(id);
    if (sid) goToStaff(sid, id);
    else lookNone(id);
  };
  const hundredNow = cs && scoreScale ? toHundred(cs.total, scoreScale) : null;
  /** 物差しの下限の条件ごとの内訳（点数の理由で条件ごとの超過を比べる） */
  const scoreLower = useMemo(
    () => (scoreProblem ? (attempt(() => ruleLowerBounds(scoreProblem)).value ?? {}) : {}),
    [scoreProblem],
  );
  /** 点を下げているいちばん大きい理由（PRD D173。減点の内訳と条件ごとの達成から） */
  const reasonNow =
    cs && scoreScale && scoreProblem
      ? reasonOfRoutes({ problem: scoreProblem, scale: scoreScale }, cs, {
          achievements: curAch,
          rules: scoreRules,
          ruleLower: scoreLower,
        })
      : null;
  /** 訪問の一覧（表示の「一覧」。休みのため無しの訪問も薄く出す。ADR-0013） */
  const visitList = (
    <VisitList
      visits={sortedVisits}
      visitById={visitById}
      clientById={clientById}
      ownerName={(id) => {
        const o = owner.get(id);
        return o ? { id: o, name: staffName(o), known: staffById.has(o) } : null;
      }}
      notes={(id) => ({
        outside: !!problem && !problem.visits.some((v) => v.id === id),
        dropped: unassigned.includes(id),
        pinned: !!own(pins, id),
        hard: hardOf.get(id),
      })}
      clientLabel={terms.client}
      typeOfVisit={(v) => typeOf(data.visitTypes, v.typeId)}
      leaveVisits={[...m.leaveVisits].sort((a, b) => a.earliestStart.localeCompare(b.earliestStart))}
      leaveNoteOf={(v) => leaveOn(data.clientLeaves, v.clientId, v.date)?.note ?? ''}
      onEdit={(id) => openVisit(id)}
      onCancel={cancelVisit}
    />
  );
  /**
   * スマホの日ごとのリスト（PRD D334）の行：その日の訪問（取り消し・休みの回も）を時刻の順に。時刻は今の担当の開始（無ければ開始の早い方）。
   * 印は要対応（訪問ごとの検査）・未連絡の変更・ピン
   */
  const dayRows = useMemo((): DayListRow[] => {
    if (!compact) return [];
    const startOf = (v: Visit) => explained.get(v.id)?.timing?.start ?? hhmmToMinutes(v.earliestStart);
    return [...m.allVisits]
      .sort((a, b) => startOf(a) - startOf(b) || a.id.localeCompare(b.id))
      .map((v) => {
        const sid = owner.get(v.id) ?? (v.cancelled ? v.staffId : null);
        const sName = sid ? (staffById.get(sid)?.name ?? '（不明）') : '';
        const s = sid ? (staffById.get(sid) ?? null) : null;
        const leave = !v.cancelled && m.leaveVisits.includes(v);
        const start = startOf(v);
        const type = typeOf(data.visitTypes, v.typeId);
        return {
          visitId: v.id,
          time: `${clockTime(start)}〜${clockTime(start + v.durationMinutes)}`,
          title: clientById.get(v.clientId)?.displayName ?? '（不明）',
          staff: s,
          staffName: sName,
          state: v.cancelled
            ? v.cancelKind === 'sameDay'
              ? '当日キャンセル'
              : '取り消し'
            : leave
              ? '休みのため無し'
              : null,
          look: looks.get(v.id),
          color: type ? colorOf(type.color) : null,
          selectable: canSelectVisit(v, leave, jstDate(Date.now())),
        };
      });
  }, [compact, m.allVisits, m.leaveVisits, explained, owner, staffById, clientById, looks, data]);
  const dateIndex = dates.indexOf(date);
  const prevDate = dateIndex > 0 ? dates[dateIndex - 1] : undefined;
  const nextDate = dateIndex >= 0 ? dates[dateIndex + 1] : undefined;
  const dayList = (
    <DayList
      dateLabel={dateText(date)}
      rows={dayRows}
      onOpen={(id) => openVisit(id)}
      selecting={selecting}
      onSelecting={(on) => {
        setSelecting(on);
        if (!on) multi.clear();
      }}
      isSelected={multi.has}
      onToggle={multi.toggle}
      onPrev={prevDate ? () => setDate(prevDate) : null}
      onNext={nextDate ? () => setDate(nextDate) : null}
    />
  );
  /** 担当ごとの1日（PRD D84）：今の担当の並びから。列と同じ人・同じ順 */
  const staffLines = useMemo(
    () =>
      problem && hasPlan ? dayLines(problem, routes, columns, (sid) => spansOf(slotsOf.get(sid)?.baseSlots ?? [])) : [],
    [problem, hasPlan, routes, columns, slotsOf],
  );
  const lineRange = useMemo(() => dayLineRange(staffLines), [staffLines]);
  /**
   * 担当ごとの1日から（PRD D84。一覧のときは担当ごとの表示に切り替えてから）：その人を選んで（列の見出しを押したときと同じ。
   * 地図もその人に絞る）列へ移り、列の見出しにフォーカス。visitId があればその訪問を選んで（カードを押したときと同じ。
   * 選んだままなら外さず、地図をその人に絞り直す）列の中のカードへ移る
   */
  const goToStaff = (sid: string, visitId?: string) => {
    if (shownView === 'list' || shownView === 'day') setView('timeline');
    if (visitId) {
      const x = { id: visitId, set: PLAN_SET };
      if (sel.isPicked(x)) focusOn(sid);
      else sel.togglePick(x);
    } else focusOn(sid);
    requestAnimationFrame(() => {
      const col = document.querySelector<HTMLElement>(`.route-col[data-staff="${CSS.escape(sid)}"]`);
      const card = visitId ? col?.querySelector<HTMLElement>(`[data-visit="${CSS.escape(visitId)}"]`) : null;
      if (card) {
        card.scrollIntoView({ behavior: scrollBehavior(), block: 'center', inline: 'nearest' });
        return;
      }
      col?.scrollIntoView({ behavior: scrollBehavior(), block: 'start', inline: 'nearest' });
      colHeadOf(sid)?.focus({ preventScroll: true });
    });
  };
  /** 担当なしの訪問の列へ移る（帯の近道。一覧のときは担当ごとの表示に切り替えてから） */
  const goToNone = () => {
    // スマホの日ごとのリストは、最初の担当なしの行へ巻く
    if (shownView === 'day') {
      requestAnimationFrame(() =>
        document
          .querySelector('.day-row.is-unassigned')
          ?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }),
      );
      return;
    }
    if (shownView === 'list') setView('timeline');
    requestAnimationFrame(() =>
      document.getElementById(noneColId)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }),
    );
  };
  // ?do=unassigned を受けた日（PRD D201）：並びが出ていれば1回だけ巻く。担当なしの訪問が無いときは巻かずに終える
  // biome-ignore lint/correctness/useExhaustiveDependencies: 日付・並びが変わったときだけ
  useEffect(() => {
    if (pendingNone.current === null || pendingNone.current !== date || !problem) return;
    pendingNone.current = null;
    if (unassigned.length > 0) goToNone();
  }, [date, problem, unassigned.length, noneAsked]);

  /** 計算中の進み具合（操作の行） */
  const progressView = running && (
    <div className="plan-progress" data-testid="plan-progress">
      <PlanProgressText
        store={progressStore}
        prefix={runningFor ? `${shortDate(runningFor.date)} の${runningFor.label}案B・` : ''}
      />
      <button type="button" className="btn btn-small" onClick={stop}>
        <WithIcon icon={Square} size={14}>
          止める
        </WithIcon>
      </button>
    </div>
  );

  // ---- 「欠勤・キャンセル」の欄（PRD D167〜D172）：選択肢・訪問の担当・4段目の振り直しの結果・5段目の連絡 ----
  const sudden = useSuddenFlow({
    date,
    data,
    update,
    terms,
    state: suddenState,
    flow,
    day: { staff, slotsOf, visits, visitById, clientById, staffName, visitLabel },
    plan: {
      problem,
      routes,
      hasPlan,
      owner,
      startOf: (id) => explained.get(id)?.timing?.start ?? null,
      told,
      toldState,
    },
    contactWords,
    applyCancel,
    adopt,
    staffMail,
    onCopied,
    colHeadOf,
  });

  /** 訪問を追加を押せない理由（〈利用者さん〉がいない・スマホの幅） */
  const addWhy =
    m.clients.length === 0
      ? `${terms.client}がいません`
      : compact
        ? 'スマホの幅では訪問を足しません（パソコン・タブレットで）'
        : false;
  /**
   * 操作の行の「その他 ▾」（スマホだけ。PRD D334・D344）：訪問を追加・表示・使い方。
   * パソコン・タブレットは項目が少ないので、訪問を追加・使い方をたたまずに操作の行へ出す（その他 ▾ は出さない）
   */
  const moreItems: MenuItem[] = !compact
    ? []
    : [
        {
          key: 'add',
          label: '訪問を追加',
          icon: Plus,
          disabled: addWhy,
          onSelect: () => openVisit(null),
          testId: 'plan-visit-add',
        },
        // スマホは表示の切り替えを「その他 ▾」に入れる（操作の行を1段にする。PRD D334）
        ...(
          [
            ['day', '日ごとのリスト'],
            ['order', '順番'],
            ['list', '一覧'],
          ] as const
        ).map(
          ([k, text], i): MenuItem => ({
            key: `view-${k}`,
            group: i === 0 ? '表示' : undefined,
            label: `${text}で見る`,
            current: mView === k,
            onSelect: () => setMView(k),
            testId: `plan-view-${k}`,
          }),
        ),
        {
          key: 'help',
          group: 'そのほか',
          label: helpOpen ? '使い方を閉じる' : '使い方',
          icon: Info,
          onSelect: () => setHelpOpen(!helpOpen),
          testId: 'plan-more-help',
        },
      ];

  return (
    <div className="plan-page stack">
      <PageHeader
        icon={CalendarDays}
        title="日の予定"
        lead="その日の担当を見て直し、〈スタッフ〉に伝えたら確定します"
      />
      {/* 上のナビの行（日・週・月で同じ。PRD D347。ADR-0060）。日送り・今日・［月｜週｜日］・状態の印・メールで送る・確定 */}
      <ScheduleNav
        current="day"
        today={{ onClick: () => setDate(todayDate), disabled: date === todayDate }}
        prev={{ label: '前の日', onClick: () => prevDate && setDate(prevDate), disabled: !prevDate }}
        next={{ label: '次の日', onClick: () => nextDate && setDate(nextDate), disabled: !nextDate }}
        picker={{ label: '日付', value: date, options: dayOptions, onChange: setDate }}
        actions={
          (hasPlan || toldState === 'changed') && (
            <PlanConfirmActions
              toldState={toldState}
              toldCount={toldCount}
              date={date}
              mailOn={mailOn}
              running={!!running}
              onPickDate={setDate}
              onOpenTold={() => setToldOpen(true)}
              onMail={() => setPanel('mail')}
              onAdopt={adopt}
            />
          )
        }
      />
      {/* 進み具合の帯は月の予定だけ（PRD D332）。日は見出しの状態の印と「今の担当」の1行 */}
      {m.clients.length === 0 && (
        <div className="card">
          <p className="sub">先に{terms.client}を登録してください。</p>
        </div>
      )}

      {hasPlan && cs && (
        <PlanOneLine
          cs={cs}
          visitCount={visits.length}
          droppedRows={droppedRows}
          hardRows={hardRows}
          hundredNow={hundredNow}
          scoreRulerName={scoreRulerName}
          reasonNow={reasonNow}
          rulesOn={rulesOn}
          compatOn={compatOn}
          date={date}
          lookNone={lookNone}
          lookAt={lookAt}
          goToNone={goToNone}
          onOpen={(id) => openVisit(id)}
          onDetail={() => setPanel('detail')}
        />
      )}
      {/* 操作の行（日・週・月で同じ並び・同じ位置＝状態の1行のすぐ下。PRD D327・D344）：欠勤・キャンセルを登録／元に戻す・やり直す／表示／訪問を追加・使い方（スマホは その他 ▾） */}
      <ScheduleToolbar
        zoom="day"
        className="plan-toolbar"
        absence={
          suddenOn
            ? {
                onClick: () => suddenState.open({}),
                disabled: visits.length === 0 && sudden.staffList.length === 0,
                ref: sudden.btnRef,
              }
            : null
        }
        moreItems={moreItems}
        after={progressView}
      >
        {!compact && (visits.length > 0 || m.leaveVisits.length > 0) && (
          <fieldset className="segmented seg-sm plan-view-toggle" aria-label="表示">
            {(
              [
                ['timeline', '時間軸'],
                ['order', '順番'],
                ['list', '一覧'],
              ] as const
            ).map(([k, text]) => (
              <button
                key={k}
                type="button"
                aria-pressed={shownView === k}
                className={`${shownView === k ? 'is-on' : ''} plan-view-${k}`}
                onClick={() => setColView(k)}
              >
                {text}
              </button>
            ))}
          </fieldset>
        )}
        {/* パソコン・タブレットは「その他 ▾」にたたまずに出す（PRD D344） */}
        {!compact && (
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (addWhy === false) openVisit(null);
              }}
              aria-disabled={addWhy !== false || undefined}
              title={addWhy || undefined}
              data-testid="plan-visit-add"
            >
              <WithIcon icon={Plus}>
                <span className="tb-label">訪問を追加</span>
              </WithIcon>
            </button>
            <button
              type="button"
              className="btn"
              aria-pressed={helpOpen}
              onClick={() => setHelpOpen(!helpOpen)}
              data-testid="plan-help-btn"
            >
              <WithIcon icon={Info}>
                <span className="tb-label">{helpOpen ? '使い方を閉じる' : '使い方'}</span>
              </WithIcon>
            </button>
          </>
        )}
      </ScheduleToolbar>
      {/* 使い方は操作の行のすぐ下に開く */}
      {helpOpen && <PlanHelp helpRef={helpRef} staffTerm={terms.staff} onClose={() => setHelpOpen(false)} />}
      {/* 担当ごとの1日（PRD D84）。訪問のある日だけ。狭い幅では畳む */}
      {hasPlan && cs && !compact && (
        <DayLines
          lines={staffLines}
          range={lineRange}
          nameOf={staffName}
          onPick={goToStaff}
          staffTerm={terms.staff}
          collapsed={narrowOrPrint}
          detailName={(sid) => staffById.get(sid)?.name ?? ''}
        />
      )}

      {/* あるときだけの帯（PRD D63）。ドラッグ中には増減しない（移したあとに変わる） */}
      <PlanBands
        errors={{ problem: m.problemError, run: error, score: (hasPlan && curScore?.error) || null }}
        care={{ count: hasPlan ? careCount : 0, parts: careParts, unassigned: unassigned.length }}
        toldCount={toldState === 'changed' ? toldCount : null}
        reassign={hasPlan && reassignInfo ? { unplaced: rDiff?.unplaced.length ?? 0, left: left.length } : null}
        leave={{ count: m.leaveVisits.length, names: leaveNames }}
        over={workloadOn ? { list: overSpan, limitHours: data.org.spanLimitHours, staffById } : null}
        terms={terms}
        date={date}
        staffName={staffName}
        on={{ goNone: goToNone, openTold: () => setToldOpen(true), goBar: goToBar, showList: () => setView('list') }}
      />
      {/* キーで動かした先の読み上げと、繰り返しの回の範囲を選び直す小さな帯（PRD D333） */}
      <KeyMoveBand
        onMoved={(r) => {
          if (r.date !== date) setDate(r.date);
          focusBand(r.visitId);
        }}
      />

      {shownView !== 'day' && visits.length === 0 && m.leaveVisits.length > 0 ? (
        visitList
      ) : shownView !== 'day' && visits.length === 0 ? (
        <div className="card">
          <Empty icon={CalendarDays}>
            この日の訪問はまだありません。
            {compact ? 'パソコン・タブレットで足せます。' : '操作の行の「訪問を追加」で足せます。'}繰り返しは
            {terms.client}の画面で足せます。
          </Empty>
        </div>
      ) : (
        <div className="plan-main">
          <div className="plan-body stack">
            {hasPlan && reassignInfo && (
              <ReassignBar
                id={barId}
                info={reassignInfo}
                diff={rDiff}
                left={left}
                visitLabel={visitLabel}
                visitNode={visitNode}
                staffName={staffName}
                onReassignAgain={flow.reassignAgain}
                cancelled={absenceCancelled}
                running={!!running}
                onRevert={flow.revertToBase}
                extraActions={<ContactButton count={contactsTotal} onOpen={() => setContactsOpen(true)} />}
              >
                <AnnealBox {...annealBox} />
              </ReassignBar>
            )}
            {shownView === 'list' ? (
              visitList
            ) : shownView === 'day' ? (
              dayList
            ) : !hasVisits ? null : (
              <div className="card stack plan-view" data-testid="plan-view">
                {shownView === 'timeline' ? (
                  <>
                    {unassigned.length > 0 && noneCol}
                    <RouteTimeline
                      columns={columns.map(timelineCol)}
                      legOn={(leg) => sel.isLeg(legSel(leg))}
                      onLeg={(leg) => sel.toggleLeg(legSel(leg))}
                    />
                    {/* 未割当が0件のときのドラッグの受け口は時間軸の下に出す（時間軸の位置を変えない） */}
                    {unassigned.length === 0 && dragging !== null && owner.has(dragging) && noneCol}
                  </>
                ) : (
                  <div className="route-grid">
                    {(unassigned.length > 0 || (dragging !== null && owner.has(dragging))) && noneCol}
                    {columns.map((sid) => {
                      const ids = own(routes, sid) ?? [];
                      return (
                        <div
                          key={sid}
                          className={`route-col ${colClass(sid)}`}
                          style={{ borderTopColor: colorOfStaff.get(sid) }}
                          data-staff={sid}
                          {...dropProps(sid)}
                        >
                          {colHeader(sid)}
                          {ids.length === 0 && <span className="sub">ここへドラッグすると移せます</span>}
                          {ids.map((id) => card(id))}
                          {homeLeg(sid)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {hasPlan && (
            <aside ref={mapCardRef} className="card stack plan-map" aria-label="地図" data-testid="plan-map">
              <SectionTitle
                icon={MapIcon}
                aside={
                  focusStaff && (
                    <button type="button" className="btn btn-small" onClick={sel.clear}>
                      全員のルートを見る
                    </button>
                  )
                }
              >
                地図{focusStaff ? `：${staffName(focusStaff)}` : ''}
              </SectionTitle>
              <RouteMap points={points} lines={lines} height={wideMap ? 600 : 420} />
              <StaffLegend
                staffIds={columns.filter((sid) => (own(routes, sid)?.length ?? 0) > 0)}
                staffName={staffName}
                focusStaff={focusStaff}
                onFocus={focusOn}
                extra={<span className="nowrap legend-item">「家」＝自宅</span>}
              />
            </aside>
          )}
        </div>
      )}
      {hasPlan && (
        <MapDock
          target={mapCardRef}
          points={points}
          lines={lines}
          title={`地図${focusStaff ? `：${staffName(focusStaff)}` : ''}`}
          focusKey={sel.focusKey}
        />
      )}
      {hasPlan && reassignInfo && (
        <ReassignDock
          targetId={barId}
          unplaced={rDiff?.unplaced.length ?? 0}
          left={left.length}
          method={reassignInfo.method}
          annealRecommended={annealRecommended && !annealDisabled}
          annealRunning={running === 'anneal'}
          contactCount={contactsTotal}
          onGo={goToBar}
          onAnneal={() => {
            flow.anneal.start();
            goToBar();
          }}
          onContacts={() => setContactsOpen(true)}
        />
      )}

      {notInProblem.length > 0 && (
        <div className="card stack">
          <SectionTitle
            icon={TriangleAlert}
            aside={
              <Hint>
                {terms.client}が休止中・位置が未登録などの訪問です（{terms.client}の画面で直せます）。
              </Hint>
            }
          >
            計算に入れなかった訪問
          </SectionTitle>
          {notInProblem.map((v) => (
            <span key={v.id}>{visitLabel(v.id)}</span>
          ))}
        </div>
      )}

      {cancelFor && (
        <CancelVisitPanel
          visit={cancelFor}
          clientName={clientById.get(cancelFor.clientId)?.displayName ?? ''}
          clientWord={terms.client}
          suddenOn={suddenOn}
          sameDay={cancelSameDay}
          setSameDay={setCancelSameDay}
          onCancel={doCancel}
          onClose={() => setCancelFor(null)}
        />
      )}
      {panel === 'detail' && (
        <PlanDetailPanel
          cs={hasPlan ? cs : null}
          scoreProblem={scoreProblem}
          scoreScale={scoreScale}
          scoreRulerName={scoreRulerName}
          curAch={curAch}
          rules={data.rules}
          terms={terms}
          routes={routes}
          staffName={staffName}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'mail' && mailOn && (
        <DayMailPanel
          data={data}
          date={date}
          onClose={() => setPanel(null)}
          confirm={{ state: toldState, onConfirm: (by) => (by === 'mail' ? confirmByMail() : void adopt()) }}
        />
      )}

      {contactsOpen && (contacts || leftContacts.length > 0) && (
        <ContactPanel
          list={contacts ?? EMPTY_CONTACTS}
          left={leftContacts}
          words={contactWords}
          terms={terms}
          staffMail={staffMail}
          onCopied={onCopied}
          onClose={() => setContactsOpen(false)}
        />
      )}
      {/* 未連絡の変更の連絡の一覧（伝えた内容 → 今。ADR-0053） */}
      {toldOpen && told && (
        <ContactPanel
          list={told}
          left={[]}
          words={contactWords}
          terms={terms}
          staffMail={staffMail}
          onCopied={onCopied}
          onClose={() => setToldOpen(false)}
        />
      )}
      {sudden.panel && <SuddenPanel key={date} {...sudden.panel} />}
      {/* 複数選択の帯（PRD D330。画面の下に貼り付く） */}
      {/* 選んだ訪問をまとめて動かす帯は、確認のモードでは出さない（札を動かさない。PRD D348） */}
      <SelectionBar ids={multi.ids} onClear={multi.clear} dates={[date]} />
    </div>
  );
}

/** 時間軸をやめて順番にする幅（PRD D58） */
const TIMELINE_NARROW_QUERY = '(max-width: 900px)';

/** 地図を時間軸の横に並べる幅（PRD D63） */
const WIDE_MAP_QUERY = '(min-width: 1280px)';

/** 狭い幅（900px 以下）か印刷中か。印刷は beforeprint の中ですぐ描き直す（印刷の画像に間に合わせる） */
function useNarrowOrPrint(): boolean {
  const narrow = useMedia(TIMELINE_NARROW_QUERY);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
  return narrow || printing;
}

/** 訪問の一覧の「注意」に出すもの */
type VisitNotes = {
  /** 計算に入れていない（訪問先が休止中・位置が未登録など） */
  outside: boolean;
  /** 担当なし */
  dropped: boolean;
  /** ピン */
  pinned: boolean;
  /** 要対応（担当が休み・条件に合わない・時間に間に合わない） */
  hard?: string[];
};

/**
 * その日の訪問の一覧（時間・訪問先・所要・担当・注意・開く/取消）。表示の切り替えの「一覧」で出す（PRD D63）。
 * 担当は訪問の担当を出すだけ（割り当ては時間軸・順番でドラッグする）
 */
function VisitList({
  visits,
  visitById,
  clientById,
  ownerName,
  notes,
  clientLabel,
  typeOfVisit,
  leaveVisits,
  leaveNoteOf,
  onEdit,
  onCancel,
}: {
  /** 開始時刻の順の訪問ID */
  visits: string[];
  visitById: Map<string, Visit>;
  clientById: Map<string, Client>;
  /** 担当（担当なしは null）。known：〈スタッフ〉がデータにいる（いなければ名前をボタンにしない） */
  ownerName: (id: string) => { id: string; name: string; known: boolean } | null;
  notes: (id: string) => VisitNotes;
  clientLabel: string;
  /** 訪問の種類（ADR-0012。種類なしは null） */
  typeOfVisit: (v: Visit) => VisitType | null;
  /** 〈利用者さん〉の休み（ADR-0013）のため無しの訪問（開始の順）。薄い行で後ろに出す（計算に入らない） */
  leaveVisits: Visit[];
  /** 休みの理由 */
  leaveNoteOf: (v: Visit) => string;
  onEdit: (id: string) => void;
  onCancel: (v: Visit) => void;
}) {
  /** 「固定」の説明は表の中で最初の1行だけ（PRD D241。2行目からは文字だけ） */
  const firstPinned = visits.find((id) => visitById.has(id) && notes(id).pinned);
  return (
    <section className="card stack visit-list" data-testid="visit-list">
      <SectionTitle icon={CalendarDays}>
        訪問の一覧（{visits.length}件{leaveVisits.length > 0 ? `・休みのため無し ${leaveVisits.length}件` : ''}）
      </SectionTitle>
      <div className="table-scroll">
        <table className="visit-table">
          <thead>
            <tr>
              <th>
                <WithIcon icon={Clock} size={14}>
                  時間
                </WithIcon>
              </th>
              <th>{clientLabel}</th>
              <th className="num">所要</th>
              <th>担当</th>
              <th>注意</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visits.map((id) => {
              const v = visitById.get(id);
              if (!v) return null;
              const o = ownerName(id);
              const n = notes(id);
              const label = `${clientById.get(v.clientId)?.displayName ?? ''} ${windowText(v)}`;
              return (
                <tr key={id} className={o ? '' : 'row-unassigned'}>
                  <td className="nowrap">
                    <div className="time-cell">
                      <Clock size={14} aria-hidden="true" />
                      <span className="time-main">{windowText(v)}</span>
                      {v.windowKind === 'window' && <span className="time-tag">この間に開始</span>}
                    </div>
                  </td>
                  <td>
                    <ClientName client={clientById.get(v.clientId)} detail />
                    {(typeOfVisit(v) || v.pattern?.edited) && (
                      <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                        <TypeMark type={typeOfVisit(v)} compact />
                        {v.pattern?.edited && (
                          <span className="chip chip-warn" title="定期パターンのこの回だけ変えた訪問">
                            この回だけの変更
                          </span>
                        )}
                      </div>
                    )}
                    {v.note && <div className="sub">{v.note}</div>}
                  </td>
                  <td className="num nowrap">{v.durationMinutes}分</td>
                  <td className="nowrap">
                    {o ? (
                      <span className="row" style={{ gap: 6 }}>
                        <StaffMarkById id={o.id} size="xs" />
                        <PersonButton kind="staff" id={o.id} name={o.known ? o.name : ''}>
                          {o.name}
                        </PersonButton>
                      </span>
                    ) : (
                      <span className="sub">担当なし</span>
                    )}
                  </td>
                  <td>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
                      {n.outside && <span className="chip chip-warn">計算に入れない</span>}
                      {n.dropped && <span className="chip chip-warn">担当なし</span>}
                      {n.pinned && (
                        <span className="chip chip-pin">
                          <Pin size={12} strokeWidth={2.4} aria-hidden="true" />
                          <Term k="pinned" plain={id !== firstPinned} />
                        </span>
                      )}
                      {n.hard?.map((h) => (
                        <span key={h} className="chip chip-red" title="要対応">
                          <ShieldAlert size={12} aria-hidden="true" />
                          {h}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="nowrap">
                    <div className="actions">
                      <IconButton
                        icon={PanelRightOpen}
                        label={`${label}を開く`}
                        onClick={() => onEdit(id)}
                        data-testid="visit-row-open"
                        data-visit={id}
                      />
                      <IconButton icon={Ban} label={`${label}を取り消す`} tone="danger" onClick={() => onCancel(v)} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {leaveVisits.map((v) => {
              const note = leaveNoteOf(v);
              const label = `${clientById.get(v.clientId)?.displayName ?? ''} ${windowText(v)}`;
              return (
                <tr key={v.id} className="row-leave" data-testid="visit-leave-row">
                  <td className="nowrap">
                    <div className="time-cell">
                      <Clock size={14} aria-hidden="true" />
                      <span className="time-main">{windowText(v)}</span>
                    </div>
                  </td>
                  <td>
                    <ClientName client={clientById.get(v.clientId)} detail />
                    <TypeMark type={typeOfVisit(v)} compact />
                  </td>
                  <td className="num nowrap">{v.durationMinutes}分</td>
                  <td className="nowrap">
                    <span className="sub">—</span>
                  </td>
                  <td>
                    <span className="chip chip-leave" title={note || undefined}>
                      <BedSingle size={12} aria-hidden="true" />
                      休みのため無し{note ? `（${note}）` : ''}
                    </span>
                  </td>
                  <td className="nowrap">
                    <div className="actions">
                      <IconButton
                        icon={PanelRightOpen}
                        label={`${label}を開く`}
                        onClick={() => onEdit(v.id)}
                        data-testid="visit-row-open"
                        data-visit={v.id}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * 訪問の詳細の「担当を変える ▾」（PRD D217。ADR-0030）：ドラッグと同じ手直しを、押す・キーボード・タッチで。
 * 候補は「受けられる人」と同じ candidatesFor（列のある人だけ）。押せる人を先に、必須の条件に合わない人は押せず理由を出す。
 * 今の担当は印を付けて押せない。担当のいる訪問は最後に「担当なしにする」。選ぶとドラッグと同じ moveTo・unassign
 */
function ReassignMenu({
  problem,
  routes,
  visitId,
  ownerId,
  pinned,
  staffIds,
  staffName,
  staffTerm,
  busy,
  onMove,
  onNone,
}: {
  problem: Problem;
  routes: Record<string, string[]>;
  visitId: string;
  ownerId: string | null;
  pinned: boolean;
  /** 列を出している人（ドラッグで落とせる人と同じ） */
  staffIds: string[];
  staffName: (id: string) => string;
  staffTerm: string;
  /** 押せない理由（計算中）。無ければ false */
  busy: string | false;
  onMove: (staffId: string) => void;
  onNone: () => void;
}) {
  /** 候補は一覧を開いているときだけ計算する（「受けられる人」の CandidateBox と同じ。訪問を選ぶ・ドラッグのたびに計算しない） */
  const [open, setOpen] = useState(false);
  // 判定は訪問の詳細の欄と同じ関数（lib/reassignMenu の reassignChoices。ADR-0051）。出す人は列を出している人
  const sorted = useMemo(() => {
    if (!open) return [];
    const shown = new Set(staffIds);
    return reassignChoices(problem, routes, visitId, ownerId, (sid) => shown.has(sid)).filter((c) => !c.current);
  }, [open, problem, routes, visitId, ownerId, staffIds]);
  if (!problem.visits.some((v) => v.id === visitId)) return null;
  const items: MenuItem[] = [
    ...(ownerId
      ? [
          {
            key: `cur-${ownerId}`,
            group: '今の担当',
            testId: 'plan-reassign-current',
            label: staffName(ownerId),
            note: pinned ? 'ピン' : undefined,
            description: CURRENT_TEXT,
            current: true,
            disabled: true,
            onSelect: () => {},
          },
        ]
      : []),
    ...sorted.map(
      (c, i): MenuItem => ({
        key: `to-${c.staffId}`,
        group: i === 0 ? `ほかの${staffTerm}へ移す` : undefined,
        testId: 'plan-reassign-item',
        label: staffName(c.staffId),
        description: c.description,
        disabled: busy || c.disabled,
        onSelect: () => onMove(c.staffId),
      }),
    ),
    // 担当の無い訪問で移せる人がいなければ、そう書く（一覧を空にしない）
    ...(!ownerId && open && sorted.length === 0
      ? [
          {
            key: 'empty',
            testId: 'plan-reassign-empty',
            label: `移せる${staffTerm}がいません`,
            disabled: true,
            onSelect: () => {},
          },
        ]
      : []),
    ...(ownerId
      ? [
          {
            key: 'none',
            group: 'そのほか',
            testId: 'plan-reassign-none',
            label: '担当なしにする',
            description: NONE_TEXT,
            icon: CircleOff,
            disabled: busy,
            onSelect: onNone,
          },
        ]
      : []),
  ];
  return (
    <div className="plan-reassign">
      <MenuButton
        label="担当を変える"
        icon={ArrowRightLeft}
        items={items}
        testId="plan-reassign"
        onOpenChange={setOpen}
      />
    </div>
  );
}

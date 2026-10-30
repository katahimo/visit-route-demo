// 日の予定の訪問の見た目（PRD D58・D124・D217・D241）：順番のカード・時間軸の帯と、その詳細（詳細・変更・名前・担当を変える・
// 印・経路のリンク・理由）。どれも usePlanPage の戻り値から描く関数
import { MessageSquareText, PanelRightOpen, Pin, PinOff, ShieldAlert, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { VisitRouteLinks } from '../components/mapsLinks';
import { PersonButton } from '../components/PersonPopover';
import type { TimelineBand } from '../components/routeTimeline';
import { VisitCard } from '../components/routeView';
import { StaffMark } from '../components/StaffMark';
import { Term } from '../components/Term';
import { shiftShort, TlMark, type TlMarkTone } from '../components/timelineMarks';
import { IconButton, WithIcon } from '../components/ui';
import { VisitRules } from '../components/VisitRules';
import { TypeMark } from '../components/visitType';
import { hhmmToMinutes, jstDate } from '../domain/time';
import { colorOf } from '../lib/colors';
import { own } from '../lib/common';
import { exceptionsOnly } from '../lib/exceptionView';
import { HOME_LABEL } from '../lib/mapsLink';
import { typeOf } from '../lib/patternText';
import { leftReasonText } from './absenceParts';
import { ReasonBox } from './planParts';
import { ReassignMenu } from './planReassignMenu';
import { focusAfterMove, PLAN_SET } from './usePlanNav';
import type { PlanCtx } from './usePlanPage';

/** 描く関数が使う名前（usePlanPage の戻り値から並べる） */
function namesOf(p: PlanCtx) {
  const { d, sel, v, drag, flow, f, nav, edits } = p;
  return {
    ...d,
    date: p.date,
    sel,
    focusStaff: sel.focusStaff,
    focusOn: sel.focusOn,
    multi: v.multi,
    noneColId: v.noneColId,
    dragging: drag.dragging,
    dropTo: drag.dropTo,
    dropProps: drag.dropProps,
    dragProps: drag.dragProps,
    running: flow.planRun.running,
    reassignMarks: flow.marks,
    leftById: flow.leftById,
    reassignInfo: flow.info,
    absentStaff: flow.absentStaff,
    rDiff: flow.diff,
    left: flow.left,
    goToBar: flow.goToBar,
    annealRecommended: p.shown.annealRecommended,
    annealDisabled: flow.anneal.disabled,
    suddenOn: f.suddenOn,
    suddenState: p.suddenState,
    flow,
    unpin: edits.unpin,
    moveTo: edits.moveTo,
    unassign: edits.unassign,
    placeCandidate: edits.placeCandidate,
    openVisit: nav.openVisit,
    visitKeys: nav.visitKeys,
    /** 例外だけ見せる（エキスパート機能が切。PRD D384） */
    only: exceptionsOnly(d.data.org.features),
  };
}

/** 描くたびに1回だけ作る（訪問ごと・列ごとに呼ぶので） */
const namesCache = new WeakMap<PlanCtx, ReturnType<typeof namesOf>>();

/** 描く関数が使う名前（usePlanPage の戻り値ごとに1回だけ作る） */
export function bv(p: PlanCtx): ReturnType<typeof namesOf> {
  let names = namesCache.get(p);
  if (!names) {
    names = namesOf(p);
    namesCache.set(p, names);
  }
  return names;
}

/**
 * 訪問の詳細の経路のリンク（PRD D100。ADR-0018）：担当の今の並びの順番で、前の場所（前の訪問先、1件目は担当の自宅）から・今いる場所から。
 * 担当の決まっていない訪問は出さない。伝えたあとに変わった日（未連絡の変更あり）は「今の順番（未連絡）」と添える
 */
export function routeLinksOf(p: PlanCtx, id: string, sid: string | null) {
  const { routes, staffById, clientOf, toldState } = bv(p);
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
}

/** visitLabel と同じ見た目で、〈利用者さん〉の名前から詳細を開く（欠勤の人に残る訪問。PRD D206） */
export function visitNode(p: PlanCtx, id: string) {
  const { visitById, clientOf } = bv(p);
  const c = clientOf(id);
  return (
    <>
      {visitById.get(id)?.earliestStart ?? ''}{' '}
      {c ? <PersonButton kind="client" id={c.id} name={c.displayName} testId="left-client" /> : '（不明）'}
    </>
  );
}

/** 帯・カードの詳細の「詳細・変更」（訪問の詳細の欄を開く） */
export function openOf(p: PlanCtx, id: string) {
  const { openVisit } = bv(p);
  return (
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
}

/**
 * 訪問の詳細の〈利用者さん〉・担当の名前（押すと詳細の吹き出し。PRD D124）。順番のカードの詳細・時間軸の帯の詳細で共通。
 * withClient が false のときは担当だけ（時間軸は見出しの行に〈利用者さん〉の名前がある）
 */
export function whoOf(p: PlanCtx, id: string, sid: string | null, withClient = true) {
  const { staffById, clientOf, terms } = bv(p);
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
}

/**
 * 訪問の印（欠勤の人のまま・代行・+N分・固定・必須の違反）と「固定を外す」。順番のカードの中・時間軸の帯の説明で共通。
 * pinHint：「固定」に用語の説明を付ける（順番の表示では並びで最初の固定の訪問だけ。押して開く説明は別に数える。PRD D241）
 */
export function tagsOf(p: PlanCtx, id: string, pinHint = true) {
  const { pins, staffName, hardOf, toldMarks, running, reassignMarks, leftById, unpin, only } = bv(p);
  // 例外だけ見せる（切）：ピン・条件に合わない印は出さない（担当なし・重なり・休みの人と「変更あり」だけ目立たせる）
  const pin = only ? undefined : own(pins, id);
  const hard = only ? undefined : hardOf.get(id);
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
}

/**
 * 訪問の詳細の「担当を変える ▾」（PRD D217）。順番のカード・時間軸の帯の詳細で共通。
 * 入らない訪問で「受けられる人」（振り直しの候補）を出しているものは重ねない
 */
export function reassignOf(p: PlanCtx, id: string, ownerId: string | null) {
  const { problem, hasPlan, routes, pins, staffName, terms, columns, running, reassignMarks, moveTo, unassign } = bv(p);
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
}

/** 順番の表示で最初（入らなかった訪問 → 列の順）の固定の訪問。「固定」の説明はこのカードだけ（PRD D241） */
export function firstPinnedCard(p: PlanCtx) {
  const { routes, pins, unassigned, columns } = bv(p);
  return [...unassigned, ...columns.flatMap((sid) => own(routes, sid) ?? [])].find((id) => own(pins, id));
}

/** 訪問カード（ドラッグで担当を移す。押すと理由） */
export function card(p: PlanCtx, id: string) {
  const {
    routes,
    pins,
    owner,
    explained,
    visitById,
    clientOf,
    data,
    hardOf,
    sel,
    multi,
    dragging,
    dragProps,
    only,
    looks,
  } = bv(p);
  const pin = own(pins, id);
  const hard = hardOf.get(id);
  const tone = only ? (looks.get(id)?.tone === 'issue' || looks.get(id)?.tone === 'unassigned' ? 'red' : null) : null;
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
      tone={only ? tone : hard ? 'red' : pin ? 'pinned' : null}
      oneLine={only}
      drag={dragProps(id)}
      dragging={dragging === id}
      detail={
        <>
          {openOf(p, id)}
          {whoOf(p, id, ownerId)}
          {reassignOf(p, id, ownerId)}
          <VisitRules client={clientOf(id)} />
          {routeLinksOf(p, id, ownerId)}
          <ReasonBox explain={explained.get(id)} />
        </>
      }
      mark={<TypeMark type={typeOf(data.visitTypes, visitById.get(id)?.typeId)} compact />}
    >
      {tagsOf(p, id, id === firstPinnedCard(p))}
    </VisitCard>
  );
}

/**
 * 時間軸の帯（PRD D58）：時刻は今の担当の lenient（explain の timing。無ければ訪問の開始（早）と所要）、色は種類。
 * 印は小さなアイコンと title、押すと帯の下に印の説明と理由
 */
export function bandOf(p: PlanCtx, id: string, sid: string): TimelineBand {
  const {
    pins,
    explained,
    visitById,
    clientOf,
    staffName,
    data,
    hardOf,
    looks,
    date,
    sel,
    multi,
    dragging,
    dragProps,
    reassignMarks,
    leftById,
    visitKeys,
    only,
  } = bv(p);
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
  const mark = (key: string, tone: TlMarkTone, title: string, body: ReactNode, testId?: string, toldDate?: string) => {
    notes.push(title);
    icons.push(
      <TlMark key={key} tone={tone} title={title} testId={testId} toldDate={toldDate}>
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
        lm.toldDate ? (
          lm.short
        ) : (
          <MessageSquareText size={11} aria-hidden="true" />
        )
      ) : lm.kind === 'pin' ? (
        <Pin size={11} strokeWidth={2.4} aria-hidden="true" />
      ) : (
        lm.short
      ),
      lm.kind === 'issue' ? 'issue-mark' : lm.kind === 'told' ? 'told-mark' : undefined,
      lm.toldDate,
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
    tone: only
      ? look?.tone === 'issue'
        ? 'red'
        : null
      : look?.tone === 'issue' || (hard && date >= jstDate(Date.now()))
        ? 'red'
        : pin
          ? 'pinned'
          : null,
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
        {openOf(p, id)}
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <strong>
            {client ? <PersonButton kind="client" id={client.id} name={client.displayName} /> : '（不明）'}
          </strong>
          <TypeMark type={type} compact />
        </div>
        {whoOf(p, id, sid, false)}
        {reassignOf(p, id, sid)}
        {tagsOf(p, id)}
        <VisitRules client={client} />
        {routeLinksOf(p, id, sid)}
        <ReasonBox explain={explained.get(id)} />
      </>
    ),
  };
}

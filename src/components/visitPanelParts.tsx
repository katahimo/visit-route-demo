// 訪問の詳細の欄（VisitPanel）の見る区画：足元のボタン・訪問の内容・スマホの大きな4つのボタン・取り消し・決まりごと
import {
  Ban,
  CalendarDays,
  Check,
  Navigation,
  Pin,
  Plus,
  Repeat,
  RotateCcw,
  Undo2,
  UserRoundCog,
  X,
} from 'lucide-react';
import type { Client, Staff, Visit, VisitType } from '../contracts/documents';
import { dateText } from '../lib/dateText';
import type { PrevStop } from '../lib/prevStop';
import type { VisitInfo } from '../lib/visitDraft';
import { windowShown } from '../lib/visitPanelText';
import { MAPS_TITLE, VisitRouteLinks } from './mapsLinks';
import { PersonButton } from './PersonPopover';
import { StaffMark } from './StaffMark';
import { WithIcon } from './ui';
import { hasVisitRules, VisitRules } from './VisitRules';
import { TypeMark } from './visitType';

/** スマホの下から出る欄で開いている操作（大きな4つのボタンの「担当を替える」「取り消す」。PRD D334） */
export type VisitAct = 'staff' | 'cancel' | null;

/** 足元のボタン（保存を出すときは保存・閉じる、出さないときは閉じるだけ） */
export function VisitFooter({
  saveShown,
  isNew,
  onClose,
}: {
  saveShown: boolean;
  isNew: boolean;
  onClose: () => void;
}) {
  return saveShown ? (
    <>
      <button type="submit" className="btn btn-primary" data-testid="vp-save">
        <WithIcon icon={isNew ? Plus : Check}>{isNew ? '追加' : '保存'}</WithIcon>
      </button>
      <button type="button" className="btn" onClick={onClose} data-testid="vp-close">
        <WithIcon icon={X}>閉じる</WithIcon>
      </button>
    </>
  ) : (
    <button type="button" className="btn" onClick={onClose} data-testid="vp-close">
      <WithIcon icon={X}>閉じる</WithIcon>
    </button>
  );
}

/** 担当の欄の中身（印・名前・ピン・いつもの担当。無ければ「担当なし」） */
function OwnerFact({ info, ownerStaff }: { info: VisitInfo; ownerStaff: Staff | undefined }) {
  if (!ownerStaff) return <span className="sub">担当なし</span>;
  return (
    <span className="with-staff-mark">
      <StaffMark staff={ownerStaff} size="xs" />
      <PersonButton kind="staff" id={ownerStaff.id} name={ownerStaff.name} testId="vp-staff-name" />
      {info.assignment.pinned && (
        <span className="chip chip-pin">
          <Pin size={12} strokeWidth={2.4} aria-hidden="true" />
          ピン
        </span>
      )}
      {info.assignment.staffId === info.usualStaffId && <span className="sub">（いつもの担当）</span>}
    </span>
  );
}

/** この回の変更（変えた所のチップと「繰り返しのとおりに戻す」。変更が無ければ何も出さない） */
function ChangesFact({
  v,
  info,
  restorable,
  onRestore,
}: {
  v: Visit;
  info: VisitInfo;
  restorable: boolean;
  onRestore: () => void;
}) {
  if (!(info.changes.length > 0 || (v.pattern?.edited && !v.cancelled))) return null;
  return (
    <>
      <dt>この回の変更</dt>
      <dd className="row" style={{ gap: 4, flexWrap: 'wrap' }} data-testid="vp-changes">
        {info.changes.length === 0 && <span className="chip chip-warn">この回だけの変更</span>}
        {info.changes.map((c) => (
          <span key={c} className="chip chip-warn">
            {c}
          </span>
        ))}
        {restorable && info.changes.length > 0 && (
          <button type="button" className="btn btn-small btn-text" onClick={onRestore} data-testid="vp-restore">
            <WithIcon icon={RotateCcw} size={14}>
              繰り返しのとおりに戻す
            </WithIcon>
          </button>
        )}
      </dd>
    </>
  );
}

/** 訪問の内容（〈利用者さん〉・日時・所要・種類・担当・繰り返し・この回の変更・メモ） */
export function VisitSummary({
  v,
  info,
  client,
  type,
  ownerStaff,
  restorable,
  onRestore,
  onOpenDay,
}: {
  v: Visit;
  info: VisitInfo;
  client: Client | undefined;
  type: VisitType | null;
  ownerStaff: Staff | undefined;
  /** 「繰り返しのとおりに戻す」を出す（日時を変えられるとき） */
  restorable: boolean;
  onRestore: () => void;
  /** 「日の予定で見る」（出さなければ無し） */
  onOpenDay: (() => void) | null;
}) {
  return (
    <section className="vp-summary" data-testid="vp-summary" aria-label="訪問の内容">
      <div className="vp-head">
        <strong className="vp-client">
          {client ? (
            <PersonButton kind="client" id={client.id} name={client.displayName} testId="vp-client-name" />
          ) : (
            '（不明）'
          )}
        </strong>
        <TypeMark type={type} compact />
        {v.cancelled && (
          <span className="chip chip-red" data-testid="vp-cancelled">
            {v.cancelKind === 'sameDay' ? '当日キャンセル' : '取り消し済み'}
          </span>
        )}
        {info.onLeave && <span className="chip chip-leave">休みのため無し</span>}
      </div>
      <dl className="vp-facts">
        <dt>日時</dt>
        <dd data-testid="vp-when">
          {dateText(v.date)} {windowShown(v)}
        </dd>
        <dt>所要</dt>
        <dd>{v.durationMinutes}分</dd>
        <dt>種類</dt>
        <dd>{type?.name ?? 'なし'}</dd>
        <dt>担当</dt>
        <dd data-testid="vp-staff-now">
          <OwnerFact info={info} ownerStaff={ownerStaff} />
        </dd>
        {info.patternText && (
          <>
            <dt>繰り返し</dt>
            <dd data-testid="vp-pattern">
              <WithIcon icon={Repeat} size={14}>
                {info.patternText}の回
              </WithIcon>
            </dd>
          </>
        )}
        <ChangesFact v={v} info={info} restorable={restorable} onRestore={onRestore} />
        {v.note && (
          <>
            <dt>メモ</dt>
            <dd>{v.note}</dd>
          </>
        )}
      </dl>
      {!info.editable && <p className="sub">今日より前の訪問なので、見るだけです。</p>}
      {onOpenDay && (
        <button type="button" className="btn btn-small" onClick={onOpenDay} data-testid="vp-open-day">
          <WithIcon icon={CalendarDays} size={14}>
            日の予定で見る（{dateText(v.date)}）
          </WithIcon>
        </button>
      )}
    </section>
  );
}

/** スマホの「道順」（道順のリンクを切っていれば出さない。場所が無ければ押せない） */
function BigRoute({ routeHref, clientName }: { routeHref: string | null; clientName: string }) {
  return routeHref ? (
    <a
      className="btn vp-big-btn"
      href={routeHref}
      target="_blank"
      rel="noopener noreferrer"
      title={MAPS_TITLE}
      aria-label={`道順（${clientName}さんへ。Google マップ・新しいタブ）`}
      data-testid="vp-big-route"
    >
      <Navigation size={22} aria-hidden="true" />
      道順
    </a>
  ) : (
    <button
      type="button"
      className="btn vp-big-btn"
      disabled
      title="場所（住所・地図の位置）が未登録のため、道順はありません"
      data-testid="vp-big-route"
    >
      <Navigation size={22} aria-hidden="true" />
      道順
    </button>
  );
}

/** スマホの大きな4つのボタン（PRD D334）：担当を替える・取り消す・道順・日の予定で見る */
export function VisitBigButtons({
  info,
  editable,
  act,
  setAct,
  onUncancel,
  mapsOn,
  routeHref,
  clientName,
  onDay,
}: {
  info: VisitInfo;
  editable: boolean;
  act: VisitAct;
  setAct: (a: VisitAct) => void;
  onUncancel: () => void;
  mapsOn: boolean;
  routeHref: string | null;
  clientName: string;
  onDay: () => void;
}) {
  const cancelled = info.visit.cancelled;
  return (
    <div className="vp-big" data-testid="vp-big">
      <button
        type="button"
        className={`btn vp-big-btn${act === 'staff' ? ' is-on' : ''}`}
        aria-expanded={act === 'staff'}
        disabled={!editable}
        title={!editable ? (cancelled ? '取り消した訪問です' : '今日より前の訪問は変えられません') : undefined}
        onClick={() => setAct(act === 'staff' ? null : 'staff')}
        data-testid="vp-big-staff"
      >
        <UserRoundCog size={22} aria-hidden="true" />
        担当を替える
      </button>
      <button
        type="button"
        className={`btn vp-big-btn${act === 'cancel' ? ' is-on' : ''}`}
        aria-expanded={act === 'cancel'}
        disabled={!info.editable}
        title={!info.editable ? '今日より前の訪問は変えられません' : undefined}
        // 取り消した回は押すとそのまま取り消しをやめる（「取り消しをやめる」を2つ並べない）
        onClick={() => (cancelled ? onUncancel() : setAct(act === 'cancel' ? null : 'cancel'))}
        data-testid="vp-big-cancel"
      >
        {cancelled ? <Undo2 size={22} aria-hidden="true" /> : <Ban size={22} aria-hidden="true" />}
        {cancelled ? '取り消しをやめる' : '取り消す'}
      </button>
      {/* 道順のリンク（ADR-0028 の mapsLink）を切っていれば出さない（3つに詰める） */}
      {mapsOn && <BigRoute routeHref={routeHref} clientName={clientName} />}
      <button type="button" className="btn vp-big-btn" onClick={onDay} data-testid="vp-big-day">
        <CalendarDays size={22} aria-hidden="true" />
        日の予定で見る
      </button>
    </div>
  );
}

/** 取り消し（取り消す・当日キャンセル。取り消した回は取り消しをやめる） */
export function VisitCancelArea({
  info,
  onCancel,
  onUncancel,
}: {
  info: VisitInfo;
  onCancel: (sameDay: boolean) => void;
  onUncancel: () => void;
}) {
  const cancelled = info.visit.cancelled;
  return (
    <section className="vp-section vp-cancel" aria-label="取り消し" data-testid="vp-cancel-area">
      {cancelled ? (
        <button type="button" className="btn" onClick={onUncancel} data-testid="vp-uncancel">
          <WithIcon icon={Undo2}>取り消しをやめる</WithIcon>
        </button>
      ) : (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="btn tone-danger" onClick={() => onCancel(false)} data-testid="vp-cancel">
            <WithIcon icon={Ban}>取り消す</WithIcon>
          </button>
          <button
            type="button"
            className="btn tone-danger"
            onClick={() => onCancel(true)}
            data-testid="vp-cancel-sameday"
          >
            当日キャンセルとして取り消す
          </button>
        </div>
      )}
      {info.pattern && !cancelled && <p className="sub">取り消しはこの回だけです。</p>}
    </section>
  );
}

/** 決まりごと・道順（狭い画面は決まりごとがあるときだけ。道順のリンクは広い画面だけ） */
export function VisitRulesSection({
  client,
  route,
  narrow,
}: {
  client: Client;
  route: PrevStop | null;
  narrow: boolean;
}) {
  if (narrow && !hasVisitRules(client)) return null;
  return (
    <section className="vp-section" aria-label="決まりごと・道順">
      <VisitRules client={client} />
      {route && !narrow && (
        <VisitRouteLinks
          to={client.place}
          toName={client.displayName}
          from={route.from}
          fromName={route.fromName}
          mode={route.staff.travelMode}
          testId="vp-route"
        />
      )}
    </section>
  );
}

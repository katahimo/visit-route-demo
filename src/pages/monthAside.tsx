// 月の画面の右の欄の部品（PRD D55・D153・D201・D223・D311・D340・D343）：その日の回の一覧・確定していない日（まとめて確定）・
// 要対応・選んだ〈スタッフ〉／〈利用者さん〉の月のまとめと、スマホの下から出る欄
import { CalendarDays, CalendarRange, CircleAlert, ListChecks, Lock, PencilLine, Timer, X } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { PersonButton } from '../components/PersonPopover';
import { ClientDot } from '../components/parts';
import { StaffMark } from '../components/StaffMark';
import { SelectionBar } from '../components/scheduleParts';
import { Term } from '../components/Term';
import { SidePanel, WithIcon } from '../components/ui';
import { SelectToggle, VisitRow, type VisitRowData } from '../components/visitParts';
import type { Client, Staff, Visit, VisitType } from '../contracts/documents';
import type { Features } from '../contracts/features';
import { colorOf } from '../lib/colors';
import { type BulkConfirm, bulkConfirmLabel, bulkConfirmWhy } from '../lib/confirmDay';
import { dateText, mdText } from '../lib/dateText';
import { attentionTarget, type LinkTarget } from '../lib/links';
import { type Attention, type DayStatus, type StaffMonth, shortName, type TypeCount } from '../lib/month';
import { hoursText, longDate } from '../lib/monthCell';
import { DAY_STATE_TEXT } from '../lib/monthList';
import { REQUESTED_OFF_NOTE } from '../lib/requestedOff';
import { changesText } from '../lib/settledView';

/**
 * その日の回の一覧（月のマスで Enter。PRD D340）：右の欄の先頭に、その日の回を1行ずつ（共通の VisitRow）。
 * 行を押すと訪問の詳細の欄、Shift／Ctrl＋クリック・Enter で選ぶ、キーで動かす（日・週と同じ）、ドラッグでほかの日のマスへ。
 * Esc（選んでいれば先に選択を外す）・×でマスへ戻る
 */
export function DayVisits({
  date,
  visits,
  rowOf,
  itemProps,
  isSelected,
  selected,
  onClearSelection,
  onOpenDay,
  onClose,
}: {
  date: string;
  visits: readonly Visit[];
  rowOf: (v: Visit) => VisitRowData;
  itemProps: (v: Visit) => Record<string, unknown>;
  isSelected: (id: string) => boolean;
  /** 選んでいる訪問の件数（Esc は先に選択を外す） */
  selected: number;
  onClearSelection: () => void;
  onOpenDay: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <section
      className="month-day-visits"
      aria-labelledby={titleId}
      data-testid="month-day-visits"
      data-date={date}
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        e.preventDefault();
        // 選んでいれば先に選択を外す（ほかの画面の Esc と同じ）。選んでいなければ一覧を閉じてマスへ
        if (selected > 0) onClearSelection();
        else onClose();
      }}
    >
      <div className="spread">
        <h2 id={titleId} className="month-aside-title" tabIndex={-1}>
          {longDate(date)}の訪問 {visits.length}件
        </h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="その日の訪問の一覧を閉じる"
          onClick={onClose}
          data-testid="month-day-visits-close"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {visits.length === 0 ? (
        <p className="sub">この日の訪問はありません。</p>
      ) : (
        <ul className="vrow-list month-day-rows">
          {visits.map((v) => (
            <li key={v.id}>
              <VisitRow
                row={rowOf(v)}
                selecting={false}
                selected={isSelected(v.id)}
                props={itemProps(v)}
                testId="month-visit"
              />
            </li>
          ))}
        </ul>
      )}
      <p className="sub month-day-visits-help">
        行を押すと訪問の詳細。Shift・Ctrl＋クリックで選び、↑↓ で15分・←→
        で1日動かせます。行を別の日のマスへドラッグするか、選んで下の「別の日へ」で日付を移せます（時刻はそのまま）。
      </p>
      <button type="button" className="btn btn-small" onClick={onOpenDay} data-testid="month-day-visits-plan">
        この日の日の予定を開く
      </button>
    </section>
  );
}

/** 確定していない日（今日以降。PRD D153）と、問題の無い日をまとめて確定（PRD D223） */
export function MonthUnconfirmed({
  unconfirmed,
  statuses,
  bulk,
  running,
  onConfirm,
  onOpenDay,
  onShowAttention,
}: {
  unconfirmed: readonly string[];
  statuses: ReadonlyMap<string, DayStatus>;
  bulk: BulkConfirm;
  /** 担当を組んでいる間は押せない */
  running: boolean;
  onConfirm: () => void;
  onOpenDay: (date: string) => void;
  onShowAttention: () => void;
}) {
  /** まとめて確定を押せない理由の文（aria-describedby） */
  const bulkWhyId = useId();
  return (
    <>
      <h2 className="month-aside-title">
        <Lock size={18} aria-hidden="true" />
        確定していない日
      </h2>
      {unconfirmed.length > 0 && (
        <div className="month-confirm-bulk">
          <button
            type="button"
            className="btn"
            disabled={running || bulk.targets.length === 0}
            aria-describedby={bulk.targets.length === 0 ? bulkWhyId : undefined}
            onClick={onConfirm}
            data-testid="month-confirm-bulk"
            data-count={bulk.targets.length}
          >
            <WithIcon icon={Lock} size={14}>
              {bulkConfirmLabel(bulk.targets.length)}
            </WithIcon>
          </button>
          {bulk.targets.length === 0 ? (
            <p className="sub" id={bulkWhyId} data-testid="month-confirm-why">
              {bulkConfirmWhy(bulk)}
            </p>
          ) : (
            <p className="sub" data-testid="month-confirm-note">
              一度も確定していない日のうち、守れない条件が無く、要対応に出ていない日を確定します。
            </p>
          )}
        </div>
      )}
      {unconfirmed.length === 0 ? (
        <p className="sub">今日以降で、確定していない日はありません。</p>
      ) : (
        <ul className="month-attention" data-testid="month-unconfirmed">
          {unconfirmed.map((d) => (
            <li key={d}>
              <button
                type="button"
                className="month-attention-btn"
                onClick={() => onOpenDay(d)}
                title="押すとその日の「日の予定」を開きます"
              >
                <span className="month-attention-date">{dateText(d)}</span>
                <span>{DAY_STATE_TEXT[statuses.get(d)?.state ?? 'none']}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-small" onClick={onShowAttention}>
        <WithIcon icon={ListChecks} size={14}>
          要対応を見る
        </WithIcon>
      </button>
    </>
  );
}

/** 要対応（今日以降。行き先を添える。PRD D201）。エキスパート機能が入のときだけ（切は出さない。PRD D410） */
export function MonthAttention({
  attention,
  features,
  spanLimitHours,
  onOpen,
}: {
  attention: readonly Attention[];
  features: Features;
  spanLimitHours: number;
  onOpen: (t: LinkTarget) => void;
}) {
  return (
    <>
      <h2 className="month-aside-title">
        <ListChecks size={18} aria-hidden="true" />
        <Term k="attention" />
      </h2>
      {attention.length === 0 ? (
        <p className="sub">
          今日以降で、要対応の訪問（担当なし・担当が休み・条件に合わない・時間に間に合わない）・未連絡の変更・出勤〜退勤（拘束）が上限を超える日はありません。
        </p>
      ) : (
        <ul className="month-attention" data-testid="month-attention">
          {attention.map((a) => {
            const t = attentionTarget(a, features);
            return (
              <li key={`${a.date}-${a.kind}`}>
                <button
                  type="button"
                  className={`month-attention-btn is-${a.kind}`}
                  onClick={() => onOpen(t)}
                  data-to={t.to}
                  data-date={a.date}
                  data-kind={a.kind}
                >
                  <span className="month-attention-date">{dateText(a.date)}</span>
                  <span>
                    {a.kind === 'care' && (
                      <WithIcon icon={CircleAlert} size={14}>
                        要対応 {a.count}件{a.names.length > 0 ? `（${a.names.join('・')}）` : ''}
                      </WithIcon>
                    )}
                    {a.kind === 'changed' && (
                      <WithIcon icon={PencilLine} size={14}>
                        {changesText(a.count, true)}
                      </WithIcon>
                    )}
                    {a.kind === 'overSpan' && (
                      <WithIcon icon={Timer} size={14}>
                        出勤〜退勤（拘束）が{spanLimitHours}時間を超える {a.names.map(shortName).join('・')}
                      </WithIcon>
                    )}
                    {/* 行き先を添える（PRD D201） */}
                    <small className="month-attention-go">{t.note}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/** 選んだ〈スタッフ〉の月のまとめ（PRD D55）：資格・最終勤務日・担当・稼働時間・移動・希望休・欠勤・種類ごとの件数 */
export function MonthStaffSum({
  id,
  staff,
  name,
  monthNo,
  sum,
  typeById,
}: {
  id: string;
  staff: Staff | undefined;
  name: string;
  monthNo: number;
  sum: StaffMonth;
  typeById: ReadonlyMap<string, VisitType>;
}) {
  return (
    <>
      <h2 className="month-aside-title">
        <StaffMark staff={staff} size="md" />
        {/* 名前を押すと詳細の吹き出し（PRD D122・D123） */}
        <span>
          <PersonButton kind="staff" id={id} name={name} testId="month-aside-name" />
          さん・{monthNo}月
        </span>
      </h2>
      {sum.qualifications.length > 0 && (
        <div className="month-quals">
          <span className="sub">資格</span>
          {sum.qualifications.map((q) => (
            <span key={q} className="chip">
              {q}
            </span>
          ))}
        </div>
      )}
      <dl className="month-facts" data-testid="month-staff-sum">
        {staff?.lastDay && (
          <>
            <dt>最終勤務日</dt>
            <dd data-testid="month-staff-lastday">{mdText(staff?.lastDay ?? '')}（翌日から勤務なし）</dd>
          </>
        )}
        <dt>担当</dt>
        <dd>{sum.count}件</dd>
        <dt>稼働時間</dt>
        <dd>
          {hoursText(sum.minutes)}（{sum.workDays}日）
        </dd>
        <dt>移動</dt>
        <dd>{sum.travel}分</dd>
        {sum.requestedDays > 0 && (
          <>
            <dt>{REQUESTED_OFF_NOTE}</dt>
            <dd>{sum.requestedDays}日</dd>
          </>
        )}
        {sum.absenceDays > 0 && (
          <>
            <dt>欠勤</dt>
            <dd>{sum.absenceDays}日</dd>
          </>
        )}
      </dl>
      <TypeList types={sum.types} typeById={typeById} />
      <p className="sub">数えるのはその日の今の担当です。</p>
    </>
  );
}

/** 種類ごとの件数（色の丸と名前と件数） */
function TypeList({ types, typeById }: { types: readonly TypeCount[]; typeById: ReadonlyMap<string, VisitType> }) {
  if (types.length === 0) return null;
  return (
    <ul className="month-types" aria-label="種類ごとの件数">
      {types.map((x) => {
        const t = x.typeId === null ? undefined : typeById.get(x.typeId);
        return (
          <li key={x.typeId ?? '__none'}>
            <span
              className="month-type-dot"
              style={{ background: t ? colorOf(t.color) : '#cfc4bb' }}
              aria-hidden="true"
            />
            <span>{t?.name ?? '種類なし'}</span>
            <span>{x.count}件</span>
          </li>
        );
      })}
    </ul>
  );
}

/** 選んだ〈利用者さん〉（回・休み・集計は〈利用者さん〉の画面の予定（月）で見て直す。PRD D311。重ねて持たない） */
export function MonthClientSum({
  client,
  dotClient,
  name,
  monthNo,
  ym,
  clientTerm,
}: {
  client: Client;
  /** 印の色の〈利用者さん〉（稼働している人から引く） */
  dotClient: Client | undefined;
  name: string;
  monthNo: number;
  ym: string;
  clientTerm: string;
}) {
  return (
    <>
      <h2 className="month-aside-title">
        <ClientDot client={dotClient} hidden />
        <span>
          <PersonButton kind="client" id={client.id} name={name} testId="month-aside-name" />・{monthNo}月
        </span>
      </h2>
      {/* 回・休み・集計は〈利用者さん〉の画面の予定（月）で見て直す（PRD D311。重ねて持たない） */}
      <p className="sub">マスの印は、この{clientTerm}の訪問のある日です。</p>
      <Link
        className="btn btn-small"
        to={`/clients/${encodeURIComponent(client.id)}?cal=month&d=${ym}-01`}
        data-testid="month-client-open"
      >
        <WithIcon icon={CalendarRange} size={14}>
          {client.displayName}の予定（{monthNo}月）を開く
        </WithIcon>
      </Link>
    </>
  );
}

/** スマホの下から出る欄（PRD D343）：その日の訪問をリストの行で。見る・取り消す・担当替えまで（ADR-0051 の決定5） */
export function MonthDaySheet({
  date,
  visits,
  days,
  rowOf,
  rowProps,
  selection,
  selecting,
  onSelecting,
  onClose,
  returnFocus,
  onOpenDay,
}: {
  date: string;
  visits: readonly Visit[];
  /** 表示している月の日付（選んだ訪問の帯がこの外へ移した訪問を数えない） */
  days: readonly string[];
  rowOf: (v: Visit) => VisitRowData;
  rowProps: (v: Visit) => Record<string, unknown>;
  selection: { ids: readonly string[]; has: (id: string) => boolean; clear: () => void };
  selecting: boolean;
  onSelecting: (on: boolean) => void;
  onClose: () => void;
  returnFocus: () => HTMLElement | null;
  onOpenDay: () => void;
}) {
  return (
    <SidePanel
      icon={CalendarDays}
      title={`${longDate(date)}の訪問 ${visits.length}件`}
      sheet
      onClose={onClose}
      returnFocus={returnFocus}
      footer={
        <button type="button" className="btn" onClick={onOpenDay} data-testid="month-day-visits-plan">
          この日の日の予定を開く
        </button>
      }
    >
      <div className="stack month-day-sheet" data-testid="month-day-sheet" data-date={date}>
        {visits.length === 0 ? (
          <p className="sub">この日の訪問はありません。</p>
        ) : (
          <>
            <div className="row month-day-sheet-tools">
              <SelectToggle selecting={selecting} onChange={onSelecting} testId="month-select" />
              <span className="sub">長押しでも選べます</span>
            </div>
            <ul className="vrow-list month-day-rows">
              {visits.map((v) => (
                <li key={v.id}>
                  <VisitRow
                    row={rowOf(v)}
                    selecting={selecting}
                    selected={selection.has(v.id)}
                    props={rowProps(v)}
                    testId="month-visit"
                  />
                </li>
              ))}
            </ul>
            <SelectionBar ids={selection.ids} onClear={selection.clear} dates={days} inline />
          </>
        )}
      </div>
    </SidePanel>
  );
}

import { Check, Lock, RefreshCw, Sparkles, TriangleAlert, X } from 'lucide-react';
import { ClientFilter } from '../components/ClientFilter';
import { ClientPicker } from '../components/ClientPicker';
import { DetailsFold } from '../components/DetailsFold';
import { PickChips } from '../components/PickChips';
import { StaffMark } from '../components/StaffMark';
import { Hint, WithIcon } from '../components/ui';
import { useConfirmStep, useExceptionsOnly } from '../components/useFeature';
import type { InsertNoticeFlow } from '../components/useInsertNotice';
import { TypeDot } from '../components/visitType';
import type { Terms } from '../contracts/documents';
import { WEEK_TABLE_FILTER } from '../lib/clientFilter';
import { mdText } from '../lib/dateText';
import { weekHeading } from '../lib/detailsHeading';
import { foldedParts, showUnfitLegend } from '../lib/exceptionView';
import { TIMELINE_CLIENT_MAX } from '../lib/timelineClients';
import { SNAP_MINUTES, staffWithQualification } from '../lib/week';
import { type WeekPrep, weekStatusText } from '../lib/weekPrep';
import { allowedStaffText, timelineClientMaxText } from '../lib/weekScreen';
import { WEEK_VIEWS, type WeekView, weekViewLabel } from '../lib/weekView';
import type { WeekClients } from './useWeekClients';
import type { WeekModel } from './useWeekModel';
import type { WeekNav } from './useWeekNav';
import type { WeekPrepFlow } from './useWeekPrep';

// 週の予定（pages/WeekPage.tsx）の上の区画の部品：ナビの行の主ボタン・1行の状態・表示の切り替えと選ぶ欄・動かしたあとの知らせ

/** 表示の切り替えのボタンの data-testid（今までの e2e の名前を引き継ぐ：時間軸の見る人は by-*、表は tab-*） */
const VIEW_TEST_ID: Record<WeekView, string> = {
  'timeline-staff': 'by-staff',
  'timeline-client': 'by-client',
  table: 'tab-table',
  clients: 'tab-clients',
};

/**
 * ナビの行の右（PRD D328・D346）：この週の主ボタン（確定 → 済み）。担当ごとの週の予定をメールで送るのは「その他 ▾」（PRD D93・D402）
 */
export function WeekNavActions({ flow }: { flow: Pick<WeekPrepFlow, 'next' | 'nextRef' | 'whyId' | 'confirmWeek'> }) {
  const { next, nextRef, whyId } = flow;
  return (
    <>
      {next.kind !== 'none' && (
        <div className="week-next" ref={nextRef} tabIndex={-1} data-testid="week-next" data-kind={next.kind}>
          {next.kind === 'confirm' ? (
            <button
              type="button"
              className="btn btn-primary"
              aria-disabled={next.why !== null || undefined}
              aria-describedby={next.why ? whyId : undefined}
              onClick={() => {
                if (next.why !== null) return;
                void flow.confirmWeek();
              }}
              data-testid="week-next-btn"
            >
              <WithIcon icon={Lock}>
                <span className="week-next-long">{next.label}</span>
                <span className="week-next-short">{next.short}</span>
              </WithIcon>
            </button>
          ) : (
            <span
              className={`week-next-status${next.kind === 'done' ? ' is-done' : ''}`}
              data-testid="week-next-status"
            >
              {next.kind === 'done' && <Check size={14} strokeWidth={3} aria-hidden="true" />}
              {next.label}
            </span>
          )}
          {next.why && (
            <span className="sub week-next-why" id={whyId} data-testid="week-next-why">
              {next.why}
            </span>
          )}
        </div>
      )}
    </>
  );
}

/** 1行の状態（PRD D332。進み具合の帯は月の予定だけ）。今日以降に訪問の無い週は出さない */
function WeekStatusLine({ prep }: { prep: WeekPrep }) {
  const confirmStep = useConfirmStep();
  if (prep.futureDays === 0) return null;
  return (
    <p className="week-status sub" data-testid="week-status">
      この週の今日以降：{weekStatusText(prep.line, confirmStep)}
    </p>
  );
}

/**
 * 「詳しく」（入切とも。畳んでおく。開け閉めは端末に覚える。PRD D384・D393）：この週の1行の状態・時間軸の凡例と使い方。
 * 入は見出しの1行に「未確定 N日・要対応 M件」を出す
 */
export function WeekDetails({
  prep,
  model,
  by,
  tab,
}: {
  prep: WeekPrep;
  model: WeekModel;
  by: WeekNav['by'];
  tab: WeekNav['tab'];
}) {
  const only = useExceptionsOnly();
  const confirmStep = useConfirmStep();
  const parts = foldedParts('week', only, { status: prep.futureDays > 0, legend: tab === 'timeline' });
  if (parts.length === 0) return null;
  return (
    <DetailsFold
      testId="week-details"
      screen="week"
      heading={only ? undefined : weekHeading(prep.futureDays, prep.line, confirmStep)}
    >
      {parts.includes('status') && <WeekStatusLine prep={prep} />}
      {parts.includes('legend') && <TimelineTools model={model} by={by} />}
    </DetailsFold>
  );
}

/** 時間軸の凡例と使い方 */
function TimelineTools({ model, by }: { model: WeekModel; by: WeekNav['by'] }) {
  const { data, terms } = model;
  const unfit = showUnfitLegend(useExceptionsOnly());
  return (
    <div className="row week-tools">
      <span className="row week-legend">
        {data.visitTypes.map((t) => (
          <span key={t.id} className="row week-legend-item">
            <TypeDot type={t} />
            {t.name}
          </span>
        ))}
        <span className="row week-legend-item">
          <span className="week-legend-dash is-unassigned" aria-hidden="true" />
          担当なし（要対応）
        </span>
        {unfit && (
          <>
            <span className="row week-legend-item">
              <span className="week-legend-unfit" aria-hidden="true">
                資格✗
              </span>
              担当が種類の必要条件を満たさない
            </span>
            <span className="row week-legend-item">
              <span className="week-legend-unfit" aria-hidden="true">
                限✗
              </span>
              担当が担当できる人に入っていない
            </span>
          </>
        )}
      </span>
      <Hint>
        <ul className="hint-list">
          <li>帯の中の色は種類、縁の色は{by === 'staff' ? `担当の${terms.staff}` : terms.client}です。</li>
          <li>帯を押すと訪問の詳細の欄が開き、日時・担当・取り消しを変えられます。</li>
          <li>
            帯をドラッグすると、別の日・時刻へ動かせます（{SNAP_MINUTES}
            分刻み）。落とす先に、空き時間に入れられる人の数が出ます。
          </li>
          <li>定期パターンの訪問は、「この回だけ」「これ以降」「すべて」を選べます。</li>
        </ul>
      </Hint>
    </div>
  );
}

/** 時間軸の〈スタッフ〉のチップと、資格で選ぶチップ */
function StaffPick({
  model,
  nav,
  allowedNow,
}: {
  model: WeekModel;
  nav: WeekNav;
  allowedNow: ReadonlySet<string> | null;
}) {
  const { data, terms, activeStaff, badgesOf, qualItem } = model;
  return (
    <>
      <PickChips
        label={terms.staff}
        people={activeStaff.map((s) => ({
          id: s.id,
          name: s.name,
          mark: <StaffMark staff={s} size="xs" />,
          badges: badgesOf.get(s.id),
        }))}
        selected={nav.staffSel}
        onChange={(ids) => nav.setSel('staff', ids)}
        highlight={allowedNow}
        detailKind="staff"
        testId="staff-chips"
      />
      {qualItem && qualItem.options.length > 0 && (
        <fieldset className="pick-chips week-quals" data-testid="qual-chips">
          <legend className="pick-chips-legend">{qualItem.name}で選ぶ</legend>
          {qualItem.options.map((o) => {
            const ids = staffWithQualification(data.items, activeStaff, o);
            return (
              <button
                key={o}
                type="button"
                className="pick-chip week-qual"
                onClick={() => nav.setSel('staff', ids)}
                disabled={ids.length === 0}
                title={`${o}を持つ${terms.staff}を選ぶ（${ids.length}人）`}
                data-testid="qual-chip"
              >
                {o}
                <span className="sub">{ids.length}人</span>
              </button>
            );
          })}
        </fieldset>
      )}
    </>
  );
}

/**
 * 時間軸の〈利用者さん〉（PRD D136〜D138）：この週に訪問がある人のチップ（〈スタッフ〉で見るときと同じ見た目・操作・i）。
 * ドラッグ中に高さを変えない：チップ・上限の文はドラッグで変わらない（変えるのは押したときだけ）。「ほかの人を探す」の
 * 検索欄は畳んでおき、候補の欄は浮かせて出す（帯を押すと検索欄からフォーカスが外れて閉じる）
 */
function ClientPick({ people, terms, model }: { people: WeekClients; terms: Terms; model: WeekModel }) {
  return (
    <>
      <PickChips
        label={`表示する${terms.client}（${TIMELINE_CLIENT_MAX}人まで）`}
        people={people.chipPeople}
        selected={people.timelineClients}
        onChange={people.onClientChips}
        bulk={false}
        detailKind="client"
        fold={{ rows: 2, open: people.chipsOpen, onOpenChange: people.setChipsOpen }}
        actions={
          <>
            <button
              type="button"
              className="btn btn-small"
              onClick={people.clearClients}
              disabled={people.pickedClients.length === 0}
              data-testid="week-client-chips-none"
            >
              全部外す
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={people.resetClients}
              disabled={people.resetDisabled}
              data-testid="week-client-chips-reset"
            >
              先頭{TIMELINE_CLIENT_MAX}人に戻す
            </button>
          </>
        }
        testId="week-client-chips"
      />
      <output className="week-client-message" data-testid="week-client-chips-message">
        {people.chipMessage}
      </output>
      <details className="week-client-search" data-testid="week-client-search">
        <summary>ほかの人を探す</summary>
        <ClientPicker
          clients={people.weekClients}
          selected={people.pickedClients}
          onChange={people.setTimelineClients}
          multiple
          max={TIMELINE_CLIENT_MAX}
          maxMessage={timelineClientMaxText(terms.client)}
          label={`${terms.client}を名前・よみで探す（この週に訪問の無い人も）`}
          byStaff={{ staffLabel: terms.staff, staff: model.activeStaff, clientIdsOf: people.clientsOfStaff }}
          showChips={false}
          testId="week-client-picker"
        />
      </details>
    </>
  );
}

/** 上の欄：表示の切り替え（PRD D188）と、表示ごとの選ぶ欄・絞り込み・ドラッグ中の担当できる人 */
export function WeekHead({
  model,
  nav,
  people,
  allowedNow,
}: {
  model: WeekModel;
  nav: WeekNav;
  people: WeekClients;
  allowedNow: ReadonlySet<string> | null;
}) {
  const { data, terms, clients, activeStaff } = model;
  const { tab, by, view } = nav;
  const clientTimeline = tab === 'timeline' && by === 'client';
  return (
    <div className="card stack week-head">
      <div className="row week-nav">
        <fieldset className="segmented week-views" aria-label="表示" data-testid="week-views">
          {WEEK_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              className={view === v ? 'is-on' : ''}
              aria-pressed={view === v}
              onClick={() => people.goView(v)}
              data-testid={VIEW_TEST_ID[v]}
            >
              {weekViewLabel(v, terms)}
            </button>
          ))}
        </fieldset>
      </div>
      {tab === 'timeline' && by === 'staff' && <StaffPick model={model} nav={nav} allowedNow={allowedNow} />}
      {clientTimeline && <ClientPick people={people} terms={terms} model={model} />}
      {/* 〈利用者さん〉×曜日の表の絞り込み（PRD D108〜D112。変わるのは押したときだけで、ドラッグ中に高さを変えない） */}
      {tab === 'clients' && (
        <ClientFilter
          clients={clients}
          state={people.tableFilter}
          onChange={people.setTableFilter}
          facts={people.facts}
          staff={activeStaff}
          terms={{ client: terms.client, staff: terms.staff }}
          periodLabel="この週"
          defaults={WEEK_TABLE_FILTER}
          visitTypes={data.visitTypes}
          testId="week-client-filter"
        />
      )}
      {clientTimeline && people.pickedClients.length > TIMELINE_CLIENT_MAX && (
        <p className="sub" data-testid="week-client-over">
          {timelineClientMaxText(terms.client)}。選んだ{people.pickedClients.length}人のうち先頭の{TIMELINE_CLIENT_MAX}
          人を出しています
        </p>
      )}
      {/* 行はいつも出しておく（ドラッグの始まりに行を足すと時間軸が下へずれ、つかんだ帯が指の下から動く） */}
      {clientTimeline && (
        <p className={`week-allowed${allowedNow ? '' : ' is-idle'}`} data-testid="week-allowed">
          {allowedStaffText(allowedNow, activeStaff, terms.staff)}
        </p>
      )}
    </div>
  );
}

/** 動かしたあとの「空き時間に入れる」の知らせ（担当なしで動かしたとき） */
export function WeekNotice({ flow, onOpenDay }: { flow: InsertNoticeFlow; onOpenDay: (d: string) => void }) {
  const { notice } = flow;
  if (!notice) return null;
  return (
    <output className="card stack week-notice" data-testid="week-notice">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span>
          <WithIcon icon={TriangleAlert} size={16}>
            {notice.label} へ動かしました。担当なしです
          </WithIcon>
        </span>
        <button type="button" className="icon-btn" aria-label="知らせを閉じる" onClick={flow.clear}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {notice.error && <p className="warn-text">{notice.error}</p>}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={flow.insert} disabled={!!notice.error}>
          <WithIcon icon={Sparkles}>{mdText(notice.date)} の空き時間に入れる</WithIcon>
        </button>
        <button type="button" className="btn" onClick={() => onOpenDay(notice.date)}>
          <WithIcon icon={RefreshCw}>その日を開く</WithIcon>
        </button>
      </div>
    </output>
  );
}

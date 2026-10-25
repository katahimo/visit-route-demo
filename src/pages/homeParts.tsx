// ホームの部品：次の一手のカード・いつでも使う入口のカード・今日の訪問の欄・「訪問を追加」（PRD D141〜D145・D263・D304）
import {
  CalendarCheck,
  CalendarDays,
  CalendarSearch,
  ChevronRight,
  CircleAlert,
  House,
  Lock,
  type LucideIcon,
  Plus,
  Sparkles,
  UserRound,
  UserX,
} from 'lucide-react';
import { useId, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { StaffMarkById } from '../components/StaffMark';
import { useOpenVisit } from '../components/VisitPanel';
import { addDays, jstHhmm } from '../domain/time';
import { dateText } from '../lib/dateText';
import type { HomeEntry, HomeEntryKey, HomeTask, HomeTaskKind } from '../lib/home';
import { dayVisitRows, unassignedVisits, type VisitRow } from '../lib/visitLists';
import { useDemoData } from '../store';

const KIND_ICON: Record<HomeTaskKind, LucideIcon> = {
  standard: CalendarCheck,
  attention: CircleAlert,
  today: CalendarDays,
  confirm: Lock,
  create: Sparkles,
};

const ENTRY_ICON: Record<HomeEntryKey, LucideIcon> = {
  absence: UserX,
  vacancy: CalendarSearch,
  clients: House,
  staff: UserRound,
};

/** 押したボタンへフォーカスを戻す（訪問の詳細の欄を閉じたとき。ボタンが消えていれば戻さない） */
const backTo = (btn: HTMLElement) => () => (btn.isConnected ? btn : null);

/**
 * 次の一手のカード（全体が1つのリンク）。lead は先頭の「まずこれ」（主ボタンの塗りで幅いっぱい。ホームの主ボタンはこの1つ。
 * PRD D263）。「まずこれ」は見える札で、読み上げでも題名の前に読む
 */
export function TaskCard({ task: t, lead, onPick }: { task: HomeTask; lead: boolean; onPick: () => void }) {
  const Icon = KIND_ICON[t.kind];
  return (
    <Link
      to={t.to}
      className={`card home-task is-${t.tone}${lead ? ' is-lead' : ''}`}
      onClick={onPick}
      data-testid="home-task"
      data-kind={t.kind}
      data-tone={t.tone}
      data-lead={lead || undefined}
    >
      <span className="home-task-icon" aria-hidden="true">
        <Icon size={lead ? 24 : 20} strokeWidth={2.2} />
      </span>
      <span className="home-task-text">
        {lead && (
          <span className="home-lead-badges">
            <span className="home-lead-badge" data-testid="home-lead">
              まずこれ
            </span>
            {/* 要対応が先頭のときは要対応の印（赤）を残す（塗りの中でも色と文字で分かる） */}
            {t.tone === 'warn' && (
              <span className="home-lead-badge is-warn" data-testid="home-lead-warn">
                要対応
              </span>
            )}
          </span>
        )}
        <strong>{t.title}</strong>
        {t.detail && <span className="sub">{t.detail}</span>}
      </span>
      <ChevronRight size={18} className="home-task-go" aria-hidden="true" />
    </Link>
  );
}

/** いつでも使う入口のカード。first は先頭に置く当日の入口（欠勤・キャンセル。アイコンだけ朱） */
export function EntryCard({
  entry,
  onPick,
  first = false,
}: {
  entry: HomeEntry;
  onPick?: () => void;
  first?: boolean;
}) {
  const Icon = ENTRY_ICON[entry.key];
  return (
    <Link
      to={entry.to}
      className={`card home-task is-entry${first ? ' is-first' : ''}`}
      onClick={onPick}
      data-testid={`home-${entry.key}`}
    >
      <span className="home-task-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={2.2} />
      </span>
      <span className="home-task-text">
        <strong>{entry.title}</strong>
        <span className="sub">{entry.detail}</span>
      </span>
      <ChevronRight size={18} className="home-task-go" aria-hidden="true" />
    </Link>
  );
}

/** いつでも：1回だけの訪問を足す（訪問の詳細の欄を今日の日付で開く） */
export function AddVisitItem({ today }: { today: string }) {
  const openVisit = useOpenVisit();
  return (
    <li>
      <button
        type="button"
        className="card home-task is-entry"
        onClick={(e) => openVisit({ newVisit: { date: today }, returnFocus: backTo(e.currentTarget) })}
        data-testid="home-visit-add"
      >
        <span className="home-task-icon" aria-hidden="true">
          <Plus size={20} strokeWidth={2.2} />
        </span>
        <span className="home-task-text">
          <strong>訪問を追加</strong>
          <span className="sub">1回だけの訪問を足して、担当の候補から選ぶ</span>
        </span>
        <ChevronRight size={18} className="home-task-go" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * 今日の訪問の欄（PRD D304）：今日の訪問・これからの入らない訪問（5件まで）から1件ずつ詳細の欄を開く。
 * onPickToday は日の予定へ移る前に選んでいる日付を今日にする
 */
export function HomeVisits({ today, onPickToday }: { today: string; onPickToday: () => void }) {
  const { data } = useDemoData();
  const openVisit = useOpenVisit();
  const visitsId = useId();
  const nowHm = jstHhmm(Date.now());
  const todayRows = useMemo(() => dayVisitRows(data, today, nowHm), [data, today, nowHm]);
  const laterUnassigned = useMemo(() => unassignedVisits(data, addDays(today, 1), addDays(today, 31)), [data, today]);
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.displayName ?? '（不明）';
  const staffName = (id: string) => data.staff.find((s) => s.id === id)?.name ?? '（不明）';
  const openRow = (e: { currentTarget: HTMLElement }, visitId: string) =>
    openVisit({ visitId, returnFocus: backTo(e.currentTarget) });
  const rowText = (r: VisitRow) => (r.mark === 'unassigned' ? '担当なし' : staffName(r.staffId ?? ''));
  return (
    <section className="stack" aria-labelledby={visitsId} style={{ gap: 10 }} data-testid="home-visits">
      <h2 id={visitsId} className="home-section-title">
        今日の訪問
      </h2>
      {todayRows.rows.length === 0 ? (
        <p className="sub">今日の訪問はありません。</p>
      ) : (
        <ul className="home-visits">
          {todayRows.rows.map((r) => (
            <li key={r.visit.id}>
              <button
                type="button"
                className={`home-visit${r.mark ? ' is-warn' : ''}`}
                onClick={(e) => openRow(e, r.visit.id)}
                data-testid="home-visit"
                data-visit={r.visit.id}
              >
                <span className="home-visit-time">{r.visit.earliestStart}</span>
                <span className="home-visit-name">{clientName(r.visit.clientId)}</span>
                <span className="home-visit-staff sub">
                  {r.staffId && <StaffMarkById id={r.staffId} size="xs" />}
                  {rowText(r)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {todayRows.rest > 0 && (
        <Link to="/plan" onClick={onPickToday} className="sub" data-testid="home-visits-rest">
          あと {todayRows.rest}件（日の予定で見る）
        </Link>
      )}
      {laterUnassigned.length > 0 && (
        <>
          <h3 className="home-section-sub">これからの入らない訪問（要対応）</h3>
          <ul className="home-visits" data-testid="home-unassigned">
            {laterUnassigned.slice(0, 5).map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="home-visit is-warn"
                  onClick={(e) => openRow(e, v.id)}
                  data-testid="home-unassigned-visit"
                  data-visit={v.id}
                >
                  <span className="home-visit-time">
                    {dateText(v.date)} {v.earliestStart}
                  </span>
                  <span className="home-visit-name">{clientName(v.clientId)}</span>
                  <span className="home-visit-staff sub">担当なし</span>
                </button>
              </li>
            ))}
          </ul>
          {laterUnassigned.length > 5 && (
            <p className="sub">ほか {laterUnassigned.length - 5}件（月の予定の要対応で）</p>
          )}
        </>
      )}
    </section>
  );
}

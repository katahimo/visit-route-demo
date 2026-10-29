import { CircleCheck, ListTodo } from 'lucide-react';
import { useId } from 'react';
import { useDay } from '../components/day';
import { PageHeader } from '../components/ui';
import { COMPACT_QUERY, NARROW_QUERY, useMedia } from '../components/useMedia';
import { jstDate } from '../domain/time';
import { dateText } from '../lib/dateText';
import { useDemoData } from '../store';
import './home.css';
import { AddVisitItem, EntryCard, HomeVisits, TaskCard } from './homeParts';
import { useHomeTasks } from './useHomeTasks';

/**
 * ホーム「今日やること」（PRD D141〜D145・D263。ADR-0025・0044）：起動したときの画面。今の状態から次の一手を作業の順に
 * カードで並べ（lib/home の homeTasks）、先頭の1枚を「まずこれ」と大きく見せる。押すとその操作のある画面へ移る。下に、いつでも使う入口（欠勤・問い合わせ・探す）。
 * 狭い画面（スマホ）では欠勤・キャンセルの入口を「いつでも」から外し、ホームの先頭に常に置く（PRD D247）。
 * 日の状態は月の画面と同じ数え方（lib/useDayStatuses）。データは書き換えない
 */
export default function HomePage() {
  const today = jstDate(Date.now());
  const { setDate } = useDay();
  const { data } = useDemoData();
  const { tasks, ready, entries } = useHomeTasks(data, today);
  // スマホでは欠勤・キャンセルを先頭へ（当日の朝に開いてすぐ押せる。切った機能なら出さない）
  const narrow = useMedia(NARROW_QUERY);
  const topEntry = narrow ? entries.find((e) => e.key === 'absence') : undefined;
  const anytime = topEntry ? entries.filter((e) => e !== topEntry) : entries;

  const nextId = useId();
  const anytimeId = useId();
  // スマホの幅では「訪問を追加」を出さない
  const compact = useMedia(COMPACT_QUERY);
  /** 日の画面へ移るものは、移る前に選んでいる日付をその日にする */
  const pickDate = (d?: string) => {
    if (d) setDate(d);
  };

  return (
    <div className="stack home-page">
      <PageHeader
        icon={ListTodo}
        title="ホーム"
        lead={`今日やること：${dateText(today)}の状態から、次にすることを並べています`}
      />

      {topEntry && (
        <div className="home-quick" data-testid="home-quick">
          <EntryCard entry={topEntry} onPick={() => pickDate(topEntry.date)} first />
        </div>
      )}

      <section className="stack" aria-labelledby={nextId} style={{ gap: 10 }}>
        <h2 id={nextId} className="home-section-title">
          次にすること
        </h2>
        {ready && (
          <p className="card home-ready" data-testid="home-ready">
            <CircleCheck size={22} aria-hidden="true" />
            <strong>今日の準備はできています</strong>
          </p>
        )}
        <ul className="home-tasks" data-testid="home-tasks">
          {tasks.map((t, i) => {
            // 先頭の1枚は「まずこれ」（幅いっぱい・主ボタンの塗り。PRD D263）。知らせだけ（準備ができている）なら強めない
            const lead = i === 0 && t.tone !== 'info';
            return (
              <li key={`${t.kind}-${t.title}`} className={lead ? 'is-lead' : undefined}>
                <TaskCard task={t} lead={lead} today={today} onPick={pickDate} />
              </li>
            );
          })}
        </ul>
      </section>

      <HomeVisits today={today} onPickToday={() => pickDate(today)} />

      <section className="stack" aria-labelledby={anytimeId} style={{ gap: 10 }}>
        <h2 id={anytimeId} className="home-section-title">
          いつでも
        </h2>
        {/* 切った機能の入口（欠勤・キャンセル・問い合わせ）は出さない（PRD D213。並びと文は lib/home の homeEntries） */}
        <ul className="home-tasks home-anytime" data-testid="home-anytime">
          {anytime.map((e) => (
            <li key={e.key}>
              <EntryCard entry={e} onPick={() => pickDate(e.date)} />
            </li>
          ))}
          {!compact && data.clients.length > 0 && <AddVisitItem today={today} />}
        </ul>
      </section>
    </div>
  );
}

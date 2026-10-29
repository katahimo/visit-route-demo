// 組み方の標準の画面の「1. 案をくらべる」の中の「日で見る」（PRD D350。ADR-0065）：表だけでは判断しにくいので、
// 期間の日を選び、案のその日を今日の予定と同じ見せ方（担当ごとの時間軸と地図。components/choiceBand の ChoiceDayView）で見る。
// タブは今の標準（同じ日の計算した回を今の標準の担当・開始のまま並べたもの。標準を登録する前は出さない）と案ごと。読み取り専用で、［この案から作る］はカードと同じ
import { CalendarSearch } from 'lucide-react';
import { ChoiceDayView } from '../components/choiceBand';
import { WithIcon } from '../components/ui';
import { dateText } from '../lib/dateText';
import type { StandardDayViewState } from './useStandardDayView';

export function StandardDayView({
  day,
  stale,
  onUse,
}: {
  day: StandardDayViewState;
  /** 案を作ったあとに繰り返しが変わった（日で見るは案を作ったときの標準・訪問のまま） */
  stale: boolean;
  /** ［この案から作る］（カードと同じ） */
  onUse: (presetId: string) => void;
}) {
  const { ref, dates, date, input, visits, tab, setDate, setTab } = day;
  if (dates.length === 0 || !date) return null;
  return (
    <section ref={ref} className="stack standard-day-view" aria-label="日で見る" data-testid="standard-day-view">
      <h3 className="standard-view-title">
        <WithIcon icon={CalendarSearch} size={16}>
          日で見る
        </WithIcon>
      </h3>
      <p className="sub" data-testid="standard-day-lead">
        {input && input.current === null
          ? '日を選び、案のその日を今日の予定と同じ時間軸と地図で見ます。標準はまだ登録していないので、案どうしをくらべます（読み取り専用）'
          : '日を選び、案のその日を今日の予定と同じ時間軸と地図で見ます。「今の標準」は同じ日を今の標準の担当・時刻のまま並べたものです（読み取り専用）'}
      </p>
      {stale && (
        <p className="sub warn" data-testid="standard-day-stale">
          案を作ったときの標準・繰り返しで見ています。今の標準とくらべるには案を作り直してください
        </p>
      )}
      <div className="standard-day-tabs" role="tablist" aria-label="日付" data-testid="standard-day-tabs">
        {dates.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === date}
            className={`btn btn-small${d === date ? ' is-on' : ''}`}
            onClick={() => setDate(d)}
            data-date={d}
          >
            {dateText(d)}
          </button>
        ))}
      </div>
      {input ? (
        <ChoiceDayView
          key={date}
          input={input}
          visits={visits}
          tab={tab}
          onTab={setTab}
          currentLabel="今の標準"
          action={(c) => (
            <button
              type="button"
              className="btn btn-small"
              onClick={() => onUse(c.presetId)}
              disabled={stale}
              title={stale ? '案を作り直すと選べます' : undefined}
              data-testid="standard-day-use"
            >
              この案から作る
            </button>
          )}
        />
      ) : (
        <p className="sub">この日の案はありません</p>
      )}
    </section>
  );
}

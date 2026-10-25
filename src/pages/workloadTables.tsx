// 勤務の見込みの画面の表（PRD D72・D202・D241。ADR-0015）：月の合計・〈スタッフ〉×日の拘束（横棒）・選んだ人の日ごと（時間軸の横棒）
import { Timer, TriangleAlert } from 'lucide-react';
import { EdgeScroll } from '../components/EdgeScroll';
import { StaffMark } from '../components/StaffMark';
import { StaffLegend } from '../components/staffBar';
import { Term } from '../components/Term';
import { SectionTitle, WithIcon } from '../components/ui';
import { SpanBar, SpanMini } from '../components/workBars';
import type { Staff } from '../contracts/documents';
import { weekday } from '../domain/time';
import { WEEKDAY_LABELS } from '../lib/common';
import { clockTime, dateText } from '../lib/dateText';
import { hmText, kmOf, type WorkDay, type WorkTotal } from '../lib/workload';
import { axisMarks, emptyStat, type PickedDay, spanNum, statTitle, sumWork } from '../lib/workloadView';

/** 月の合計の表 */
export function WorkloadTotals({
  rows,
  totals,
  pickedId,
  onPick,
  fareOn,
  limitHours,
}: {
  rows: Staff[];
  totals: ReadonlyMap<string, WorkTotal>;
  /** 下の日ごとの表に出している人 */
  pickedId: string | undefined;
  onPick: (staffId: string) => void;
  fareOn: boolean;
  limitHours: number;
}) {
  const sumOf = (pick: (t: WorkTotal) => number) => sumWork(totals, rows, pick);
  const overDays = sumOf((t) => t.overDays);
  return (
    <section className="card stack">
      <SectionTitle icon={Timer} aside={<span className="sub">予定からの見込み（実績ではありません）</span>}>
        月の合計
      </SectionTitle>
      <div className="table-scroll">
        <table className="work-table" data-testid="work-totals">
          <thead>
            <tr>
              <th scope="col">名前</th>
              <th scope="col" className="num">
                日数
              </th>
              <th scope="col" className="num">
                訪問
              </th>
              <th scope="col" className="num">
                {/* 同じ画面の2か所目から説明を付けない（PRD D241。上限の設定に付けている） */}
                <Term k="span" plain />
              </th>
              <th scope="col">一番長い日</th>
              <th scope="col" className="num">
                訪問の時間
              </th>
              <th scope="col" className="num">
                移動
              </th>
              <th scope="col" className="num">
                <Term k="wait" />
              </th>
              <th scope="col" className="num">
                自宅との行き帰り
              </th>
              <th scope="col" className="num">
                距離
              </th>
              {fareOn && (
                <th scope="col" className="num">
                  交通費
                </th>
              )}
              <th scope="col" className="num">
                上限超え
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const t = totals.get(s.id)!;
              return (
                <tr key={s.id}>
                  <th scope="row" className="work-name">
                    <span className="with-staff-mark">
                      <StaffMark staff={s} size="sm" />
                      <button
                        type="button"
                        className="link-btn"
                        aria-pressed={pickedId === s.id}
                        onClick={() => onPick(s.id)}
                        title="押すと下の日ごとの表に出します"
                      >
                        {s.name}
                      </button>
                    </span>
                  </th>
                  <td className="num">{t.days}日</td>
                  <td className="num">{t.count}件</td>
                  <td className="num">{hmText(t.span)}</td>
                  <td>
                    <span className="work-max">
                      <SpanMini
                        stat={{ ...emptyStat(s.id), span: t.maxSpan, over: t.overDays > 0 }}
                        limitHours={limitHours}
                      />
                      <span>{hmText(t.maxSpan)}</span>
                    </span>
                  </td>
                  <td className="num">{hmText(t.visit)}</td>
                  <td className="num">{hmText(t.travel)}</td>
                  <td className="num">{hmText(t.wait)}</td>
                  <td className="num">{hmText(t.home)}</td>
                  <td className="num">{kmOf(t.meters)}km</td>
                  {fareOn && <td className="num">{t.fareYen.toLocaleString()}円</td>}
                  <td className={`num${t.overDays > 0 ? ' warn-text' : ''}`}>
                    {t.overDays > 0 ? (
                      <WithIcon icon={TriangleAlert} size={13}>
                        {t.overDays}日
                      </WithIcon>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">合計</th>
              <td className="num">{sumOf((t) => t.days)}日</td>
              <td className="num">{sumOf((t) => t.count)}件</td>
              <td className="num">{hmText(sumOf((t) => t.span))}</td>
              <td />
              <td className="num">{hmText(sumOf((t) => t.visit))}</td>
              <td className="num">{hmText(sumOf((t) => t.travel))}</td>
              <td className="num">{hmText(sumOf((t) => t.wait))}</td>
              <td className="num">{hmText(sumOf((t) => t.home))}</td>
              <td className="num">{kmOf(sumOf((t) => t.meters))}km</td>
              {fareOn && <td className="num">{sumOf((t) => t.fareYen).toLocaleString()}円</td>}
              <td className="num">{overDays > 0 ? `${overDays}日` : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/** 〈スタッフ〉×日の拘束の表（マスを押すとその日の日の予定） */
export function WorkloadGrid({
  rows,
  days,
  staffTerm,
  limitHours,
  onOpenDay,
}: {
  rows: Staff[];
  days: WorkDay[];
  staffTerm: string;
  limitHours: number;
  onOpenDay: (date: string) => void;
}) {
  return (
    <section className="card stack">
      <SectionTitle
        icon={Timer}
        aside={
          <span className="sub">
            横棒は出勤〜退勤（拘束）の長さ（{12}時間で端まで。縦の線は上限）。上限を超える日は斜線と「!」
          </span>
        }
      >
        {staffTerm}×日の出勤〜退勤（拘束）
      </SectionTitle>
      <EdgeScroll className="table-scroll work-grid-scroll">
        <table className="work-grid" data-testid="work-grid">
          <thead>
            <tr>
              <th scope="col" className="work-grid-name">
                名前
              </th>
              {days.map((d) => (
                <th
                  key={d.date}
                  scope="col"
                  className={`work-grid-day${weekday(d.date) === 0 ? ' is-sun' : weekday(d.date) === 6 ? ' is-sat' : ''}`}
                >
                  {Number(d.date.slice(8, 10))}
                  <small>{WEEKDAY_LABELS[weekday(d.date)]}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <th scope="row" className="work-grid-name">
                  <span className="with-staff-mark">
                    <StaffMark staff={s} size="xs" />
                    {s.name}
                  </span>
                </th>
                {days.map((d) => {
                  const x = d.stats.find((y) => y.staffId === s.id);
                  return (
                    <td key={d.date} className={`work-cell${x?.over ? ' is-over' : ''}`}>
                      {x ? (
                        // 押すとその日の日の画面（PRD D202。名前の吹き出しは付けない：D124）
                        <button
                          type="button"
                          className="work-cell-in work-cell-btn"
                          title={statTitle(s.name, d.date, x)}
                          aria-label={`${spanNum(x)}${x.over ? '!' : ''}：${statTitle(s.name, d.date, x)}（日の予定で開く）`}
                          onClick={() => onOpenDay(d.date)}
                          data-date={d.date}
                        >
                          <span className="work-cell-num">
                            {spanNum(x)}
                            {x.over && (
                              <strong>
                                !<span className="sr-only">（上限を超える）</span>
                              </strong>
                            )}
                          </span>
                          <SpanMini stat={x} limitHours={limitHours} />
                        </button>
                      ) : (
                        <span className="sub">
                          <span aria-hidden="true">・</span>
                          <span className="sr-only">訪問なし</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </EdgeScroll>
      <p className="sub" data-testid="work-grid-note">
        数字は出勤〜退勤（拘束）の時間です。マスを押すと、その日の「日の予定」を開きます。くわしくは下の「日ごと」の表で見られます。
      </p>
    </section>
  );
}

/** 選んだ人の日ごとの表（時間軸の横棒。日付を押すとその日の日の予定） */
export function WorkloadDays({
  picked,
  rows,
  onPick,
  staffTerm,
  pickedDays,
  axis,
  fareOn,
  onOpenDay,
}: {
  picked: Staff;
  rows: Staff[];
  onPick: (staffId: string) => void;
  staffTerm: string;
  pickedDays: PickedDay[];
  axis: { start: number; end: number };
  fareOn: boolean;
  onOpenDay: (date: string) => void;
}) {
  return (
    <section className="card stack" data-testid="work-detail">
      <SectionTitle icon={Timer}>
        <span className="work-detail-title">
          日ごと：
          <select
            value={picked.id}
            onChange={(e) => onPick(e.target.value)}
            aria-label={`日ごとに見る${staffTerm}`}
            data-testid="work-staff"
          >
            {rows.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </span>
      </SectionTitle>
      <p className="row work-legend sub">
        <span>横棒は最初の訪問の開始〜最後の訪問の終わり（拘束）。</span>
        <StaffLegend states={['visit', 'travel', 'free']} labels={{ free: '空き時間（待ち。休憩に使える時間）' }} />
        <span>上限を超える日は太い枠と注意の印</span>
      </p>
      <div className="table-scroll">
        <table className="work-table work-days">
          <thead>
            <tr>
              <th scope="col">日付</th>
              <th scope="col" className="work-axis-head">
                <span className="work-axis" aria-hidden="true">
                  {axisMarks(axis).map((m) => (
                    <span key={m} style={{ left: `${((m - axis.start) / (axis.end - axis.start)) * 100}%` }}>
                      {m / 60}
                    </span>
                  ))}
                </span>
                <span className="sr-only">時間帯</span>
              </th>
              <th scope="col">始め〜終わり</th>
              <th scope="col" className="num">
                {/* 日ごとの表は月の合計の表と同じ語なので文字だけ（PRD D241） */}
                <Term k="span" plain />
              </th>
              <th scope="col" className="num">
                訪問
              </th>
              <th scope="col" className="num">
                移動
              </th>
              <th scope="col" className="num">
                <Term k="wait" plain />
              </th>
              <th scope="col" className="num">
                距離
              </th>
              {fareOn && (
                <th scope="col" className="num">
                  交通費
                </th>
              )}
              <th scope="col">確定</th>
            </tr>
          </thead>
          <tbody>
            {pickedDays.map(({ day, stat }) => (
              <tr key={day.date} className={stat.over ? 'is-over' : ''}>
                <th scope="row" className="nowrap">
                  {/* 日付から日の画面（PRD D202） */}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => onOpenDay(day.date)}
                    aria-label={`${dateText(day.date)}（日の予定で開く）`}
                    title="押すとその日の「日の予定」を開きます"
                    data-testid="work-day-open"
                    data-date={day.date}
                  >
                    {dateText(day.date)}
                  </button>
                </th>
                <td className="work-axis-cell">
                  <SpanBar stat={stat} range={axis} />
                </td>
                <td className="nowrap">
                  {clockTime(stat.start)}〜{clockTime(stat.end)}
                </td>
                <td className={`num${stat.over ? ' warn-text' : ''}`}>
                  {stat.over ? (
                    <WithIcon icon={TriangleAlert} size={13}>
                      {hmText(stat.span)}
                    </WithIcon>
                  ) : (
                    hmText(stat.span)
                  )}
                </td>
                <td className="num">
                  {hmText(stat.visit)}（{stat.count}件）
                </td>
                <td className="num">{hmText(stat.travel)}</td>
                <td className="num">{hmText(stat.wait)}</td>
                <td className="num">{kmOf(stat.meters)}km</td>
                {fareOn && <td className="num">{stat.fareYen.toLocaleString()}円</td>}
                <td className="sub">{day.source === 'confirmed' ? '確定' : '未確定'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

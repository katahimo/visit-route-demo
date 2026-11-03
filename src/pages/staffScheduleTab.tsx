// 〈スタッフ〉の画面の予定のタブ（PRD D308〜D310・D312。ADR-0015・ADR-0052）：その期間の勤務の見込み・欠勤と希望休・
// 担当の振り直しの入口と、担当している訪問のカレンダー（日の印は欠勤・希望休・勤務なし）
import { CalendarX, Timer, UserRoundCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PersonCalendar } from '../components/PersonCalendar';
import { DlRow } from '../components/personDetail';
import { WithIcon } from '../components/ui';
import { useFeatures } from '../components/useFeature';
import type { Staff } from '../contracts/documents';
import { availabilityOf } from '../domain/availability';
import { absenceText } from '../lib/absences';
import { dateText, mdText } from '../lib/dateText';
import { linkIfOn, suddenHref, workloadHref } from '../lib/links';
import { isRequestedOff, REQUESTED_OFF_NOTE } from '../lib/requestedOff';
import { hmText } from '../lib/workload';
import { ymOf } from '../lib/ym';
import { useDemoData } from '../store';
import type { StaffSchedule } from './useStaffSchedule';

export function StaffScheduleTab({
  s,
  today,
  schedule,
  offboardOn,
  onOffboard,
}: {
  /** 保存してある人 */
  s: Staff;
  today: string;
  schedule: StaffSchedule;
  offboardOn: boolean;
  /** 担当の振り直しの欄を開く */
  onOffboard: () => void;
}) {
  const { data } = useDemoData();
  const features = useFeatures();
  const id = s.id;
  const { calView, anchor, setCal, work, absences } = schedule;
  const workloadTo = linkIfOn(features, workloadHref(ymOf(anchor), id));
  const absenceOf = (d: string) => data.absences.find((a) => a.staffId === id && a.date === d);
  const dayNote = (d: string) => {
    const a = absenceOf(d);
    if (a)
      return (
        <span className="chip chip-warn pcal-chip" title={a.note || undefined}>
          {isRequestedOff(a) ? REQUESTED_OFF_NOTE : '欠勤'}
        </span>
      );
    const av = availabilityOf(
      s,
      d,
      data.availability.find((x) => x.staffId === id && x.date === d),
    );
    return av.slots.length === 0 ? <span className="chip pcal-chip">勤務なし</span> : null;
  };

  return (
    <div className="person-schedule" data-testid="person-schedule">
      <div className="person-schedule-side">
        <section className="card stack" data-testid="staff-work">
          <h2 className="person-subhead">
            <WithIcon icon={Timer} size={16}>
              この期間の勤務の見込み
            </WithIcon>
          </h2>
          {work ? (
            <dl>
              <DlRow term="訪問" value={`${work.count}件（${work.days}日）`} />
              <DlRow term="拘束" value={`${hmText(work.span)}（いちばん長い日 ${hmText(work.maxSpan)}）`} />
              <DlRow term="移動" value={hmText(work.travel)} />
              {work.overDays > 0 && <DlRow term="上限を超える日" value={`${work.overDays}日`} />}
            </dl>
          ) : (
            <span className="sub">この期間に担当する訪問はありません。</span>
          )}
          {workloadTo && (
            <Link to={workloadTo} className="btn btn-small btn-text" data-testid="to-workload">
              勤務の見込みで詳しく見る
            </Link>
          )}
        </section>
        <section className="card stack" data-testid="staff-absences">
          <h2 className="person-subhead">
            <WithIcon icon={CalendarX} size={16}>
              欠勤・{REQUESTED_OFF_NOTE}（これから60日）
            </WithIcon>
          </h2>
          {absences.length === 0 ? (
            <span className="sub">欠勤・{REQUESTED_OFF_NOTE}はありません</span>
          ) : (
            <ul className="person-list">
              {absences.map((a) => (
                <li key={a.id}>
                  <strong>{dateText(a.date)}</strong>{' '}
                  <span className="sub">
                    {isRequestedOff(a) ? REQUESTED_OFF_NOTE : `欠勤 ${absenceText(a)}`}
                    {a.note && !isRequestedOff(a) ? `・${a.note}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <span className="sub">
            急な欠勤は「欠勤・キャンセルを登録」、{REQUESTED_OFF_NOTE}は月の予定の「休みを追加」で入れます。
          </span>
          {linkIfOn(features, suddenHref(today, id)) && (
            <Link to={suddenHref(today, id)} className="btn btn-small btn-text" data-testid="to-sudden">
              今日の欠勤を登録する
            </Link>
          )}
        </section>
        {offboardOn && s.lastDay && (
          <section className="card stack">
            <span className="sub">最終勤務日 {mdText(s.lastDay)}</span>
            <button type="button" className="btn btn-small" onClick={onOffboard} data-testid="leaving-open">
              <WithIcon icon={UserRoundCog} size={14}>
                担当の振り直しを開く
              </WithIcon>
            </button>
          </section>
        )}
      </div>
      <div className="person-schedule-main card">
        <PersonCalendar kind="staff" personId={id} view={calView} anchor={anchor} onChange={setCal} dayNote={dayNote} />
      </div>
    </div>
  );
}

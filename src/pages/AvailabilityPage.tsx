import { Clock, Timer } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDay } from '../components/day';
import { PeopleTabs } from '../components/SettingsTabs';
import { PageHeader, WithIcon } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { byName } from '../lib/common';
import { useDemoData } from '../store';
import { AvailabilityLegend, AvailabilityPanel, AvailabilityTable } from './availabilityParts';
import { useAvailabilityEdit } from './useAvailabilityEdit';
import './schedule.css';

/**
 * 稼働時間帯のカレンダー（スタッフ×日。PoC本体 AvailabilityPage.tsx の簡易版：管理者のみ・データの中の日付だけ）。
 * 基本の曜日と時間が薄い字、日ごとに変えた日は色付き。セルを押すと下で直せる
 */
export default function AvailabilityPage() {
  const { data } = useDemoData();
  const { date: today, dates } = useDay();
  /** 欠勤・キャンセル（ADR-0028 の sudden）：切なら凡例で登録の場所（予定の画面）を案内しない（欠勤の印は事実なので出す） */
  const suddenOn = useFeature('sudden');
  const workloadOn = useFeature('workload');
  const terms = data.org.terms;
  const staff = useMemo(() => data.staff.filter((s) => s.active).sort(byName), [data.staff]);
  const overrides = useMemo(
    () => new Map(data.availability.map((a) => [`${a.staffId}_${a.date}`, a])),
    [data.availability],
  );
  /** 欠勤（ADR-0011）：セルに「欠勤」の印。登録・取り消しは予定の画面で */
  const absences = useMemo(() => new Map(data.absences.map((a) => [`${a.staffId}_${a.date}`, a])), [data.absences]);
  const edit = useAvailabilityEdit(staff, overrides, absences);
  const { picked, pickedStaff } = edit;

  return (
    <div className="stack">
      <PageHeader
        nav={<PeopleTabs />}
        icon={Clock}
        title="勤務時間（シフト）"
        lead={`${terms.staff}ごとの働ける時間`}
        actions={
          // 勤務の見込みはメニューから外し、ここ（と月の予定の「その他 ▾」）から開く（PRD D275。主ボタンにしない）
          workloadOn && (
            <Link className="btn" to={`/workload?ym=${today.slice(0, 7)}`} data-testid="avail-workload">
              <WithIcon icon={Timer}>勤務の見込み</WithIcon>
            </Link>
          )
        }
      />
      <div className="card stack">
        <AvailabilityLegend suddenOn={suddenOn} staffTerm={terms.staff} />
        <AvailabilityTable
          staff={staff}
          dates={dates}
          today={today}
          staffTerm={terms.staff}
          overrides={overrides}
          absences={absences}
          picked={picked}
          onPick={edit.pick}
        />
        {staff.length === 0 && <p className="sub">在籍中の{terms.staff}がいません。</p>}
      </div>

      {picked && pickedStaff && (
        <AvailabilityPanel
          staff={pickedStaff}
          picked={picked}
          override={edit.pickedOverride}
          absence={edit.pickedAbsence}
          retiredWhy={edit.retiredWhy}
          pickedWorks={edit.pickedWorks}
          absenceHref={edit.absenceHref}
          draft={edit.draft}
          onDraft={edit.setDraft}
          onSave={edit.save}
          onReset={edit.reset}
          onClose={() => edit.setPicked(null)}
        />
      )}
    </div>
  );
}

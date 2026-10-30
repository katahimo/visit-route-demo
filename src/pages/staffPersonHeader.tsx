// 〈スタッフ〉の画面の見出し（PRD D308・D312。ADR-0052）：印と名前・状態（利用中／休止中・最終勤務日・ふだんの勤務）・
// その人のスマホ画面へ・一覧へ戻る・タブ［予定｜基本情報｜勤務時間｜相性］
import { CalendarDays, Clock, HeartHandshake, Plus, Smartphone, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BackToList, type PersonTabDef, PersonTabs } from '../components/personPage';
import { StaffMark } from '../components/StaffMark';
import { PageHeader, WithIcon } from '../components/ui';
import type { Staff } from '../contracts/documents';
import { WEEKDAY_LABELS } from '../lib/common';
import { mdText } from '../lib/dateText';
import { staffTabKeys } from '../lib/peopleView';
import type { StaffTab } from '../lib/personPage';

export function StaffPersonHeader({
  s,
  id,
  isNew,
  tab,
  compatOn,
  only,
  staffTerm,
  askTab,
}: {
  s: Staff;
  id: string;
  isNew: boolean;
  tab: StaffTab;
  compatOn: boolean;
  /** エキスパート機能が切か（切は相性のタブを出さず、中身は基本情報の「詳しく」へ。PRD D385） */
  only: boolean;
  staffTerm: string;
  /** タブを替えてよいか（替えるなら直している入力を捨てる） */
  askTab: () => Promise<boolean>;
}) {
  const all: PersonTabDef<StaffTab>[] = [
    { key: 'schedule', label: '予定', icon: CalendarDays, disabled: isNew ? '保存してから見られます' : false },
    { key: 'basic', label: '基本情報', icon: UserRound },
    { key: 'hours', label: '勤務時間', icon: Clock, disabled: isNew ? '保存してから直せます' : false },
    {
      key: 'compat',
      label: compatOn ? '相性' : '担当',
      icon: HeartHandshake,
      disabled: isNew ? '保存してから見られます' : false,
    },
  ];
  const keys = staffTabKeys(
    all.map((t) => t.key),
    only,
  );
  const tabs = all.filter((t) => keys.includes(t.key));
  return (
    <PageHeader
      icon={isNew ? Plus : UserRound}
      title={
        isNew ? (
          `${staffTerm}を追加`
        ) : (
          <span className="with-staff-mark">
            <StaffMark staff={s} size="md" />
            {s.name}
          </span>
        )
      }
      lead={
        isNew ? (
          `${staffTerm}の名前を入れて保存します`
        ) : (
          <span className="person-state" data-testid="person-state">
            <span className="chip">{s.active ? '利用中' : '休止中'}</span>
            {s.lastDay && (
              <span className="chip chip-lastday" data-testid="staff-lastday">
                最終 {mdText(s.lastDay)}
              </span>
            )}
            <span className="sub">
              {s.workDays.map((d) => WEEKDAY_LABELS[d]).join('')} {s.shiftStart}〜{s.shiftEnd}
            </span>
          </span>
        )
      }
      actions={
        <>
          {!isNew && (
            <Link className="btn btn-text" to={`/staff-view/${encodeURIComponent(id)}`} data-testid="to-staff-view">
              <WithIcon icon={Smartphone}>{s.name}さんの画面で見る</WithIcon>
            </Link>
          )}
          <BackToList to="/staff" label={`${staffTerm}一覧`} />
        </>
      }
      nav={<PersonTabs tabs={tabs} current={tab} ask={askTab} label={`${staffTerm}の画面の切り替え`} />}
    />
  );
}

// 〈利用者さん〉の画面の見出し（PRD D308。ADR-0052）：名前（色の丸）・状態（段階・仮押さえ・休み中・いつもの担当）・
// 一覧へ戻る・タブ［予定｜基本情報｜担当・相性｜休み］
import { BedSingle, CalendarDays, HeartHandshake, House, Plus, UserRound } from 'lucide-react';
import { BackToList, type PersonTabDef, PersonTabs } from '../components/personPage';
import { StaffMarkById } from '../components/StaffMark';
import { PageHeader } from '../components/ui';
import type { DemoData } from '../contracts/data';
import type { Client, Staff } from '../contracts/documents';
import { leaveOn } from '../domain/leaves';
import { jstDate } from '../domain/time';
import { STAGE_LABELS } from '../lib/clientStage';
import { colorOf } from '../lib/colors';
import type { ClientTab } from '../lib/personPage';
import { usualStaffOf } from '../lib/usualStaff';

/** タブ（新しい人は予定・担当・休みを押せない。休みの機能を切れば休みのタブを出さない） */
function clientTabs(isNew: boolean, compatOn: boolean, leavesOn: boolean): PersonTabDef<ClientTab>[] {
  return [
    { key: 'schedule', label: '予定', icon: CalendarDays, disabled: isNew ? '保存してから見られます' : false },
    { key: 'basic', label: '基本情報', icon: UserRound },
    {
      key: 'staffing',
      label: compatOn ? '担当・相性' : '担当',
      icon: HeartHandshake,
      disabled: isNew ? '保存してから見られます' : false,
    },
    ...(leavesOn
      ? [
          {
            key: 'leaves' as const,
            label: '休み',
            icon: BedSingle,
            disabled: isNew ? '保存してから入れられます' : (false as const),
          },
        ]
      : []),
  ];
}

/** 状態（段階・仮押さえ・休み中・いつもの担当） */
function ClientStateChips({
  c,
  saved,
  data,
  staff,
  today,
}: {
  c: Client;
  saved: Client | undefined;
  data: DemoData;
  staff: Staff[];
  today: string;
}) {
  const leaveNow = saved ? leaveOn(data.clientLeaves, saved.id, today) : null;
  const staffName = (sid: string | null) => (sid ? (staff.find((s) => s.id === sid)?.name ?? '（不明）') : '');
  /** いつもの担当（繰り返しの担当。版2） */
  const usualId = usualStaffOf(data.patterns, c.id, jstDate(Date.now()));
  return (
    <span className="person-state" data-testid="person-state">
      <span className={`chip stage-chip is-${c.stage}`} data-testid="client-stage">
        {STAGE_LABELS[c.stage]}
      </span>
      {c.tentative && <span className="chip chip-warn">仮押さえ</span>}
      {leaveNow && (
        <span className="chip chip-warn" title={leaveNow.note || undefined}>
          休み中
        </span>
      )}
      {usualId && (
        <span className="with-staff-mark sub">
          <StaffMarkById id={usualId} size="xs" />
          いつもの担当 {staffName(usualId)}
        </span>
      )}
    </span>
  );
}

export function ClientPageHeader({
  isNew,
  c,
  saved,
  data,
  staff,
  today,
  tab,
  compatOn,
  leavesOn,
  onAskTab,
}: {
  isNew: boolean;
  c: Client;
  saved: Client | undefined;
  data: DemoData;
  /** 名前の順の〈スタッフ〉 */
  staff: Staff[];
  today: string;
  tab: ClientTab;
  compatOn: boolean;
  leavesOn: boolean;
  /** タブを替える前の確認（替えるなら入力を捨てる） */
  onAskTab: () => Promise<boolean>;
}) {
  const terms = data.org.terms;
  return (
    <PageHeader
      icon={isNew ? Plus : House}
      title={
        isNew ? (
          `${terms.client}を追加`
        ) : (
          <span className="row" style={{ gap: 8 }}>
            {/* 色の丸（文字は入れない。見出しの文字を名前だけにする） */}
            <span className="dot dot-sm" style={{ background: colorOf(c.color) }} aria-hidden="true" />
            {c.displayName}
          </span>
        )
      }
      lead={
        isNew ? (
          `${terms.client}の名前と段階を入れて保存します`
        ) : (
          <ClientStateChips c={c} saved={saved} data={data} staff={staff} today={today} />
        )
      }
      actions={<BackToList to="/clients" label={`${terms.client}一覧`} />}
      nav={
        <PersonTabs
          tabs={clientTabs(isNew, compatOn, leavesOn)}
          current={tab}
          ask={onAskTab}
          label={`${terms.client}の画面の切り替え`}
        />
      }
    />
  );
}

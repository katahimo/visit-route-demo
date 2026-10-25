// 〈スタッフ〉の画面のタブの中身（PRD D71・D121・D308〜D310。ADR-0014・ADR-0015・ADR-0052）：基本情報（新しい人の基本の節・
// 基本・自宅・特性・求めること・最終勤務日）・勤務時間（ふだんの勤務・日ごとに変えた勤務）・相性（担当）
import {
  BadgeCheck,
  CalendarDays,
  CalendarX,
  Clock,
  HeartHandshake,
  Home,
  SlidersHorizontal,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConditionsEditor, TraitsEditor } from '../components/conditions';
import { CondRows, DlRow, StaffHoursRow, StaffLastDayRow, StaffTraitRows } from '../components/personDetail';
import { EditSection } from '../components/personPage';
import { placeText, StaffClientRows } from '../components/personView';
import { AddressField } from '../components/placeLookup';
import { Hint, WithIcon } from '../components/ui';
import type { Staff } from '../contracts/documents';
import { slotsText } from '../domain/availability';
import { encodeStaffFilter } from '../lib/compatView';
import { dateText } from '../lib/dateText';
import { orDash } from '../lib/viewMode';
import { useDemoData } from '../store';
import { StaffBasicFields, StaffBasicView, StaffHoursFields, StaffLastDayFields } from './staffFields';
import type { useStaffEdit } from './useStaffEdit';
import type { StaffSchedule } from './useStaffSchedule';

/** 節の編集（useStaffEdit の戻り値） */
type StaffEdit = ReturnType<typeof useStaffEdit>;

/** 基本情報のタブ（新しい人は基本の節だけを開いた形） */
export function StaffBasicTab({
  s,
  isNew,
  ed,
  mailOn,
  offboardOn,
}: {
  s: Staff;
  isNew: boolean;
  ed: StaffEdit;
  mailOn: boolean;
  offboardOn: boolean;
}) {
  const { data } = useDemoData();
  const terms = data.org.terms;
  const staffItems = data.items.filter((i) => i.target === 'staff');
  const { edit, form, setForm, bad, sec } = ed;
  const basicFields = form && (
    <StaffBasicFields form={form} setForm={setForm} bad={bad} previewColor={ed.previewColor} mailOn={mailOn} />
  );
  const hoursFields = form && <StaffHoursFields form={form} setForm={setForm} bad={bad} />;
  return (
    <div className="person-sections">
      {isNew && edit ? (
        <EditSection
          name="new"
          icon={UserRound}
          title="基本"
          editing
          onEdit={() => {}}
          onSave={ed.save}
          onCancel={() => void ed.cancelEdit()}
          error={ed.error}
          errorId={ed.errorId}
          view={null}
        >
          {basicFields}
          {hoursFields}
          <Hint label="ほかの項目">自宅・特性・求めること・最終勤務日は、保存してから入れられます。</Hint>
        </EditSection>
      ) : (
        <>
          <EditSection {...sec('basic')} icon={UserRound} title="基本" view={<StaffBasicView s={s} mailOn={mailOn} />}>
            {basicFields}
          </EditSection>
          <EditSection
            {...sec('home')}
            icon={Home}
            title="自宅"
            view={
              <dl>
                <DlRow term="住所" value={orDash(s.home.address)} />
                <DlRow term="地図の位置" value={placeText(s.home)} />
              </dl>
            }
          >
            {/* 郵便番号は住所を探すためだけで保存しない（自宅は契約の Place のまま。PRD D121） */}
            {form && (
              <AddressField
                value={form.home}
                onChange={(home) => setForm((f) => ({ ...f, home }))}
                testId="staff-home"
                postalLabel="郵便番号（任意。住所を探すためだけで、保存しません）"
              />
            )}
          </EditSection>
          <EditSection
            {...sec('traits')}
            icon={BadgeCheck}
            title="特性"
            view={
              <dl>
                <StaffTraitRows staff={s} data={data} />
              </dl>
            }
          >
            {form && (
              <TraitsEditor
                items={staffItems}
                value={form.traits}
                onChange={(traits) => setForm({ ...form, traits })}
              />
            )}
          </EditSection>
          <EditSection
            {...sec('conds')}
            icon={SlidersHorizontal}
            title={`${terms.client}に求めること`}
            view={
              <dl>
                <CondRows requirements={s.requirements} preferences={s.preferences} data={data} />
              </dl>
            }
          >
            {form && (
              <>
                <h3 className="person-subhead">
                  <WithIcon icon={SlidersHorizontal} size={16}>
                    必要条件
                  </WithIcon>
                </h3>
                <Hint>
                  {terms.client}
                  の特性への条件です。例：ペットのいる家を避けるなら、「ペットあり」を「なし」にします。合わない
                  {terms.client}は、点が下がるか、必須なら担当になりません。
                </Hint>
                <ConditionsEditor
                  items={data.items}
                  target="client"
                  value={form.requirements}
                  onChange={(requirements) => setForm({ ...form, requirements })}
                />
                <h3 className="person-subhead">
                  <WithIcon icon={Sparkles} size={16}>
                    希望
                  </WithIcon>
                </h3>
                <ConditionsEditor
                  items={data.items}
                  target="client"
                  value={form.preferences}
                  onChange={(preferences) => setForm({ ...form, preferences })}
                />
              </>
            )}
          </EditSection>
          {offboardOn && (
            <EditSection
              {...sec('lastDay')}
              icon={CalendarX}
              title="最終勤務日（退職・担当替え）"
              view={
                <dl>
                  <StaffLastDayRow staff={s} />
                </dl>
              }
            >
              {form && <StaffLastDayFields form={form} setForm={setForm} bad={bad} terms={terms} />}
            </EditSection>
          )}
        </>
      )}
    </div>
  );
}

/** 勤務時間のタブ（ふだんの勤務の節と、これからの日ごとに変えた勤務） */
export function StaffHoursTab({
  s,
  ed,
  overrides,
}: {
  s: Staff;
  ed: StaffEdit;
  overrides: StaffSchedule['overrides'];
}) {
  const { form, setForm, bad, sec } = ed;
  return (
    <div className="person-sections">
      <EditSection
        {...sec('hours')}
        icon={Clock}
        title="ふだんの勤務"
        view={
          <dl>
            <StaffHoursRow staff={s} />
          </dl>
        }
      >
        {form && <StaffHoursFields form={form} setForm={setForm} bad={bad} />}
      </EditSection>
      <section className="card stack person-sec" data-testid="person-sec" data-section="overrides">
        <div className="section-title">
          <h2>
            <CalendarDays size={18} strokeWidth={2.2} aria-hidden="true" />
            日ごとに変えた勤務（これから）
          </h2>
          <div className="section-aside">
            <Link to="/availability" className="btn btn-small" data-testid="to-availability">
              勤務時間（シフト）で直す
            </Link>
          </div>
        </div>
        {overrides.length === 0 ? (
          <span className="sub">日ごとに変えた勤務はありません</span>
        ) : (
          <ul className="person-list">
            {overrides.map((o) => (
              <li key={o.date}>
                <strong>{dateText(o.date)}</strong> <span className="sub">{slotsText(o.slots)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** 相性（担当）のタブ */
export function StaffCompatTab({ saved, compatOn }: { saved: Staff; compatOn: boolean }) {
  const { data } = useDemoData();
  return (
    <div className="person-sections">
      <section className="card stack person-sec" data-testid="person-sec" data-section="compat">
        <div className="section-title">
          <h2>
            <HeartHandshake size={18} strokeWidth={2.2} aria-hidden="true" />
            {compatOn ? '相性・担当' : '担当'}
          </h2>
          <div className="section-aside">
            {compatOn && (
              <Link
                to={`/compat?sf=${encodeURIComponent(encodeStaffFilter({ query: saved.name, chips: [] }))}`}
                className="btn btn-small"
                data-testid="to-compat"
              >
                相性の表で直す
              </Link>
            )}
          </div>
        </div>
        <dl>
          <StaffClientRows staff={saved} data={data} compatOn={compatOn} />
        </dl>
      </section>
    </div>
  );
}

// 〈利用者さん〉の画面の担当・相性のタブ（PRD D308・D311。ADR-0014・0052）：節「担当」（担当できる人を限る）・
// 「〈スタッフ〉に求めること」（必要条件・希望）と、読むだけの相性
import { HeartHandshake, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CondChips, ConditionsEditor } from '../components/conditions';
import { PickChips } from '../components/PickChips';
import { Check } from '../components/parts';
import { ClientStaffRows, CondRows } from '../components/personDetail';
import { EditSection } from '../components/personPage';
import { ClientCompatRows, PersonNames } from '../components/personView';
import { StaffMarkById } from '../components/StaffMark';
import { Hint, WithIcon } from '../components/ui';
import type { DemoData } from '../contracts/data';
import type { Client, Staff } from '../contracts/documents';
import { jstDate } from '../domain/time';
import { EMPTY_FILTER, encodeFilter } from '../lib/clientFilter';
import { usualStaffOf } from '../lib/usualStaff';
import type { ClientFormCtx, ClientSecOf } from './clientBasicSections';

function ClientStaffingFields({
  form,
  setForm,
  terms,
  limit,
  setLimit,
  allowedOn,
  activeStaff,
  data,
}: ClientFormCtx & {
  limit: boolean;
  setLimit: (on: boolean) => void;
  allowedOn: boolean;
  activeStaff: Staff[];
  data: DemoData;
}) {
  return (
    <>
      <p className="sub" data-testid="client-usual-note">
        いつもの担当は繰り返しの担当です（予定のタブの繰り返しの「直す」で替えます）。
      </p>
      {allowedOn && (
        <>
          <Hint label="担当できる人（社内の決まり）">
            <ul className="hint-list">
              <li>「この方は2人だけで担当する」のような決まりがあれば、担当できる{terms.staff}を選びます。</li>
              <li>選んだ人のほかは、担当になりません。</li>
              <li>休止中の{terms.staff}は選べません。選んだ人が全員いなくなると、だれでも担当できるに戻ります。</li>
            </ul>
          </Hint>
          <Check
            checked={limit}
            onChange={(on) => {
              setLimit(on);
              // 入れたときに誰も選んでいなければ、いつもの担当（繰り返しの担当）を最初に選んでおく
              const usual = usualStaffOf(data.patterns, form.id, jstDate(Date.now()));
              if (on && form.allowedStaffIds.length === 0 && usual && activeStaff.some((s) => s.id === usual))
                setForm({ ...form, allowedStaffIds: [usual] });
            }}
          >
            担当できる人を限る
          </Check>
          {limit && (
            <PickChips
              label={`担当できる${terms.staff}（押して選ぶ・外す）`}
              people={activeStaff.map((s) => ({ id: s.id, name: s.name, mark: <StaffMarkById id={s.id} size="xs" /> }))}
              selected={form.allowedStaffIds}
              // 全員を選ぶと PickChips は null を返す（全員の ID にする）
              onChange={(next) => setForm({ ...form, allowedStaffIds: next ?? activeStaff.map((s) => s.id) })}
              bulk={false}
              testId="client-allowed"
            />
          )}
        </>
      )}
    </>
  );
}

function ClientCondsFields({ form, setForm, terms, data }: ClientFormCtx & { data: DemoData }) {
  return (
    <>
      <h3 className="person-subhead">
        <WithIcon icon={SlidersHorizontal} size={16}>
          必要条件
        </WithIcon>
      </h3>
      <Hint>
        例：性別が女性、資格に看護師を含む。「条件の重み」の画面の「{terms.client}
        の必要条件」で、必須か重みかを決めます。
      </Hint>
      <ConditionsEditor
        items={data.items}
        target="staff"
        value={form.requirements}
        onChange={(requirements) => setForm({ ...form, requirements })}
      />
      <h3 className="person-subhead">
        <WithIcon icon={Sparkles} size={16}>
          希望
        </WithIcon>
      </h3>
      <Hint>例：経験年数3以上。満たさないと点が付きます。</Hint>
      <ConditionsEditor
        items={data.items}
        target="staff"
        value={form.preferences}
        onChange={(preferences) => setForm({ ...form, preferences })}
      />
    </>
  );
}

/** 相性（読むだけ。直すのは相性の表をその人の名前で絞って開く） */
function ClientCompatSection({ saved, data }: { saved: Client; data: DemoData }) {
  return (
    <section className="card stack person-sec" data-testid="person-sec" data-section="compat">
      <div className="section-title">
        <h2>
          <HeartHandshake size={18} strokeWidth={2.2} aria-hidden="true" />
          相性
        </h2>
        <div className="section-aside">
          <Link
            to={`/compat?cf=${encodeURIComponent(encodeFilter({ ...EMPTY_FILTER, query: saved.displayName }))}`}
            className="btn btn-small"
            data-testid="to-compat"
          >
            相性の表で直す
          </Link>
        </div>
      </div>
      <dl>
        <ClientCompatRows client={saved} data={data} />
      </dl>
      <span className="sub">×の{data.org.terms.staff}は担当になりません。</span>
    </section>
  );
}

export function ClientStaffingTab({
  c,
  saved,
  ctx,
  limit,
  setLimit,
  sec,
  data,
  activeStaff,
  allowedOn,
  compatOn,
}: {
  c: Client;
  saved: Client;
  /** 直している入力（直していなければ null） */
  ctx: Omit<ClientFormCtx, 'form'> & { form: Client | null };
  /** 担当できる人を限るか（直している節。直していなければ null） */
  limit: boolean | null;
  setLimit: (on: boolean) => void;
  sec: ClientSecOf;
  data: DemoData;
  activeStaff: Staff[];
  allowedOn: boolean;
  compatOn: boolean;
}) {
  const { form, setForm, bad, terms } = ctx;
  const itemById = new Map(data.items.map((i) => [i.id, i]));
  return (
    <div className="person-sections">
      <EditSection
        {...sec('staffing')}
        icon={ShieldCheck}
        title="担当"
        view={
          <dl>
            <ClientStaffRows
              client={c}
              data={data}
              names={(list, testId) => <PersonNames kind="staff" people={list} testId={testId} />}
            />
          </dl>
        }
      >
        {form && limit !== null && (
          <ClientStaffingFields
            form={form}
            setForm={setForm}
            bad={bad}
            terms={terms}
            limit={limit}
            setLimit={setLimit}
            allowedOn={allowedOn}
            activeStaff={activeStaff}
            data={data}
          />
        )}
      </EditSection>
      <EditSection
        {...sec('conds')}
        icon={SlidersHorizontal}
        title={`${terms.staff}に求めること`}
        view={
          <>
            <dl>
              <CondRows requirements={c.requirements} preferences={c.preferences} data={data} />
            </dl>
            <CondChips requirements={c.requirements} preferences={c.preferences} itemById={itemById} />
          </>
        }
      >
        {form && <ClientCondsFields form={form} setForm={setForm} bad={bad} terms={terms} data={data} />}
      </EditSection>
      {compatOn && <ClientCompatSection saved={saved} data={data} />}
    </div>
  );
}

import { Layers, Pencil, Plus, Save, ShieldCheck, Timer, Trash2, X } from 'lucide-react';
import { useMemo } from 'react';
import { CondChips, ConditionsEditor } from '../components/conditions';
import { FieldError, RequiredMark } from '../components/FieldError';
import { Empty, Hint, IconButton, PageHeader, SectionTitle, SidePanel, WithIcon } from '../components/ui';
import { TypeDot } from '../components/visitType';
import { MAX_VISIT_TYPES, type VisitType } from '../contracts/documents';
import type { Item } from '../contracts/rules';
import { CLIENT_COLORS } from '../lib/colors';
import { type TypeUses, usesOf } from '../lib/visitTypes';
import { useDemoData } from '../store';
import './settings.css';
import { SettingsTabs } from '../components/SettingsTabs';
import { useTypeForm } from './useTypeForm';

/**
 * 訪問の種類（ADR-0012。PRD D36）：一覧・足す・直す・消す。
 * 担当に必要な条件は〈スタッフ〉の項目ごとの1行のチェック表（components/conditions.tsx をそのまま使う）。常に必須
 */

export default function TypesPage() {
  const { data } = useDemoData();
  const terms = data.org.terms;
  const f = useTypeForm();
  const full = data.visitTypes.length >= MAX_VISIT_TYPES;

  return (
    <div className="stack">
      <PageHeader
        nav={<SettingsTabs />}
        icon={Layers}
        title="訪問の種類"
        lead={`訪問の種類（介護・リハビリなど）と、担当する${terms.staff}に必要な条件を決めます`}
        actions={
          <button
            type="button"
            className="btn btn-primary"
            disabled={full}
            title={full ? `種類は${MAX_VISIT_TYPES}までです` : ''}
            onClick={() => f.open(null)}
          >
            <WithIcon icon={Plus}>種類を追加</WithIcon>
          </button>
        }
      />
      <Hint label="種類について">
        <ul className="hint-list">
          <li>種類の「担当に必要な条件」は、いつも必須です。合わない{terms.staff}は、その訪問の担当になりません。</li>
          <li>標準の所要は、新しい訪問と定期パターンの初めの値に使います。</li>
          {full && <li>種類は{MAX_VISIT_TYPES}までです。</li>}
        </ul>
      </Hint>

      <div className="card table-scroll">
        {data.visitTypes.length === 0 ? (
          <Empty icon={Layers}>種類はまだありません。「種類を追加」で足します</Empty>
        ) : (
          <TypesTable
            visitTypes={data.visitTypes}
            items={data.items}
            uses={f.uses}
            onEdit={f.open}
            onRemove={f.remove}
          />
        )}
      </div>

      {f.form && <TypeFormPanel f={f} />}
    </div>
  );
}

/** 種類の一覧の表（名前・標準の所要・担当に必要な条件・使っている数・操作） */
function TypesTable({
  visitTypes,
  items,
  uses,
  onEdit,
  onRemove,
}: {
  visitTypes: VisitType[];
  items: Item[];
  uses: ReadonlyMap<string, TypeUses>;
  onEdit: (t: VisitType) => void;
  onRemove: (t: VisitType) => void;
}) {
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  return (
    <table className="people-table" data-testid="types-table">
      <thead>
        <tr>
          <th>名前</th>
          <th className="num">標準の所要</th>
          <th>担当に必要な条件</th>
          <th className="num">使っている</th>
          <th aria-label="操作" />
        </tr>
      </thead>
      <tbody>
        {visitTypes.map((t) => {
          const u = usesOf(uses, t.id);
          return (
            <tr key={t.id}>
              <td>
                <span className="row person-name">
                  <TypeDot type={t} size={14} />
                  <span className="person-main">
                    {t.name}
                    {t.note && <small className="person-sub">{t.note}</small>}
                  </span>
                </span>
              </td>
              <td className="num nowrap">{t.durationMinutes}分</td>
              <td className="cond-cell">
                <CondChips requirements={t.requirements} preferences={[]} itemById={itemById} />
              </td>
              <td className="num nowrap">
                訪問 {u.visits}件・パターン {u.patterns}件
              </td>
              <td>
                <div className="actions">
                  <IconButton icon={Pencil} label={`${t.name}を編集`} onClick={() => onEdit(t)} />
                  <IconButton icon={Trash2} label={`${t.name}を消す`} tone="danger" onClick={() => onRemove(t)} />
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** 種類を足す・直す欄（名前・標準の所要・メモ・色・担当に必要な条件。保存・閉じる・消す） */
function TypeFormPanel({ f }: { f: ReturnType<typeof useTypeForm> }) {
  const { data } = useDemoData();
  const { form, setForm, isNew, error, errorId, bad, save, remove } = f;
  if (!form) return null;
  return (
    <SidePanel
      icon={isNew ? Plus : Pencil}
      title={isNew ? '種類を追加' : `種類を編集：${form.name.trim() || '（名前なし）'}`}
      onClose={() => setForm(null)}
      onSubmit={save}
      footer={
        <>
          <button type="submit" className="btn btn-primary">
            <WithIcon icon={Save}>保存</WithIcon>
          </button>
          <button type="button" className="btn" onClick={() => setForm(null)}>
            <WithIcon icon={X}>閉じる</WithIcon>
          </button>
          <FieldError as="span" id={errorId} token={error}>
            {error?.text}
          </FieldError>
        </>
      }
    >
      <div className="form-grid">
        <label>
          <span>
            名前（20字まで）
            <RequiredMark />
          </span>
          <input
            value={form.name}
            maxLength={20}
            required
            {...bad('name')}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          <span>
            <WithIcon icon={Timer} size={14}>
              標準の所要（分）
            </WithIcon>
            <RequiredMark />
          </span>
          <input
            type="number"
            min={5}
            max={720}
            value={form.durationMinutes}
            required
            {...bad('durationMinutes')}
            onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
          />
        </label>
        <label>
          メモ
          <input value={form.note} maxLength={200} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </label>
      </div>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <span className="sub">色</span>
        {CLIENT_COLORS.map((col, i) => (
          <button
            key={col}
            type="button"
            className="dot dot-sm"
            aria-label={`色${i + 1}`}
            aria-pressed={form.color === i}
            onClick={() => setForm({ ...form, color: i })}
            style={{
              background: col,
              border: form.color === i ? '3px solid var(--ink)' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            {form.color === i ? '✓' : ''}
          </button>
        ))}
      </div>
      <SectionTitle icon={ShieldCheck}>担当に必要な条件（いつも必須）</SectionTitle>
      <Hint>例：資格に理学療法士・作業療法士・言語聴覚士のどれか。何も選ばない項目は問いません。</Hint>
      <ConditionsEditor
        items={data.items}
        target="staff"
        value={form.requirements}
        onChange={(requirements) => setForm({ ...form, requirements })}
      />
      {!isNew && (
        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              const t = data.visitTypes.find((x) => x.id === form.id);
              if (t) remove(t);
            }}
          >
            <WithIcon icon={Trash2}>この種類を消す</WithIcon>
          </button>
        </div>
      )}
    </SidePanel>
  );
}

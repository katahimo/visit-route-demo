import { Check, House, type LucideIcon, Pencil, Plus, Tags, Trash2, UserRound, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { FieldError, invalidAttrs } from '../components/FieldError';
import { Empty, Hint, IconButton, PageHeader, SectionTitle, WithIcon } from '../components/ui';
import { ITEM_KINDS, type Item, type ItemKind, type ItemTarget } from '../contracts/rules';
import { ITEM_KIND_LABELS, nameTaken, optionNameError } from '../lib/common';
import {
  addItem,
  changeItemKind,
  hasOptions,
  itemRefs,
  itemValueCount,
  optionUseCount,
  patchItem,
  removeItem,
  removeOption,
  renameOption,
} from '../lib/items';
import { useDemoData } from '../store';
import './settings.css';
import { SettingsTabs } from '../components/SettingsTabs';
import { narrowRole } from '../lib/narrowRoles';

/**
 * 項目：スタッフの項目・訪問先の項目の2つの表（ClassClassify の列の種類と OptionsEditor にならう）。
 * スタッフの項目は訪問先の条件で、訪問先の項目はスタッフの条件で使う
 */

export default function ItemsPage() {
  const { data } = useDemoData();
  const terms = data.org.terms;
  return (
    <div className="stack">
      <PageHeader
        nav={<SettingsTabs />}
        icon={Tags}
        title="特性の項目"
        lead={`${terms.staff}や${terms.client}の特性（資格・ペットなど）を決めます`}
      />
      <Hint label="使い方">
        <ul className="hint-list">
          <li>
            {terms.staff}や{terms.client}が持つ特性（資格・経験年数・ペットなど）を決めます。値は「{terms.staff}」「
            {terms.client}」の画面で入れます。
          </li>
          <li>選択肢の横の数字は、当てはまる人数です。人の画面で特性を直すと変わります。</li>
          <li>「使っている条件」は、この項目を使っている条件の数です。</li>
        </ul>
      </Hint>
      <ItemTable
        target="staff"
        icon={UserRound}
        title={`${terms.staff}の項目`}
        note={`${terms.client}の必要条件・希望で使います`}
      />
      <ItemTable
        target="client"
        icon={House}
        title={`${terms.client}の項目`}
        note={`${terms.staff}の必要条件・希望で使います`}
      />
    </div>
  );
}

function ItemTable({
  target,
  icon,
  title,
  note,
}: {
  target: ItemTarget;
  icon: LucideIcon;
  title: string;
  note: string;
}) {
  const { data, update } = useDemoData();
  const items = data.items.filter((i) => i.target === target);
  return (
    <div className="card stack">
      <SectionTitle
        icon={icon}
        aside={
          <button
            type="button"
            className="btn btn-small"
            onClick={() => update((d) => addItem(d, target), '項目を追加')}
          >
            <WithIcon icon={Plus} size={14}>
              項目を追加
            </WithIcon>
          </button>
        }
      >
        {title}
      </SectionTitle>
      <span className="sub">{note}</span>
      <div className="table-scroll">
        {/* 狭い画面（600px 以下）では行をカードにする（PRD D220。名前が1行目、種類・選択肢・使っている条件は見出し付きの行、消すは右下） */}
        <table {...narrowRole.table} className="items-table narrow-cards">
          <thead {...narrowRole.rowgroup}>
            <tr {...narrowRole.row}>
              <th {...narrowRole.columnheader}>名前</th>
              <th {...narrowRole.columnheader}>種類</th>
              <th {...narrowRole.columnheader}>
                選択肢<span className="th-note">（数字は当てはまる人数）</span>
              </th>
              <th {...narrowRole.columnheader}>使っている条件</th>
              <th {...narrowRole.columnheader} aria-label="操作" />
            </tr>
          </thead>
          <tbody {...narrowRole.rowgroup}>
            {items.map((it) => (
              <ItemRow key={it.id} item={it} items={items} />
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && <Empty icon={Tags}>項目がありません。</Empty>}
    </div>
  );
}

/** 選択肢を持たない形の説明（開始年は ADR-0070） */
const NO_OPTION_NOTES: Partial<Record<ItemKind, string>> = {
  flag: 'あり／なし',
  number: '数値を入れる',
  startYear: '始めた年（西暦）を入れる。条件はその日までの年数で比べる',
};

/** 項目の1行：名前・種類・選択肢（人数）・使っている条件・消す。直すと確かめてからすぐ保存 */

function ItemRow({ item: it, items }: { item: Item; items: Item[] }) {
  const { data, update } = useDemoData();
  const confirmDialog = useConfirm();
  const refs = itemRefs(data, it);
  const setItem = (patch: Partial<Item>) => update((d) => patchItem(d, it.id, patch), '項目を直す');
  const remove = async () => {
    const ok = await confirmDialog({
      title: `項目「${it.name}」を消しますか？`,
      body:
        refs.length > 0
          ? `${refs.length}件の条件で使っています（${refs.slice(0, 5).join('、')}${refs.length > 5 ? ' など' : ''}）。\n消すと、その条件は無効になります（条件そのものは残ります）。入っている値も消えます。`
          : '入っている値も消えます。',
      confirmLabel: '消す',
      tone: 'danger',
    });
    if (!ok) return;
    update((d) => removeItem(d, it), '項目を消す');
  };
  const changeKind = async (kind: ItemKind) => {
    const n = itemValueCount(data, it);
    if (
      (n > 0 || refs.length > 0) &&
      !(await confirmDialog({
        title: `項目「${it.name}」の種類を変えますか？`,
        body: `種類を変えると、この項目の値（${n}件）と、この項目を使う条件（${refs.length}件）を消します。`,
        confirmLabel: '値を消して種類を変える',
        tone: 'danger',
      }))
    )
      return;
    update((d) => changeItemKind(d, it, kind), '項目の形を変える');
  };
  const dropOption = async (opt: string) => {
    const n = optionUseCount(data, it, opt);
    if (
      n > 0 &&
      !(await confirmDialog({
        title: `選択肢「${opt}」を消しますか？`,
        body: `${n}件に入っています。消すと、その値と、それを使う条件からも外れます。`,
        confirmLabel: '消す',
        tone: 'danger',
      }))
    )
      return;
    update((d) => removeOption(d, it, opt), '選択肢を消す');
  };
  return (
    <tr {...narrowRole.row}>
      <td {...narrowRole.cell} style={{ minWidth: 140 }} className="narrow-title" data-label="名前">
        <NameInput
          value={it.name}
          taken={(name) => nameTaken(items, (x) => x.name, name, it.id)}
          onCommit={(name) => setItem({ name })}
        />
      </td>
      <td {...narrowRole.cell} data-label="種類">
        <select
          value={it.kind}
          aria-label={`${it.name}の種類`}
          onChange={(e) => changeKind(e.target.value as ItemKind)}
        >
          {ITEM_KINDS.map((k) => (
            <option key={k} value={k}>
              {ITEM_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </td>
      <td {...narrowRole.cell} style={{ minWidth: 220 }} className="narrow-block" data-label="選択肢（人数）">
        {hasOptions(it.kind) ? (
          <OptionsEditor
            options={it.options}
            countOf={(o) => optionUseCount(data, it, o)}
            who={it.target === 'staff' ? data.org.terms.staff : data.org.terms.client}
            onAdd={(o) => setItem({ options: [...it.options, o] })}
            onRename={(from, to) => update((d) => renameOption(d, it, from, to), '選択肢の名前を変える')}
            onRemove={(o) => dropOption(o)}
          />
        ) : (
          <span className="sub">{NO_OPTION_NOTES[it.kind]}</span>
        )}
      </td>
      <td {...narrowRole.cell} data-label="使っている条件">
        {refs.length > 0 ? (
          <span className="badge-count" title={refs.join('、')}>
            {refs.length}
            <small>件</small>
          </span>
        ) : (
          <span className="sub">なし</span>
        )}
      </td>
      <td {...narrowRole.cell} className="narrow-act">
        <IconButton icon={Trash2} label={`項目「${it.name}」を消す`} tone="danger" onClick={() => remove()} />
      </td>
    </tr>
  );
}

/** 名前の入力。空のまま・同じ対象のほかの項目と同じ名前では確定しない */
function NameInput({
  value,
  taken,
  onCommit,
}: {
  value: string;
  taken: (name: string) => boolean;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const v = draft ?? value;
  const dup = draft !== null && v.trim() !== '' && taken(v.trim().slice(0, 30));
  const errId = useId();
  const commit = () => {
    const t = v.trim().slice(0, 30);
    if (t && taken(t)) return; // 重なる名前は確定しない（入力はそのまま残してエラーを出す）
    if (t && t !== value) onCommit(t);
    setDraft(null);
  };
  return (
    <>
      <input
        value={v}
        maxLength={30}
        aria-label="項目の名前"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        {...invalidAttrs(dup, errId)}
      />
      <FieldError as="span" id={errId} live={false}>
        {dup && '同じ名前の項目があります'}
      </FieldError>
    </>
  );
}

/** 選択肢の一覧（当てはまる人数）・追加・名前の変更・削除（ClassClassify RosterEditor の OptionsEditor にならう） */
function OptionsEditor({
  options,
  countOf,
  who,
  onAdd,
  onRename,
  onRemove,
}: {
  options: string[];
  countOf: (o: string) => number;
  /** 値を持つ側の呼び方（数字の説明に使う） */
  who: string;
  onAdd: (o: string) => void;
  onRename: (from: string, to: string) => void;
  onRemove: (o: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [added, setAdded] = useState('');
  const a = added.trim();
  const addDup = options.includes(a);
  const addBad = a ? optionNameError(a) : null;
  const d = draft.trim();
  const renameDup = editing !== null && d !== editing && options.includes(d);
  const renameBad = editing !== null && d ? optionNameError(d) : null;
  const addErrId = useId();
  const renameErrId = useId();
  /** 名前の変更の誤り（足す欄の誤りがあれば、そちらを先に出す） */
  const renameErr = addBad ? null : renameBad;
  return (
    <div className="stack" style={{ gap: 6 }}>
      {options.length === 0 && <span className="sub">選択肢がありません</span>}
      <div className="opt-chips">
        {options.map((o) =>
          editing === o ? (
            <form
              key={o}
              className="opt-edit"
              onSubmit={(e) => {
                e.preventDefault();
                if (renameDup || renameBad) return;
                if (d && d !== o) onRename(o, d.slice(0, 30));
                setEditing(null);
              }}
            >
              <input
                value={draft}
                maxLength={30}
                onChange={(e) => setDraft(e.target.value)}
                aria-label={`${o}の名前`}
                {...invalidAttrs(!!renameErr, renameErrId)}
              />
              <IconButton icon={Check} label="名前を決める" type="submit" disabled={!d || renameDup || !!renameBad} />
              <IconButton icon={X} label="閉じる" onClick={() => setEditing(null)} />
            </form>
          ) : (
            <span key={o} className="opt-chip">
              <span className="opt-name">{o}</span>
              <span
                className="opt-count"
                title={`${who}のうち${countOf(o)}人が「${o}」です。人数は${who}の画面で特性を直すと変わります`}
              >
                {countOf(o)}人
              </span>
              <IconButton
                icon={Pencil}
                label={`「${o}」の名前を変える`}
                onClick={() => {
                  setEditing(o);
                  setDraft(o);
                }}
              />
              <IconButton icon={Trash2} label={`「${o}」を消す`} tone="danger" onClick={() => onRemove(o)} />
            </span>
          ),
        )}
      </div>
      {options.length < 30 && (
        <form
          className="opt-add"
          onSubmit={(e) => {
            e.preventDefault();
            if (!a || addDup || addBad) return;
            onAdd(a.slice(0, 30));
            setAdded('');
          }}
        >
          <input
            value={added}
            maxLength={30}
            placeholder="選択肢を追加"
            {...invalidAttrs(addDup || !!addBad, addErrId)}
            onChange={(e) => setAdded(e.target.value)}
          />
          <button type="submit" className="btn btn-small nowrap" disabled={!a || addDup || !!addBad}>
            <WithIcon icon={Plus} size={14}>
              追加
            </WithIcon>
          </button>
        </form>
      )}
      <FieldError as="span" id={addErrId} live={false}>
        {addDup ? '同じ選択肢があります' : addBad}
      </FieldError>
      <FieldError as="span" id={renameErrId} live={false}>
        {renameErr}
      </FieldError>
    </div>
  );
}

// 条件の重みの画面（PRD D173〜D175・D220・D271・D286）の区画の部品：点のしくみの説明・条件の表（狭い画面ではカード）・
// 条件の名前・足す条件の種類・詳細設定（乱数の種）・確定していない重みの変更の帯（新しい考え方として保存。ADR-0065）
import {
  Dices,
  Heart,
  HeartHandshake,
  Hourglass,
  type LucideIcon,
  Pencil,
  Plus,
  Repeat,
  Scale,
  ShieldCheck,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { WeightSlider } from '../components/parts';
import { Term } from '../components/Term';
import { Hint, IconButton, WithIcon } from '../components/ui';
import type { Terms } from '../contracts/documents';
import { HARDABLE, MAX_PRESETS, type Rule, type RuleType } from '../contracts/rules';
import { ruleTypeHelp, ruleTypeLabel, weightLocked } from '../lib/common';
import { narrowRole } from '../lib/narrowRoles';
import { parseSeed, RULE_NAME_MAX, ruleNameOf, ruleRowClass, setSeed } from '../lib/ruleEdit';
import { changeText, type WeightChange } from '../lib/weightDraft';
import { useDemoData } from '../store';
import { SCORE_TEXT } from './planParts';

/** 条件の種類ごとのアイコン（必要条件=盾、希望=ハート／いいね など） */
export const RULE_ICONS: Record<RuleType, LucideIcon> = {
  clientRequirement: ShieldCheck,
  staffRequirement: ShieldCheck,
  clientPreference: Heart,
  staffPreference: ThumbsUp,
  compatibility: HeartHandshake,
  continuity: Repeat,
  balance: Scale,
  wait: Hourglass,
};

/** 点のしくみの説明と、直している基準のプリセット（次の段の案内は保存の確認と［組み方の標準へ戻る］に寄せる。ADR-0088） */
export function RulesIntro({ basisName }: { basisName: string | undefined }) {
  return (
    <>
      <Hint label="点のしくみ">
        <ul className="hint-list">
          <li>AI は、移動と条件の点の合計がいちばん少ない割当を探します。</li>
          <li>
            移動1分が1点です。<strong>重み1は、訪問1件あたり移動10分ぶん</strong>です（重み5なら50分ぶん）。
          </li>
          <li>重み0の条件は使いません。</li>
          <li>「必須」にした条件は、守れない人を担当にしません。約束の時間と働ける時間は、いつも必須です。</li>
          <li>画面の点数は、{SCORE_TEXT}です。高いほど良い組み方です。</li>
        </ul>
      </Hint>
      <p className="sub" data-testid="rules-basis">
        直しているのは
        <Term k="scoreBase" testId="term-score-base" />
        の「<strong>{basisName ?? '—'}</strong>
        」の重みです。基準は上のプリセットの丸で替えられます。同じ種類の条件は同じ重みになります。
      </p>
    </>
  );
}

/** 表の行を直す・消す（名前はすぐ保存、重み・必須は下書き） */
type RuleRowActions = {
  onLabel: (id: string, label: string) => void;
  onWeight: (type: RuleType, patch: Partial<{ weight: number; hard: boolean }>) => void;
  onRemove: (r: Rule) => void;
};

/** 条件の表（名前・種類・重み・必須・消す）。狭い画面（600px 以下）では行をカードにする（PRD D220。名前と必須が1行目、種類・重みは見出し付きの行、消すは右下） */
export function RulesTable({
  rules,
  terms,
  changeOf,
  actions,
}: {
  /** 出す条件（下書きを当てたもの） */
  rules: Rule[];
  terms: Terms;
  changeOf: (type: RuleType) => WeightChange | undefined;
  actions: RuleRowActions;
}) {
  return (
    <div className="table-scroll">
      <table {...narrowRole.table} className="rules-table narrow-cards" data-testid="narrow-rules">
        <thead {...narrowRole.rowgroup}>
          <tr {...narrowRole.row}>
            <th {...narrowRole.columnheader}>名前</th>
            <th {...narrowRole.columnheader}>種類</th>
            <th {...narrowRole.columnheader} style={{ width: 220 }}>
              重み
            </th>
            <th {...narrowRole.columnheader}>必須</th>
            <th {...narrowRole.columnheader} aria-label="操作" />
          </tr>
        </thead>
        <tbody {...narrowRole.rowgroup}>
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} terms={terms} change={changeOf(r.type)} actions={actions} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 条件の1行 */
function RuleRow({
  rule: r,
  terms,
  change,
  actions,
}: {
  rule: Rule;
  terms: Terms;
  /** 保存済みと違えば、その変更（PRD D286） */
  change: WeightChange | undefined;
  actions: RuleRowActions;
}) {
  const { onLabel, onWeight, onRemove } = actions;
  const hardable = HARDABLE.has(r.type);
  const hard = hardable && r.hard;
  const locked = weightLocked(r);
  return (
    <tr {...narrowRole.row} className={ruleRowClass(r, hard, !!change)} data-draft={change ? 1 : undefined}>
      <td {...narrowRole.cell} style={{ minWidth: 160 }} className="narrow-title" data-label="名前">
        <RuleName value={r.label} onChange={(label) => onLabel(r.id, label)} fallback={ruleTypeLabel(r.type, terms)} />
      </td>
      <td {...narrowRole.cell} data-label="種類">
        <span className="chip chip-type">
          <WithIcon icon={RULE_ICONS[r.type]} size={14}>
            {ruleTypeLabel(r.type, terms)}
          </WithIcon>
        </span>
        <Hint ariaLabel={`${r.label}の説明`}>{ruleTypeHelp(r.type, terms)}</Hint>
      </td>
      <td {...narrowRole.cell} data-label="重み">
        <WeightSlider
          label={r.label}
          value={r.weight}
          disabled={locked}
          onChange={(w) => onWeight(r.type, { weight: w })}
        />
        {!locked && <span className="sub">{r.weight === 0 ? '無効' : `移動${r.weight * 10}分ぶん`}</span>}
        {/* 保存済みと違う行は色だけでなく文字でも（PRD D286） */}
        {change && (
          <span className="chip chip-warn draft-mark" data-testid="rules-draft-mark">
            変更あり {changeText(change)}
          </span>
        )}
      </td>
      <td {...narrowRole.cell} className={hardable ? 'nowrap narrow-head' : 'nowrap'} data-label="必須">
        {hardable ? (
          <label className={`hard-toggle${r.hard ? ' is-on' : ''}`}>
            <input type="checkbox" checked={r.hard} onChange={(e) => onWeight(r.type, { hard: e.target.checked })} />
            <WithIcon icon={ShieldCheck} size={14}>
              必須
            </WithIcon>
          </label>
        ) : (
          <span className="sub">—</span>
        )}
      </td>
      <td {...narrowRole.cell} className="narrow-act">
        <IconButton icon={Trash2} label={`条件「${r.label}」を消す`} tone="danger" onClick={() => onRemove(r)} />
      </td>
    </tr>
  );
}

/**
 * 条件の名前（PRD D271）：ふだんは文字で出し、［名前を変える］で入力欄にする（誤って書き換えない）。Enter・欄を離れると
 * 決め、Esc で取り消す。空の名前は保存しない（契約は1文字以上。空のまま保存されると、次に開いたときデータ全体が読めずに
 * 初期状態へ戻ってしまう）。空のまま決めたら型の名前に戻す
 */
function RuleName({ value, onChange, fallback }: { value: string; onChange: (v: string) => void; fallback: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  /** 閉じたあと（Esc・Enter）に来る blur で、もう一度決めない */
  const closing = useRef(false);
  /** 入力をやめる。キーで閉じたら［名前を変える］へフォーカスを戻す（描き直したあと。欄を離れたときは移った先のまま） */
  const close = (focusBack: boolean) => {
    closing.current = true;
    setDraft(null);
    if (focusBack) requestAnimationFrame(() => btnRef.current?.focus());
  };
  const commit = (focusBack: boolean) => {
    if (draft === null || closing.current) return;
    const next = ruleNameOf(draft, fallback);
    // 名前が変わっていなければ書かない
    if (next !== value) onChange(next);
    close(focusBack);
  };
  if (draft === null)
    return (
      <span className="rule-name">
        <strong className="rule-name-text" data-testid="rule-name">
          {value}
        </strong>
        <button
          ref={btnRef}
          type="button"
          className="btn btn-text btn-small rule-rename"
          onClick={() => {
            closing.current = false;
            setDraft(value);
          }}
          aria-label={`条件「${value}」の名前を変える`}
          data-testid="rule-rename"
        >
          <WithIcon icon={Pencil} size={14}>
            名前を変える
          </WithIcon>
        </button>
      </span>
    );
  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: ［名前を変える］を押した直後に打てるよう、出した入力欄へ移す
      autoFocus
      value={draft}
      maxLength={RULE_NAME_MAX}
      aria-label="条件の名前"
      data-testid="rule-name-input"
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        // 変換中の Enter（確定）・Esc（取り消し）は変換のもの（ほかの部品と同じ）
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(true);
        } else if (e.key === 'Escape') {
          // 右の欄などの Esc に渡さない
          e.preventDefault();
          e.stopPropagation();
          close(true);
        }
      }}
      onBlur={() => commit(false)}
    />
  );
}

/** 足す条件の種類と［条件を足す］・その種類の説明 */
export function RulesAdd({
  types,
  terms,
  primary,
  onAdd,
}: {
  /** 選べる型（相性を切っているときは相性を除く） */
  types: readonly RuleType[];
  terms: Terms;
  /** 主ボタンにするか（重みの下書きがある間は「新しい考え方として保存」が主） */
  primary: boolean;
  onAdd: (type: RuleType) => void;
}) {
  const [addType, setAddType] = useState<RuleType>('clientPreference');
  return (
    <>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <label style={{ maxWidth: 260 }}>
          足す条件の種類
          <select value={addType} onChange={(e) => setAddType(e.target.value as RuleType)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {ruleTypeLabel(t, terms)}
              </option>
            ))}
          </select>
        </label>
        {/* 主ボタンは画面に1つ：重みの下書きがある間は「新しい考え方として保存」を主にし、こちらは枠にする（AGENTS.md） */}
        <button
          type="button"
          className={primary ? 'btn btn-primary' : 'btn'}
          style={{ alignSelf: 'flex-end' }}
          onClick={() => onAdd(addType)}
        >
          <WithIcon icon={Plus}>条件を足す</WithIcon>
        </button>
      </div>
      <Hint label="この種類の説明">{ruleTypeHelp(addType, terms)}</Hint>
    </>
  );
}

/** 詳細設定（乱数の種）。ふだん使わないので畳む（PRD D174。開いたかどうかは保存しない） */
export function RulesAdvanced() {
  const { data, update } = useDemoData();
  const [seedText, setSeedText] = useState<string | null>(null);
  const seedValue = seedText ?? String(data.seed);
  /** 打った乱数の種を書く（整数でなければ書かない） */
  const commitSeed = () => {
    const n = seedText === null ? null : parseSeed(seedText);
    if (n === null) return;
    update((d) => setSeed(d, n), '乱数の種');
  };
  const seedOk = parseSeed(seedValue) !== null;
  return (
    <details className="card seed-card rules-advanced" data-testid="rules-advanced">
      <summary className="rules-advanced-summary">
        <Dices size={16} aria-hidden="true" />
        詳細設定
        <span className="sub">（乱数の種）</span>
      </summary>
      <p className="sub">
        <Term k="seed" testId="term-seed" />
        ：AI
        は同じデータ・同じ種からは同じ提案を出します。種を変えると、別の探し方で組みます。ふだんは変えなくてかまいません。
      </p>
      <div className="row">
        <input
          className="seed-input"
          inputMode="numeric"
          value={seedValue}
          aria-label="乱数の種"
          onChange={(e) => setSeedText(e.target.value)}
          // 書くのは確定したとき（離れる・Enter）の1回だけ（全体の「元に戻す」の1手。打つたびに積まない。PRD D329）
          onBlur={() => {
            commitSeed();
            setSeedText(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) commitSeed();
          }}
        />
        {!seedOk && <span className="error">整数で入れてください</span>}
      </div>
    </details>
  );
}

/**
 * 重みの下書きがある間だけ：画面の下に貼り付く保存の帯（下のタブの上。巻いても押せる。印刷では出さない）。
 * プリセットは書き換えず、新しい考え方として保存する（ADR-0065）。6つあるときは押せず、消すよう出す
 */
export function RulesDraftBar({
  count,
  full,
  onDiscard,
  onConfirm,
}: {
  count: number;
  /** プリセットが6つある（保存できない） */
  full: boolean;
  onDiscard: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <section className="rules-draft-bar" aria-label="確定していない重みの変更" data-testid="rules-draft-bar">
      <p className="rules-draft-text">
        <span className="chip chip-warn">変更あり</span>
        <span>プリセットは書き換えません。保存すると新しい考え方として足し、ふだんの考え方（点数の基準）にします</span>
        {full && (
          <span className="error" data-testid="rules-draft-full">
            プリセットは{MAX_PRESETS}つまでです。使わない考え方を上の節で消してから保存してください
          </span>
        )}
      </p>
      <span className="rules-draft-actions">
        <button type="button" className="btn btn-text" onClick={onDiscard} data-testid="rules-draft-discard">
          取り消す
        </button>
        <button
          type="button"
          className="btn btn-primary"
          aria-disabled={full ? true : undefined}
          onClick={() => {
            if (!full) void onConfirm();
          }}
          data-testid="rules-draft-confirm"
        >
          新しい考え方として保存（{count}件）
        </button>
      </span>
    </section>
  );
}

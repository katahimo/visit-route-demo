// 提案を比べる（pages/ComparePage）の区画の部品：比べる案の一覧・提案を作る欄・条件の差・合計と条件ごと・
// 割り当てられなかった訪問・計算に入れなかった訪問。見た目だけで、データの組み立ては lib/compareChoices
import {
  CalendarDays,
  Car,
  Check,
  CircleOff,
  Gauge,
  GitCompareArrows,
  History,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { ArrangeTabs } from '../components/ArrangeTabs';
import { EmptyNext } from '../components/EmptyNext';
import { FieldError } from '../components/FieldError';
import { Term } from '../components/Term';
import { Hint, IconButton, PageHeader, SectionTitle, Stat, WithIcon } from '../components/ui';
import type { Visit } from '../contracts/documents';
import type { PlanDiff, PlanScore, Reason, ScoreScale, VisitExplain } from '../contracts/problem';
import type { Preset, Rule } from '../contracts/rules';
import { toHundred } from '../evaluate';
import { deltaText, pointsText, r0 } from '../lib/common';
import {
  type CompareChoice,
  type CompareSide,
  choiceKindText,
  hundredDelta,
  type RuleDiffRow,
} from '../lib/compareChoices';
import { dateText } from '../lib/dateText';
import { compareEmptyGuide } from '../lib/emptyGuide';
import { narrowRole } from '../lib/narrowRoles';
import type { ScoreReason } from '../lib/scoreReason';
import { CompareTable, RefMark, rulerText, SCORE_TEXT, ScoreReasonText } from './planParts';
import type { CompareProposal } from './useCompareProposal';

/** 採点の結果（attempt の形） */
export type ScoreResult = { value: PlanScore | null; error: string | null };

/** 比べる案の一覧の表。狭い画面（600px 以下）では行をカードにする（PRD D220。A・B と案の名前が1行目、ほかは見出し付きの行、操作は右下） */
export type ChoicesTableProps = {
  choices: readonly CompareChoice[];
  aId: string | undefined;
  bId: string | undefined;
  scores: ReadonlyMap<string, ScoreResult | null>;
  reasons: ReadonlyMap<string, ScoreReason | null>;
  scale: ScoreScale | null;
  isStale: (c: CompareChoice) => boolean;
  onPick: (side: CompareSide, id: string) => void;
  onApply: (c: CompareChoice) => void;
  onRemove: (c: CompareChoice) => void;
};

export function ChoicesTable({
  choices,
  aId,
  bId,
  scores,
  reasons,
  scale,
  isStale,
  onPick,
  onApply,
  onRemove,
}: ChoicesTableProps) {
  return (
    <div className="table-scroll">
      <table {...narrowRole.table} className="compare-table runs-table narrow-cards" data-testid="narrow-runs">
        <thead {...narrowRole.rowgroup}>
          <tr {...narrowRole.row}>
            <th {...narrowRole.columnheader} className="ab-col">
              A
            </th>
            <th {...narrowRole.columnheader} className="ab-col">
              B
            </th>
            <th {...narrowRole.columnheader}>担当</th>
            <th {...narrowRole.columnheader}>種類</th>
            <th {...narrowRole.columnheader} className="num">
              合計点
            </th>
            <th {...narrowRole.columnheader} className="num">
              移動
            </th>
            <th {...narrowRole.columnheader} className="num">
              入らない
            </th>
            <th {...narrowRole.columnheader} />
          </tr>
        </thead>
        <tbody {...narrowRole.rowgroup}>
          {choices.map((c) => {
            const sc = scores.get(c.id)?.value ?? null;
            const reason = reasons.get(c.id);
            const stale = isStale(c);
            return (
              <tr
                {...narrowRole.row}
                key={c.id}
                className={`${aId === c.id ? 'is-a' : ''} ${bId === c.id ? 'is-b' : ''}`}
              >
                <td {...narrowRole.cell} className="ab-col narrow-head">
                  <label className="ab-pick ab-a">
                    <input
                      type="radio"
                      name="pick-a"
                      aria-label={`${c.title} を A にする`}
                      checked={aId === c.id}
                      onChange={() => onPick('a', c.id)}
                    />
                    <span>A</span>
                  </label>
                </td>
                <td {...narrowRole.cell} className="ab-col narrow-head">
                  <label className="ab-pick ab-b">
                    <input
                      type="radio"
                      name="pick-b"
                      aria-label={`${c.title} を B にする`}
                      checked={bId === c.id}
                      onChange={() => onPick('b', c.id)}
                    />
                    <span>B</span>
                  </label>
                </td>
                <td {...narrowRole.cell} className="narrow-title" data-label="担当">
                  {c.title}
                  {c.stopped && <span className="sub">（途中で止めた提案）</span>}
                  {stale && (
                    <span className="chip chip-warn" style={{ marginLeft: 6 }} data-testid="compare-stale">
                      訪問が変わりました
                    </span>
                  )}
                </td>
                <td {...narrowRole.cell} className="nowrap sub" data-label="種類">
                  {choiceKindText(c.kind)}
                </td>
                <td className="num" data-label="合計点">
                  {sc && scale ? `${toHundred(sc.total, scale)}点` : '—'}
                  {sc && scale && <RefMark hard={sc.hardViolations.length} />}
                  {reason && (
                    <div>
                      <ScoreReasonText reason={reason} testId="compare-reason" />
                    </div>
                  )}
                </td>
                <td {...narrowRole.cell} className="num" data-label="移動">
                  {sc ? `${r0(sc.travelMinutes)}分` : '—'}
                </td>
                <td {...narrowRole.cell} className="num" data-label="入らない">
                  {sc ? `${sc.dropped}件` : '—'}
                </td>
                <td {...narrowRole.cell} className="nowrap narrow-act">
                  {c.kind === 'proposal' && (
                    <div className="actions">
                      <button
                        type="button"
                        className="btn btn-small btn-primary"
                        aria-disabled={stale || undefined}
                        onClick={() => onApply(c)}
                        data-testid="compare-apply"
                      >
                        <WithIcon icon={Check} size={14}>
                          反映する
                        </WithIcon>
                      </button>
                      <IconButton icon={Trash2} label={`${c.title} を消す`} tone="danger" onClick={() => onRemove(c)} />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 提案を作る欄（考え方を選んで作る・進み具合・止める） */
export function MakeProposal({
  date,
  choiceCount,
  presets,
  proposal,
}: {
  date: string;
  choiceCount: number;
  presets: readonly Preset[];
  proposal: CompareProposal;
}) {
  const { preset, setPresetId, making, makeError, makeProposal, stop, makeWhy } = proposal;
  const shown = making && making.date === date ? making : null;
  return (
    <div className="compare-another stack" data-testid="compare-another">
      {choiceCount === 1 && (
        <p className="sub">比べるには2つ要ります。考え方を選んで提案を作ると、今の担当と並べられます。</p>
      )}
      {makeWhy ? (
        <p className="sub" data-testid="compare-another-why">
          {makeWhy}
        </p>
      ) : (
        preset && (
          <div className="compare-another-row">
            <label className="compare-another-pick">
              <span className="sub">考え方</span>
              <select
                value={preset.id}
                onChange={(e) => setPresetId(e.target.value)}
                disabled={!!making}
                data-testid="compare-another-select"
              >
                {presets.map((o) => (
                  <option key={o.id} value={o.id}>
                    「{o.name}」
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!!making}
              onClick={makeProposal}
              data-testid="compare-another-make"
            >
              <WithIcon icon={Sparkles}>提案を作って比べる</WithIcon>
            </button>
          </div>
        )
      )}
      {/* 読み上げは始まり・終わりだけ（回数は読まない） */}
      <output className="sub compare-another-status">{shown ? `${shown.name}で作っています…` : ''}</output>
      {shown && (
        <span className="plan-progress" data-testid="compare-another-progress">
          <progress value={shown.iteration} max={shown.total || 1} aria-label={`${shown.name}の提案の進み具合`} />
          <span className="sub" aria-hidden="true">
            {shown.total > 0 ? `${shown.iteration.toLocaleString()} / ${shown.total.toLocaleString()} 回` : '準備中…'}
          </span>
          <button type="button" className="btn btn-small" onClick={stop}>
            <WithIcon icon={Square} size={14}>
              止める
            </WithIcon>
          </button>
        </span>
      )}
      <FieldError>{makeError}</FieldError>
    </div>
  );
}

/** 条件の差（A・B の重み。違う所は B を強める） */
export function RuleDiffCard({
  A,
  B,
  rows,
  rulerName,
}: {
  A: CompareChoice;
  B: CompareChoice;
  rows: readonly RuleDiffRow[];
  rulerName: string;
}) {
  return (
    <div className="card stack">
      <SectionTitle icon={SlidersHorizontal}>条件の差</SectionTitle>
      <div className="table-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th />
              <th className="num">
                <span className="ab-badge ab-a">A</span> {A.title}
              </th>
              <th className="num">
                <span className="ab-badge ab-b">B</span> {B.title}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.a === r.b ? 'is-dim' : ''}>
                <th>{r.label}</th>
                <td className="num">{r.a}</td>
                <td className="num">{r.a === r.b ? r.b : <strong className="warn-text">{r.b}</strong>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sub">下の点数は、A・B とも「{rulerName}」の重みで付けています。</p>
    </div>
  );
}

/** 合計と条件ごと（A→B）：点数・移動・担当が変わった訪問・入らない訪問の差と、条件ごとの表 */
export function TotalsCard({
  A,
  B,
  aScore,
  bScore,
  abDiff,
  scale,
  rules,
}: {
  A: CompareChoice;
  B: CompareChoice;
  aScore: ScoreResult | null;
  bScore: ScoreResult | null;
  abDiff: { value: PlanDiff | null } | null;
  scale: ScoreScale | null;
  rules: Rule[];
}) {
  const as = aScore?.value ?? null;
  const bs = bScore?.value ?? null;
  const delta = hundredDelta(as, bs, scale);
  return (
    <div className="card stack">
      <SectionTitle icon={Gauge}>合計と条件ごと（A→B）</SectionTitle>
      {abDiff?.value && (
        <div className="stat-row">
          {delta && (
            <Stat
              icon={Gauge}
              label="合計点の差（B−A）"
              tone={delta.d > 0 ? 'ok' : delta.d < 0 ? 'warn' : 'plain'}
              value={delta.d === 0 ? '差なし' : `B が ${deltaText(delta.d, '')}`}
              unit={delta.d === 0 ? undefined : '点'}
              note={`${delta.a}点 → ${delta.b}点${as && bs && as.hardViolations.length + bs.hardViolations.length > 0 ? '（参考）' : ''}`}
            />
          )}
          <Stat
            icon={Car}
            label="移動の差"
            tone={abDiff.value.travelDelta < 0 ? 'ok' : abDiff.value.travelDelta > 0 ? 'warn' : 'plain'}
            value={deltaText(abDiff.value.travelDelta, '')}
            unit={Math.round(abDiff.value.travelDelta * 10) === 0 ? undefined : '分'}
            note={as && bs ? `${r0(as.travelMinutes)} → ${r0(bs.travelMinutes)}` : undefined}
          />
          <Stat icon={Users} label="担当が変わった訪問" value={abDiff.value.changedVisits.length} unit="件" />
          {as && bs && (as.dropped > 0 || bs.dropped > 0) && (
            <Stat
              icon={CircleOff}
              label="入らない訪問"
              tone={bs.dropped > as.dropped ? 'warn' : 'plain'}
              value={`${as.dropped} → ${bs.dropped}`}
              unit="件"
            />
          )}
        </div>
      )}
      <CompareTable
        a={as}
        b={bs}
        labels={[`A：${A.title}`, `B：${B.title}`]}
        rules={rules}
        error={aScore?.error ?? bScore?.error}
        scale={scale}
      />
    </div>
  );
}

/** 入らなかった訪問（A・B それぞれ）。どの担当もできない訪問はその理由、ほかは説明の理由 */
function UnassignedList({
  choice,
  explain,
  side,
  infeasible,
  visitLabel,
  staffTerm,
}: {
  choice: CompareChoice;
  explain: ReadonlyMap<string, VisitExplain>;
  side: string;
  infeasible: ReadonlyMap<string, Reason[]>;
  visitLabel: (id: string) => string;
  staffTerm: string;
}) {
  if (choice.unassigned.length === 0) return null;
  return (
    <div className="stack" style={{ gap: 4 }}>
      <strong className="ab-title">
        <span className={`ab-badge ab-${side.toLowerCase()}`}>{side}</span>
        {choice.title}
      </strong>
      {choice.unassigned.map((id) => {
        const inf = infeasible.get(id);
        const reasons = inf ?? explain.get(id)?.reasons ?? [];
        return (
          <div key={id} className="row" style={{ flexWrap: 'wrap' }}>
            <span>{visitLabel(id)}</span>
            {inf && <span className="sub">どの{staffTerm}も担当できません：</span>}
            {reasons.map((r) => (
              <span key={`${r.ruleId}:${r.label}`} className="chip chip-warn">
                {r.label}
                {Number.isFinite(r.points) && ` ${pointsText(r.points)}`}
              </span>
            ))}
            {reasons.length === 0 && <span className="sub">（原因を出せませんでした）</span>}
          </div>
        );
      })}
    </div>
  );
}

/** 比べる担当のカード：見出し（点数の基準）・比べる案の一覧（無ければ空の画面）・提案を作る欄 */
export function ChoicesCard({
  date,
  rulerName,
  onOpenDay,
  table,
  make,
}: {
  date: string;
  rulerName: string;
  /** 空の画面の「日の画面で作る」 */
  onOpenDay: (date: string) => void;
  table: ChoicesTableProps;
  /** 提案を作る欄（計算できる訪問が無い日は null） */
  make: { presets: readonly Preset[]; proposal: CompareProposal } | null;
}) {
  const count = table.choices.length;
  return (
    <div className="card stack">
      <SectionTitle
        icon={History}
        aside={
          <span className="row" style={{ gap: 6 }}>
            <span className="sub" data-testid="score-ruler">
              <Term k="scoreBase" />：{rulerName}
            </span>
            <Hint>
              <ul className="hint-list">
                <li>提案はこの画面にいるあいだだけ残ります（保存しません。日付を変えると消えます）。</li>
                <li>{rulerText(rulerName)}。</li>
                <li>点数は、{SCORE_TEXT}です。高いほど良い組み方です。</li>
              </ul>
            </Hint>
          </span>
        }
      >
        比べる担当（{count}件）
      </SectionTitle>
      {count === 0 ? (
        // 空の画面（PRD D176）：なぜ空かと次の一手（日の画面で作る・月のまとめて作る）
        <EmptyNext guide={compareEmptyGuide({ date })} icon={History} onOpenDay={onOpenDay} testId="compare-empty" />
      ) : (
        <ChoicesTable {...table} />
      )}
      {make && <MakeProposal date={date} choiceCount={count} presets={make.presets} proposal={make.proposal} />}
    </div>
  );
}

/** 割り当てられなかった訪問（A・B それぞれ） */
export function UnassignedCard({
  A,
  B,
  aExplain,
  bExplain,
  infeasible,
  visitLabel,
  staffTerm,
}: {
  A: CompareChoice;
  B: CompareChoice;
  aExplain: ReadonlyMap<string, VisitExplain>;
  bExplain: ReadonlyMap<string, VisitExplain>;
  infeasible: ReadonlyMap<string, Reason[]>;
  visitLabel: (id: string) => string;
  staffTerm: string;
}) {
  const common = { infeasible, visitLabel, staffTerm };
  return (
    <div className="card stack">
      <SectionTitle icon={CircleOff}>割り当てられなかった訪問</SectionTitle>
      <UnassignedList choice={A} explain={aExplain} side="A" {...common} />
      <UnassignedList choice={B} explain={bExplain} side="B" {...common} />
    </div>
  );
}

/** 計算に入れなかった訪問（〈利用者さん〉が休止中・位置が未登録など） */
export function NotInProblemCard({
  visits,
  visitLabel,
  clientTerm,
}: {
  visits: readonly Visit[];
  visitLabel: (id: string) => string;
  clientTerm: string;
}) {
  return (
    <div className="card stack">
      <SectionTitle
        icon={TriangleAlert}
        aside={
          <Hint>
            {clientTerm}が休止中・位置が未登録などの訪問です（{clientTerm}の画面で直せます）。
          </Hint>
        }
      >
        計算に入れなかった訪問
      </SectionTitle>
      {visits.map((v) => (
        <span key={v.id}>{visitLabel(v.id)}</span>
      ))}
    </div>
  );
}

/** 画面の見出し（担当を組むに戻るリンク） */
export function CompareHeader({ date }: { date: string }) {
  return (
    <PageHeader
      nav={<ArrangeTabs />}
      icon={GitCompareArrows}
      title="提案を比べる"
      lead="今の担当と、考え方（プリセット）ごとに作った提案を2つ選んで比べます。提案は保存しません。よければ「反映する」"
      actions={
        <NavLink to={`/arrange?date=${date}`} className="plan-compare-link" data-testid="compare-back">
          <WithIcon icon={CalendarDays}>担当を組むに戻る（{dateText(date)}）</WithIcon>
        </NavLink>
      }
    />
  );
}

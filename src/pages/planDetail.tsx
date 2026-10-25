// 日の予定の「詳しく」の欄（PRD D63。ADR-0010）：今の担当の合計点・移動・待ち・要対応、条件ごとの達成、件数の偏り
import { Car, CircleOff, Gauge, Hourglass, ListChecks, Scale, ShieldAlert, ShieldCheck } from 'lucide-react';
import { StaffMarkById } from '../components/StaffMark';
import { Term } from '../components/Term';
import { Empty, Hint, SidePanel, Stat } from '../components/ui';
import type { Terms } from '../contracts/documents';
import type { PlanScore, Problem, RuleAchievement, ScoreScale } from '../contracts/problem';
import type { Rule } from '../contracts/rules';
import { BALANCE_RULE_KEY, hundredBreakdown, toHundred } from '../evaluate';
import { own, pointsText, r0 } from '../lib/common';
import { AchievementList, breakdownText, HundredHint, RefMark } from './planParts';

/** 「詳しく」の欄（cs は今の担当の採点。計算できる訪問が無ければ null） */
export function PlanDetailPanel({
  cs,
  scoreProblem,
  scoreScale,
  scoreRulerName,
  curAch,
  rules,
  terms,
  routes,
  staffName,
  onClose,
}: {
  cs: PlanScore | null;
  scoreProblem: Problem | null;
  scoreScale: ScoreScale | null;
  scoreRulerName: string;
  /** 条件ごとの達成 */
  curAch: RuleAchievement[];
  rules: Rule[];
  terms: Terms;
  routes: Record<string, string[]>;
  staffName: (id: string) => string;
  onClose: () => void;
}) {
  return (
    <SidePanel icon={Gauge} title="今の担当の詳しく" onClose={onClose}>
      {cs ? (
        <div className="stack" data-testid="plan-detail-panel">
          <PlanSummary
            current={cs}
            problem={scoreProblem}
            scale={scoreScale}
            rulerName={scoreRulerName}
            balanceOut={(() => {
              const b = curAch.find((x) => x.ruleId === BALANCE_RULE_KEY);
              return b ? b.total - b.met : null;
            })()}
          />
          {scoreProblem && (
            <div className="stack" style={{ gap: 6 }}>
              <strong className="balance-title">
                <ListChecks size={15} aria-hidden="true" />
                条件ごとの達成
              </strong>
              <AchievementList list={curAch} rules={rules} terms={terms} />
            </div>
          )}
          {scoreProblem && <BalanceChips problem={scoreProblem} routes={routes} staffName={staffName} />}
        </div>
      ) : (
        <Empty icon={Gauge}>この日に計算できる訪問がありません</Empty>
      )}
    </SidePanel>
  );
}

/** 今の担当の合計点（100点満点）・移動・待ち・要対応 */
function PlanSummary({
  current,
  problem,
  scale,
  rulerName,
  balanceOut,
}: {
  current: PlanScore | null;
  /** 点数の基準の物差しの問題と物差し（ADR-0010） */
  problem: Problem | null;
  scale: ScoreScale | null;
  /** 点数の基準のプリセットの名前 */
  rulerName: string;
  /** 件数の目安から外れた人の数（負担の均等が無効なら null） */
  balanceOut: number | null;
}) {
  if (!current) return null;
  const hard = current.hardViolations.length;
  const hundred = scale ? toHundred(current.total, scale) : null;
  const parts = scale && problem ? hundredBreakdown(current, scale, problem) : [];
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="stat-row">
        <Stat
          icon={Gauge}
          label={hard > 0 ? '合計（参考）' : '合計'}
          tone="primary"
          value={hundred ?? '—'}
          unit="点"
          note={breakdownText(parts) || undefined}
        />
        <Stat icon={Car} label="移動" value={r0(current.travelMinutes)} unit="分" />
        <Stat icon={Hourglass} label={<Term k="wait" />} value={r0(current.waitMinutes)} unit="分" />
        {balanceOut !== null && (
          <Stat
            icon={Scale}
            label="目安から外れた人"
            tone={balanceOut > 0 ? 'warn' : 'ok'}
            value={balanceOut}
            unit="人"
            note={balanceOut > 0 ? `負担の均等 ${pointsText(current.balancePoints)}点` : undefined}
          />
        )}
        <Stat
          icon={hard > 0 ? ShieldAlert : ShieldCheck}
          label="守れない条件"
          tone={hard > 0 ? 'danger' : 'ok'}
          value={hard}
          unit="件"
        />
        {current.dropped > 0 && (
          <Stat icon={CircleOff} label="担当なし" tone="warn" value={current.dropped} unit="件" />
        )}
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 12 }}>
        {scale && (
          <span className="sub" data-testid="score-ruler">
            <Term k="scoreBase" />：{rulerName}
          </span>
        )}
        {scale && <HundredHint cost={current.total} parts={parts} scale={scale} rulerName={rulerName} />}
        {scale && <RefMark hard={hard} />}
      </div>
    </div>
  );
}

/** スタッフごとの件数と目安の帯（帯の外は色、必須の上限を超えたら赤）。名前の前は〈スタッフ〉の印（StaffMark） */
function BalanceChips({
  problem,
  routes,
  staffName,
}: {
  problem: Problem;
  routes: Record<string, string[]>;
  staffName: (id: string) => string;
}) {
  const b = problem.balance;
  const rows = problem.staff
    .map((s, i) => ({ id: s.id, i, n: own(routes, s.id)?.length ?? 0, working: s.slots.length > 0 }))
    .filter((x) => x.working || x.n > 0);
  // 横棒の目盛りの最大（件数・目安の上・必須の上限のうち最大＋余白）
  const max = Math.max(1, ...rows.map(({ i, n }) => Math.max(n, b?.hi[i] ?? 0, b?.cap?.[i] ?? 0)));
  const pct = (v: number) => `${(Math.min(v, max) / max) * 100}%`;
  return (
    <div className="stack balance" style={{ gap: 6 }}>
      <div className="spread">
        <strong className="balance-title">
          <Scale size={15} aria-hidden="true" />
          件数の偏り
        </strong>
        <Hint>
          {b ? '色のついた帯が目安です。働ける時間が長い人ほど多くなります。' : '負担の均等の条件が無効です。'}
          {b?.cap ? '必須なので、目安より1件多いところまでです。' : ''}
        </Hint>
      </div>
      {rows.map(({ id, i, n }) => {
        const lo = b?.lo[i] ?? 0;
        const hi = b?.hi[i] ?? 0;
        const over = b?.cap ? n > (b.cap[i] ?? Number.POSITIVE_INFINITY) : false;
        const out = b ? n < lo || n > hi : false;
        const tone = over ? 'red' : out ? 'warn' : 'ok';
        const band = lo === hi ? `${lo}` : `${lo}〜${hi}`;
        return (
          <div key={id} className="balance-row" title={b ? `目安 ${band}件` : ''}>
            <span className="balance-name ellipsis">
              <StaffMarkById id={id} size="xs" />
              {staffName(id)}
            </span>
            <div
              className="balance-bar"
              role="img"
              aria-label={`${staffName(id)} ${n}件${b ? `（目安 ${band}件）` : ''}`}
            >
              {b && <span className="balance-band" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} />}
              <span className={`balance-fill tone-${tone}`} style={{ width: pct(n) }} />
            </div>
            <span className={`balance-num tone-${tone}`}>
              {n}件{b && <small>目安 {band}</small>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

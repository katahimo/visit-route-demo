// 週の予定の準備（PRD D328・D314。ADR-0046・ADR-0053・ADR-0054）の純粋関数：見出しの主ボタン（この週の問題の無い日を
// まとめて確定 → 済み）を状態から1つ決める決まり・この週の準備のまとめと、日の見出しの件数の文。週の予定では AI で組まない（手で直す。ADR-0063）。
// データは書き換えない。画面は pages/WeekPage.tsx
import { type BulkConfirm, bulkConfirmTargets } from './confirmDay';
import type { DayStatus, RangeProgress } from './month';

/**
 * 週の主ボタンの状態：確定する／残りは日の予定で（ボタンなし）／済み（ボタンなし）／今日以降に訪問が無い（ボタンなし）
 */
export type WeekNextKind = 'confirm' | 'rest' | 'done' | 'none';

export type WeekNext = {
  kind: WeekNextKind;
  /** ボタン（または状態）の文 */
  label: string;
  /** 狭い画面（390px）の短い文 */
  short: string;
  /** 押せないときの理由（見える文。押せるなら null） */
  why: string | null;
};

export type WeekNextInput = {
  /** 週の今日以降で訪問がある日の数 */
  futureDays: number;
  /** 週の今日以降の確定していない日の振り分け（lib/confirmDay の bulkConfirmTargets。月の予定と同じ決まり） */
  bulk: BulkConfirm;
  /** 月の予定の担当を組む計算（lib/monthBatch）を回しているか */
  running: boolean;
  /** 確定（伝えた）の段階を出すか（lib/settledView の showConfirmStep。省略は出す）。切なら主ボタンも状態も出さない（ADR-0073） */
  confirmStep?: boolean;
};

/** 確定のボタンの文（月の「問題の無い日をまとめて確定（N日）」の範囲を週にしたもの） */
export const weekConfirmLabel = (n: number): string => `この週の問題の無い日をまとめて確定（${n}日）`;

/**
 * 週の主ボタン（PRD D328）。仕事の順（確定 → 済み）で最初に残っているもの：
 * 1. 今日以降に訪問が無い → ボタンなし
 * 2. 問題の無い伝えていない日がある → この週の問題の無い日をまとめて確定（月の予定で担当を組んでいる間は押せず理由）
 * 3. 確定していない日が残る（要対応の日・未連絡の変更のある日）→ ボタンなし（日の予定で確かめて確定）
 * 4. 何も残っていない → 済み
 */
export function weekNext(x: WeekNextInput): WeekNext {
  const busy = x.running;
  if (x.confirmStep === false) return { kind: 'none', label: '', short: '', why: null };
  if (x.futureDays === 0)
    return { kind: 'none', label: 'この週の今日以降に訪問はありません', short: '訪問なし', why: null };
  if (x.bulk.targets.length > 0)
    return {
      kind: 'confirm',
      label: weekConfirmLabel(x.bulk.targets.length),
      short: `この週をまとめて確定（${x.bulk.targets.length}日）`,
      why: busy ? '担当を組んでいる間は確定できません' : null,
    };
  const rest = x.bulk.problem.length + x.bulk.changed.length;
  if (rest > 0) {
    const why =
      x.bulk.problem.length > 0 && x.bulk.changed.length > 0
        ? '要対応・未連絡の変更の日は日の予定で確かめて確定'
        : x.bulk.problem.length > 0
          ? '要対応の日は日の予定で確かめて確定'
          : '未連絡の変更の日は日の予定で確かめて確定';
    return { kind: 'rest', label: `未確定 ${rest}日`, short: `未確定 ${rest}日`, why };
  }
  return { kind: 'done', label: '確定済み', short: '確定済み', why: null };
}

/** 日の見出しの件数の文（PRD D314）：「N件」、担当なしがあれば「N件・担当なしM」 */
export function weekDayCountText(x: { count: number; unassigned: number }): string {
  return `${x.count}件${x.unassigned > 0 ? `・担当なし${x.unassigned}` : ''}`;
}

/** 1行の状態の文（「この週の今日以降：…」の続き）。expert 切は確定の段階が無いので、変更ありの日数と要対応だけ */
export function weekStatusText(line: WeekPrep['line'], confirmStep: boolean): string {
  if (confirmStep)
    return `確定済み ${line.told}日・まだ伝えていない ${line.notYet}日${line.changed > 0 ? `・未連絡の変更 ${line.changed}日` : ''}・要対応 ${line.care}件`;
  return `${line.changed > 0 ? `変更あり ${line.changed}日・` : ''}要対応 ${line.care}件`;
}

/** この週の準備のまとめ（PRD D328・D332）：まとめて確定の振り分け・今日以降の訪問のある日の数・1行の状態 */
export type WeekPrep = {
  bulk: BulkConfirm;
  futureDays: number;
  /** 1行の状態：確定済み・未連絡の変更・まだ伝えていない日の数と要対応の件数 */
  line: { told: number; changed: number; notYet: number; care: number };
};

/**
 * この週の準備のまとめ。p は週の今日以降の rangeProgress（lib/month。月の予定と同じ数え方）、statusOf は日の状態。
 * まとめて確定の振り分けは月と同じ決まり（lib/confirmDay の bulkConfirmTargets）
 */
export function weekPrepOf(
  p: Pick<RangeProgress, 'unconfirmed' | 'attentionItems' | 'days' | 'confirmed' | 'changed' | 'notYet' | 'care'>,
  statusOf: (date: string) => DayStatus | undefined,
): WeekPrep {
  return {
    bulk: bulkConfirmTargets(p.unconfirmed, statusOf, p.attentionItems),
    futureDays: p.days,
    line: { told: p.confirmed, changed: p.changed, notYet: p.notYet, care: p.care },
  };
}

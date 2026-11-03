// 〈利用者さん〉の繰り返し（定期パターン）を足す処理（ADR-0012・0072）：入力を確かめて足し、足した分の担当なしの回を自動で組む。
// 〈利用者さん〉の画面の「繰り返しを足す」（pages/usePatternsFlow）と、予定の「定期の予定を追加」（AddPlanPanel）が使う。データを書くのは store の update だけ
import type { DemoData } from '../contracts/data';
import type { Pattern } from '../contracts/documents';
import { jstDate } from '../domain/time';
import { requestAutoArrange } from '../lib/autoArrangeBatch';
import { type PatternForm, parsePatternForm } from '../lib/patternForm';
import { useDemoData } from '../store';

/** 足した結果：誤り（文）か、足した繰り返しと自動の組みを頼んだか */
export type PatternAddResult = { error: string } | { pattern: Pattern; auto: boolean };

/** 繰り返しを足す関数（開始日は form.from。足したあと保存前後のデータで増えた担当なしの回を、開始日（今日より前なら今日）から翌月末まで自動で組む。繰り返しの担当も書く） */
export function usePatternAdd(): (form: PatternForm, clientId: string) => PatternAddResult {
  const { data, update } = useDemoData();
  return (form, clientId) => {
    const today = jstDate(Date.now());
    // 回は見るときに計算するので、繰り返しを足すだけ（版2）
    const p = parsePatternForm(form, form.from, clientId, data.visitTypes);
    if (typeof p === 'string') return { error: p };
    const add = (d: DemoData): DemoData => ({ ...d, patterns: [...d.patterns, p] });
    // 保存後のデータは先に1回だけ作り、store にもそれを入れる（自動の組みが読むデータと参照をそろえる）
    const after = add(data);
    update((d) => (d === data ? after : add(d)), '繰り返しを足す');
    return { pattern: p, auto: requestAutoArrange({ before: data, after, today, writeUsual: true, from: p.from }) };
  };
}

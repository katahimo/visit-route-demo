// 起動したときの初期データ（PRD D322。ADR-0053・ADR-0064）。
// 初期データの今日からの日は AI で組まない（繰り返しの担当のまま）。AI で組むのは「担当を組む」で（標準が無い間は組み方の標準を先に決める。ADR-0065）。
// AI で組んだ日のあるデータ（テスト用）は plans.testkit.ts の withSeedPlans
import type { DemoData } from '../contracts/data';
import type { Features } from '../contracts/features';
import { addDays } from '../domain/time';
import { visitsOn } from '../patterns';
import { createDemoData, seedPatternStart } from './index';

/**
 * 起動したときの初期データ：seed の人・決まり・繰り返し（createDemoData）に、過去の日を伝えた状態にしたもの。
 * 今日からの日は繰り返しの担当のまま（AI で組まない。ADR-0064）。features は機能の入り切り（既定はエキスパート機能だけ切の { expert: false }。ADR-0072）
 */
export function createInitialData(today: string, features: Features = { expert: false }): DemoData {
  const d = createDemoData(today);
  return withPastTold({ ...d, org: { ...d.org, features } }, today);
}

/**
 * 繰り返しの開始日（前の月の1日）から昨日までを「伝えた」状態にする（過去の予定は済んだもの。月の予定で混み具合を見られる）。
 * 担当は繰り返しの担当（重ならない人を選んである）のまま、伝えた内容に今の担当を写す（開始は書かない＝時刻の違いを数えない）。
 * 確定した時刻はその日の18:00（日本時間）。計算しないので起動を待たせない
 */
function withPastTold(data: DemoData, today: string): DemoData {
  const snapshots = { ...data.snapshots };
  for (let date = seedPatternStart(today); date < today; date = addDays(date, 1)) {
    const visits = visitsOn(data, date).filter((v) => !v.cancelled);
    if (visits.length === 0) continue;
    snapshots[date] = {
      date,
      at: Date.parse(`${date}T18:00:00+09:00`),
      visits: visits.map((v) => ({ id: v.id, clientId: v.clientId, staffId: v.staffId, start: null })),
    };
  }
  return { ...data, snapshots };
}

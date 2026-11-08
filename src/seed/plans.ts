// 起動したときの初期データ（PRD D322。ADR-0053・ADR-0064）。
// 初期データの今日からの日は AI で組まない（繰り返しの担当のまま。その日に担当できない回だけ「この回だけ担当なし」）。AI で組むのは自動の組みと「担当を組む」で。
// AI で組んだ日のあるデータ（テスト用）は plans.testkit.ts の withSeedPlans
import type { DemoData } from '../contracts/data';
import type { Features } from '../contracts/features';
import { addDays } from '../domain/time';
import { compile } from '../matching/compile';
import { putVisits, visitsOn } from '../patterns';
import { createDemoData, DEMO_DAYS, seedPatternStart } from './index';

/**
 * 起動したときの初期データ：seed の人・決まり・繰り返し（createDemoData）に、過去の日を伝えた状態にしたもの。
 * 今日からの日は繰り返しの担当のまま（AI で組まない。ADR-0064）。ただし繰り返しの担当がその日に担当できない回
 * （勤務の上書き・休み・欠勤に収まらないなど）は「この回だけ担当なし」で保存する（PRD D322。デモで始めるときの D409 が埋める）。
 * features は機能の入り切り（既定はエキスパート機能だけ切の { expert: false }。ADR-0072）
 */
export function createInitialData(today: string, features: Features = { expert: false }): DemoData {
  const d = createDemoData(today);
  const withFeatures = { ...d, org: { ...d.org, features } };
  return withPastTold(withUnfitUnassigned(withFeatures, today, DEMO_DAYS), today);
}

/**
 * today から days 日分で、担当のある回のうちその日にその担当が担当できない（compile の可否が否。
 * 稼働時間帯の上書き・休み・欠勤に作業が収まらない・必須の条件・相性×）回を、担当なし・開始なし・ピンなしで保存した回にする。
 * 繰り返しの担当は変えない。この回だけ変えた印（edited）は付けない（担当だけの違いは edited にしない）
 */
function withUnfitUnassigned(data: DemoData, today: string, days: number): DemoData {
  const put: DemoData['visits'] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const problem = compile(data, date);
    const visitIndex = new Map(problem.visits.map((v, j) => [v.id, j]));
    const staffIndex = new Map(problem.staff.map((s, k) => [s.id, k]));
    for (const v of visitsOn(data, date)) {
      if (v.cancelled || v.staffId === null) continue;
      const j = visitIndex.get(v.id);
      const k = staffIndex.get(v.staffId);
      if (j === undefined) continue;
      if (k === undefined || !problem.allowed[j]?.[k]) put.push({ ...v, staffId: null, start: null, pinned: false });
    }
  }
  return put.length > 0 ? { ...data, visits: putVisits(data.visits, put) } : data;
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

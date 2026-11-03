// 移動・遠方（出張）の理由のキーと文（PRD D429。ADR-0096）。担当なしの理由・守れない条件の案内が使う。
// 理由の文は evaluate（explain の担当なしの理由・採点の必須の違反）が matching/travel の文で作る。ここはその見分けと案内の文をまとめる
import { FAR_TRIP_LABEL, FAR_TRIP_RULE_ID, TRAVEL_TOO_FAR_RULE_ID, TRAVEL_TOO_FAR_WORD } from '../matching';

/** 移動・遠方（出張）の理由のキー（Reason.ruleId と同じ） */
export type TravelReasonKey = typeof TRAVEL_TOO_FAR_RULE_ID | typeof FAR_TRIP_RULE_ID;

/** 呼び方（data.org.terms） */
type Terms = { client: string; staff: string };

/**
 * キーごとの文：word は理由の文に含まれる言葉（label で見分ける）、hint は直し方の案内（〈利用者さん〉の画面の場所の節）
 */
const TRAVEL_REASONS: Record<TravelReasonKey, { word: string; hint: (t: Terms) => string }> = {
  [TRAVEL_TOO_FAR_RULE_ID]: {
    word: TRAVEL_TOO_FAR_WORD,
    hint: (t) =>
      `距離から見積もった移動では、勤務の開始に家を出ても間に合いません。新幹線・飛行機などで行くときは、${t.client}の画面の場所の「移動時間（片道・分）」と「遠方（出張）」を入れてください`,
  },
  [FAR_TRIP_RULE_ID]: {
    word: FAR_TRIP_LABEL,
    hint: (t) => `遠方（出張）の${t.client}の訪問がある日は、その${t.staff}にほかの訪問を入れません`,
  },
};

/**
 * 理由が移動・遠方（出張）のものなら、そのキーと直し方の案内（ruleId か、文の言葉で見分ける。ruleId の無い必須の違反は label だけ渡す）。
 * 違えば null。どちらも直す所は〈利用者さん〉の画面の場所の節
 */
export function travelReasonOf(
  r: { ruleId?: string; label: string },
  terms: Terms,
): { key: TravelReasonKey; hint: string } | null {
  for (const key of [TRAVEL_TOO_FAR_RULE_ID, FAR_TRIP_RULE_ID] as const) {
    const x = TRAVEL_REASONS[key];
    if (r.ruleId === key || r.label.includes(x.word)) return { key, hint: x.hint(terms) };
  }
  return null;
}

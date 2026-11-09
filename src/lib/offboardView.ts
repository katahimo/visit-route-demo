// 退職・担当替えの一括振り直し（PRD D71。ADR-0015）の欄の文と並び：持ち方の文・候補の文・訪問の日ごとのまとめ・適用前の確認の文。
// 範囲と候補の計算は lib/offboard
import type { Client } from '../contracts/documents';
import { mdText } from './dateText';
import {
  addsAllowed,
  OFFBOARD_SAMPLE_DAYS,
  type OffboardCandidate,
  type OffboardClient,
  type OffboardRole,
  type OffboardVisit,
  staysOutsideAllowed,
} from './offboard';

/** 持ち方の文 */
const ROLE_TEXT: Record<OffboardRole, string> = {
  pattern: '繰り返しの担当',
  allowed: '担当できる人',
  visit: '訪問の担当',
};

/** いまの持ち方（例「繰り返しの担当（2つ）・担当できる人」） */
export const offboardRolesText = (c: Pick<OffboardClient, 'roles' | 'patternIds'>): string =>
  c.roles
    .map((r) =>
      r === 'pattern' && c.patternIds.length > 1 ? `${ROLE_TEXT[r]}（${c.patternIds.length}つ）` : ROLE_TEXT[r],
    )
    .join('・');

/** 候補の選びの文（名前のあと。例「（入れる 3/4回・4週の受け持ち 12回）」） */
export function offboardCandidateText(c: Pick<OffboardClient, 'sample'>, x: OffboardCandidate): string {
  const fit = c.sample === 0 ? '見本の訪問なし' : x.fits === 0 ? '入れる回なし' : `入れる ${x.fits}/${c.sample}回`;
  return `（${fit}・${OFFBOARD_SAMPLE_DAYS / 7}週の受け持ち ${x.load}回）`;
}

/** 代わりに選んだ人が担当できる人に足されるときの行の文（足されないときは null） */
export function offboardAddsAllowedText(
  c: Pick<Client, 'allowedStaffIds'>,
  staffId: string,
  to: { id: string; name: string } | null,
): string | null {
  return to && addsAllowed(c, staffId, to.id) ? `${to.name}さんを担当できる人に足します` : null;
}

/** 代わりに選んだ人が担当できる人の外のままになるときの行の文（そうでないときは null） */
export function offboardOutsideAllowedText(
  c: Pick<Client, 'allowedStaffIds'>,
  staffId: string,
  to: { id: string; name: string } | null,
  limitsOn: boolean,
): string | null {
  return to && staysOutsideAllowed(c, staffId, to.id, limitsOn)
    ? `${to.name}さんは担当できる人に入っていないため、訪問は要対応に残ります`
    : null;
}

/** 訪問を日ごとにまとめる（出てきた順。件数と確定した件数） */
export function offboardDays(
  visits: readonly Pick<OffboardVisit, 'date' | 'confirmed'>[],
): [string, { count: number; confirmed: number }][] {
  const out = new Map<string, { count: number; confirmed: number }>();
  for (const v of visits) {
    const x = out.get(v.date) ?? { count: 0, confirmed: 0 };
    x.count++;
    if (v.confirmed) x.confirmed++;
    out.set(v.date, x);
  }
  return [...out];
}

/** 「まとめて適用」の確認の本文 */
export function offboardConfirmBody(x: {
  /** 置き換える〈利用者さん〉の数 */
  count: number;
  /** 置き換える最初の日 */
  from: string;
  /** 「だれにもしない」にした〈利用者さん〉の名前 */
  nobody: readonly (string | undefined)[];
  /** 担当できる人がいなくなる〈利用者さん〉の名前 */
  unlimited: readonly (string | undefined)[];
  /** 新しい繰り返しの回にする、この回だけ変えた回の数 */
  renamed: number;
  terms: { client: string; staff: string };
}): string {
  const { count, from, nobody, unlimited, renamed, terms } = x;
  return `${count}人の${terms.client}の担当を、${mdText(from)}から選んだ${terms.staff}に移します（それより前の日はそのまま）。${
    nobody.length > 0 ? `${nobody.join('・')}は「だれにもしない」なので、担当なしになります。` : ''
  }${
    unlimited.length > 0
      ? `${unlimited.join('・')}は担当できる人がいなくなり、担当を限らなくなります（だれでも担当できます）。`
      : ''
  }${
    renamed > 0
      ? `繰り返しは${mdText(from)}で分け、この回だけ変えた ${renamed}件は新しい繰り返しの回にします（時刻・メモはそのまま）。`
      : ''
  }${mdText(from)}からの訪問の担当も選んだ人になります（入らない回は要対応に出ます）。`;
}

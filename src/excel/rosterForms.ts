// ほかのソフトの名簿の形の一覧（ADR-0075）：名簿の CSV を読むとき、1行目の列名で形を見分け、名簿の列の表に写す。
// 新しいソフト（別の会社）の CSV を読むときは、形ごとのファイル（ledgerCsv・reserveCsv のように列名と写し方を書く）を作り、
// ここの ROSTER_FORMS に1行足す。読み方（rosterRows）・画面・確認の文は変えなくてよい
import type { RosterKind } from '../contracts/data';
import type { Item } from '../contracts/rules';
import type { RosterTable } from './csvColumns';
import {
  GENERIC_CLIENT_KEEP_BLANK,
  GENERIC_STAFF_KEEP_BLANK,
  genericClientErrorMessage,
  genericClientToRoster,
  genericStaffErrorMessage,
  genericStaffToRoster,
} from './genericCsv';
import { ledgerErrorMessage, ledgerToRoster } from './ledgerCsv';
import {
  RESERVE_CLIENT_KEEP_BLANK,
  RESERVE_STAFF_KEEP_BLANK,
  reserveClientErrorMessage,
  reserveClientToRoster,
  reserveStaffErrorMessage,
  reserveStaffToRoster,
} from './reserveCsv';
import { STAFF_LEDGER_KEEP_BLANK, staffLedgerErrorMessage, staffLedgerToRoster } from './staffLedgerCsv';

/** 形を写すときに渡す値（今日で決まる値＝退職日を過ぎたら休止、など） */
export interface RosterFormEnv {
  /** 今日（YYYY-MM-DD） */
  today: string;
  /** 今の項目（職員台帳の資格を〈スタッフ〉の項目「資格」の選択肢に写す） */
  items: readonly Item[];
}

/** ほかのソフトの名簿の形 */
export interface RosterForm {
  /** 形の ID（テスト・ログ用。重ねない） */
  id: string;
  /** 確認の文に出す形の名前（「〈label〉の形として読みました」） */
  label: string;
  /** 読む名簿（〈利用者さん〉か〈スタッフ〉） */
  kind: RosterKind;
  /** CSV の表（1行目が列名）→ 名簿の列の表。この形でなければ null */
  toRoster: (table: readonly (readonly string[])[], env: RosterFormEnv) => RosterTable | null;
  /** 読み込みの誤りの文の『列名』を、この形の列名に直す（無ければそのまま） */
  errorMessage?: (message: string) => string;
  /**
   * セルが空なら今の値のままにする名簿の列（元のソフトに無い・空のことが多い値を、アプリで入れたあとに読み直しても消さない。
   * 例：緯度・経度・住所）
   */
  keepBlank?: readonly string[];
}

/** 形の一覧（上から順に見分ける。先に当たった形で読む） */
export const ROSTER_FORMS: readonly RosterForm[] = [
  {
    id: 'ledger',
    label: '顧客台帳',
    kind: 'client',
    toRoster: (t) => ledgerToRoster(t),
    errorMessage: ledgerErrorMessage,
  },
  {
    id: 'reserve-client',
    label: '予約システムの顧客',
    kind: 'client',
    toRoster: (t, env) => reserveClientToRoster(t, env.today),
    errorMessage: reserveClientErrorMessage,
    keepBlank: RESERVE_CLIENT_KEEP_BLANK,
  },
  {
    id: 'reserve-staff',
    label: '予約システムのスタッフ',
    kind: 'staff',
    toRoster: (t, env) => reserveStaffToRoster(t, env.today),
    errorMessage: reserveStaffErrorMessage,
    keepBlank: RESERVE_STAFF_KEEP_BLANK,
  },
  {
    id: 'staff-ledger',
    label: '職員台帳',
    kind: 'staff',
    toRoster: (t, env) => staffLedgerToRoster(t, env.today, env.items),
    errorMessage: staffLedgerErrorMessage,
    keepBlank: STAFF_LEDGER_KEEP_BLANK,
  },
  // 暫定の形（事業所のソフトが分からないとき）：名前らしい列があり、ほかの形でもアプリの名簿の形でもないときだけ当たるので、最後に置く
  {
    id: 'generic-client',
    label: '列名から読んだ名簿',
    kind: 'client',
    toRoster: (t) => genericClientToRoster(t),
    errorMessage: genericClientErrorMessage,
    keepBlank: GENERIC_CLIENT_KEEP_BLANK,
  },
  {
    id: 'generic-staff',
    label: '列名から読んだ名簿',
    kind: 'staff',
    toRoster: (t, env) => genericStaffToRoster(t, env.today, env.items),
    errorMessage: genericStaffErrorMessage,
    keepBlank: GENERIC_STAFF_KEEP_BLANK,
  },
];

/** 見分けた形と、写した表 */
export interface RosterFormHit {
  form: RosterForm;
  table: RosterTable;
}

/** CSV の表をほかのソフトの形として読む（どの形でもなければ null＝名簿の形として読む） */
export function readRosterForm(
  table: readonly (readonly string[])[],
  kind: RosterKind,
  env: RosterFormEnv,
  forms: readonly RosterForm[] = ROSTER_FORMS,
): RosterFormHit | null {
  for (const form of forms) {
    if (form.kind !== kind) continue;
    const t = form.toRoster(table, env);
    if (t) return { form, table: t };
  }
  return null;
}

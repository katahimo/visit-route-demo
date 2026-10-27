// 日の予定のメールの欄（PRD D92・D346。ADR-0017）の行と確定の文：担当ごとの行（宛先・件数・メール）と、
// 全員分を作ったら確定する欄の文。データは書き換えない純粋関数
import type { DemoData } from '../contracts/data';
import { byName, own } from './common';
import { dayByStaff, dayMailText, mailTo } from './mail';
import type { BuiltMail } from './mailto';
import type { PrintDay } from './monthPrint';

/** 担当ごとの1行（components/mailParts の MailRow に、予約送信で預ける件名・全文（text。ADR-0067）を足した形） */
export type DayMailRow = {
  key: string;
  name: string;
  email: string;
  summary: string;
  mail: BuiltMail | null;
  text: { subject: string; full: string };
};

/**
 * 日の予定のメールの行：有効な〈スタッフ〉のうち、その日に訪問がある・欠勤／希望休・伝えた内容に担当があった人（名前の順）。
 * notesOn が false なら訪問先の決まりごとを入れず、mapsOn が false なら道順を入れない。confirming（確定の欄から送る）なら
 * 本文の担当を「確定した担当」と書く（PRD D346）
 */
export function dayMailRows(
  data: DemoData,
  date: string,
  opts: { notesOn: boolean; mapsOn: boolean; includeKeys: boolean; confirming: boolean; limit: number },
): { day: PrintDay; rows: DayMailRow[]; mailSource: PrintDay['source'] } {
  const { day, byStaff } = dayByStaff(data, date);
  const staff = [...data.staff].filter((s) => s.active).sort(byName);
  /** 欠勤・希望休の人（PRD D92。行に出す。訪問が残っていなくても出す） */
  const offOf = new Map(
    day.off.filter((o) => o.kind !== 'noShift').map((o) => [o.staffId, o.kind === 'requested' ? '希望休' : '欠勤']),
  );
  /** 伝えた内容（確定）に担当があった人。伝えたあとに訪問が無くなった人にも「訪問はありません」を送れるよう行に出す */
  const toldStaff = new Set((own(data.snapshots, date)?.visits ?? []).flatMap((v) => (v.staffId ? [v.staffId] : [])));
  const listed = staff.filter((s) => (byStaff.get(s.id)?.length ?? 0) > 0 || offOf.has(s.id) || toldStaff.has(s.id));
  const mailSource = opts.confirming && day.source !== null ? 'confirmed' : day.source;
  const rows = listed.map((s) => {
    const all = byStaff.get(s.id) ?? [];
    const visits = opts.notesOn
      ? all
      : all.map((v) =>
          v.client
            ? { ...v, client: { ...v.client, entryNote: '', keyNote: '', parkingNote: '', cautionNote: '' } }
            : v,
        );
    const off = offOf.get(s.id);
    const text = dayMailText(
      data.org,
      opts.mapsOn ? s : { name: s.name },
      date,
      mailSource,
      visits,
      opts.notesOn && opts.includeKeys,
    );
    return {
      key: s.id,
      name: s.name,
      email: s.email,
      summary: [off, `訪問 ${visits.length}件`].filter(Boolean).join('・'),
      mail: mailTo(s.email, text, opts.limit),
      text: { subject: text.subject, full: text.full },
    };
  });
  return { day, rows, mailSource };
}

/** 送れる人（アドレスがあり、長すぎない）の行の key */
export const sendableKeys = (rows: readonly DayMailRow[]): string[] =>
  rows.filter((r) => r.mail && !r.mail.tooLong).map((r) => r.key);

/** 欄の確定の文（確定済み・送れる人がいない・元に戻したあと・数えている途中） */
export function dayMailProgress(x: {
  state: 'none' | 'told' | 'changed';
  sendable: number;
  sent: number;
  /** 全員分を作って1回確定した */
  autoDone: boolean;
}): string {
  if (x.state === 'told') return 'この日は確定（伝えた）済みです。';
  if (x.sendable === 0)
    return 'メールを送れる人がいません。電話などで伝えたら、下の「確定（伝えた）にする」で確定してください。';
  if (x.autoDone) return '確定を元に戻しました。確定するときは、下の「確定（伝えた）にする」を押してください。';
  return `メールを作った人 ${x.sent}/${x.sendable}人。全員分を作ると、この日を確定（伝えた）にします${
    x.state === 'changed' ? '（伝えたあとの変更も伝えた扱い）' : ''
  }。`;
}

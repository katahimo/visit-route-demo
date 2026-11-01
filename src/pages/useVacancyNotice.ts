import { useEffect, useMemo, useState } from 'react';
import { useMailLimit } from '../components/mailParts';
import { useToast } from '../components/Toast';
import type { DemoData } from '../contracts/data';
import type { Place } from '../contracts/documents';
import type { Condition } from '../contracts/rules';
import { hhmmToMinutes, jstDate, jstHhmm } from '../domain/time';
import { copyText } from '../lib/clipboard';
import { attempt } from '../lib/common';
import { referrerRecipients, vacancySubject } from '../lib/mail';
import { buildBccMails } from '../lib/mailto';
import { typeOf } from '../lib/patternText';
import { type NoticePeriod, noticeRange, vacancyQuery } from '../lib/vacancyView';
import { vacancyNotice, vacancyOf } from '../vacancy';
import { DEBOUNCE_MS } from './useVacancyResult';

/**
 * 空き枠の案内文（PRD D67。ADR-0013）：期間・種類を選ぶ。所要は種類の標準（種類の指定なしは上の条件の所要）、
 * 〈スタッフ〉の条件・場所は上の条件のまま。条件を変えると 300ms 間引いて計算し直す。
 * 紹介元へ BCC で一斉に送るメール（PRD D95。ADR-0017）もここ
 */
export function useVacancyNotice(
  data: DemoData,
  opts: {
    today: string;
    noticePeriod: NoticePeriod;
    noticeTypeId: string;
    requirements: Condition[];
    exactPlace: Place | null;
    durationOk: boolean;
    durationNum: number;
  },
) {
  const { today, noticePeriod, noticeTypeId, requirements, exactPlace, durationOk, durationNum } = opts;
  const terms = data.org.terms;
  const toast = useToast();
  const noticeType = typeOf(data.visitTypes, noticeTypeId);
  const noticeDuration = noticeType ? noticeType.durationMinutes : durationOk ? durationNum : null;
  const noticeSpan = useMemo(() => noticeRange(noticePeriod, today), [noticePeriod, today]);
  /**
   * 案内文を作る元の条件（変わるたびに新しい物）。作った文にはこれを付けておき、今の条件と違えば古い文として
   * コピー・メールを押せなくする（描いた時点で決まるので、計算し直すまでの間にも古い文で動かない）
   */
  const noticeInputs = useMemo(
    () => ({ data, noticeType, noticeDuration, requirements, exactPlace, noticeSpan, noticePeriod, terms }),
    [data, noticeType, noticeDuration, requirements, exactPlace, noticeSpan, noticePeriod, terms],
  );
  const [notice, setNotice] = useState<{ text: string; noPlan: string[]; inputs: typeof noticeInputs } | null>(null);
  /** 案内文の欄を開いているか（畳んでいる間は計算しない。問い合わせの即答の速さを落とさない。PRD D185） */
  const [noticeOpen, setNoticeOpen] = useState(false);
  /** 条件を変えてから案内文を計算し直すまで（古い文でコピー・メールさせない） */
  const noticeStale = notice === null || notice.inputs !== noticeInputs;
  // 紹介元へ BCC で一斉に（PRD D95。ADR-0017）：宛先は紹介元のメールを重複なく。外した宛先（小文字）だけを画面の中で持つ
  const referrers = useMemo(() => referrerRecipients(data.clients), [data.clients]);
  const [mailOff, setMailOff] = useState<ReadonlySet<string>>(new Set());
  const mailBcc = referrers.filter((r) => !mailOff.has(r.email.toLowerCase())).map((r) => r.email);
  const mailLimit = useMailLimit();
  // 宛先が多いと mailto が長すぎるので、目安の長さに収まるよう宛先を分けて複数のボタンにする（PRD D95・D96）
  const noticeMails =
    notice && !noticeStale && mailBcc.length > 0
      ? buildBccMails({ bcc: mailBcc, subject: vacancySubject(data.org), full: notice.text }, mailLimit)
      : [];
  const copyRecipients = async () =>
    toast(
      (await copyText(mailBcc.join(', ')))
        ? `宛先（${mailBcc.length}件）をコピーしました。メールの BCC に貼り付けてください`
        : 'コピーできませんでした。文を選んでコピーしてください',
    );
  const noticeMailWhy = noticeStale
    ? '案内文を計算し直しています'
    : referrers.length === 0
      ? `紹介元のメールアドレスが未登録です（${terms.client}の画面の「紹介元のメールアドレス」で入れられます）`
      : '宛先を1つ以上選んでください';
  useEffect(() => {
    const { data, noticeType, noticeDuration, requirements, exactPlace, noticeSpan, noticePeriod, terms } =
      noticeInputs;
    // 畳んだら古い文を捨てる（開き直したときに前の文を出さない）
    if (!noticeOpen) {
      setNotice(null);
      return;
    }
    if (noticeDuration === null) {
      setNotice(null);
      return;
    }
    const id = window.setTimeout(() => {
      const q = vacancyQuery(noticeType?.id ?? null, noticeDuration, requirements, exactPlace);
      const r = attempt(() => vacancyOf(data, q, { from: noticeSpan.from, weeks: noticeSpan.weeks })).value;
      if (!r) {
        setNotice(null);
        return;
      }
      const text = vacancyNotice(r, {
        orgName: data.org.name,
        terms,
        typeName: noticeType?.name ?? null,
        durationMinutes: noticeDuration,
        period: { from: noticeSpan.from, to: noticeSpan.to },
        mode: noticePeriod === 'fourWeeks' ? 'weekly' : 'dates',
        exact: r.exact,
        // 今日はもう過ぎた時刻を載せない（今の時刻は画面で決める）
        notBefore: { date: jstDate(Date.now()), minutes: hhmmToMinutes(jstHhmm(Date.now())) },
      });
      const noPlan = r.noPlanDates.filter((d) => d >= noticeSpan.from && d <= noticeSpan.to);
      setNotice({ text, noPlan, inputs: noticeInputs });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [noticeOpen, noticeInputs]);
  const copyNotice = async () => {
    if (!notice || noticeStale) return;
    toast(
      (await copyText(notice.text)) ? '案内文をコピーしました' : 'コピーできませんでした。文を選んでコピーしてください',
    );
  };
  return {
    noticeType,
    noticeDuration,
    noticeSpan,
    notice,
    noticeStale,
    setNoticeOpen,
    copyNotice,
    referrers,
    mailOff,
    setMailOff,
    mailBcc,
    noticeMails,
    copyRecipients,
    noticeMailWhy,
  };
}

export type VacancyNoticeState = ReturnType<typeof useVacancyNotice>;

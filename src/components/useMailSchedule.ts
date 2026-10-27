// メールの予約送信（PRD D361〜D364。ADR-0067）の状態と操作：この端末の設定・預けた記録を読み、GAS に預ける・取り消す・つながるか確かめる。
// 通信は lib/mailSchedule の postMailSchedule の1か所。押したときだけ呼ぶ
import { useState, useSyncExternalStore } from 'react';
import type { ScheduledMail } from '../contracts/mailSchedule';
import {
  cancelRequest,
  isReady,
  type MailScheduleResult,
  type MailScheduleSettings,
  pingRequest,
  postMailSchedule,
  queueRequest,
} from '../lib/mailSchedule';
import { mailScheduleMemory } from '../store';

export function useMailSchedule() {
  const state = useSyncExternalStore(mailScheduleMemory.subscribe, mailScheduleMemory.read, mailScheduleMemory.cached);
  /** 呼んでいる途中（二重に押させない） */
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<MailScheduleResult>): Promise<MailScheduleResult> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  };
  const { settings } = state;
  return {
    settings,
    reservations: state.reservations,
    ready: isReady(settings),
    busy,
    saveSettings: (s: MailScheduleSettings) => mailScheduleMemory.setSettings(s),
    /** 入れた設定でつながるか（合言葉が合うか）を確かめる（保存する前の値で試せる） */
    ping: (s: MailScheduleSettings) => run(() => postMailSchedule(s.url, pingRequest(s))),
    /** その日のメールを預ける（同じ日は上書き）。うまくいけば預けた記録を残す */
    reserve: (x: { date: string; sendAt: string; senderName: string; mails: ScheduledMail[] }) =>
      run(async () => {
        const r = await postMailSchedule(settings.url, queueRequest({ settings, ...x }));
        if (r.ok)
          mailScheduleMemory.setReservation(x.date, {
            sendAt: x.sendAt,
            count: r.res.queued ?? x.mails.length,
            at: Date.now(),
          });
        return r;
      }),
    /** その日の予約を取り消す（まだ送っていない分）。うまくいけば預けた記録を消す */
    cancel: (date: string) =>
      run(async () => {
        const r = await postMailSchedule(settings.url, cancelRequest(settings, date));
        if (r.ok) mailScheduleMemory.setReservation(date, null);
        return r;
      }),
  };
}

import { useEffect, useState, useSyncExternalStore } from 'react';
import type { FeedbackItem } from '../contracts/feedback';
import { newId } from '../lib/common';
import { feedbackStore } from '../store';
import { captureScreen } from './captureScreen';

/** 残した意見の件数（変わると描き直す。開いたときに1回読む） */
export function useFeedbackCount(): number {
  useEffect(() => {
    void feedbackStore.list().catch(() => {});
  }, []);
  return useSyncExternalStore(feedbackStore.subscribe, feedbackStore.count);
}

/** 撮ったあと、ダイアログで意見を書いているあいだの下書き（画面の画像と、撮ったときの画面） */
export type FeedbackDraft = Omit<FeedbackItem, 'id' | 'comment'>;

/**
 * 意見を書く流れ（PRD D449）：start で画面を撮って下書きを作り（撮るあいだ busy）、save で残す、cancel で捨てる。
 * 画面の名前は見出し（h1）、無ければ URL
 */
export function useFeedbackDraft() {
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  const start = async () => {
    if (busy || draft) return;
    setBusy(true);
    try {
      // 撮る前に画面の情報を取る（撮っているあいだに画面が移っても、押したときの画面を残す）
      const base = {
        at: Date.now(),
        path: window.location.hash || '#/',
        screen: document.querySelector('h1')?.textContent?.trim() ?? '',
        width: window.innerWidth,
        height: window.innerHeight,
        version: __APP_VERSION__,
        userAgent: navigator.userAgent,
      };
      setDraft({ ...base, image: await captureScreen() });
    } finally {
      setBusy(false);
    }
  };
  /** 残す（withImage が偽なら画像を外す）。残せたら件数、残せなければ例外 */
  const save = async (comment: string, withImage: boolean): Promise<number> => {
    if (!draft) return feedbackStore.count();
    await feedbackStore.add({
      ...draft,
      id: newId('fb'),
      comment: comment.trim(),
      image: withImage ? draft.image : null,
    });
    setDraft(null);
    return feedbackStore.count();
  };
  return { busy, draft, start, save, cancel: () => setDraft(null) };
}

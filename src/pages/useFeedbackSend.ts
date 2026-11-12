// 意見の画面の状態と処理（PRD D450。ADR-0114）：残した意見を読む・消す、パスワードで閉じたファイルを作る、共有する・保存してメールを開く。
// 送るのは押した人（共有の画面・メールアプリ）。アプリからは何も送らない
import { useCallback, useEffect, useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import type { FeedbackItem } from '../contracts/feedback';
import { jstDate } from '../domain/time';
import { formError } from '../lib/common';
import { saveBlob } from '../lib/download';
import { FEEDBACK_TITLE, feedbackFileName, feedbackMail, feedbackReportHtml, passwordProblem } from '../lib/feedback';
import { sealHtml } from '../lib/feedbackSeal';
import { mailtoHref } from '../lib/mailto';
import { feedbackStore, useDemoData } from '../store';

/** 作ったファイルと、中に入れた意見 */
export type FeedbackBundle = { file: File; ids: readonly string[] };

/** 端末の共有の画面（Web Share）でこのファイルを渡せるか */
const canShare = (file: File): boolean => {
  try {
    return typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] }) === true;
  } catch {
    return false;
  }
};

/** 残した意見の一覧（読み込み・1件消す） */
function useFeedbackItems() {
  const [items, setItems] = useState<FeedbackItem[] | null>(null);
  const reload = useCallback(async () => setItems(await feedbackStore.list().catch(() => [])), []);
  useEffect(() => {
    void reload();
  }, [reload]);
  const remove = async (ids: readonly string[]) => {
    await feedbackStore.remove(ids);
    await reload();
  };
  return { items, remove };
}

export function useFeedbackSend() {
  const { data } = useDemoData();
  const { items, remove } = useFeedbackItems();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [making, setMaking] = useState(false);
  const [bundle, setBundle] = useState<FeedbackBundle | null>(null);
  /** 送る操作（共有・保存）を1回でもしたか（したら「送った意見を消す」を出す） */
  const [sent, setSent] = useState(false);

  /** 作ったファイルを捨てる（意見・パスワードが変わったら作り直す） */
  const drop = () => {
    setBundle(null);
    setSent(false);
  };

  const make = async () => {
    const problem = passwordProblem(password);
    if (problem || !items || items.length === 0) {
      setError(problem);
      return;
    }
    setError(null);
    setMaking(true);
    try {
      const now = Date.now();
      const sealed = await sealHtml(feedbackReportHtml(items, { org: data.org.name, at: now }), password, {
        salt: crypto.getRandomValues(new Uint8Array(16)),
        iv: crypto.getRandomValues(new Uint8Array(12)),
        title: `${FEEDBACK_TITLE}（${items.length}件）`,
      });
      const file = new File([sealed], feedbackFileName(jstDate(now)), { type: 'text/html' });
      setBundle({ file, ids: items.map((x) => x.id) });
      setSent(false);
    } catch (e) {
      setError(`ファイルを作れませんでした（${formError(e)}）`);
    } finally {
      setMaking(false);
    }
  };

  /** 端末の共有の画面で渡す（LINE・メールなどは押した人が選ぶ） */
  const share = async () => {
    if (!bundle) return;
    try {
      await navigator.share({ files: [bundle.file], title: `アプリへの意見（${bundle.ids.length}件）` });
      setSent(true);
    } catch (e) {
      // 共有の画面を閉じただけ（AbortError）は何も出さない
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(`共有できませんでした（${formError(e)}）`);
    }
  };

  /** ファイルを保存し、件名と本文の入ったメールを開く（添付は人がする。mailto では添付できない） */
  const saveAndMail = () => {
    if (!bundle) return;
    saveBlob(bundle.file, bundle.file.name);
    window.location.href = mailtoHref(feedbackMail(bundle.ids.length, bundle.file.name));
    setSent(true);
  };

  const removeOne = async (item: FeedbackItem) => {
    const ok = await confirmDialog({
      title: 'この意見を消しますか？',
      body: item.comment,
      confirmLabel: '消す',
      tone: 'danger',
    });
    if (!ok) return;
    await remove([item.id]);
    drop();
  };

  const removeSent = async () => {
    if (!bundle) return;
    const ok = await confirmDialog({
      title: `送った意見（${bundle.ids.length}件）を消しますか？`,
      body: '相手に届いたことを確かめてから消してください。消すと元に戻せません。',
      confirmLabel: '消す',
      tone: 'danger',
    });
    if (!ok) return;
    await remove(bundle.ids);
    drop();
    setPassword('');
    toast('送った意見を消しました');
  };

  return {
    items,
    volatile: feedbackStore.volatile(),
    password,
    setPassword: (v: string) => {
      setPassword(v);
      setError(null);
      drop();
    },
    error,
    making,
    bundle,
    shareable: bundle !== null && canShare(bundle.file),
    sent,
    make,
    share,
    saveAndMail,
    removeOne,
    removeSent,
  };
}

export type FeedbackSend = ReturnType<typeof useFeedbackSend>;

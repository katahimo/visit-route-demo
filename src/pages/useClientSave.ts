// 〈利用者さん〉の画面の保存（PRD D311。ADR-0015〜0017・0053）：節の保存と、仮押さえを本登録にする・取り消す（D47）
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { type FormErr, toFormErr } from '../components/FieldError';
import { useToast } from '../components/Toast';
import { type Client, clientSchema, type Staff } from '../contracts/documents';
import { type ClientEdit, clientSaveDraft, saveClientData } from '../lib/clientEdit';
import { STAGE_LABELS, withStage } from '../lib/clientStage';
import { confirmedDatesOf } from '../lib/tentative';
import { cancelTentative as cancelTentativeData, useDemoData } from '../store';

export function useClientSave({
  edit,
  setEdit,
  setError,
  saved,
  staff,
  allowedOn,
  today,
  discardAll,
  onLeave,
}: {
  edit: ClientEdit | null;
  setEdit: (e: ClientEdit | null) => void;
  setError: (e: FormErr) => void;
  saved: Client | undefined;
  staff: readonly Staff[];
  allowedOn: boolean;
  today: string;
  discardAll: () => void;
  onLeave: () => void;
}) {
  const { data, update } = useDemoData();
  const terms = data.org.terms;
  const toast = useToast();
  const confirmDialog = useConfirm();
  const navigate = useNavigate();

  /** 保存（節の項目だけを保存した中身に重ねる。新しい人は全部） */
  const save = () => {
    if (!edit) return;
    setError(null);
    const key = edit.key;
    const r = clientSaveDraft({ edit, saved, staff, allowedOn, clients: data.clients, terms });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const base = r.draft;
    try {
      // 段階に合わせて予定の対象（active）・仮押さえを決める（ADR-0015）
      const c = clientSchema.parse(withStage(base, base.stage, base.tentative));
      const ending = c.stage === 'ended' && !!saved && saved.stage !== 'ended';
      update((d) => saveClientData(d, c, ending, today), '利用者の保存');
      setEdit(null);
      toast(
        c.stage === 'ended' && saved?.stage !== 'ended'
          ? `保存しました。${STAGE_LABELS.ended}の人は一覧の「${STAGE_LABELS.ended}の人も出す」で出ます`
          : '保存しました',
      );
      if (key === 'new') {
        onLeave();
        navigate(`/clients/${encodeURIComponent(c.id)}?tab=basic`, { replace: true });
      }
    } catch (e) {
      setError(toFormErr(e));
    }
  };

  /** 仮押さえを本登録にする（段階を「利用中」に。ADR-0015） */
  const confirmTentative = (c: Client) => {
    update((d) => ({ ...d, clients: d.clients.map((x) => (x.id === c.id ? withStage(x, 'active') : x)) }));
    toast(`${c.displayName}を本登録（利用中）にしました`);
  };
  /** 仮押さえを取り消す（D47）：確認のうえ、その人の繰り返し・訪問・〈利用者さん〉を消して一覧へ */
  const cancelTentative = async (c: Client) => {
    const fixed = confirmedDatesOf(data, c.id).length;
    const ok = await confirmDialog({
      title: `仮押さえの${c.displayName}を取り消しますか？`,
      body: `繰り返しとすべての訪問を消し、${terms.client}も消します。${
        fixed > 0 ? `確定した日（${fixed}日）の訪問は「未連絡の変更」（外れる）になります。` : ''
      }`,
      confirmLabel: '仮押さえを取り消す',
      cancelLabel: '残しておく',
      tone: 'danger',
    });
    if (!ok) return;
    onLeave();
    discardAll();
    update((d) => cancelTentativeData(d, c.id, today), '仮押さえを取り消す');
    navigate('/clients');
    toast('仮押さえを取り消しました');
  };

  return { save, confirmTentative, cancelTentative };
}

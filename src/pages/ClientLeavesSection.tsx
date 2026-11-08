import { BedSingle, Plus } from 'lucide-react';
import { Hint, SectionTitle, WithIcon } from '../components/ui';
import type { Client } from '../contracts/documents';
import { ClientLeaveFormBox, ClientLeaveList } from './clientLeaveParts';
import { useClientLeaves } from './useClientLeaves';

/**
 * 〈利用者さん〉の休み（入院・ショートステイなど。PRD D65・D308。ADR-0013・0052）：一覧と 入れる・直す・消す。
 * 〈利用者さん〉の画面の「休み」のタブに置く。どれも「直す（入れる）→ 保存」の形で、保存を押すまでデータを変えない。
 * 休みの期間の訪問は消さず「休みのため無し」と扱う（計算から外れる）。休みと重なる確定した日があれば注意を出す
 * （確認ではなく注意。案は作り直さない）。消すのは直す欄の「この休みを消す」（確認してから。元に戻るだけ）
 */

export function ClientLeavesSection({
  client,
  onOpenDay,
  onDirty,
}: {
  client: Client;
  /** 確定した日へのリンクを押したとき（無ければ選んでいる日付を変えて予定の画面へ） */
  onOpenDay?: (date: string) => void;
  /** 入力中の変更の有無（画面を離れる前の確認に使う） */
  onDirty?: (dirty: boolean) => void;
}) {
  const {
    data,
    terms,
    today,
    leaves,
    form,
    setForm,
    openForm,
    error,
    errorState,
    setError,
    openDay,
    draftConfirmed,
    save,
    remove,
  } = useClientLeaves({ client, onOpenDay, onDirty });

  return (
    <div className="stack" data-testid="leaves-section">
      <SectionTitle
        icon={BedSingle}
        aside={
          !form && (
            <button
              type="button"
              className="btn btn-small"
              data-testid="leave-add"
              onClick={() => {
                setError(null);
                openForm({ id: null, from: today, to: today, note: '' });
              }}
            >
              <WithIcon icon={Plus} size={14}>
                休みを追加
              </WithIcon>
            </button>
          )
        }
      >
        休み（入院・ショートステイなど）
      </SectionTitle>
      <Hint>
        <ul className="hint-list">
          <li>休みの間の訪問は消さずに「休みのため無し」にし、担当を組みません。</li>
          <li>休みを消すと元に戻ります。</li>
        </ul>
      </Hint>
      <ClientLeaveList
        leaves={leaves}
        data={data}
        today={today}
        onEdit={(l) => {
          setError(null);
          openForm({ id: l.id, from: l.from, to: l.to, note: l.note });
        }}
      />

      {form && (
        <ClientLeaveFormBox
          form={form}
          setForm={setForm}
          clientName={client.displayName}
          clientTerm={terms.client}
          draftConfirmed={draftConfirmed}
          errorState={errorState}
          error={error}
          onOpenDay={openDay}
          onSave={save}
          onCancel={() => {
            openForm(null);
            setError(null);
          }}
          onRemove={() => {
            const l = leaves.find((x) => x.id === form.id);
            if (l) void remove(l);
          }}
        />
      )}
    </div>
  );
}

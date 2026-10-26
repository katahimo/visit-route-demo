// 組み方の標準の画面の「2. 表で直す（下書き）」の状態と処理：下書きの作り直し・捨てる・マスを直す欄の開け閉め。
// 案から作ると 2 の段へ移る（見出しへのフォーカスは画面が段の変わり目で行う。ADR-0066）
import { useMemo, useRef, useState } from 'react';
import type { ConfirmFn } from '../components/ConfirmDialog';
import { type CellRef, type StandardTable, tableDiff } from '../lib/standard';
import { type StandardWork, setDraft, setStandardStep } from '../lib/standardDraft';
import { cellKey } from './standardParts';

export function useStandardDraft(
  work: StandardWork,
  current: StandardTable,
  key: string,
  confirmDialog: ConfirmFn,
  presetName: (id: string | null) => string,
) {
  const draft = work.draft;
  const draftDiff = useMemo(() => (draft ? tableDiff(draft.table, current) : []), [draft, current]);
  const [editing, setEditing] = useState<CellRef | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const pickProposal = async (presetId: string, table: StandardTable) => {
    if (work.draft) {
      const ok = await confirmDialog({
        title: `下書きを「${presetName(presetId)}」の案で置き換えますか？`,
        body: '今の下書きで直した所は消えます',
        confirmLabel: '置き換える',
      });
      if (!ok) return;
    }
    setDraft({ table, from: presetId }, key);
    setEditing(null);
    setStandardStep('register');
  };
  const closeEditor = (ref: CellRef | null) => {
    setEditing(null);
    // マスのボタンは残るので、欄を消す前にフォーカスを移す（消えた欄にフォーカスを残さない）
    if (ref) cellRefs.current.get(cellKey(ref))?.focus();
  };
  const fromCurrent = () => {
    setDraft({ table: current, from: null }, key);
    setEditing(null);
  };
  const discard = async () => {
    if (!draft) return;
    if (draftDiff.length > 0) {
      const ok = await confirmDialog({
        title: '下書きを捨てますか？',
        body: `今の標準と違う ${draftDiff.length}か所の直しが消えます。標準と予定は変わりません`,
        confirmLabel: '捨てる',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setDraft(null, null);
    setEditing(null);
  };
  return {
    draft,
    draftDiff,
    editing,
    setEditing,
    cellRefs,
    pickProposal,
    closeEditor,
    fromCurrent,
    discard,
  };
}

/** useStandardDraft の返り値（下書きの区画の部品が受け取る） */
export type StandardDraftState = ReturnType<typeof useStandardDraft>;

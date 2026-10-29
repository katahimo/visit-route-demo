// 組み方の標準の画面の「3. 標準にする」の状態と処理：いつから・書き換える所・すでにある予定の扱い・登録
import { useMemo, useState } from 'react';
import type { ConfirmFn } from '../components/ConfirmDialog';
import type { ToastAction, useToast } from '../components/Toast';
import { saveArrangeBasis } from '../components/useArrangeBasis';
import type { DemoData } from '../contracts/data';
import { newId } from '../lib/common';
import { mdText } from '../lib/dateText';
import {
  type CellDiff,
  defaultSince,
  earliestSince,
  hasStandard,
  registerStandard,
  type TemporaryChoice,
  temporaryChanges,
} from '../lib/standard';
import { type StandardDraft, setDraft, standardWork } from '../lib/standardDraft';
import { effectiveDiff as effectiveDiffOf, endsBeforeIds, registerLines } from '../lib/standardView';

/** 登録に使う画面の道具（データの更新・確認・通知・元に戻す） */
export type StandardRegisterDeps = {
  data: DemoData;
  update: (fn: (d: DemoData) => DemoData, label?: string) => void;
  today: string;
  confirmDialog: ConfirmFn;
  toast: ReturnType<typeof useToast>;
  undoAction: ToastAction;
  presetName: (id: string | null) => string;
  /** 登録したあとにマスの欄を閉じる */
  closeEditing: () => void;
};

export function useStandardRegister(
  deps: StandardRegisterDeps,
  draft: StandardDraft | null,
  draftDiff: readonly CellDiff[],
) {
  const { data, update, today, confirmDialog, toast, undoAction, presetName, closeEditing } = deps;
  const minSince = earliestSince(data, today);
  const [sinceIn, setSinceIn] = useState<string | null>(null);
  const since = sinceIn !== null && sinceIn >= minSince ? sinceIn : defaultSince(data, today);
  // いつからより前に終わる繰り返しのマスは登録で書き換えないので、違う所に数えない（レビュー #92）
  const endsBefore = useMemo(() => endsBeforeIds(data.patterns, since), [data.patterns, since]);
  const effectiveDiff = useMemo(() => effectiveDiffOf(draftDiff, endsBefore), [draftDiff, endsBefore]);
  const skippedDiff = draftDiff.length - effectiveDiff.length;
  const temps = useMemo(
    () => (draft && effectiveDiff.length > 0 ? temporaryChanges(data, draft.table, since, today) : []),
    [data, draft, effectiveDiff.length, since, today],
  );
  const [temp, setTemp] = useState<TemporaryChoice>('drop');
  // 標準がまだ無ければ、直しの無い表（今の表のまま）でも標準にできる。いつからより前に終わる行だけ直した表は、
  // 直しが捨てられて下書きと違う標準になるので押せない
  const asIs = !hasStandard(data) && draftDiff.length === 0;
  const canRegister = draft !== null && (effectiveDiff.length > 0 || asIs);
  const register = async () => {
    if (!draft || !canRegister) return;
    const lines = registerLines(effectiveDiff, since, temps.length, temp, draft.from ? presetName(draft.from) : null);
    const ok = await confirmDialog({
      title: `この表を ${mdText(since)} から標準にしますか？`,
      body: lines.join('\n'),
      confirmLabel: '標準にする',
    });
    if (!ok) return;
    const table = draft.table;
    const presetId = draft.from;
    const at = Date.now();
    let changed = false;
    let registered = null as DemoData | null;
    update((d) => {
      const next = registerStandard(d, table, since, today, { newId: () => newId('pattern'), temp, at, presetId });
      changed = next !== d;
      registered = next;
      return next;
    }, '組み方の標準を登録');
    // 書き換える所が無かった（別のタブで同じ標準を登録した）ときは完了にしない
    if (!changed) {
      toast('書き換える所がありませんでした');
      return;
    }
    // 標準で組んだときの基本情報を覚える（登録で分けた繰り返しのあとのデータ。ADR-0067）
    if (registered) saveArrangeBasis(registered);
    setDraft(null, null);
    standardWork.set((w) => ({ ...w, registered: { since, at } }));
    closeEditing();
    toast('標準にしました', { action: undoAction });
  };
  return { minSince, since, setSinceIn, effectiveDiff, skippedDiff, temps, temp, setTemp, canRegister, register };
}

/** useStandardRegister の返り値（登録の区画の部品が受け取る） */
export type StandardRegisterState = ReturnType<typeof useStandardRegister>;

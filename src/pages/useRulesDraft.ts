// 条件の重みの画面の重みの下書き（PRD D286。ADR-0048・ADR-0065）：表の重み・必須は動かしても保存せず、画面の中の下書きに置く。
// 「新しい考え方として保存（N件）」で確認（名前と変わる重み）のあと新しいプリセットとして足して点数の基準にし、「取り消す」で捨てる。
// 下書きのまま画面を離れるときは確かめる。下書きの計算は lib/weightDraft、保存は lib/presets の saveDraftAsPreset
import { useEffect, useMemo, useRef, useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { useLeaveGuard } from '../components/useLeaveGuard';
import { MAX_PRESETS, type RuleType } from '../contracts/rules';
import { addPresetError, draftPresetName, PRESET_NAME_MAX, saveDraftAsPreset } from '../lib/presets';
import {
  confirmBody,
  confirmTitle,
  draftChanges,
  editDraft,
  leaveDialog,
  pruneDraft,
  savedText,
  savedWeights,
  type WeightDraft,
  withDraft,
} from '../lib/weightDraft';
import { scorePresetOf, scoreRulesOf } from '../seed';
import { useDemoData } from '../store';

/** 下書きが無いとき（基準が替わったとき）の空の下書き */
const NO_DRAFT: WeightDraft = {};

/** 確定・取り消しのあと、押したボタンが消えるのでフォーカスを画面の見出しへ（確認が閉じて裏の inert が外れてから） */
function useFocusHead(): () => void {
  const [focusHead, setFocusHead] = useState(0);
  useEffect(() => {
    if (focusHead === 0) return;
    const id = requestAnimationFrame(() => {
      const h = document.querySelector<HTMLElement>('.app-main h1');
      if (!h) return;
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [focusHead]);
  return () => setFocusHead((n) => n + 1);
}

export function useRulesDraft() {
  const { data, update } = useDemoData();
  const confirmDialog = useConfirm();
  const toast = useToast();
  /** 最新のデータ（確認を待つ間に別のタブで変わったかを見る） */
  const dataRef = useRef(data);
  dataRef.current = data;
  /** プリセットが6つあれば保存できない（使わない考え方を消してから。ADR-0065） */
  const full = data.presets.length >= MAX_PRESETS;
  /** 点数の基準のプリセット（この画面で表の重みの元にする考え方。ADR-0035・ADR-0065） */
  const basis = scorePresetOf(data.presets, data.scorePresetId);
  /** 保存済みの条件：名前・種類は条件のまま、重み・必須は基準のプリセットのもの */
  const savedRules = useMemo(() => scoreRulesOf(data), [data]);
  const saved = useMemo(() => savedWeights(savedRules), [savedRules]);
  /**
   * 重みの下書き（PRD D286）。直している基準のプリセットの id と組にし、基準が替わったら（ラジオ・基準のプリセットを消す）捨てる。
   * その型の条件が無くなった型・保存済みと同じ値になった型は外す（pruneDraft）
   */
  const [rawDraft, setRawDraft] = useState<{ basisId: string | null; values: WeightDraft }>({
    basisId: null,
    values: {},
  });
  const basisId = basis?.id ?? null;
  /** 最新の基準（確認を待つ間に別のタブで替わったかを見る） */
  const basisRef = useRef(basisId);
  basisRef.current = basisId;
  const draft = useMemo(
    () => (rawDraft.basisId === basisId ? pruneDraft(rawDraft.values, saved) : NO_DRAFT),
    [rawDraft, basisId, saved],
  );
  // 外した型は state からも消す（同じ型の条件をあとで足しても古い下書きが戻らない）
  useEffect(() => {
    if (draft !== rawDraft.values) setRawDraft({ basisId, values: draft });
  }, [draft, rawDraft.values, basisId]);
  /** 表に出す条件（下書きを当てたもの） */
  const shownRules = useMemo(() => withDraft(savedRules, draft), [savedRules, draft]);
  const changes = useMemo(() => draftChanges(savedRules, draft), [savedRules, draft]);
  const changeOf = (type: RuleType) => changes.find((c) => c.type === type);
  const setWeight = (type: RuleType, patch: Partial<{ weight: number; hard: boolean }>) =>
    setRawDraft({ basisId, values: editDraft(draft, saved, type, patch) });
  const focusHead = useFocusHead();
  /** 下書きを捨てる */
  const reset = () => setRawDraft({ basisId, values: {} });
  const discard = () => {
    reset();
    focusHead();
    toast('重みの変更を取り消しました');
  };
  /** 新しい考え方として保存する（ADR-0065）：名前を付けて新しいプリセットとして足し、点数の基準にする（元のプリセットは残る） */
  const saveDraft = async () => {
    const list = changes;
    const values = draft;
    if (list.length === 0 || full || !basis) return;
    let name = draftPresetName(basis.name, data.presets);
    const ok = await confirmDialog({
      title: confirmTitle(list.length),
      body: confirmBody(list, basis.name),
      confirmLabel: '保存する',
      cancelLabel: '編集を続ける',
      field: {
        label: '新しい考え方の名前',
        initial: name,
        maxLength: PRESET_NAME_MAX,
        testId: 'rules-draft-name',
        error: (v) => addPresetError(dataRef.current, v),
        onValue: (v) => {
          name = v;
        },
      },
    });
    if (!ok) return;
    // 確認の間に別のタブで点数の基準が替わった・6つに達したら書かない（下書きは前の基準の重み。替わった基準では捨てられる）
    if (basisRef.current !== basisId) {
      toast('点数の基準が替わったので、保存しませんでした');
      return;
    }
    if (dataRef.current.presets.length >= MAX_PRESETS) {
      toast(`プリセットが${MAX_PRESETS}つになったので、保存しませんでした。使わない考え方を消してから保存してください`);
      return;
    }
    const error = addPresetError(dataRef.current, name);
    if (error) {
      toast(`保存しませんでした：${error}`);
      return;
    }
    update(
      (d) => (scorePresetOf(d.presets, d.scorePresetId)?.id === basisId ? saveDraftAsPreset(d, values, name) : d),
      '新しい考え方として保存',
    );
    reset();
    focusHead();
    toast(savedText(name.trim()));
  };
  // 下書きのまま画面を離れる（リンク・パレット・再読込・タブを閉じる）ときは確かめる
  useLeaveGuard(changes.length > 0, leaveDialog(changes.length));
  return { basis, full, savedRules, shownRules, changes, changeOf, setWeight, discard, saveDraft };
}

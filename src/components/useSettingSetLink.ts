// 設定のひな形をリンクで適用する（`#/settings?apply=<ID>`。PRD D480〜D482・D484〜D487。ADR-0121・ADR-0122）：管理者設定の画面で URL の apply を見て、
// 3ステップの手順の画面（SettingSetSteps。①データの控え ②変わる設定 ③適用）を出す。［適用］で store の update を通して書く（元に戻せる）。
// ［取り消す］では何も変えない。知らない ID は「見つかりません」、全部同じなら「すでにこの設定です」を知らせて何もしない（控えの書き出しも求めない）。
// どの場合も答えたあとに URL から apply を消す（読み直しても2回出さない）。ひな形の中身と比べ方は lib/settingSets
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jstDate } from '../domain/time';
import { newId } from '../lib/common';
import {
  applySettingSet,
  type SettingSetDef,
  settingSetChanges,
  settingSetConfirmBody,
  settingSetOf,
} from '../lib/settingSets';
import { useDemoData } from '../store';
import { useToast } from './Toast';
import { useUndoAction } from './undo';

/** 手順の画面に出している設定のひな形と、②の本文（変わる項目の一覧。開いた時点のデータで作る） */
export type SettingSetPending = { set: SettingSetDef; body: string };

export type SettingSetLink = {
  /** 手順の画面に出すもの（出さないときは null） */
  pending: SettingSetPending | null;
  /** ［適用］ */
  apply(): void;
  /** ［取り消す］・Esc・背景 */
  cancel(): void;
};

export function useSettingSetLink(): SettingSetLink {
  const { data, update } = useDemoData();
  const toast = useToast();
  const undoAction = useUndoAction();
  const [params, setParams] = useSearchParams();
  const applyId = params.get('apply');
  /** 今出している apply（同じ URL で2回出さない。URL から消えたら空に戻す） */
  const handling = useRef<string | null>(null);
  /** 手順の画面を開いた時点のデータ（本文を作る） */
  const dataRef = useRef(data);
  dataRef.current = data;
  const [pending, setPending] = useState<SettingSetPending | null>(null);

  const done = () =>
    setParams(
      (p) => {
        p.delete('apply');
        return p;
      },
      { replace: true },
    );

  // biome-ignore lint/correctness/useExhaustiveDependencies: URL の apply が付いた・変わったときだけ
  useEffect(() => {
    if (applyId === null) {
      handling.current = null;
      return;
    }
    if (handling.current === applyId) return;
    handling.current = applyId;
    const set = settingSetOf(applyId);
    if (!set) {
      toast(`設定のひな形「${applyId}」が見つかりません。設定は変えていません`);
      done();
      return;
    }
    const d = dataRef.current;
    const changes = settingSetChanges(d, set);
    if (changes.length === 0) {
      toast(`すでにこの設定です（${set.label}）`);
      done();
      return;
    }
    setPending({ set, body: settingSetConfirmBody(d, changes, jstDate(Date.now())) });
  }, [applyId]);

  const apply = () => {
    if (!pending) return;
    const { set } = pending;
    setPending(null);
    done();
    const ruleId = newId('r');
    update((cur) => applySettingSet(cur, set, ruleId), `設定のひな形「${set.label}」を適用`);
    toast(`設定のひな形「${set.label}」を適用しました`, { action: undoAction });
  };
  const cancel = () => {
    setPending(null);
    done();
  };
  return { pending, apply, cancel };
}

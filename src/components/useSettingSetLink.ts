// 設定のひな形をリンクで適用する（`#/settings?apply=<ID>`。PRD D480〜D482。ADR-0121）：管理者設定の画面で URL の apply を見て、
// 独自の確認ダイアログ（ADR-0026）に変わる項目（今の値 → 新しい値）を出し、［適用］で store の update を通して書く（元に戻せる）。
// キャンセルでは何も変えない。知らない ID は「見つかりません」、全部同じなら「すでにこの設定です」を知らせて何もしない。
// どの場合も答えたあとに URL から apply を消す（読み直しても2回出さない）。ひな形の中身と比べ方は lib/settingSets
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jstDate } from '../domain/time';
import { newId } from '../lib/common';
import { applySettingSet, settingSetChanges, settingSetConfirmBody, settingSetOf } from '../lib/settingSets';
import { useDemoData } from '../store';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';
import { useUndoAction } from './undo';

export function useSettingSetLink(): void {
  const { data, update } = useDemoData();
  const confirmDialog = useConfirm();
  const toast = useToast();
  const undoAction = useUndoAction();
  const [params, setParams] = useSearchParams();
  const applyId = params.get('apply');
  /** 今出している apply（同じ URL で2回確認を出さない。URL から消えたら空に戻す） */
  const handling = useRef<string | null>(null);
  /** 確認を開いた時点のデータ（本文を作る） */
  const dataRef = useRef(data);
  dataRef.current = data;

  // biome-ignore lint/correctness/useExhaustiveDependencies: URL の apply が付いた・変わったときだけ
  useEffect(() => {
    if (applyId === null) {
      handling.current = null;
      return;
    }
    if (handling.current === applyId) return;
    handling.current = applyId;
    const done = () =>
      setParams(
        (p) => {
          p.delete('apply');
          return p;
        },
        { replace: true },
      );
    const run = async () => {
      const set = settingSetOf(applyId);
      if (!set) {
        toast(`設定のひな形「${applyId}」が見つかりません。設定は変えていません`);
        return;
      }
      const d = dataRef.current;
      const changes = settingSetChanges(d, set);
      if (changes.length === 0) {
        toast(`すでにこの設定です（${set.label}）`);
        return;
      }
      const body = settingSetConfirmBody(d, changes, jstDate(Date.now()));
      const ok = await confirmDialog({
        title: `設定のひな形「${set.label}」を適用しますか？`,
        body,
        confirmLabel: '適用',
      });
      if (!ok) return;
      const ruleId = newId('r');
      update((cur) => applySettingSet(cur, set, ruleId), `設定のひな形「${set.label}」を適用`);
      toast(`設定のひな形「${set.label}」を適用しました`, { action: undoAction });
    };
    void run().finally(done);
  }, [applyId]);
}

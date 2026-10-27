// 基本情報が最後に AI で組んだあとに変わったか（ADR-0067。PRD D363）。鍵は lib/arrangeBasis、覚える先は store/arrangeBasis
import { useMemo, useSyncExternalStore } from 'react';
import type { DemoData } from '../contracts/data';
import { type BasisData, basisKey } from '../lib/arrangeBasis';
import { arrangeBasisMemory } from '../store';

/** 組んだとき（標準を登録した）の基本情報の鍵を覚える */
export const saveArrangeBasis = (data: BasisData): void => arrangeBasisMemory.save(basisKey(data));

/** AI で組み始めたときの基本情報の鍵（提案は組み始めたときの前提で作るので、反映ではこの鍵を覚える。画面全体で1つ） */
let startedKey: string | null = null;
/** AI で組み始めたときの基本情報を控える（担当を組むの「AI で組む」・［組み直す］） */
export const markArrangeStart = (data: BasisData): void => {
  startedKey = basisKey(data);
};
/** 提案を反映したときに覚える：組み始めたときの鍵（無ければ今のデータの鍵） */
export const saveAppliedBasis = (data: BasisData): void => arrangeBasisMemory.save(startedKey ?? basisKey(data));

/**
 * 基本情報が最後に組んだあとに変わったか（まだ組んでいなければ false）。鍵はデータが変わったときだけ作り直す
 * （覚えた鍵は覚え直したときに読み直す。反映で訪問が変わらなくても知らせが消える）
 */
export function useBasisChanged(data: DemoData): boolean {
  const { patterns, clients, clientLeaves, compat, staff, availability } = data;
  const key = useMemo(
    () => basisKey({ patterns, clients, clientLeaves, compat, staff, availability }),
    [patterns, clients, clientLeaves, compat, staff, availability],
  );
  const saved = useSyncExternalStore(arrangeBasisMemory.subscribe, arrangeBasisMemory.get);
  return saved !== null && saved !== key;
}

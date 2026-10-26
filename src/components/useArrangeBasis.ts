// 基本情報が最後に AI で組んだあとに変わったか（ADR-0067。PRD D363）。鍵は lib/arrangeBasis、覚える先は store/arrangeBasis
import { useMemo } from 'react';
import type { DemoData } from '../contracts/data';
import { type BasisData, basisKey } from '../lib/arrangeBasis';
import { arrangeBasisMemory } from '../store';

/** 組んだとき（提案を反映した・標準を登録した）の基本情報の鍵を覚える（組んだ結果は鍵に入らないので、反映の前のデータでよい） */
export const saveArrangeBasis = (data: BasisData): void => arrangeBasisMemory.save(basisKey(data));

/**
 * 基本情報が最後に組んだあとに変わったか（まだ組んでいなければ false）。鍵はデータが変わったときだけ作り直す
 * （覚えた鍵は描くたびに読む。反映・登録でデータが変わるので、覚え直した直後にも描き直る）
 */
export function useBasisChanged(data: DemoData): boolean {
  const { patterns, clients, clientLeaves, compat, staff, availability } = data;
  const key = useMemo(
    () => basisKey({ patterns, clients, clientLeaves, compat, staff, availability }),
    [patterns, clients, clientLeaves, compat, staff, availability],
  );
  const saved = arrangeBasisMemory.get();
  return saved !== null && saved !== key;
}

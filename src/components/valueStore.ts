// lib/valueStore の入れ物を React で読むフック（PRD D249。ADR-0039）
import { useSyncExternalStore } from 'react';
import type { ReadableStore } from '../lib/valueStore';

/** 入れ物の今の値（変わったら、これを呼んだ部品だけ描き直す） */
export function useValueStore<T>(store: ReadableStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

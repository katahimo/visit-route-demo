// 編集の欄の変更の有無を lib/dirtyForms に知らせるフック（PRD D227）
import { useEffect } from 'react';
import { markDirtyForm } from '../lib/dirtyForms';

/** 編集の欄の変更の有無を知らせる（欄が閉じる・変更が無くなると外す） */
export function useDirtyMark(on: boolean): void {
  useEffect(() => {
    if (!on) return;
    return markDirtyForm();
  }, [on]);
}

// チェックボックスの小さな部品（ほかの部品を import しない。conditions と parts の循環を作らないため別のファイル）
import type { ReactNode } from 'react';

/** チェックボックスの横並び（label の縦並びの既定を打ち消す） */
export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

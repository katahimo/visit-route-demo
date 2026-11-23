// 保存の容量超過の判定と、控えを残せなかったときの文言（1世代の控え・更新前の控えで共用。ADR-0032・ADR-0122）

/** 容量超過の例外か */
export function isQuota(e: unknown): boolean {
  if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) return true;
  return (e as { name?: string } | null)?.name === 'QuotaExceededError';
}

export const KEEP_FULL = '控えを残せません：容量不足';
export const KEEP_NO_STORAGE = '控えを残せません：このブラウザでは保存が使えません';
export const KEEP_FAILED = '控えを残せません：保存できませんでした';

// 〈利用者さん〉の画面の「仮押さえを取り消す」（D47。ADR-0012）。〈利用者さん〉を消すと相性などの食い違いを直す（repair）ので、
// データの持ち主の store に置く。データは書き換えず、新しい DemoData を返す（画面は update(fn) に渡す）
import type { DemoData } from '../contracts/data';
import { removePattern } from '../patterns';
import { repair } from './repair';

/**
 * 仮押さえを取り消す：その人の定期パターンを removePattern で消し、〈利用者さん〉と、その人の訪問をすべて消す
 * （パターンで消えずに残る今日より前・この回だけ変えた回・単発も）。
 * 〈利用者さん〉は相性（compat）から除く（repair を通す）。伝えた内容に残る訪問は「未連絡の変更」の「外れる」になる
 */
export function cancelTentative(d: DemoData, clientId: string, today: string): DemoData {
  let x = { patterns: d.patterns, visits: d.visits, clients: d.clients };
  for (const p of d.patterns.filter((p) => p.clientId === clientId)) {
    const r = removePattern(x, p.id, today);
    x = { ...x, patterns: r.patterns, visits: r.visits };
  }
  return repair({
    ...d,
    patterns: x.patterns,
    visits: x.visits.filter((v) => v.clientId !== clientId),
    clients: d.clients.filter((c) => c.id !== clientId),
  });
}

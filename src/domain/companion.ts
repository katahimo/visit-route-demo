// 同行の組（2人体制・研修同行。デモ独自。ADR-0120）の判定。「どの訪問が同行の組か」を決めるのはこのファイルだけ
// （compile・帯の印・連絡の文で同じ判定）。1訪問1人のまま、同じ時刻の訪問をもう1件持つ形で表す
import type { AccompanyKind, Visit } from '../contracts/documents';

type CompanionVisit = Pick<Visit, 'id' | 'date' | 'clientId' | 'earliestStart' | 'cancelled'> &
  Partial<Pick<Visit, 'accompany'>>;

/** 組の鍵：同じ日・同じ〈利用者さん〉・同じ開始（早） */
const keyOf = (v: CompanionVisit) => `${v.date}\u0000${v.clientId}\u0000${v.earliestStart}`;

/** 組の中の訪問の役：'trainee'＝研修同行の分、'group'＝ほかの訪問（元の訪問・2人体制の2人目） */
export type CompanionRole = 'group' | 'trainee';

/** 組の1件：役と、組のほかの訪問の ID（並びは渡した順） */
export type CompanionOf = { role: CompanionRole; kind: AccompanyKind; partners: string[] };

/**
 * 同行の組（訪問ID → 役・組の種類・相手）。取り消した訪問は入れない。組は同じ日・同じ〈利用者さん〉・同じ開始（早）の訪問が2件以上で、
 * うち1件以上が同行（accompany あり）のもの。同行の印の無い同じ時刻の訪問だけ（今までの2件の入れ方）は組にしない（今までの動きのまま）。
 * 組の種類は、研修同行の分があれば 'trainee'、無ければ 'pair'
 */
export function companionsOf(visits: readonly CompanionVisit[]): Map<string, CompanionOf> {
  const groups = new Map<string, CompanionVisit[]>();
  for (const v of visits) {
    if (v.cancelled) continue;
    const k = keyOf(v);
    const g = groups.get(k);
    if (g) g.push(v);
    else groups.set(k, [v]);
  }
  const out = new Map<string, CompanionOf>();
  for (const g of groups.values()) {
    if (g.length < 2 || !g.some((v) => v.accompany !== undefined)) continue;
    const kind: AccompanyKind = g.some((v) => v.accompany === 'trainee') ? 'trainee' : 'pair';
    for (const v of g) {
      out.set(v.id, {
        role: v.accompany === 'trainee' ? 'trainee' : 'group',
        kind,
        partners: g.filter((x) => x.id !== v.id).map((x) => x.id),
      });
    }
  }
  return out;
}

/**
 * 同行の訪問を足せるか（同じ日・同じ〈利用者さん〉・同じ開始（早）の、取り消していないほかの訪問があるか）。
 * 無ければ組にならないので、同行として保存しない
 */
export function hasCompanionBase(
  visits: readonly CompanionVisit[],
  v: Pick<Visit, 'date' | 'clientId' | 'earliestStart'> & { id?: string },
): boolean {
  return visits.some(
    (x) =>
      !x.cancelled &&
      x.id !== v.id &&
      x.date === v.date &&
      x.clientId === v.clientId &&
      x.earliestStart === v.earliestStart,
  );
}

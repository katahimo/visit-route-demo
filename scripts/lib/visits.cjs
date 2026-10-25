// e2e の共通：保存したデータ（data）から、ある範囲の訪問（保存した回＋計算した繰り返しの回）を求める。
// 初期データは保存した訪問が空で、今日からの日は繰り返しの担当のまま（計算した回）なので、
// 「繰り返しの回がある」ことは data.visits ではなく、これで見る。
// src/patterns の visitsOn・occursOn・visitOf と同じ決まり（写し。ここは純粋関数で、ブラウザの外で動く）。

const addDays = (d, n) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const weekday = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** その日にパターンの訪問があるか */
function occursOn(p, date) {
  if (date < p.from) return false;
  if (p.to !== null && date > p.to) return false;
  if (!p.weekdays.includes(weekday(date))) return false;
  if (p.repeat === 'monthly') return p.monthWeeks.includes(Math.floor((Number(date.slice(8, 10)) - 1) / 7) + 1);
  const firstWeekStart = addDays(p.from, -weekday(p.from));
  return Math.floor(daysBetween(firstWeekStart, date) / 7) % p.everyWeeks === 0;
}

/** パターンの1回分（計算した回） */
function visitOf(p, date) {
  const t = p.dayTimes.find((x) => x.weekday === weekday(date)) ?? p;
  return {
    id: `${date}_${p.id}`,
    date,
    clientId: p.clientId,
    windowKind: p.windowKind,
    earliestStart: t.earliestStart,
    latestStart: t.latestStart,
    durationMinutes: p.durationMinutes,
    staffId: p.usualStaffId,
    start: null,
    pinned: false,
    cancelled: false,
    note: '',
    typeId: p.typeId,
    cancelKind: null,
    pattern: { id: p.id, date, edited: false },
  };
}

/** from〜to（両端を含む）の訪問（保存した回＋計算した回。日付・開始の順）。利用中の〈利用者さん〉のパターンだけ計算する */
function visitsIn(d, from, to) {
  const active = new Set(d.clients.filter((c) => c.active).map((c) => c.id));
  const saved = new Set(d.visits.map((v) => v.id));
  const out = d.visits.filter((v) => v.date >= from && v.date <= to);
  for (let day = from; day <= to; day = addDays(day, 1)) {
    for (const p of d.patterns) {
      if (!active.has(p.clientId) || !occursOn(p, day) || saved.has(`${day}_${p.id}`)) continue;
      out.push(visitOf(p, day));
    }
  }
  return out.sort((a, b) =>
    a.date !== b.date
      ? a.date < b.date
        ? -1
        : 1
      : (a.start ?? a.earliestStart) < (b.start ?? b.earliestStart)
        ? -1
        : 1,
  );
}

/** ID の訪問（保存した回か計算した回）。無ければ null */
function findVisit(d, id) {
  const saved = d.visits.find((v) => v.id === id);
  if (saved) return saved;
  const date = id.slice(0, 10);
  return visitsIn(d, date, date).find((v) => v.id === id) ?? null;
}

module.exports = { visitsIn, findVisit };

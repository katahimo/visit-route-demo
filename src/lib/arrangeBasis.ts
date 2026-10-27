// 基本情報の鍵（ADR-0067。PRD D363）：AI で担当を組む前提（〈利用者さん〉の予定・相性・〈スタッフ〉の勤務時間）が、
// 最後に組んだあとに変わったかを見るための短い文字列。組んだ結果（訪問の担当・繰り返しのいつもの担当・標準の開始）は入れない
import type { DemoData } from '../contracts/data';
import { addDays } from '../domain/time';

/** 鍵に入れるデータ */
export type BasisData = Pick<DemoData, 'patterns' | 'clients' | 'clientLeaves' | 'compat' | 'staff' | 'availability'>;

/** 32ビットの FNV-1a（16進8桁）。同じ文字列はいつも同じ値 */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 並びに寄らない、キーの順を決めた文字列（相性の表） */
function compatText(compat: DemoData['compat']): string {
  return Object.keys(compat)
    .sort()
    .map((c) => {
      const row = compat[c] ?? {};
      const cells = Object.keys(row)
        .sort()
        .filter((s) => (row[s] ?? 0) !== 0)
        .map((s) => `${s}=${row[s]}`);
      return cells.length > 0 ? `${c}:${cells.join(',')}` : '';
    })
    .filter(Boolean)
    .join(';');
}

/**
 * 繰り返しを〈利用者さん〉×曜日に開き、中身（種類・繰り返し方・時刻・所要）が同じで期間が続く（前の終わりの翌日が次の始まり）
 * ものを1つの期間にまとめた行（曜日ごとに分けた・担当だけ替えて「いつから」で分けた繰り返しでも同じ行になる）
 */
function patternLines(patterns: BasisData['patterns']): string[] {
  const spans = new Map<string, { from: string; to: string | null }[]>();
  for (const p of patterns) {
    for (const wd of p.weekdays) {
      const t = p.dayTimes.find((x) => x.weekday === wd);
      const body = [
        p.clientId,
        wd,
        p.typeId ?? '',
        p.repeat,
        p.everyWeeks,
        p.monthWeeks.join(','),
        p.windowKind,
        t?.earliestStart ?? p.earliestStart,
        t?.latestStart ?? p.latestStart,
        p.durationMinutes,
      ].join('/');
      spans.set(body, [...(spans.get(body) ?? []), { from: p.from, to: p.to }]);
    }
  }
  const lines: string[] = [];
  for (const [body, list] of spans) {
    const merged: { from: string; to: string | null }[] = [];
    for (const s of [...list].sort((a, b) => a.from.localeCompare(b.from))) {
      const last = merged[merged.length - 1];
      if (last && last.to !== null && addDays(last.to, 1) >= s.from) {
        last.to = s.to === null ? null : s.to > last.to ? s.to : last.to;
      } else merged.push({ ...s });
    }
    for (const m of merged) lines.push(`${body}/${m.from}/${m.to ?? ''}`);
  }
  return lines.sort();
}

/**
 * 基本情報の鍵。繰り返しは〈利用者さん〉×曜日の続く期間（patternLines）で、曜日・時刻・所要・繰り返し方・期間を見る。
 * 〈利用者さん〉は段階、〈スタッフ〉は休止・勤務日・勤務時間・最終勤務日
 */
export function basisKey(data: BasisData): string {
  const patterns = patternLines(data.patterns);
  const clients = data.clients.map((c) => `${c.id}/${c.stage}`).sort();
  const leaves = data.clientLeaves.map((l) => `${l.clientId}/${l.from}/${l.to}`).sort();
  const staff = data.staff
    .map((s) => [s.id, s.active, s.workDays.join(','), s.shiftStart, s.shiftEnd, s.lastDay ?? ''].join('/'))
    .sort();
  const availability = data.availability
    .map((a) => `${a.staffId}/${a.date}/${a.slots.map((x) => `${x.start}-${x.end}`).join(',')}`)
    .sort();
  return fnv1a(
    [
      patterns.join('|'),
      clients.join('|'),
      leaves.join('|'),
      compatText(data.compat),
      staff.join('|'),
      availability.join('|'),
    ].join('\n'),
  );
}

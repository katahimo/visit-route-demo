import { useState } from 'react';
import { useToast } from '../components/Toast';
import type { DemoData } from '../contracts/data';
import type { Condition } from '../contracts/rules';
import type { VacancyQuery } from '../contracts/vacancy';
import { toPlace } from '../lib/addressLookup';
import { CLIENT_COLORS } from '../lib/colors';
import { nameTaken } from '../lib/common';
import { mdText } from '../lib/dateText';
import { type HoldSlot, holdData, holdPatterns } from '../lib/hold';
import { newClient } from '../lib/newClient';
import { normalizePostalCode } from '../lib/postalCode';
import type { useDemoData } from '../store';
import type { VacancyPlace } from './useVacancyInput';

/** 仮押さえの欄（nameBad：誤りが表示名の欄のもの。PRD D250） */
export type HoldForm = { name: string; error: string | null; nameBad?: boolean };

/**
 * 仮押さえ：〈利用者さん〉（仮）と繰り返しを1回の update で入れ、今日から4週の回を空き時間に入れて（lib/weekOps の insertAllIntoPlans）、
 * いちばん多く入った人を繰り返しの担当にする（版2。それより後の回はその担当で出る。lib/hold の holdData）
 */
export function useVacancyHold(
  data: DemoData,
  update: ReturnType<typeof useDemoData>['update'],
  opts: {
    today: string;
    query: VacancyQuery | null;
    slots: HoldSlot[];
    place: VacancyPlace;
    requirements: Condition[];
    typeId: string | null;
    from: string;
  },
) {
  const toast = useToast();
  const terms = data.org.terms;
  const [hold, setHold] = useState<HoldForm | null>(null);
  const register = () => {
    const { today, query, slots, place, requirements, typeId, from } = opts;
    if (!hold || !query) return;
    const name = hold.name.trim();
    if (!name) {
      setHold({ ...hold, error: '表示名を入れてください', nameBad: true });
      return;
    }
    if (nameTaken(data.clients, (x) => x.displayName, name)) {
      setHold({
        ...hold,
        error: `「${name}」と同じ名前の${terms.client}がいます。名前を変えてください`,
        nameBad: true,
      });
      return;
    }
    if (slots.length === 0) return;
    const client = newClient({
      displayName: name,
      // 郵便番号は7桁にできれば写す（できなければ空）
      place: { ...toPlace(place), postalCode: normalizePostalCode(place.postalCode) ?? '' },
      note: '問い合わせの試算から仮押さえ',
      color: data.clients.length % CLIENT_COLORS.length,
      requirements,
      tentative: true,
      // 問い合わせからの仮押さえは「相談受付」の段階（ADR-0015）。仮押さえなので予定・AI案に入る
      stage: 'inquiry',
    });
    const patterns = holdPatterns(client.id, slots, { typeId, durationMinutes: query.durationMinutes, from });
    if (!patterns) {
      setHold({ ...hold, error: '定期パターンを作れませんでした。条件を確かめてください', nameBad: false });
      return;
    }
    // 知らせの件数はいまのデータで数える（update の中の関数はあとで呼ばれることがある）
    const r = holdData(data, client, patterns, today);
    update((d) => holdData(d, client, patterns, today).data, '仮押さえ');
    setHold(null);
    const into = r.inserted > 0 ? `・担当を ${r.inserted}件入れました` : '';
    const miss =
      r.failedDates.length > 0
        ? `。${r.failedDates.length}日（${r.failedDates.map(mdText).join('・')}）は空き時間に入りません`
        : '';
    toast(`仮押さえしました（${name}・4週の訪問 ${r.added}件${into}）${miss}`);
  };
  return { hold, setHold, register };
}

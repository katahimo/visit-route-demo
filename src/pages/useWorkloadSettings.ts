// 勤務の見込みの画面の設定（事業所の交通費の単価・拘束の上限。PRD D72。ADR-0015）：入力中の文字・誤り・保存（離れたとき・Enter）
import { useEffect, useState } from 'react';
import { useToast } from '../components/Toast';
import type { DemoData } from '../contracts/data';
import { fareInputError, limitInputError } from '../lib/workloadView';
import { useDemoData } from '../store';

export function useWorkloadSettings(org: DemoData['org']) {
  const { update } = useDemoData();
  const toast = useToast();
  const [fare, setFare] = useState(String(org.fareYenPerKm));
  const [limit, setLimit] = useState(String(org.spanLimitHours));
  useEffect(() => {
    setFare(String(org.fareYenPerKm));
  }, [org.fareYenPerKm]);
  useEffect(() => {
    setLimit(String(org.spanLimitHours));
  }, [org.spanLimitHours]);
  const fareNum = Number(fare);
  const limitNum = Number(limit);
  const fareError = fareInputError(fare);
  const limitError = limitInputError(limit);
  const saveFare = () => {
    if (fareError || fareNum === org.fareYenPerKm) return;
    update((d) => ({ ...d, org: { ...d.org, fareYenPerKm: fareNum } }), '交通費の単価');
    toast(fareNum > 0 ? `交通費の単価を ${fareNum}円/km にしました` : '交通費を出さないようにしました');
  };
  const saveLimit = () => {
    if (limitError || limitNum === org.spanLimitHours) return;
    update((d) => ({ ...d, org: { ...d.org, spanLimitHours: limitNum } }), '拘束の上限');
    toast(
      limitNum > 0
        ? `出勤〜退勤（拘束）の上限を ${limitNum}時間 にしました`
        : '出勤〜退勤（拘束）の注意を出さないようにしました',
    );
  };
  return { fare, setFare, limit, setLimit, fareError, limitError, saveFare, saveLimit };
}

export type WorkloadSettings = ReturnType<typeof useWorkloadSettings>;

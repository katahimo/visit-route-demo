// 退職・担当替えの一括振り直し（PRD D71。ADR-0015）の状態と処理：範囲（offboardScope）・〈利用者さん〉ごとに選んだ代わりの人・
// 「まとめて適用」（確認してから置き換える）・日の予定／月の予定へ移る
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { useDay } from '../components/day';
import { useToast } from '../components/Toast';
import { jstDate } from '../domain/time';
import { newId } from '../lib/common';
import { applyOffboard, applyOffboardWith, defaultChoice, offboardScope, unlimitedBy } from '../lib/offboard';
import { offboardConfirmBody, offboardDays } from '../lib/offboardView';
import { useDemoData } from '../store';

/** 選びの値（だれにもしない） */
export const NOBODY = '';

export function useOffboardFlow(staffId: string, onClose: () => void) {
  const { data, update } = useDemoData();
  const { setDate } = useDay();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const terms = data.org.terms;
  const today = jstDate(Date.now());
  const scope = useMemo(() => offboardScope(data, staffId, today), [data, staffId, today]);
  const staffById = useMemo(() => new Map(data.staff.map((s) => [s.id, s])), [data.staff]);
  const clientById = useMemo(() => new Map(data.clients.map((c) => [c.id, c])), [data.clients]);
  const name = staffById.get(staffId)?.name ?? '';
  /** 〈利用者さん〉ID → 選んだ人（'' はだれにもしない） */
  const [choices, setChoices] = useState<Record<string, string>>({});
  // 範囲が変わったら（適用・最終勤務日の変更）、まだ選んでいない〈利用者さん〉に既定の候補を入れる
  useEffect(() => {
    if (!scope) return;
    setChoices((prev) => {
      const next: Record<string, string> = {};
      for (const c of scope.clients) next[c.clientId] = prev[c.clientId] ?? defaultChoice(c) ?? NOBODY;
      return next;
    });
  }, [scope]);

  /** 訪問を日ごとにまとめる */
  const byDate = useMemo(() => offboardDays(scope?.visits ?? []), [scope]);

  const openDay = (d: string) => {
    setDate(d);
    onClose();
    navigate('/plan');
  };
  /** その人に絞った月の予定を開く（数え始める日の月） */
  const openMonth = (from: string) => {
    onClose();
    navigate(`/month?ym=${from.slice(0, 7)}&staff=${encodeURIComponent(staffId)}`);
  };

  const canApply = !!scope && scope.clients.length > 0;
  const apply = async () => {
    if (!scope || !canApply) return;
    const picked: Record<string, string | null> = {};
    for (const c of scope.clients) picked[c.clientId] = choices[c.clientId] || null;
    const nobody = scope.clients.filter((c) => !picked[c.clientId]).map((c) => clientById.get(c.clientId)?.displayName);
    // 担当できる人がその人だけの〈利用者さん〉を「だれにもしない」にすると、担当を限らなくなる
    const unlimited = unlimitedBy(data, staffId, picked).map((id) => clientById.get(id)?.displayName);
    // 確認の前に同じ規則で一度当てて、付け替える訪問の数を出す（データは変えない）
    const from = scope.from;
    const pids: string[] = [];
    const nextPid = () => {
      const id = newId('pt');
      pids.push(id);
      return id;
    };
    const preview = applyOffboardWith(data, staffId, picked, from, today, nextPid);
    const body = offboardConfirmBody({
      count: scope.clients.length,
      from,
      nobody,
      unlimited,
      renamed: preview.renamed,
      terms,
    });
    const ok = await confirmDialog({ title: '担当を置き換えますか？', body, confirmLabel: '担当を置き換える' });
    if (!ok) return;
    // 確認と同じパターン ID で当てる
    let k = 0;
    update((d) => applyOffboard(d, staffId, picked, from, today, () => pids[k++] ?? newId('pt')));
    toast(`${scope.clients.length}人の担当を置き換えました。入らない回は月の予定の要対応で確かめてください`);
  };

  return {
    terms,
    scope,
    limitsOn: data.org.features.allowedStaff !== false,
    staffById,
    clientById,
    name,
    choices,
    setChoices,
    byDate,
    openDay,
    openMonth,
    canApply,
    apply,
  };
}

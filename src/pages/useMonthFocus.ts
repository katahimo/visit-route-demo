// 月の画面の表示の選択（PRD D55・D61）：全体／〈スタッフ〉1人／〈利用者さん〉1人（URL の ?staff= ?client=）。
// 〈利用者さん〉は検索欄で選ぶので、まだ選んでいない間も検索欄を出しておく画面の状態（clientMode）を持つ
import { useEffect, useMemo, useState } from 'react';
import type { DemoData } from '../contracts/data';
import { byDisplayName, byName } from '../lib/common';
import { type MonthFocus, monthFocusOf, monthFocusPatch, monthFocusValue } from '../lib/monthView';
import type { ParamsPatch } from './useMonthNav';

export function useMonthFocus(
  data: DemoData,
  params: URLSearchParams,
  patchParams: (patch: ParamsPatch) => void,
  /** 表示の選ぶ欄で選んだとき（段は出したまま。PRD D327） */
  onPick: () => void,
) {
  const activeStaff = useMemo(() => data.staff.filter((s) => s.active).sort(byName), [data.staff]);
  const activeClients = useMemo(() => data.clients.filter((c) => c.active).sort(byDisplayName), [data.clients]);
  const typeById = useMemo(() => new Map(data.visitTypes.map((t) => [t.id, t])), [data.visitTypes]);
  const staffById = useMemo(() => new Map(data.staff.map((s) => [s.id, s])), [data.staff]);

  // ---- 表示の選択（?staff= ?client=。いない人は全体）----
  const focus: MonthFocus = useMemo(
    () => monthFocusOf(params.get('staff'), params.get('client'), activeStaff, activeClients),
    [params, activeStaff, activeClients],
  );
  /**
   * 表示の選択で「〈利用者さん〉」を選んでいる（PRD D61。〈利用者さん〉は検索欄 ClientPicker で1人選ぶ。
   * まだ選んでいない間も検索欄を出しておくための画面の状態）
   */
  const [clientMode, setClientMode] = useState(focus.kind === 'client');
  useEffect(() => {
    if (focus.kind === 'client') setClientMode(true);
    else if (focus.kind === 'staff') setClientMode(false);
  }, [focus.kind]);
  const focusValue = monthFocusValue(clientMode, focus);
  const pickFocus = (value: string) => {
    // 段の中で選び直しても段は出したまま（全体に戻しても消してフォーカスを落とさない。PRD D327）
    onPick();
    setClientMode(value === 'client');
    const patch = monthFocusPatch(value, focus.kind);
    if (patch) patchParams(patch);
  };
  /** 全体の表示にする（pickFocus('all') と同じ。extra は一緒に URL から消すもの） */
  const showAll = (extra: ParamsPatch = {}) => {
    setClientMode(false);
    patchParams({ staff: null, client: null, ...extra });
  };
  /** 選んだ〈利用者さん〉（休みの欄。ADR-0013） */
  const focusClient = focus.kind === 'client' ? data.clients.find((c) => c.id === focus.id) : undefined;
  const focusName =
    focus.kind === 'staff'
      ? (staffById.get(focus.id)?.name ?? '')
      : focus.kind === 'client'
        ? (activeClients.find((c) => c.id === focus.id)?.displayName ?? '')
        : '';

  return {
    activeStaff,
    activeClients,
    typeById,
    staffById,
    focus,
    clientMode,
    focusValue,
    focusClient,
    focusName,
    pickFocus,
    showAll,
  };
}

export type MonthFocusState = ReturnType<typeof useMonthFocus>;

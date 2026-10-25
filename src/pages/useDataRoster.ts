// データの画面の名簿の読み込み（PRD D103〜D107・D209。ADR-0020）：読んで検査し、件数（追加・更新・変更なし・終了／休止）を
// 見せて確かめてから、store の update で入れる。AI案・記録・確定した割当・訪問はそのまま。
// 入ったかは次の描画で data を見て決める（入らなければ成功と言わず、残した控えを前の世代に戻す）
import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import type { DemoData, RosterKind, RosterMode } from '../contracts/data';
import { rosterConfirmBody, rosterDoneText, rosterHasChanges, rosterHowText } from '../lib/dataScreen';
import { type LastDayPerson, lastDayChanged } from '../lib/personLinks';
import { canKeepPrevious, type PreviousKeep, useDemoData } from '../store';

export function useDataRoster(x: {
  rosterMode: RosterMode;
  setError: Dispatch<SetStateAction<string | null>>;
  setLastDay: Dispatch<SetStateAction<LastDayPerson[] | null>>;
}) {
  const { rosterMode, setError, setLastDay } = x;
  const { data, update, keepPrevious } = useDemoData();
  const toast = useToast();
  const confirmDialog = useConfirm();
  /** 読み込みの確認のあいだに、データが別のところ（別のタブなど）で変わっていないかを見る */
  const latest = useRef(data);
  latest.current = data;
  /** 名簿を update で入れたところ（入ったかは次の描画で data を見て決める。入らなければ成功と言わない） */
  const pending = useRef<{
    base: DemoData;
    next: DemoData;
    done: string;
    lastDay: LastDayPerson[];
    keep: PreviousKeep;
  } | null>(null);
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    if (data === p.next) {
      pending.current = null;
      toast(p.done);
      if (p.lastDay.length > 0) setLastDay(p.lastDay);
    } else if (data !== p.base) {
      pending.current = null;
      // 入らなかったので、残した控えは前の世代に戻す
      p.keep.cancel();
      setError(
        '読み込みのあいだにデータが変わったので入れませんでした（いまのデータはそのままです）。もう一度読み込んでください',
      );
    }
  }, [data, toast, setError, setLastDay]);

  return async (file: File, kind: RosterKind) => {
    const base = data;
    const { importRoster, rosterSummary, rosterWarning } = await import('../excel');
    const r = await importRoster(await file.arrayBuffer(), base, kind, rosterMode);
    if ('code' in r) {
      setError(`読み込めませんでした（いまのデータはそのままです）\n${r.message}`);
      return;
    }
    const term = kind === 'staff' ? base.org.terms.staff : base.org.terms.client;
    if (!rosterHasChanges(r)) {
      toast(`${term}の名簿に変更はありませんでした（変更なし ${r.unchanged}人）`);
      return;
    }
    const changed = () => {
      setError('読み込みのあいだにデータが変わりました。もう一度読み込んでください（いまのデータはそのままです）');
    };
    // 読んでいるあいだに別のところ（別のタブなど）でデータが変わっていたら、確認を出さずに止める
    if (latest.current !== base) return changed();
    const terms = base.org.terms;
    const how = rosterHowText(rosterMode);
    const ok = await confirmDialog({
      title: `${term}の名簿を読み込みますか？（${how}）`,
      body: rosterConfirmBody({
        warning: rosterWarning(r, kind, terms),
        fileName: file.name,
        term,
        how,
        summary: rosterSummary(r, kind, terms),
        keep: canKeepPrevious(),
      }),
      confirmLabel: '名簿を読み込む',
      // 総入れ替え（名簿にいない人を終了・休止にする）は危険の色
      tone: rosterMode === 'replace' ? 'danger' : 'primary',
    });
    if (!ok) return;
    if (latest.current !== base) return changed();
    // 名簿の読み込みも人をまとめて書き換えるので、いまのデータを1世代だけ控える（確認で OK になってから。PRD D227）
    const keep = keepPrevious(`${term}の名簿の${how}`);
    // 最終勤務日が入った人は ID も要る（知らせのリンク。PRD D209）ので、読み込む前と後を比べて引く
    const lastDay = kind === 'staff' ? lastDayChanged(base.staff, r.data.staff) : [];
    pending.current = {
      base,
      next: r.data,
      done: rosterDoneText({ term, staffTerm: terms.staff, hasLastDay: lastDay.length > 0, keep }),
      lastDay,
      keep,
    };
    update((d) => (d === base ? r.data : d), '名簿の読み込み');
  };
}

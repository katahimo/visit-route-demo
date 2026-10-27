// 名簿の読み込み（PRD D103〜D107・D209。ADR-0020・ADR-0068。〈利用者さん〉一覧・〈スタッフ〉一覧の名簿の欄から）：
// Excel のブックか CSV（文字コードは見分ける）を読んで検査し、件数（追加・更新・変更なし・終了／休止）を
// 見せて確かめてから、store の update で入れる。AI案・記録・確定した割当・訪問はそのまま。
// 入ったかは次の描画で data を見て決める（入らなければ成功と言わず、残した控えを前の世代に戻す）
import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import type { DemoData, RosterKind, RosterMode } from '../contracts/data';
import { rosterConfirmBody, rosterDoneText, rosterHasChanges, rosterHowText } from '../lib/dataScreen';
import { canKeepPrevious, type PreviousKeep, useDemoData } from '../store';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';

/** offboardOn は退職・担当替えの機能（ADR-0028 の offboard）が入か（切っていれば最終勤務日の欄を指さない） */
export function useRosterImport(x: {
  rosterMode: RosterMode;
  offboardOn: boolean;
  setError: Dispatch<SetStateAction<string | null>>;
}) {
  const { rosterMode, offboardOn, setError } = x;
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
    keep: PreviousKeep;
  } | null>(null);
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    if (data === p.next) {
      pending.current = null;
      toast(p.done);
    } else if (data !== p.base) {
      pending.current = null;
      // 入らなかったので、残した控えは前の世代に戻す
      p.keep.cancel();
      setError(
        '読み込みのあいだにデータが変わったので入れませんでした（いまのデータはそのままです）。もう一度読み込んでください',
      );
    }
  }, [data, toast, setError]);

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
        source: r.source,
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
    // 最終勤務日が入った人がいれば、一覧の「最終勤務日のある人」の欄で振り直せると知らせる（PRD D209）
    const hasLastDay = offboardOn && r.lastDaySet.length > 0;
    pending.current = {
      base,
      next: r.data,
      done: rosterDoneText({ term, staffTerm: terms.staff, hasLastDay, keep }),
      keep,
    };
    update((d) => (d === base ? r.data : d), '名簿の読み込み');
  };
}

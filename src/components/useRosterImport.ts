// 名簿の読み込み（PRD D103〜D107・D209。ADR-0020・ADR-0068。〈利用者さん〉一覧・〈スタッフ〉一覧の名簿の欄から）：
// Excel のブックか CSV（文字コードは見分ける）を読んで検査し、件数（追加・更新・変更なし・終了／休止）を
// 見せて確かめてから、store の update で入れる。訪問（担当）・伝えた内容はそのまま。
// 入れる手は usePendingImport（入らなければ成功と言わず、残した控えを前の世代に戻す）
import type { Dispatch, SetStateAction } from 'react';
import type { RosterKind, RosterMode } from '../contracts/data';
import { jstDate } from '../domain/time';
import {
  rosterConfirmBody,
  rosterDefaultHoursNote,
  rosterDoneText,
  rosterHasChanges,
  rosterHowText,
  rosterIsEmpty,
} from '../lib/dataScreen';
import { autoPlaceAfterRoster } from '../lib/placeAll';
import { canKeepPrevious } from '../store';
import { useConfirm } from './ConfirmDialog';
import { IMPORT_CHANGED_TEXT, usePendingImport } from './usePendingImport';

/**
 * offboardOn は退職・担当替えの機能（ADR-0028 の offboard）が入か（切っていれば最終勤務日の欄を指さない）。
 * onPlace は位置の無い人を自動でまとめて置き始める（PRD D427。ADR-0094）。渡されていて、読み込んだあとに
 * まとめて置く対象がいれば、確認に1文を足し（押す前に分かるように。ADR-0016）、名簿が入ったと見届けたら呼ぶ
 */
export function useRosterImport(x: {
  rosterMode: RosterMode;
  offboardOn: boolean;
  setError: Dispatch<SetStateAction<string | null>>;
  onPlace?: () => void;
}) {
  const { rosterMode: chosenMode, offboardOn, setError, onPlace } = x;
  const { data, toast, changedSince, commit } = usePendingImport(setError);
  const confirmDialog = useConfirm();

  /** mode は読み込み方（読み直したあとの続きでは控えた読み込み方。省けば今の選び） */
  return async (file: File, kind: RosterKind, rosterMode: RosterMode = chosenMode) => {
    const base = data;
    const { importRoster, rosterSummary, rosterWarning } = await import('../excel');
    const r = await importRoster(await file.arrayBuffer(), base, kind, rosterMode, jstDate(Date.now()));
    if ('code' in r) {
      setError(`読み込めませんでした（いまのデータはそのままです）\n${r.message}`);
      return;
    }
    const term = kind === 'staff' ? base.org.terms.staff : base.org.terms.client;
    if (!rosterHasChanges(r)) {
      toast(`${term}の名簿に変更はありませんでした（変更なし ${r.unchanged}人）`);
      return;
    }
    // 読んでいるあいだに別のところ（別のタブなど）でデータが変わっていたら、確認を出さずに止める
    if (changedSince(base)) return setError(IMPORT_CHANGED_TEXT);
    const terms = base.org.terms;
    const how = rosterHowText(rosterMode);
    const autoPlace = autoPlaceAfterRoster({ geocodeOn: onPlace !== undefined, next: r.data, kind });
    const ok = await confirmDialog({
      title: `${term}の名簿を読み込みますか？（${how}）`,
      body: rosterConfirmBody({
        warning: rosterWarning(r, kind, terms),
        fileName: file.name,
        term,
        how,
        summary: rosterSummary(r, kind, terms),
        source: r.source,
        otherForm: r.otherForm,
        empty: rosterIsEmpty(base, kind),
        keep: canKeepPrevious(),
        autoPlace,
        hoursNote: rosterDefaultHoursNote({
          names: r.hoursDefaulted,
          features: base.org.features,
          staffTerm: terms.staff,
        }),
      }),
      confirmLabel: '名簿を読み込む',
      // 総入れ替え（名簿にいない人を終了・休止にする）は危険の色
      tone: rosterMode === 'replace' ? 'danger' : 'primary',
    });
    if (!ok) return;
    if (changedSince(base)) return setError(IMPORT_CHANGED_TEXT);
    // 名簿の読み込みも人をまとめて書き換えるので、いまのデータを1世代だけ控える（確認で OK になってから。PRD D227）
    // 最終勤務日が入った人がいれば、一覧の「最終勤務日のある人」の欄で振り直せると知らせる（PRD D209）
    const hasLastDay = offboardOn && r.lastDaySet.length > 0;
    commit({
      base,
      next: r.data,
      label: `${term}の名簿の${how}`,
      done: (keep) => rosterDoneText({ term, staffTerm: terms.staff, hasLastDay, keep }),
      onDone: autoPlace ? onPlace : undefined,
    });
  };
}

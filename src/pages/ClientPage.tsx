import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { useExceptionsOnly, useFeature } from '../components/useFeature';
import { COMPACT_QUERY, useMedia } from '../components/useMedia';
import { jstDate } from '../domain/time';
import type { ClientSecKey } from '../lib/clientEdit';
import { byName } from '../lib/common';
import { clientFolded, clientTabKeys } from '../lib/peopleView';
import { CLIENT_TABS, type ClientTab, NEW_PERSON_ID, tabOf } from '../lib/personPage';
import { useDemoData } from '../store';
import { ClientLeavesSection } from './ClientLeavesSection';
import type { ClientSecOf } from './clientBasicSections';
import { ClientBasicTab } from './clientBasicTab';
import { ClientPageHeader } from './clientPageHeader';
import { ClientScheduleTab } from './clientScheduleTab';
import { ClientStaffingTab } from './clientStaffingTab';
import { useClientCal } from './useClientCal';
import { useClientEdit } from './useClientEdit';
import { useClientSave } from './useClientSave';
import './settings.css';

/**
 * 〈利用者さん〉の画面（`#/clients/:id`。PRD D308〜D311。ADR-0052）：全画面に、上に名前と状態、タブ［予定｜基本情報｜担当・相性｜休み］。
 * 予定は左に繰り返し（定期パターン）と休み、右に週・月のカレンダー（components/PersonCalendar。回を押すと訪問の詳細の欄）。
 * 基本情報・担当・相性は節ごとに「直す → 保存・取り消し」（components/personPage の EditSection）。繰り返し・休みも保存を押すまで変えない。
 * 変更があるまま離れる・タブを替える・別の人へ移るときは確かめる（断れば続ける）。`#/clients/new` は新しい人（基本の節が開いた形）
 */

export default function ClientPage() {
  const { id: rawId = '' } = useParams();
  // 開いている人（URL の人と違うのは、変更があるまま URL が替わって確かめている間だけ）
  const [shownId, setShownId] = useState(rawId);
  const { data } = useDemoData();
  const navigate = useNavigate();
  const { search } = useLocation();
  const confirm = useConfirm();
  const leaveOk = useRef(false);
  /** 開いている人の URL のクエリ（断って戻すとき、タブ・カレンダーもそのまま戻す） */
  const searchRef = useRef(search);
  if (rawId === shownId) searchRef.current = search;
  const dirtyRef = useRef(false);
  const who = useRef('');
  // URL の人が替わった（パレット・吹き出しのリンク・hash の書き換え）：変更があれば確かめ、断れば元の人の URL へ戻す
  // biome-ignore lint/correctness/useExhaustiveDependencies: URL の人が替わったときだけ
  useEffect(() => {
    if (rawId === shownId) return;
    if (!dirtyRef.current || leaveOk.current) {
      leaveOk.current = false;
      setShownId(rawId);
      return;
    }
    const back = shownId;
    const next = data.clients.find((c) => c.id === rawId)?.displayName ?? '（名前なし）';
    // 画面の移動で待っている確認を取り消す処理（ConfirmDialog）のあとで聞く
    const t = window.setTimeout(() => {
      void confirm({
        title: `変更を捨てて、${next}を開きますか？`,
        body: `${who.current}の変更を保存していません。`,
        confirmLabel: `捨てて${next}を開く`,
        cancelLabel: '編集を続ける',
        tone: 'danger',
      }).then((ok) => {
        if (ok) setShownId(rawId);
        else navigate(`/clients/${encodeURIComponent(back)}${searchRef.current}`, { replace: true });
      });
    });
    return () => window.clearTimeout(t);
  }, [rawId]);
  if (shownId !== NEW_PERSON_ID && !data.clients.some((c) => c.id === shownId)) {
    if (rawId !== shownId) return null;
    return <Navigate to="/clients" replace state={{ missing: shownId }} />;
  }
  return (
    <ClientPageBody
      key={shownId}
      id={shownId}
      onDirty={(d, name) => {
        dirtyRef.current = d;
        who.current = name;
      }}
      onLeave={() => {
        leaveOk.current = true;
      }}
    />
  );
}

function ClientPageBody({
  id,
  onDirty,
  onLeave,
}: {
  id: string;
  onDirty: (dirty: boolean, who: string) => void;
  onLeave: () => void;
}) {
  const { data } = useDemoData();
  const terms = data.org.terms;
  const [params] = useSearchParams();
  const narrow = useMedia(COMPACT_QUERY);
  const today = jstDate(Date.now());
  // 機能の入り切り（ADR-0028）：切った機能の入力の欄・表示を出さない（データは消さず、保存しても今の値を残す）
  const stageOn = useFeature('clientStage');
  const allowedOn = useFeature('allowedStaff');
  const leavesOn = useFeature('clientLeave');
  const patternsOn = useFeature('patterns');
  const notesOn = useFeature('visitNotes');
  const compatOn = useFeature('compat');
  const only = useExceptionsOnly(); // 切は段階・特性・決まりごと・担当・相性を「詳しく ▾」へ畳む（PRD D385）
  const isNew = id === NEW_PERSON_ID;
  const saved = data.clients.find((c) => c.id === id);
  const staff = useMemo(() => [...data.staff].sort(byName), [data.staff]);
  const activeStaff = useMemo(() => staff.filter((s) => s.active), [staff]);
  const clientItems = data.items.filter((i) => i.target === 'client');
  const tab: ClientTab = isNew ? 'basic' : tabOf(clientTabKeys(CLIENT_TABS, only), params.get('tab'));

  // ---- 節の編集・保存 ----
  const ed = useClientEdit({ isNew, saved, staff, nextColor: data.clients.length, terms, onDirty, onLeave });
  const { edit, error, errorId } = ed;
  const { save, confirmTentative, cancelTentative } = useClientSave({
    edit,
    setEdit: ed.setEdit,
    setError: ed.setError,
    saved,
    staff,
    allowedOn,
    today,
    discardAll: ed.discardAll,
    onLeave,
  });
  // ---- 予定のカレンダー（URL の cal・d） ----
  const cal = useClientCal(today);

  // 新しい人を保存・取り消して移る間（節を閉じたあと）は何も出さない
  if (!saved && !edit) return null;
  const c = saved ?? edit?.form;
  if (!c) return null;
  const editing = (k: ClientSecKey) => edit?.key === k;
  /** 直している入力（直していなければ null） */
  const ctx = { form: edit?.form ?? null, setForm: ed.setForm, bad: ed.bad, terms };
  /** 節の共通の引数 */
  const sec: ClientSecOf = (key) => ({
    name: key,
    editing: editing(key),
    onEdit: () => void ed.startEdit(key),
    onSave: save,
    onCancel: () => void ed.cancelEdit(),
    error: editing(key) ? error : null,
    errorId,
  });

  /** 担当・相性（入はタブ、切は基本情報の「詳しく」の中） */
  const staffingTab = saved && (
    <ClientStaffingTab
      c={c}
      saved={saved}
      ctx={ctx}
      limit={edit ? edit.limit : null}
      setLimit={ed.setLimit}
      sec={sec}
      data={data}
      activeStaff={activeStaff}
      allowedOn={allowedOn}
      compatOn={compatOn}
    />
  );

  return (
    <div
      className="stack person-page person-view"
      data-testid="person-view"
      data-kind="client"
      data-id={isNew ? '' : id}
    >
      <ClientPageHeader
        isNew={isNew}
        c={c}
        saved={saved}
        data={data}
        staff={staff}
        today={today}
        tab={tab}
        compatOn={compatOn}
        leavesOn={leavesOn}
        only={only}
        onAskTab={ed.askTab}
      />

      {tab === 'schedule' && saved && (
        <ClientScheduleTab
          saved={saved}
          data={data}
          today={today}
          resetKey={ed.resetKey}
          narrow={narrow}
          leavesOn={leavesOn}
          patternsOn={patternsOn}
          pattern={cal.pattern}
          onPattern={cal.setPattern}
          onPatternsDirty={ed.onPatternsDirty}
          calView={cal.calView}
          anchor={cal.anchor}
          onCal={cal.setCal}
        />
      )}

      {tab === 'basic' && (
        <ClientBasicTab
          c={c}
          saved={saved}
          newEdit={isNew && !!edit}
          ctx={ctx}
          sec={sec}
          onSave={save}
          onCancel={() => void ed.cancelEdit()}
          error={error}
          errorId={errorId}
          clientItems={clientItems}
          stageOn={stageOn}
          notesOn={notesOn}
          folded={clientFolded(only)}
          more={only && saved ? staffingTab : null}
          onConfirmTentative={confirmTentative}
          onCancelTentative={cancelTentative}
        />
      )}

      {tab === 'staffing' && staffingTab}

      {tab === 'leaves' && saved && leavesOn && (
        <div className="card stack" data-testid="person-leaves">
          <ClientLeavesSection key={`l${ed.resetKey}`} client={saved} onDirty={ed.onLeavesDirty} />
        </div>
      )}
    </div>
  );
}

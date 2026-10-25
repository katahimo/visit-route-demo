import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { useFeature } from '../components/useFeature';
import { jstDate } from '../domain/time';
import { NEW_PERSON_ID, STAFF_TABS, type StaffTab, tabOf } from '../lib/personPage';
import { useDemoData } from '../store';
import { OffboardPanel } from './OffboardPanel';
import { StaffPersonHeader } from './staffPersonHeader';
import { StaffScheduleTab } from './staffScheduleTab';
import { StaffBasicTab, StaffCompatTab, StaffHoursTab } from './staffSections';
import { useStaffEdit } from './useStaffEdit';
import { useStaffSchedule } from './useStaffSchedule';
import './settings.css';

/**
 * 〈スタッフ〉の画面（`#/staff/:id`。PRD D308〜D310・D312。ADR-0052）：〈利用者さん〉の画面と同じ形で、タブ［予定｜基本情報｜勤務時間｜相性］。
 * 予定は担当している訪問のカレンダー（回を押すと訪問の詳細の欄）・欠勤と希望休・その期間の勤務の見込みの要約。
 * 基本情報・勤務時間は節ごとに「直す → 保存・取り消し」。最終勤務日を入れて保存すると担当の振り直しの欄（ADR-0015）。
 * `#/staff/new` は新しい人（基本の節が開いた形）
 */

export default function StaffPersonPage() {
  const { staffId: rawId = '' } = useParams();
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
  // URL の人が替わった：変更があれば確かめ、断れば元の人の URL へ戻す（〈利用者さん〉の画面と同じ）
  // biome-ignore lint/correctness/useExhaustiveDependencies: URL の人が替わったときだけ
  useEffect(() => {
    if (rawId === shownId) return;
    if (!dirtyRef.current || leaveOk.current) {
      leaveOk.current = false;
      setShownId(rawId);
      return;
    }
    const back = shownId;
    const next = data.staff.find((s) => s.id === rawId)?.name ?? '（名前なし）';
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
        else navigate(`/staff/${encodeURIComponent(back)}${searchRef.current}`, { replace: true });
      });
    });
    return () => window.clearTimeout(t);
  }, [rawId]);
  if (shownId !== NEW_PERSON_ID && !data.staff.some((s) => s.id === shownId)) {
    if (rawId !== shownId) return null;
    return <Navigate to="/staff" replace state={{ missing: shownId }} />;
  }
  return (
    <StaffPageBody
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

function StaffPageBody({
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
  const [params, setParams] = useSearchParams();
  const today = jstDate(Date.now());
  // 機能の入り切り（ADR-0028）
  const offboardOn = useFeature('offboard');
  const compatOn = useFeature('compat');
  const mailOn = useFeature('mail');
  const allowedStaffOn = useFeature('allowedStaff');
  const isNew = id === NEW_PERSON_ID;
  const saved = data.staff.find((s) => s.id === id);
  const tab: StaffTab = isNew ? 'basic' : tabOf(STAFF_TABS, params.get('tab'));
  /** 担当の振り直しの欄（最終勤務日を入れて保存したとき。PRD D71） */
  const [offboard, setOffboard] = useState(false);

  // ---- 節の編集 ----
  const ed = useStaffEdit({ saved, isNew, today, offboardOn, allowedStaffOn, onDirty, onLeave, setOffboard });
  // ---- 予定のカレンダー ----
  const schedule = useStaffSchedule({ params, setParams, tab, saved, today });

  // 新しい人を保存・取り消して移る間（節を閉じたあと）は何も出さない
  if (!saved && !ed.edit) return null;
  const s = saved ?? ed.edit?.form;
  if (!s) return null;

  return (
    <div
      className="stack person-page person-view"
      data-testid="person-view"
      data-kind="staff"
      data-id={isNew ? '' : id}
    >
      <StaffPersonHeader
        s={s}
        id={id}
        isNew={isNew}
        tab={tab}
        compatOn={compatOn}
        staffTerm={terms.staff}
        askTab={async () => {
          // 替えるなら直している節・繰り返し・休みの入力を捨てる（戻ったときに古い下書きを出さない）
          const ok = await ed.ask('tab');
          if (ok) ed.discardAll();
          return ok;
        }}
      />

      {tab === 'schedule' && saved && (
        <StaffScheduleTab
          s={s}
          today={today}
          schedule={schedule}
          offboardOn={offboardOn}
          onOffboard={() => setOffboard(true)}
        />
      )}

      {tab === 'basic' && <StaffBasicTab s={s} isNew={isNew} ed={ed} mailOn={mailOn} offboardOn={offboardOn} />}

      {tab === 'hours' && saved && <StaffHoursTab s={s} ed={ed} overrides={schedule.overrides} />}

      {tab === 'compat' && saved && <StaffCompatTab saved={saved} compatOn={compatOn} />}

      {offboardOn && offboard && saved && <OffboardPanel staffId={saved.id} onClose={() => setOffboard(false)} />}
    </div>
  );
}

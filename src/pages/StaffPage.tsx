import { Plus, UserRound } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { DetailColumnsToggle, useDetailColumns } from '../components/DetailColumns';
import { RosterButton, RosterCard } from '../components/RosterCard';
import { PeopleTabs } from '../components/SettingsTabs';
import { useToast } from '../components/Toast';
import { PageHeader, WithIcon } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { useIntro } from '../components/useIntro';
import { jstDate } from '../domain/time';
import { byName } from '../lib/common';
import { narrowRole } from '../lib/narrowRoles';
import { offboardScope } from '../lib/offboard';
import { peopleIntro, staffColumns } from '../lib/peopleView';
import { useDemoData } from '../store';
import { leavingStaff, OffboardPanel } from './OffboardPanel';
import { StaffHead, type StaffLeaving, StaffLeavingCard, StaffRow } from './staffList';
import './settings.css';

/**
 * 〈スタッフ〉一覧（PoC本体 StaffPage.tsx を写し、招待・メールを外して特性と条件を足した）。
 * 行を押すとその人の画面（`#/staff/:id`。StaffPersonPage）へ、「追加」は新しい人の画面（`#/staff/new`）へ（PRD D308）。
 * 最終勤務日のある人の担当の振り直しの欄（ADR-0015）はここからも開ける（名簿の読み込みで最終勤務日が入った人もここに出る。PRD D209）。
 * 「Excel・CSV」で名簿の欄（書き出し・読み込み。ADR-0068）を開く
 */

export default function StaffPage() {
  const { data } = useDemoData();
  const terms = data.org.terms;
  const lead = useIntro('staff', `${terms.staff}の勤務・特性・条件を決めます`, peopleIntro('staff'));
  // 機能の入り切り（ADR-0028）：退職・担当替えを切れば振り直しの欄を出さない（最終勤務日の値は事実なので一覧の「最終」の印は残す）
  const offboardOn = useFeature('offboard');
  // 名簿の欄（Excel・CSV。ADR-0068）。Excel の入出力を切っていれば出さない（ADR-0028 の excel）
  const excelOn = useFeature('excel');
  // 一覧の列は名前・勤務日・勤務時間の3列。入は表の上の「くわしい列」で専門の列を足せる（PRD D385・D394）
  const { detailed } = useDetailColumns('staff');
  const cols = staffColumns(detailed);
  const [rosterOpen, setRosterOpen] = useState(false);
  const rosterId = useId();
  /** 担当の振り直しの欄を開いている〈スタッフ〉（PRD D71。null：閉じている） */
  const [offboardFor, setOffboardFor] = useState<string | null>(null);
  const today = jstDate(Date.now());
  const staff = useMemo(() => [...data.staff].sort(byName), [data.staff]);
  /** 最終勤務日のある人と、振り直しが残っているもの（〈利用者さん〉の人数・訪問の件数） */
  const leaving = useMemo(
    (): StaffLeaving[] =>
      leavingStaff(data.staff).map((s) => {
        const sc = offboardScope(data, s.id, today, false);
        return { staff: s, clients: sc?.clients.length ?? 0, visits: sc?.visits.length ?? 0 };
      }),
    [data, today],
  );
  const staffItems = data.items.filter((i) => i.target === 'staff');
  const itemById = new Map(data.items.map((i) => [i.id, i]));
  // ?id= で開いたら（古いリンク・ブックマーク）、その人の画面（`#/staff/:id`）へ移る（PRD D308。いない人なら URL から消すだけ）
  const navigate = useNavigate();
  // いない人の画面（`/staff/:id`）から移ってきたときは知らせる（state.missing。1回だけ）
  const toastMissing = useToast();
  const location = useLocation();
  const missing = (location.state as { missing?: string } | null)?.missing;
  // biome-ignore lint/correctness/useExhaustiveDependencies: 移ってきたときだけ
  useEffect(() => {
    if (!missing) return;
    toastMissing(`その${terms.staff}は見つかりません（消されたか、URL が違います）`);
    navigate(location.pathname, { replace: true, state: null });
  }, [missing]);
  const [params, setParams] = useSearchParams();
  const openId = params.get('id');
  // biome-ignore lint/correctness/useExhaustiveDependencies: URL の id が変わったときだけ
  useEffect(() => {
    if (openId === null) return;
    if (data.staff.some((x) => x.id === openId)) {
      navigate(`/staff/${encodeURIComponent(openId)}`, { replace: true });
      return;
    }
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete('id');
        return p;
      },
      { replace: true },
    );
  }, [openId]);

  return (
    <div className="stack">
      <PageHeader
        // 一覧・勤務・相性の小さいタブ（入切とも。PRD D394）
        nav={<PeopleTabs />}
        icon={UserRound}
        // 見出しはメニューの名前と同じ（PRD D230）
        title={terms.staff}
        lead={lead}
        actions={
          <>
            {excelOn && (
              <RosterButton open={rosterOpen} onToggle={() => setRosterOpen((o) => !o)} controls={rosterId} />
            )}
            <Link to="/staff/new" className="btn btn-primary" data-testid="staff-add">
              <WithIcon icon={Plus}>{terms.staff}を追加</WithIcon>
            </Link>
          </>
        }
      />

      {excelOn && <RosterCard kind="staff" id={rosterId} open={rosterOpen} onClose={() => setRosterOpen(false)} />}

      {offboardOn && leaving.length > 0 && <StaffLeavingCard leaving={leaving} terms={terms} onOpen={setOffboardFor} />}

      <DetailColumnsToggle list="staff" />
      {/* 狭い画面（600px 以下）では行をカードにする（PRD D220。名前と状態が1行目、ほかは見出し付きの行、開くは右下） */}
      <div className="card table-scroll">
        <table {...narrowRole.table} className="people-table narrow-cards" data-testid="narrow-staff">
          <thead {...narrowRole.rowgroup}>
            <StaffHead cols={cols} clientTerm={terms.client} />
          </thead>
          <tbody {...narrowRole.rowgroup}>
            {staff.map((s) => (
              <StaffRow
                key={s.id}
                s={s}
                cols={cols}
                clientTerm={terms.client}
                staffItems={staffItems}
                itemById={itemById}
                onOpen={() => navigate(`/staff/${encodeURIComponent(s.id)}`)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {offboardOn && offboardFor && <OffboardPanel staffId={offboardFor} onClose={() => setOffboardFor(null)} />}
    </div>
  );
}

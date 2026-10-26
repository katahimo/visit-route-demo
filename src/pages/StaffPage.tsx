import { Plus, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BasicsNav } from '../components/SettingsTabs';
import { useToast } from '../components/Toast';
import { PageHeader, WithIcon } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { jstDate } from '../domain/time';
import { byName } from '../lib/common';
import { narrowRole } from '../lib/narrowRoles';
import { offboardScope } from '../lib/offboard';
import { useDemoData } from '../store';
import { leavingStaff, OffboardPanel } from './OffboardPanel';
import { type StaffLeaving, StaffLeavingCard, StaffRow } from './staffList';
import './settings.css';

/**
 * 〈スタッフ〉一覧（PoC本体 StaffPage.tsx を写し、招待・メールを外して特性と条件を足した）。
 * 行を押すとその人の画面（`#/staff/:id`。StaffPersonPage）へ、「追加」は新しい人の画面（`#/staff/new`）へ（PRD D308）。
 * 最終勤務日のある人の担当の振り直しの欄（ADR-0015）はここからも開ける
 */

export default function StaffPage() {
  const { data } = useDemoData();
  const terms = data.org.terms;
  // 機能の入り切り（ADR-0028）：退職・担当替えを切れば振り直しの欄を出さない（最終勤務日の値は事実なので一覧の「最終」の印は残す）
  const offboardOn = useFeature('offboard');
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
        nav={<BasicsNav />}
        icon={UserRound}
        title={`${terms.staff}一覧`}
        lead={`${terms.staff}の勤務・特性・条件を決めます`}
        actions={
          <Link to="/staff/new" className="btn btn-primary" data-testid="staff-add">
            <WithIcon icon={Plus}>{terms.staff}を追加</WithIcon>
          </Link>
        }
      />

      {offboardOn && leaving.length > 0 && <StaffLeavingCard leaving={leaving} terms={terms} onOpen={setOffboardFor} />}

      {/* 狭い画面（600px 以下）では行をカードにする（PRD D220。名前と状態が1行目、ほかは見出し付きの行、開くは右下） */}
      <div className="card table-scroll">
        <table {...narrowRole.table} className="people-table narrow-cards" data-testid="narrow-staff">
          <thead {...narrowRole.rowgroup}>
            <tr {...narrowRole.row}>
              <th {...narrowRole.columnheader}>名前</th>
              <th {...narrowRole.columnheader}>勤務</th>
              <th {...narrowRole.columnheader}>特性</th>
              <th {...narrowRole.columnheader}>{terms.client}に求めること</th>
              <th {...narrowRole.columnheader}>自宅の位置</th>
              <th {...narrowRole.columnheader}>状態</th>
              <th {...narrowRole.columnheader} aria-label="操作" />
            </tr>
          </thead>
          <tbody {...narrowRole.rowgroup}>
            {staff.map((s) => (
              <StaffRow
                key={s.id}
                s={s}
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

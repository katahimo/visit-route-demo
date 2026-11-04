// 移動時間の見積もり方を選ぶ（PRD D436。ADR-0101）：直線距離（送らない）か、道路に沿った道のり（押したときだけ緯度・経度を OSRM へ送って取る）。
// 管理者設定の「道路の移動時間（車）」のカードと、登録の案内の③で使う
import { Route } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { ROAD_POINTS_MAX } from '../contracts/documents';
import { jstDate, jstHhmm } from '../domain/time';
import { roadPlanText, roadProgressText, roadStatusText } from '../lib/roadTravelView';
import { useConfirm } from './ConfirmDialog';
import './roadTravel.css';
import { useToast } from './Toast';
import { WithIcon } from './ui';
import { useRoadTable } from './useRoadTable';

type Mode = 'line' | 'road';

/** waitReason：取れない間の理由（緯度・経度を探している途中など）。あれば［取る］を押せない */
export function RoadTravelChoice({ waitReason = null }: { waitReason?: string | null }) {
  const road = useRoadTable();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const name = useId();
  const [mode, setMode] = useState<Mode>(road.table ? 'road' : 'line');
  // 別のタブ・元に戻すで表が入ったら、道路を選んだ状態に合わせる
  const has = road.table !== undefined;
  useEffect(() => {
    if (has) setMode('road');
  }, [has]);
  const busy = road.progress !== null;
  /** 送れない（地点が無い・上限を超える） */
  const cannot = road.points.length === 0 || road.points.length > ROAD_POINTS_MAX;

  const choose = async (next: Mode) => {
    if (next === mode) return;
    if (next === 'line' && road.table) {
      const yes = await confirmDialog({
        title: '直線距離からの見積もりに戻しますか？',
        body: '取った道路の移動時間を消します。もう一度道路を選んで押せば、また取れます。',
        confirmLabel: '戻す',
      });
      if (!yes) return;
      road.clear();
      toast('直線距離からの見積もりに戻しました');
    }
    setMode(next);
  };
  const fetchNow = async () => {
    const r = await road.fetchNow();
    toast(r.ok ? `${r.count}地点の道路の移動時間を取りました` : r.message);
  };

  return (
    <fieldset className="stack road-choice" data-testid="road-choice" disabled={busy}>
      <legend className="road-choice-legend">移動時間の見積もり方</legend>
      <label className="road-choice-option">
        <input
          type="radio"
          name={name}
          checked={mode === 'line'}
          onChange={() => void choose('line')}
          data-testid="road-choice-line"
        />
        <span>
          直線距離から見積もる<span className="sub">（外部へ送りません）</span>
        </span>
      </label>
      <label className="road-choice-option">
        <input
          type="radio"
          name={name}
          checked={mode === 'road'}
          onChange={() => void choose('road')}
          data-testid="road-choice-road"
        />
        <span>
          道路に沿った道のりから取る<span className="sub">（車の区間）</span>
        </span>
      </label>
      {mode === 'road' && (
        <div className="stack road-choice-body">
          <p className="sub" data-testid="road-choice-notice">
            押したときに、自宅と訪問先の緯度・経度だけを OSRM（OpenStreetMap
            の道路の公開サーバー）へ送って取ります。名前・住所は送りません。
          </p>
          <p className="sub" data-testid="road-choice-plan">
            目安：{roadPlanText(road.points.length)}
          </p>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => void fetchNow()}
              disabled={busy || cannot || waitReason !== null}
              data-testid="road-travel-fetch"
            >
              <WithIcon icon={Route}>{road.table ? '取り直す' : '道路の移動時間を取る'}</WithIcon>
            </button>
            {waitReason && <span className="sub">{waitReason}</span>}
          </div>
        </div>
      )}
      <p className="sub" data-testid="road-travel-status" aria-live="polite">
        {road.progress
          ? roadProgressText(road.progress.done, road.progress.total)
          : roadStatusText(road.table, road.points, (ms) => `${jstDate(ms)} ${jstHhmm(ms)}`)}
      </p>
    </fieldset>
  );
}

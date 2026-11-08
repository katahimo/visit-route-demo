// 移動時間の見積もり方を選ぶ（PRD D436。ADR-0101）：緯度・経度の直線距離（送らない）か、車道にそった道のり（押したときだけ緯度・経度を OSRM へ送って取る）。
// 管理者設定の「移動時間の見積もり方」のカードと、登録の案内の③で使う
import { Route } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { ROAD_NEAR_K, ROAD_POINTS_MAX } from '../contracts/documents';
import { SPEED_KMH } from '../domain/geo';
import { jstDate, jstHhmm } from '../domain/time';
import {
  lineExampleText,
  roadExampleText,
  roadPlanText,
  roadProgressText,
  roadStatusText,
  TRAVEL_RULES,
} from '../lib/roadTravelView';
import { useDemoData } from '../store';
import { useConfirm } from './ConfirmDialog';
import './roadTravel.css';
import { useToast } from './Toast';
import { TravelNumberField } from './TravelNumberField';
import { WithIcon } from './ui';
import { useRoadTable } from './useRoadTable';

type Mode = 'line' | 'road';

/**
 * waitReason：取れない間の理由（緯度・経度を探している途中など）。あれば［取る］を押せない。
 * hideLegend：題を読み上げだけにする（上にカードの見出しがあるとき）
 */
export function RoadTravelChoice({
  waitReason = null,
  hideLegend = false,
}: {
  waitReason?: string | null;
  hideLegend?: boolean;
}) {
  const road = useRoadTable();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const name = useId();
  const [mode, setMode] = useState<Mode>(road.table ? 'road' : 'line');
  // 別のタブ・元に戻すで表が入った・消えたら、選んだ状態も合わせる
  const has = road.table !== undefined;
  useEffect(() => {
    setMode(has ? 'road' : 'line');
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
    toast(r.ok ? `${r.count}地点の道のりを取得しました。予定の移動時間が変わります` : r.message);
  };

  return (
    <>
      <fieldset className="stack road-choice" data-testid="road-choice" disabled={busy}>
        <legend className={hideLegend ? 'sr-only' : 'road-choice-legend'}>移動時間の見積もり方</legend>
        <label className="road-choice-option">
          <input
            type="radio"
            name={name}
            checked={mode === 'line'}
            onChange={() => void choose('line')}
            data-testid="road-choice-line"
          />
          <span>緯度・経度の直線距離で見積もる</span>
        </label>
        <LineFormula />
        <label className="road-choice-option">
          <input
            type="radio"
            name={name}
            checked={mode === 'road'}
            onChange={() => void choose('road')}
            data-testid="road-choice-road"
          />
          <span>車道にそった道のりから見積もる</span>
        </label>
        <RoadFormula />
        {mode === 'road' && (
          <div className="stack road-choice-body">
            <p className="sub" data-testid="road-choice-notice">
              車道にそった道のりは、OSRM の公開サーバー（OpenStreetMap
              の道路データ）に、緯度・経度のみを送信して取得します。
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
                <WithIcon icon={Route}>{road.table ? '取り直す' : '道のりを取得する'}</WithIcon>
              </button>
              {waitReason && <span className="sub">{waitReason}</span>}
            </div>
          </div>
        )}
      </fieldset>
      {/* 状態と［止める］は fieldset の外（取っている間も押せる） */}
      <div className="row road-status">
        <p className="sub" data-testid="road-travel-status" aria-live="polite">
          {road.progress
            ? roadProgressText(road.progress.done, road.progress.total)
            : roadStatusText(road.table, road.points, (ms) => `${jstDate(ms)} ${jstHhmm(ms)}`)}
        </p>
        {busy && (
          <button type="button" className="btn" onClick={road.stop} data-testid="road-travel-stop">
            止める
          </button>
        )}
      </div>
    </>
  );
}

/** 係数を保存して知らせる（org の lineTravel・roadTravel の1つの値） */
function useSaveCoef() {
  const { data, update } = useDemoData();
  const toast = useToast();
  const line = (key: 'detourFactor' | 'driveKmh', label: string, unit: string) => (n: number) => {
    update((d) => ({ ...d, org: { ...d.org, lineTravel: { ...d.org.lineTravel, [key]: n } } }), label);
    toast(`${label}を ${n}${unit} にしました`);
  };
  const road = (key: 'parkMinutes' | 'trafficFactor', label: string, unit: string) => (n: number) => {
    update((d) => ({ ...d, org: { ...d.org, roadTravel: { ...d.org.roadTravel, [key]: n } } }), label);
    toast(`${label}を ${n}${unit} にしました`);
  };
  return { org: data.org, line, road };
}

/** 直線距離の計算式と係数（道なり係数・車の速さ） */
function LineFormula() {
  const { org, line } = useSaveCoef();
  const t = org.lineTravel;
  return (
    <div className="stack road-choice-body" data-testid="line-formula">
      <p className="road-formula">移動（分）＝ 直線距離 × 道なり係数 ÷ 車の速さ × 60</p>
      <div className="row road-settings">
        <TravelNumberField
          label="道なり係数"
          value={t.detourFactor}
          rule={TRAVEL_RULES.detour}
          onSave={line('detourFactor', '道なり係数', '倍')}
          testId="line-detour"
        />
        <TravelNumberField
          label="車の速さ"
          value={t.driveKmh}
          rule={TRAVEL_RULES.driveKmh}
          onSave={line('driveKmh', '車の速さ', 'km/h')}
          testId="line-kmh"
        />
      </div>
      <p className="sub" data-testid="line-example">
        {lineExampleText(t)}。自転車 {SPEED_KMH.BICYCLE}km/h・徒歩 {SPEED_KMH.WALK}km/h・公共交通 {SPEED_KMH.TRANSIT}
        km/h は決まった速さ
      </p>
    </div>
  );
}

/** 車道の道のりの計算式と補正（駐車・玄関まで・混雑係数） */
function RoadFormula() {
  const { org, road } = useSaveCoef();
  const t = org.roadTravel;
  return (
    <div className="stack road-choice-body" data-testid="road-formula">
      <p className="road-formula">移動（分）＝ 駐車・玄関まで ＋ 混雑係数 × 道路の所要（分）</p>
      <div className="row road-settings">
        <TravelNumberField
          label="駐車・玄関まで"
          value={t.parkMinutes}
          rule={TRAVEL_RULES.park}
          onSave={road('parkMinutes', '駐車・玄関まで', '分')}
          testId="road-travel-park"
        />
        <TravelNumberField
          label="混雑係数"
          value={t.trafficFactor}
          rule={TRAVEL_RULES.traffic}
          onSave={road('trafficFactor', '混雑係数', '倍')}
          testId="road-travel-factor"
        />
      </div>
      <p className="sub" data-testid="road-travel-example">
        {roadExampleText(t)}。道路の所要は渋滞・信号待ちを含みません。地点ごとに近い{ROAD_NEAR_K}
        か所より遠い組と、車でない移動は直線距離で見積もります
      </p>
    </div>
  );
}

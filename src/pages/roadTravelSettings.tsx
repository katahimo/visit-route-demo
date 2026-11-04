// 管理者設定の「道路の移動時間（車）」（PRD D436。ADR-0101）：見積もり方の選択（components/RoadTravelChoice）と、補正（駐車・玄関までの分・混雑係数）の欄
import { Route } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { FieldError, invalidAttrs } from '../components/FieldError';
import { RoadTravelChoice } from '../components/RoadTravelChoice';
import { useToast } from '../components/Toast';
import { Hint } from '../components/ui';
import {
  ROAD_NEAR_K,
  ROAD_PARK_MINUTES_MAX,
  ROAD_TRAFFIC_FACTOR_MAX,
  ROAD_TRAFFIC_FACTOR_MIN,
} from '../contracts/documents';
import { factorInputError, parkInputError, roadExampleText } from '../lib/roadTravelView';
import { useDemoData } from '../store';
import '../components/roadTravel.css';

export function RoadTravelSettingsCard() {
  const { data, update } = useDemoData();
  const hasTable = data.roads !== undefined;
  const toast = useToast();
  const titleId = useId();
  const ids = { park: useId(), factor: useId() };
  const travel = data.org.roadTravel;
  const [park, setPark] = useState(String(travel.parkMinutes));
  const [factor, setFactor] = useState(String(travel.trafficFactor));
  // 別のタブ・元に戻すで変わったら欄も合わせる
  useEffect(() => {
    setPark(String(travel.parkMinutes));
  }, [travel.parkMinutes]);
  useEffect(() => {
    setFactor(String(travel.trafficFactor));
  }, [travel.trafficFactor]);
  const parkError = parkInputError(park);
  const factorError = factorInputError(factor);

  const savePark = () => {
    const n = Number(park.normalize('NFKC').trim());
    if (parkError || n === travel.parkMinutes) return;
    update(
      (d) => ({ ...d, org: { ...d.org, roadTravel: { ...d.org.roadTravel, parkMinutes: n } } }),
      '駐車・玄関までの分',
    );
    toast(`駐車・玄関までを ${n}分 にしました`);
  };
  const saveFactor = () => {
    const n = Number(factor.normalize('NFKC').trim());
    if (factorError || n === travel.trafficFactor) return;
    update((d) => ({ ...d, org: { ...d.org, roadTravel: { ...d.org.roadTravel, trafficFactor: n } } }), '混雑係数');
    toast(`混雑係数を ${n} にしました`);
  };
  const enter = (save: () => void) => (e: { key: string }) => {
    if (e.key === 'Enter') save();
  };

  return (
    <section className="card stack" aria-labelledby={titleId} data-testid="road-travel-settings">
      <h2 id={titleId} className="feature-section-title">
        <Route size={18} aria-hidden="true" />
        道路の移動時間（車）
        {hasTable && <span className="feature-badge">使っています</span>}
      </h2>
      <div className="feature-desc-line">
        <span className="sub">
          車で回る区間の移動時間を、OpenStreetMap の道路から取ります。取らないときは直線距離から見積もります
        </span>
        <Hint ariaLabel="道路の移動時間の説明">
          <span data-testid="road-travel-notes">
            道路の所要は渋滞・信号待ちを含まないため、下の補正を足して使います。地点ごとに近い{ROAD_NEAR_K}
            か所まで取り、遠い組と自転車・徒歩・公共交通の移動は直線距離から見積もります。
          </span>
        </Hint>
      </div>
      <RoadTravelChoice />
      <div className="row road-settings">
        <label className="road-setting">
          <span>駐車・玄関まで</span>
          <input
            type="number"
            min={0}
            max={ROAD_PARK_MINUTES_MAX}
            step={1}
            value={park}
            onChange={(e) => setPark(e.target.value)}
            onBlur={savePark}
            onKeyDown={enter(savePark)}
            {...invalidAttrs(!!parkError, ids.park)}
            data-testid="road-travel-park"
          />
          <span>分</span>
          <FieldError as="span" id={ids.park}>
            {parkError}
          </FieldError>
        </label>
        <label className="road-setting">
          <span>混雑係数</span>
          <input
            type="number"
            min={ROAD_TRAFFIC_FACTOR_MIN}
            max={ROAD_TRAFFIC_FACTOR_MAX}
            step={0.1}
            value={factor}
            onChange={(e) => setFactor(e.target.value)}
            onBlur={saveFactor}
            onKeyDown={enter(saveFactor)}
            {...invalidAttrs(!!factorError, ids.factor)}
            data-testid="road-travel-factor"
          />
          <span>倍</span>
          <FieldError as="span" id={ids.factor}>
            {factorError}
          </FieldError>
        </label>
      </div>
      <p className="sub" data-testid="road-travel-example">
        {roadExampleText(travel)}
      </p>
      <p className="sub">
        経路：©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap contributors
        </a>
        ・
        <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">
          OSRM
        </a>
      </p>
    </section>
  );
}

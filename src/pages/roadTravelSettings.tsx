// 管理者設定の「移動時間の見積もり方」（PRD D436。ADR-0101）：直線距離か車道の道のりかの選択と、それぞれの計算式・係数（components/RoadTravelChoice）
import { Route } from 'lucide-react';
import { useId } from 'react';
import { RoadTravelChoice } from '../components/RoadTravelChoice';
import { useDemoData } from '../store';
import '../components/roadTravel.css';

export function RoadTravelSettingsCard() {
  const { data } = useDemoData();
  const titleId = useId();
  return (
    <section className="card stack" aria-labelledby={titleId} data-testid="road-travel-settings">
      <h2 id={titleId} className="feature-section-title">
        <Route size={18} aria-hidden="true" />
        移動時間の見積もり方
        {data.roads && <span className="feature-badge">車道の道のり</span>}
      </h2>
      <RoadTravelChoice hideLegend />
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

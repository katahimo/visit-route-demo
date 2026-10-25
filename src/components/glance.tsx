// 一目で分かる表示の部品（PRD D78〜D80）：段階の凡例。
// （今月の準備の積み上げ PrepBar は進み具合の帯（components/progressBand。PRD D154）にまとめて消した。色の CSS .prep-bar・.prep-part は帯が使う）
// 色だけに頼らない：文字（○△×？・数字）・枠（0人の濃い枠・案なしの破線）と、title・読み上げの文。
// 色の言葉は3段バーと同じ components/barMarks.css（PRD D85。柄は使わない）
import './barMarks.css';
import './glance.css';

/** 段階の凡例（class は lv-〈段階〉） */
export function LevelLegend({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <span className="glance-legend" data-testid="level-legend">
      {items.map(([level, label]) => (
        <span key={level} className="glance-legend-item">
          <span className={`glance-swatch lv-${level}`} aria-hidden="true" />
          {label}
        </span>
      ))}
    </span>
  );
}

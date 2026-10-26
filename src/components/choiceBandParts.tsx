// 案を日で見る（ChoiceDayView）の見た目の部品：案のタブ・要約・地図の欄
import { Crown, Map as MapIcon } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import type { Staff } from '../contracts/documents';
import type { ReassignDiff } from '../contracts/reassign';
import { type DayChoice, diffSign, pointText } from '../lib/choiceBandView';
import { deltaText, r0 } from '../lib/common';
import type { MapLine, MapPoint } from '../lib/routeView';
import { MapDock } from './MapDock';
import { RouteMap } from './RouteMap';
import { StaffLegend } from './routeView';
import { SectionTitle } from './ui';

type RouteMapData = { points: MapPoint[]; lines: MapLine[] };

/** 案のタブ（今・案ごと。点と今から担当が変わる件数。いちばん点の高い案に王冠）。k は見ているタブ（-1 は今） */
export function ChoiceTabs({
  currentLabel,
  choices,
  moved,
  k,
  best,
  points,
  onPick,
}: {
  currentLabel: string;
  choices: readonly DayChoice[];
  /** 案ごとの今から担当が変わる件数 */
  moved: readonly number[];
  k: number;
  best: number;
  points: { current: number | null; choices: (number | null)[] };
  onPick: (next: number) => void;
}) {
  return (
    <div className="choice-tabs" role="tablist" aria-label="案">
      <button
        type="button"
        role="tab"
        aria-selected={k < 0}
        className={`choice-tab${k < 0 ? ' is-on' : ''}`}
        onClick={() => onPick(-1)}
        data-testid="standard-day-current"
      >
        <span className="choice-tab-name">{currentLabel}</span>
        <span className="choice-tab-points" data-testid="choice-points">
          {pointText(points.current)}
        </span>
      </button>
      {choices.map((c, i) => (
        <button
          key={c.presetId}
          type="button"
          role="tab"
          aria-selected={k === i}
          className={`choice-tab${k === i ? ' is-on' : ''}`}
          onClick={() => onPick(i)}
          data-testid="standard-day-choice"
          data-preset={c.presetId}
        >
          <span className="choice-tab-name">
            {best === i && choices.length > 1 && (
              <Crown size={14} aria-label="いちばん点の高い案" data-testid="standard-day-crown" />
            )}
            {c.name}
          </span>
          <span className="choice-tab-points" data-testid="choice-points">
            {pointText(points.choices[i] ?? null)}
          </span>
          <span className="choice-tab-sub">担当が変わる {moved[i] ?? 0}件</span>
        </button>
      ))}
    </div>
  );
}

/** 要約（点と今との差・変わる件数・移動の増減・担当なし）と、選んだ案の操作（action） */
export function ChoiceSummary({
  name,
  isChoice,
  diff,
  shown,
  currentPoints,
  currentLabel,
  unassignedCount,
  action,
}: {
  name: string;
  /** 案のタブを見ている（今のタブなら false） */
  isChoice: boolean;
  diff: ReassignDiff | null;
  shown: number | null;
  currentPoints: number | null;
  currentLabel: string;
  unassignedCount: number;
  action?: ReactNode;
}) {
  const delta = shown !== null && currentPoints !== null ? shown - currentPoints : null;
  return (
    <div className="row choice-summary" style={{ flexWrap: 'wrap', gap: 8 }}>
      <p className="choice-stats" data-testid="choice-stats">
        <strong>{name}</strong>：{pointText(shown)}
        {isChoice &&
          delta !== null &&
          `（${currentLabel} ${pointText(currentPoints)}・${diffSign(delta)}${Math.abs(delta)}）`}
        {isChoice && diff && (
          <>
            ・担当が変わる <strong>{diff.moved.length}</strong>件・時刻が変わる <strong>{diff.shifted.length}</strong>
            件・移動 {deltaText(r0(diff.travelDelta), '分')}
          </>
        )}
        {unassignedCount > 0 && <span className="warn-text">・担当なし {unassignedCount}件</span>}
      </p>
      {action && <div className="row choice-actions">{action}</div>}
    </div>
  );
}

/** 時間軸の下の地図の欄（全幅）と、地図が画面の外のときに右下に浮かせる MapDock */
export function ChoiceMapCard({
  cardRef,
  map,
  title,
  focusStaff,
  focusKey,
  staffIds,
  staffById,
  onClear,
  onFocus,
}: {
  cardRef: RefObject<HTMLDivElement | null>;
  map: RouteMapData;
  title: string;
  focusStaff: string | null;
  focusKey: Parameters<typeof MapDock>[0]['focusKey'];
  staffIds: string[];
  staffById: ReadonlyMap<string, Staff>;
  onClear: () => void;
  onFocus: (id: string | null) => void;
}) {
  return (
    <>
      <div ref={cardRef} className="choice-map stack" data-testid="standard-day-map">
        <SectionTitle
          icon={MapIcon}
          aside={
            focusStaff && (
              <button type="button" className="btn btn-small" onClick={onClear}>
                全員のルートを見る
              </button>
            )
          }
        >
          {title}
        </SectionTitle>
        <RouteMap points={map.points} lines={map.lines} height={420} />
        <StaffLegend
          staffIds={staffIds}
          staffName={(id) => staffById.get(id)?.name ?? '（不明）'}
          focusStaff={focusStaff}
          onFocus={onFocus}
          extra={<span className="nowrap legend-item">「家」＝自宅</span>}
        />
      </div>
      <MapDock target={cardRef} points={map.points} lines={map.lines} title={title} focusKey={focusKey} />
    </>
  );
}

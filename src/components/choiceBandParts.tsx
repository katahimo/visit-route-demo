// 考え方ごとの案の帯の見た目の部品：見出し・タブ・要約と操作・地図の欄
import { CircleCheck, Crown, Map as MapIcon, Sparkles, X } from 'lucide-react';
import type { RefObject } from 'react';
import type { Staff } from '../contracts/documents';
import { diffSign, pointText } from '../lib/choiceBandView';
import { deltaText, r0 } from '../lib/common';
import { monthBatch, type ProposalChoice, type ProposalDay } from '../lib/monthBatch';
import type { MapLine, MapPoint } from '../lib/routeView';
import { MapDock } from './MapDock';
import { RouteMap } from './RouteMap';
import { StaffLegend } from './routeView';
import { SectionTitle, WithIcon } from './ui';

type RouteMapData = { points: MapPoint[]; lines: MapLine[] };

/** 帯の見出し（案の数・説明・捨てる） */
export function ChoiceHead({ label, count }: { label: string; count: number }) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
      <WithIcon icon={Sparkles} size={16}>
        <span className="band-text">
          <strong>
            {label}の案（{count}つ）
          </strong>
          ：タブで切り替えて、今の担当とくらべてください。気に入った案を「この案を標準にする」で選ぶと、これから AI
          はその考え方で組みます
        </span>
      </WithIcon>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => monthBatch.discard()}
        data-testid="proposal-discard"
      >
        <WithIcon icon={X} size={14}>
          捨てる
        </WithIcon>
      </button>
    </div>
  );
}

/** 案のタブ（今の担当・案ごと）。k は見ているタブ（-1 は今の担当） */
export function ChoiceTabs({
  choices,
  k,
  best,
  points,
  onPick,
}: {
  choices: readonly ProposalChoice[];
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
        data-testid="choice-current"
      >
        <span className="choice-tab-name">今の担当</span>
        <span className="choice-tab-points">{pointText(points.current)}</span>
      </button>
      {choices.map((c, i) => {
        const d = c.days[0];
        return (
          <button
            key={c.presetId}
            type="button"
            role="tab"
            aria-selected={k === i}
            className={`choice-tab${k === i ? ' is-on' : ''}`}
            onClick={() => onPick(i)}
            data-testid="choice-card"
            data-preset={c.presetId}
          >
            <span className="choice-tab-name">
              {best === i && choices.length > 1 && <Crown size={14} aria-label="いちばん点の高い案" />}
              {c.name}
            </span>
            <span className="choice-tab-points" data-testid="choice-points">
              {pointText(points.choices[i] ?? null)}
            </span>
            <span className="choice-tab-sub">担当が変わる {d?.diff?.moved.length ?? 0}件</span>
          </button>
        );
      })}
    </div>
  );
}

/** 要約（点・変わる件数）と「この案を標準にする」「この日だけ反映」 */
export function ChoiceSummary({
  k,
  chosen,
  day,
  shown,
  currentPoints,
  unassignedCount,
  canAct,
  onAdopt,
  onApplyOnly,
}: {
  k: number;
  chosen: ProposalChoice | undefined;
  day: ProposalDay | undefined;
  shown: number | null;
  currentPoints: number | null;
  unassignedCount: number;
  /** 押せるか（組んでいる最中でなく、訪問が変わっていない） */
  canAct: boolean;
  onAdopt: () => void;
  onApplyOnly: () => void;
}) {
  const diff = shown !== null && currentPoints !== null ? shown - currentPoints : null;
  return (
    <div className="row choice-summary" style={{ flexWrap: 'wrap', gap: 8 }}>
      <p className="choice-stats" data-testid="choice-stats">
        <strong>{k >= 0 ? chosen?.name : '今の担当'}</strong>：{pointText(shown)}
        {k >= 0 && diff !== null && `（今 ${pointText(currentPoints)}・${diffSign(diff)}${Math.abs(diff)}）`}
        {day && (
          <>
            ・担当が変わる <strong>{day.diff?.moved.length ?? 0}</strong>件・時刻が変わる{' '}
            <strong>{day.diff?.shifted.length ?? 0}</strong>件
            {day.diff ? `・移動 ${deltaText(r0(day.diff.travelDelta), '分')}` : ''}
          </>
        )}
        {unassignedCount > 0 && <span className="warn-text">・担当なし {unassignedCount}件</span>}
      </p>
      {k >= 0 && (
        <div className="row choice-actions">
          <button
            type="button"
            className="btn btn-primary btn-small"
            disabled={!canAct}
            onClick={onAdopt}
            data-testid="choice-adopt"
          >
            <WithIcon icon={CircleCheck} size={14}>
              この案を標準にする
            </WithIcon>
          </button>
          <button
            type="button"
            className="btn btn-small"
            disabled={!canAct}
            onClick={onApplyOnly}
            data-testid="choice-apply"
          >
            この日だけ反映
          </button>
        </div>
      )}
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
      <div ref={cardRef} className="choice-map stack" data-testid="choice-map">
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

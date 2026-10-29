// 〈利用者さん〉の画面の予定のタブ（PRD D308〜D310。ADR-0052・0056）：左に繰り返し（PatternsSection。機能 patterns が切なら隠す）とこれからの休み、
// 右に週・月のカレンダー（PersonCalendar）
import { BedSingle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PersonCalendar } from '../components/PersonCalendar';
import { WithIcon } from '../components/ui';
import type { DemoData } from '../contracts/data';
import type { Client } from '../contracts/documents';
import { leaveOn } from '../domain/leaves';
import { mdText } from '../lib/dateText';
import { leavesOf } from '../lib/leaves';
import type { CalView } from '../lib/personPage';
import { PatternsSection } from './PatternsSection';

export function ClientScheduleTab({
  saved,
  data,
  today,
  resetKey,
  narrow,
  leavesOn,
  patternsOn,
  pattern,
  onPattern,
  onPatternsDirty,
  calView,
  anchor,
  onCal,
}: {
  saved: Client;
  data: DemoData;
  today: string;
  /** 変更を捨てたら繰り返しの入力を作り直す */
  resetKey: number;
  narrow: boolean;
  leavesOn: boolean;
  /** 繰り返しの機能（patterns）が入か。切なら繰り返しの欄を隠す（今ある繰り返しの回は予定に残り、カレンダーに出る） */
  patternsOn: boolean;
  /** 選んでいる（カレンダーで目立たせる）繰り返し */
  pattern: string | null;
  onPattern: (id: string | null) => void;
  onPatternsDirty: (dirty: boolean) => void;
  calView: CalView;
  anchor: string;
  onCal: (v: { view: CalView; anchor: string }) => void;
}) {
  const id = saved.id;
  const leaves = leavesOf(data, saved.id);
  return (
    <div className="person-schedule" data-testid="person-schedule">
      <div className="person-schedule-side">
        {patternsOn && (
          <div className="card stack">
            <PatternsSection
              key={`p${resetKey}`}
              client={saved}
              selected={pattern}
              onSelect={onPattern}
              onDirty={onPatternsDirty}
              readOnly={narrow}
            />
            {narrow && <span className="sub">繰り返しを足す・直すのは広い画面でできます。</span>}
          </div>
        )}
        {/* 休みは事実なので、休みの機能を切っても読むだけで出す（入れる・直すは休みのタブ） */}
        <div className="card stack" data-testid="schedule-leaves">
          <h2 className="person-subhead">
            <WithIcon icon={BedSingle} size={16}>
              休み
            </WithIcon>
          </h2>
          {leaves.filter((l) => l.to >= today).length === 0 ? (
            <span className="sub">これからの休みはありません</span>
          ) : (
            <ul className="person-list">
              {leaves
                .filter((l) => l.to >= today)
                .map((l) => (
                  <li key={l.id}>
                    <strong>
                      {mdText(l.from)}〜{mdText(l.to)}
                    </strong>{' '}
                    <span className="sub">{l.note || '理由なし'}</span>
                  </li>
                ))}
            </ul>
          )}
          {leavesOn && (
            <Link
              to={`/clients/${encodeURIComponent(id)}?tab=leaves`}
              replace
              className="btn btn-small btn-text"
              data-testid="to-leaves"
            >
              休みを入れる・直す
            </Link>
          )}
        </div>
      </div>
      <div className="person-schedule-main card">
        <PersonCalendar
          kind="client"
          personId={id}
          view={calView}
          anchor={anchor}
          onChange={onCal}
          highlight={pattern}
          dayNote={(d) =>
            leaveOn(data.clientLeaves, id, d) ? <span className="chip chip-warn pcal-chip">休み</span> : null
          }
        />
      </div>
    </div>
  );
}

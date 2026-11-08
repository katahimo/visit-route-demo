// 月の画面の見出しの欄の部品（PRD D53〜D55・D61・D69・D177・D189・D256・D327）：見せ方の切り替え・表示の選択の段・
// マスの見方の説明・「休みを入れる」の帯・凡例・範囲の AI で組む（担当を組む）の進み具合
import { CalendarOff, LayoutGrid, List, Lock, PencilLine, Square } from 'lucide-react';
import { type RefObject, useId } from 'react';
import { ClientPicker } from '../components/ClientPicker';
import { LoadLegend, LoadRowsSample } from '../components/loadBar';
import type { MenuItem } from '../components/MenuButton';
import { StaffLegend } from '../components/staffBar';
import { Term } from '../components/Term';
import { WithIcon } from '../components/ui';
import type { Client, Staff, VisitType } from '../contracts/documents';
import { barEdgeNote, barRowsText } from '../lib/barRows';
import { mdText } from '../lib/dateText';
import type { DayStatus } from '../lib/month';
import type { BatchRun } from '../lib/monthBatch';
import { monthHelpLines } from '../lib/monthGuide';
import { DAY_STATE_TEXT, type MonthLayout } from '../lib/monthList';
import { batchProgressValue, type MonthFocus } from '../lib/monthView';
import { REQUESTED_OFF_NOTE } from '../lib/requestedOff';
import { dayStateText } from '../lib/settledView';
import type { OffNote } from './useMonthOff';

const STATE_ORDER: DayStatus['state'][] = ['none', 'told', 'changed'];
/** 確定の段階が無い（切）ときの凡例：決まったあとの変更だけ */
const STATE_ORDER_CHANGED_ONLY: DayStatus['state'][] = ['changed'];

/** カレンダーと日ごとの一覧の切り替えを「その他 ▾」の項目で（操作の行のボタンを2つまでにするため。PRD D189・D384・D402。600px 以下ははじめ一覧。URL の ?layout=） */
export function monthLayoutItems(layout: MonthLayout, onPick: (next: MonthLayout) => void): MenuItem[] {
  return (
    [
      ['calendar', 'カレンダー', LayoutGrid],
      ['list', '日ごとの一覧', List],
    ] as const
  ).map(
    ([k, label, icon], i): MenuItem => ({
      key: `layout-${k}`,
      group: i === 0 ? '表示' : undefined,
      label: `${label}で見る`,
      icon,
      current: layout === k,
      onSelect: () => onPick(k),
      testId: `month-layout-${k}`,
    }),
  );
}

/**
 * 表示の選択の段（PRD D55・D61・D327）：表示（全体・〈スタッフ〉・〈利用者さん〉の検索欄）・「休みを入れる」（〈スタッフ〉を
 * 選んでいるとき）・混み具合で数える人（全体のとき）
 */
export function MonthPickers({
  selectRef,
  terms,
  focus,
  focusValue,
  onPickFocus,
  people,
  onPickClient,
  off,
  load,
}: {
  selectRef: RefObject<HTMLSelectElement | null>;
  terms: { staff: string; client: string };
  focus: MonthFocus;
  focusValue: string;
  onPickFocus: (value: string) => void;
  /** 選べる人と〈利用者さん〉の検索欄の近道（この月に訪問がある人・〈スタッフ〉が担当する人） */
  people: {
    staff: readonly Staff[];
    clients: readonly Client[];
    monthClientIds: ReadonlySet<string>;
    clientIdsOf: (staffId: string) => ReadonlySet<string>;
  };
  onPickClient: (id: string | null) => void;
  /** 「休みを入れる」のボタン（出さないなら null） */
  off: { on: boolean; disabled: boolean; onToggle: () => void } | null;
  load: { value: string | null; types: readonly VisitType[]; onChange: (typeId: string | null) => void };
}) {
  /** 「混み具合：空きを数える人」の選ぶ欄の名前（aria-labelledby） */
  const loadTypeId = useId();
  return (
    <div className="row month-pickers" data-testid="month-pickers">
      <label className="month-picker">
        <span>表示</span>
        <select
          ref={selectRef}
          value={focusValue}
          onChange={(e) => onPickFocus(e.target.value)}
          data-testid="month-focus"
        >
          <option value="all">全体</option>
          <optgroup label={terms.staff}>
            {people.staff.map((s) => (
              <option key={s.id} value={`staff:${s.id}`}>
                {s.name}
              </option>
            ))}
          </optgroup>
          <option value="client">{terms.client}（名前・よみで探す）</option>
        </select>
      </label>
      {focusValue === 'client' && (
        <ClientPicker
          clients={people.clients}
          selected={focus.kind === 'client' ? [focus.id] : []}
          onChange={(ids) => onPickClient(ids[0] ?? null)}
          label={`表示する${terms.client}`}
          period={{ label: 'この月', clientIds: people.monthClientIds }}
          byStaff={{ staffLabel: terms.staff, staff: people.staff, clientIdsOf: people.clientIdsOf }}
          tentativeShortcut
          testId="month-client-picker"
        />
      )}
      {off && (
        <button
          type="button"
          className={`btn btn-small month-off-toggle${off.on ? ' is-on' : ''}`}
          aria-pressed={off.on}
          disabled={off.disabled}
          onClick={off.onToggle}
          data-testid="month-off-toggle"
        >
          <WithIcon icon={CalendarOff} size={14}>
            {off.on ? '休みの入力を終わる' : '休みを追加'}
          </WithIcon>
        </button>
      )}
      {focus.kind === 'all' && (
        // 用語の説明（ボタン）は label の中に置かない（入力欄の名前が用語のボタンへ移るため）。
        // 選ぶ欄の名前は aria-labelledby で「混み具合：」と用語をつなぐ
        <div className="month-picker">
          <span>
            <span id={`${loadTypeId}-label`}>混み具合：</span>
            <Term k="loadCount" testId="term-load-count" id={`${loadTypeId}-term`} />
          </span>
          <select
            aria-labelledby={`${loadTypeId}-label ${loadTypeId}-term`}
            value={load.value ?? ''}
            onChange={(e) => load.onChange(e.target.value === '' ? null : e.target.value)}
            data-testid="month-load-type"
          >
            <option value="">すべて</option>
            {load.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}（担当できる人）
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/** 「その他 ▾」の「マスの見方の説明」（PRD D327。文は lib/monthGuide の monthHelpLines。切は切のマスに出る印だけ） */
export function MonthHelp({
  helpRef,
  staffTerm,
  confirmStep,
  onClose,
}: {
  helpRef: RefObject<HTMLDivElement | null>;
  staffTerm: string;
  /** 確定（伝えた）の段階を出すか（lib/settledView） */
  confirmStep: boolean;
  onClose: () => void;
}) {
  return (
    <div ref={helpRef} className="hint-body month-help" tabIndex={-1} data-testid="month-help">
      <ul className="plan-help-list">
        {monthHelpLines(staffTerm, confirmStep).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <div>
        <button type="button" className="btn btn-small btn-text" onClick={onClose}>
          説明を閉じる
        </button>
      </div>
    </div>
  );
}

/** 「休みを入れる」の間の帯（PRD D69）：何をするかと、この月の希望休の日数・最後の付け外しの結果（読み上げ） */
export function MonthOffBar({
  name,
  offDays,
  note,
  onOpenDay,
}: {
  name: string;
  offDays: number;
  note: OffNote | null;
  onOpenDay: (date: string) => void;
}) {
  return (
    <div className="month-off-bar" data-testid="month-off-bar">
      <p>
        <strong>
          <WithIcon icon={CalendarOff} size={14}>
            {name}さんの休みを追加
          </WithIcon>
        </strong>
        ：勤務日のマスを押すと、その日を終日の{REQUESTED_OFF_NOTE}
        にします。もう一度押すと外します。
        <span className="sub">
          この月の{REQUESTED_OFF_NOTE}：{offDays}
          日。勤務の無い日・今日より前の日・ほかの欠勤のある日は押せません。
        </span>
      </p>
      <p className={note?.warn ? 'warn-text' : 'sub'} aria-live="polite" data-testid="month-off-note">
        {note?.text ?? ''}
        {note?.warn && (
          <button type="button" className="btn btn-small" onClick={() => onOpenDay(note.date)}>
            {mdText(note.date)} の予定を開く
          </button>
        )}
      </p>
    </div>
  );
}

/** 範囲の AI で組む（担当を組む）の進み具合（PRD D256）と止める */
export function MonthBatchProgress({
  batch,
  current,
  onStop,
}: {
  batch: BatchRun;
  current: string | undefined;
  onStop: () => void;
}) {
  return (
    <div className="stack month-progress" style={{ gap: 4 }} data-testid="month-progress">
      <progress
        value={batchProgressValue(batch)}
        max={Math.max(1, batch.targets.length)}
        aria-label="担当を組む進み具合"
        style={{ width: '100%' }}
      />
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span className="sub" aria-live="polite">
          {`${current ? '' : `${batch.label}：`}${current ? `${mdText(current)}：` : ''}${batch.index + 1}/${batch.targets.length}日（組めた日 ${batch.made}日）`}
        </span>
        <button type="button" className="btn btn-small" onClick={onStop}>
          <WithIcon icon={Square} size={14}>
            止める
          </WithIcon>
        </button>
      </div>
    </div>
  );
}

/**
 * 月の見出しの凡例：日の状態（背景・枠と印）と、3段バーの色と目盛り（見出しに1回）。
 * はじめは1行の要約と「凡例を見る」に畳む（PRD D177。開いたかどうかは保存しない）。
 * bar：全体は混み具合（load）、〈スタッフ〉を選んだときはその人の時間帯の状態（staff。PRD D75）
 */
export function MonthLegend({ bar, confirmStep }: { bar: 'load' | 'staff' | null; confirmStep: boolean }) {
  return (
    <details className="month-legend-fold" data-testid="month-legend-fold">
      <summary className="month-legend-summary" data-testid="month-legend-toggle">
        <span className="month-legend-open">
          <span className="is-closed">凡例を見る</span>
          <span className="is-opened">凡例を閉じる</span>
        </span>
        <span className="sub month-legend-line">
          色＝日の状態・赤い枠と「要対応 N」の札＝要対応・▶■＝始まる／終わる
          {bar === 'load' ? '・棒＝30分ごとの空き' : bar === 'staff' ? '・棒＝その人の時間帯' : ''}
          。マスにマウスを乗せるかフォーカスすると、そのマスの読み方が出ます
        </span>
      </summary>
      <MonthLegendBody bar={bar} confirmStep={confirmStep} />
    </details>
  );
}

/** 凡例の中身（開いたとき。確定の段階が無い（切）ときは、確定の状態の凡例を出さず「変更あり」だけ） */
function MonthLegendBody({ bar, confirmStep }: { bar: 'load' | 'staff' | null; confirmStep: boolean }) {
  return (
    <div className="month-legend" data-testid="month-legend">
      <span className="month-legend-group">
        {(confirmStep ? STATE_ORDER : STATE_ORDER_CHANGED_ONLY).map((st) => (
          <span key={st} className="month-legend-item">
            <span className={`month-swatch is-state-${st}`} aria-hidden="true">
              {st === 'told' && <Lock size={9} />}
              {st === 'changed' && <PencilLine size={9} />}
            </span>
            {/* 確定済み・未連絡の変更ありは説明つき（PRD D323） */}
            {!confirmStep ? (
              dayStateText(st, false, DAY_STATE_TEXT)
            ) : st === 'told' ? (
              <Term k="confirmed">{DAY_STATE_TEXT[st]}</Term>
            ) : st === 'changed' ? (
              <Term k="confirmDiff">{DAY_STATE_TEXT[st]}</Term>
            ) : (
              DAY_STATE_TEXT[st]
            )}
          </span>
        ))}
        <span className="month-legend-item">
          <span className="month-swatch is-care" aria-hidden="true">
            <span className="month-dot" />
          </span>
          要対応（担当なし・担当が休み・条件に合わない・時間に間に合わない）
        </span>
        <span className="month-legend-item">
          <span className="month-attn" aria-hidden="true">
            要対応 N
          </span>
          要対応の件数（右の欄の行の数）
        </span>
        <span className="month-legend-item">▶ 始まる・■ 終わる</span>
      </span>
      {bar !== null && (
        <span className="month-legend-group">
          <span className="month-legend-load">
            <span className="sub">{bar === 'load' ? '混み具合' : '時間帯'}</span>
            <LoadRowsSample />
            <span className="sub">
              {barRowsText()}
              {barEdgeNote()}
            </span>
          </span>
          {bar === 'load' ? <LoadLegend /> : <StaffLegend />}
          {bar === 'staff' && (
            <span className="sub" data-testid="month-staff-bar-note">
              時間帯は今の担当で出します
            </span>
          )}
        </span>
      )}
    </div>
  );
}

import type { RefObject } from 'react';
import { EdgeScroll } from '../components/EdgeScroll';
import { LoadRowsSample } from '../components/loadBar';
import { PersonButton } from '../components/PersonPopover';
import { QualificationBadges } from '../components/PickChips';
import { StaffMark } from '../components/StaffMark';
import { StaffBar, StaffLegend } from '../components/staffBar';
import { ChipStack, DropShadow, SelectToggle, VisitChip, VisitRow, type VisitRowData } from '../components/visitParts';
import type { Client } from '../contracts/documents';
import { barEdgeNote, barRowsText } from '../lib/barRows';
import { colorOf } from '../lib/colors';
import { clockTime, dateText } from '../lib/dateText';
import { typeOf } from '../lib/patternText';
import {
  type Band,
  type ClientWeekCell,
  type ClientWeekItem,
  type ClientWeekRow,
  canMoveVisit,
  clientItemMark,
  type StaffWeekTable,
  type WeekCell,
  type WeekRow,
} from '../lib/week';
import {
  clientItemText,
  clockSpan,
  diffText,
  initialOf,
  itemStateText,
  NO_TYPE_COLOR,
  pressText,
  staffCellTexts,
  visitAriaLabel,
  visitTitle,
} from '../lib/weekScreen';
import type { WeekModel } from './useWeekModel';
import type { WeekVisits } from './useWeekVisits';

// 週の予定（pages/WeekPage.tsx）の表：〈スタッフ〉×曜日（D51・PRD D342）と〈利用者さん〉×曜日（D56・PRD D83・D342）。
// マスに小さな札を3件まで積み、残りは「+N」の一覧（components/visitParts の ChipStack）

/** 表の部品が共通に使うもの（データ・訪問の動かし方・今日・狭い画面か） */
export type WeekTableCtx = { model: WeekModel; visits: WeekVisits; today: string; narrow: boolean };

/** 「+N」の一覧の行（リストの行。〈スタッフ〉×曜日の表は行が担当なので担当を出さない） */
function bandRow({ model, visits }: WeekTableCtx, b: Band, hideStaff: boolean): VisitRowData {
  const v = model.visitById.get(b.visitId);
  const t = typeOf(model.data.visitTypes, v?.typeId);
  const s = b.staffId ? model.staffById.get(b.staffId) : undefined;
  return {
    visitId: b.visitId,
    time: clockSpan(b.start, b.end),
    title: model.clientName(v),
    staff: s ?? null,
    staffName: b.staffId ? (s?.name ?? '（不明）') : '',
    state: b.leave ? '休みのため無し' : null,
    look: visits.lookOf(b.visitId),
    color: t ? colorOf(t.color) : null,
    hideStaff,
  };
}

/** 「+N」の一覧の行（〈利用者さん〉×曜日の表） */
function itemRow({ model, visits }: WeekTableCtx, it: ClientWeekItem): VisitRowData {
  const t = typeOf(model.data.visitTypes, it.typeId);
  const s = it.staffId ? model.staffById.get(it.staffId) : undefined;
  return {
    visitId: it.visitId,
    time: clockSpan(it.start, it.end),
    title: model.clientName(model.visitById.get(it.visitId)),
    staff: s ?? null,
    staffName: it.staffId ? (s?.name ?? '（不明）') : '',
    state: itemStateText(it),
    look: visits.lookOf(it.visitId),
    color: t ? colorOf(t.color) : NO_TYPE_COLOR,
  };
}

/** 表の上の凡例の行の「選ぶ」（狭い画面だけ。PRD D340） */
function SelectSwitch({ ctx }: { ctx: WeekTableCtx }) {
  if (!ctx.narrow) return null;
  return <SelectToggle selecting={ctx.visits.selecting} onChange={ctx.visits.setSelecting} testId="week-select" />;
}

/** 〈スタッフ〉×曜日の表のマス：30分ごとの状態のバー・訪問の札・件数（PRD D76・D342） */
function StaffCell({ ctx, staffId, c }: { ctx: WeekTableCtx; staffId: string; c: WeekCell }) {
  const { model, visits, today, narrow } = ctx;
  const { drag, multi, lookOf } = visits;
  // 数字は見比べに要る件数だけを小さく残し、稼働・移動・種類の内訳は title と読み上げへ（PRD D76）
  const { offText, detail } = staffCellTexts(c, model.data.visitTypes);
  const key = `s|${staffId}|${c.date}`;
  const hov = drag.hover?.key === key ? drag.hover : null;
  const chips = model.bandsOf.get(`${staffId}|${c.date}`) ?? [];
  return (
    <td
      className={[
        'week-cell',
        c.off ? 'is-off' : '',
        c.date < today ? 'is-past' : '',
        hov?.verdict.ok ? 'is-drop' : '',
      ].join(' ')}
      {...drag.target(key, () => ({ date: c.date, start: null, staffId }))}
      data-testid="week-cell"
      data-date={c.date}
      data-staff={staffId}
      title={`${model.staffName(staffId)}さん ${dateText(c.date)}：${detail}`}
    >
      <StaffBar slots={c.bar} testId="week-bar" />
      {/* 小さな札（時刻と〈利用者さん〉の頭文字）を3件まで積み、残りは「+N」（PRD D342） */}
      <ChipStack
        items={chips}
        keep={visits.keepId}
        dragging={drag.dragId !== null}
        listTitle={`${dateText(c.date)} ${model.staffName(staffId)}さんの訪問 ${chips.length}件`}
        chip={(b) => {
          const v = model.visitById.get(b.visitId);
          const look = lookOf(b.visitId);
          const on = multi.has(b.visitId);
          const movable = canMoveVisit(b.date, today) && !b.leave;
          const t = typeOf(model.data.visitTypes, v?.typeId);
          const name = model.clientName(v);
          return (
            <VisitChip
              visitId={b.visitId}
              time={clockTime(b.start)}
              short={initialOf(name)}
              label={visitAriaLabel(b.start, `${name}さん`, look?.text, on)}
              title={visitTitle(b.start, b.end, name, look?.text)}
              look={look}
              color={t ? colorOf(t.color) : null}
              selected={on}
              props={{
                ...drag.source(b.visitId, movable && !narrow),
                ...visits.tableItemProps(b.visitId, { selectable: movable, movable, selected: on }),
              }}
              testId="week-tvisit"
            />
          );
        }}
        row={(b) => {
          const movable = canMoveVisit(b.date, today) && !b.leave;
          const on = multi.has(b.visitId);
          return (
            <VisitRow
              row={bandRow(ctx, b, true)}
              selecting={visits.selecting}
              selected={on}
              props={{
                ...drag.source(b.visitId, movable && !narrow),
                ...visits.itemProps(b.visitId, { selectable: movable, movable, selected: on }),
              }}
              testId="week-list-visit"
            />
          );
        }}
        testId="week-tchips"
      />
      {hov && <DropShadow hover={hov} className="week-tdrop" time={false} />}
      <span className="week-cell-foot">
        {c.off ? (
          // 訪問の無い休みは、バーに重ねた「休み」（PRD D85）と二重にしないよう文字は読み上げだけ
          <span className={c.count > 0 ? 'week-cell-count' : 'sr-only'}>{offText}</span>
        ) : (
          <span className="week-cell-count">{c.count}件</span>
        )}
        <span className="sr-only">（{detail}）</span>
      </span>
    </td>
  );
}

/** 〈スタッフ〉×曜日の表の行：名前（押すと詳細の吹き出し。PRD D123）・日ごとのマス・週の合計・平均との差 */
function StaffRow({ ctx, r }: { ctx: WeekTableCtx; r: WeekRow }) {
  const { model } = ctx;
  return (
    <tr>
      <th scope="row">
        <span className="with-staff-mark">
          <StaffMark staff={model.staffById.get(r.staffId)} size="sm" />
          <PersonButton kind="staff" id={r.staffId} name={model.staffById.get(r.staffId)?.name ?? ''}>
            {model.staffName(r.staffId)}
          </PersonButton>
        </span>
        <QualificationBadges badges={model.badgesOf.get(r.staffId) ?? []} />
      </th>
      {r.cells.map((c) => (
        <StaffCell key={c.date} ctx={ctx} staffId={r.staffId} c={c} />
      ))}
      <td className="week-total">
        <strong>{r.total.count}件</strong>
        <span className="sub">稼働 {r.total.hours}時間</span>
        <span className="sub">移動 {r.total.travel}分</span>
      </td>
      <td className={`week-diff${r.strong ? ' is-strong' : ''}`} data-testid="week-diff">
        {diffText(r.diff)}
      </td>
    </tr>
  );
}

/** 〈スタッフ〉×曜日の表（D51） */
export function StaffWeekCard({
  ctx,
  table,
  dates,
  scrollRef,
}: {
  ctx: WeekTableCtx;
  table: StaffWeekTable;
  dates: readonly string[];
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const { terms } = ctx.model;
  return (
    <div className="card week-card">
      <div className="week-table-legend" data-testid="week-legend">
        <SelectSwitch ctx={ctx} />
        <span className="row week-table-legend-rows">
          <LoadRowsSample />
          <span className="sub">
            {barRowsText()}
            {barEdgeNote()}
          </span>
        </span>
        <StaffLegend />
      </div>
      <EdgeScroll scrollRef={scrollRef}>
        <table className="week-table" data-testid="week-table">
          <thead>
            <tr>
              <th scope="col">{terms.staff}</th>
              {dates.map((d) => (
                <th key={d} scope="col" className={d === ctx.today ? 'is-today' : undefined}>
                  {dateText(d)}
                </th>
              ))}
              <th scope="col">週の合計</th>
              <th scope="col">平均との差</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <StaffRow key={r.staffId} ctx={ctx} r={r} />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">日ごとの合計</th>
              {table.days.map((d) => (
                <td key={d.date}>
                  <strong>{d.count}件</strong>
                  <span className="sub">移動 {d.travel}分</span>
                </td>
              ))}
              <td className="week-total">
                <strong>{table.rows.reduce((m, r) => m + r.total.count, 0)}件</strong>
              </td>
              <td className="sub">平均 {table.average}件</td>
            </tr>
          </tfoot>
        </table>
      </EdgeScroll>
      <p className="sub">
        マスのバーは、その人の30分ごとの状態（訪問・移動・空き・休み・勤務外）です。バーの下は訪問の札（時刻と
        {terms.client}
        の頭文字）で、3件まで出し、残りは「+N」を押すと一覧で見られます。札を別のマスへドラッグすると担当と曜日が変わり、時刻はそのままです。
        キーボードでは札の上で ←→ で曜日・↑↓ で隣の担当へ動かし、Enter で訪問の詳細の欄を開きます。
        平均との差が30%を超える人を目立たせます。
      </p>
    </div>
  );
}

/** 〈利用者さん〉×曜日の表のマス：訪問の札（時刻と担当の印。PRD D342）。同じ行の別の日へドラッグできる */
function ClientCell({
  ctx,
  clientId,
  client,
  cell,
}: {
  ctx: WeekTableCtx;
  clientId: string;
  client: Client | undefined;
  cell: ClientWeekCell;
}) {
  const { model, visits, today, narrow } = ctx;
  const { drag, multi, lookOf } = visits;
  const key = `c|${clientId}|${cell.date}`;
  const hov = drag.hover?.key === key ? drag.hover : null;
  return (
    <td
      className={`week-ccell${cell.date < today ? ' is-past' : ''}${hov?.verdict.ok ? ' is-drop' : ''}`}
      {...drag.target(key, () => ({ date: cell.date, start: null, clientId }))}
      data-date={cell.date}
      data-client={clientId}
      data-testid="week-ccell"
    >
      {/* 小さな札（時刻と担当の印）を3件まで積み、残りは「+N」（PRD D342） */}
      <ChipStack
        items={cell.items}
        keep={visits.keepId}
        dragging={drag.dragId !== null}
        listTitle={`${dateText(cell.date)} ${client?.displayName ?? ''}さんの訪問 ${cell.items.length}件`}
        chip={(it) => {
          const type = typeOf(model.data.visitTypes, it.typeId);
          const mk = clientItemMark(it, model.markNames);
          // 〈利用者さん〉の休み（ADR-0013）・取り消しの訪問は動かさない
          const movable = canMoveVisit(it.date, today) && !it.leave && !it.cancelled;
          const look = lookOf(it.visitId);
          const on = multi.has(it.visitId);
          const text = clientItemText(it, type?.name, mk.text, look?.text);
          return (
            <VisitChip
              visitId={it.visitId}
              time={clockTime(it.start)}
              short={
                mk.kind === 'visit' && it.staffId ? (
                  <>
                    <StaffMark staff={model.staffById.get(it.staffId)} size="xs" />
                    {it.substitute && <span className="week-chip-sub">代</span>}
                  </>
                ) : mk.kind === 'unassigned' ? (
                  'なし'
                ) : (
                  mk.short
                )
              }
              label={`${text}${pressText(on)}`}
              title={text}
              look={look}
              color={type ? colorOf(type.color) : NO_TYPE_COLOR}
              selected={on}
              unassigned={mk.kind === 'unassigned'}
              off={!!it.leave || !!it.cancelled}
              props={{
                ...drag.source(it.visitId, movable && !narrow),
                ...visits.tableItemProps(it.visitId, { selectable: movable, movable, selected: on }),
              }}
              testId="week-citem"
            />
          );
        }}
        row={(it) => {
          const movable = canMoveVisit(it.date, today) && !it.leave && !it.cancelled;
          const on = multi.has(it.visitId);
          return (
            <VisitRow
              row={itemRow(ctx, it)}
              selecting={visits.selecting}
              selected={on}
              props={{
                ...drag.source(it.visitId, movable && !narrow),
                ...visits.itemProps(it.visitId, { selectable: movable, movable, selected: on }),
              }}
              testId="week-list-visit"
            />
          );
        }}
        testId="week-cchips"
      />
      {hov && <DropShadow hover={hov} className="week-cdrop" testId="week-cdrop" />}
    </td>
  );
}

/** 〈利用者さん〉×曜日の表（D56）：絞り込んだ人の行（人数の上限なし） */
export function ClientWeekCard({
  ctx,
  rows,
  dates,
  scrollRef,
}: {
  ctx: WeekTableCtx;
  rows: ClientWeekRow[];
  dates: readonly string[];
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const { terms, clientById } = ctx.model;
  return (
    <div className="card week-card">
      <div className="week-table-legend" data-testid="week-client-legend">
        <SelectSwitch ctx={ctx} />
        <span className="sub" data-testid="week-chip-legend">
          札は「時刻・担当の印」です。代＝いつもの担当でない・なし＝担当なし（要対応）・休＝休みのため無し・取消＝取り消し
        </span>
      </div>
      <EdgeScroll scrollRef={scrollRef}>
        <table className="week-table week-clients" data-testid="week-client-table">
          <thead>
            <tr>
              <th scope="col">{terms.client}</th>
              {dates.map((d) => (
                <th key={d} scope="col" className={d === ctx.today ? 'is-today' : undefined}>
                  {dateText(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = clientById.get(r.clientId);
              return (
                <tr key={r.clientId}>
                  <th scope="row">
                    <span className="row week-client-name">
                      {c && (
                        <span
                          className="week-client-color"
                          style={{ background: colorOf(c.color) }}
                          aria-hidden="true"
                        />
                      )}
                      {c ? <PersonButton kind="client" id={c.id} name={c.displayName} /> : '（不明）'}
                    </span>
                  </th>
                  {r.cells.map((cell) => (
                    <ClientCell key={cell.date} ctx={ctx} clientId={r.clientId} client={c} cell={cell} />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </EdgeScroll>
      {rows.length === 0 && (
        <p className="sub" data-testid="week-none">
          {`当てはまる${terms.client}がいません。上の絞り込みを外すか「絞り込みを戻す」を押してください。`}
        </p>
      )}
      <p className="sub">
        絞り込んだ{terms.client}
        の訪問です（人数の上限はありません。最初はこの週に訪問がある人を全員出します）。マスには訪問の札（時刻と担当の印）を時刻の順に3件まで出し、残りは「+N」を押すと一覧で見られます。
        札を同じ行の別の日のマスへドラッグすると、時刻はそのままで日を動かせます（今日より前の日へは動かせません。取り消し・休みの訪問は動かせません）。
        札を押すと訪問の詳細の欄が開きます。キーボードでは ←→ で曜日・↑↓ で隣の担当へ動かし、Enter で欄を開きます。
      </p>
    </div>
  );
}

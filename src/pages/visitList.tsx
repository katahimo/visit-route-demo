// 日の予定の訪問の一覧（表示の「一覧」。PRD D63）：時間・訪問先・所要・担当・注意・開く/取消。休みのため無しの訪問も薄く出す（ADR-0013）
import { Ban, BedSingle, CalendarDays, Clock, PanelRightOpen, Pin, ShieldAlert } from 'lucide-react';
import { PersonButton } from '../components/PersonPopover';
import { ClientName } from '../components/parts';
import { StaffMarkById } from '../components/StaffMark';
import { Term } from '../components/Term';
import { IconButton, SectionTitle, WithIcon } from '../components/ui';
import { TypeMark } from '../components/visitType';
import type { Client, Visit, VisitType } from '../contracts/documents';
import { windowText } from '../domain/scheduleModel';

/** 訪問の一覧の「注意」に出すもの */
type VisitNotes = {
  /** 計算に入れていない（訪問先が休止中・位置が未登録など） */
  outside: boolean;
  /** 担当なし */
  dropped: boolean;
  /** ピン */
  pinned: boolean;
  /** 要対応（担当が休み・条件に合わない・時間に間に合わない） */
  hard?: string[];
};

/**
 * その日の訪問の一覧（時間・訪問先・所要・担当・注意・開く/取消）。表示の切り替えの「一覧」で出す（PRD D63）。
 * 担当は訪問の担当を出すだけ（割り当ては時間軸・順番でドラッグする）
 */
export function VisitList({
  visits,
  visitById,
  clientById,
  ownerName,
  notes,
  clientLabel,
  typeOfVisit,
  leaveVisits,
  leaveNoteOf,
  onEdit,
  onCancel,
}: {
  /** 開始時刻の順の訪問ID */
  visits: string[];
  visitById: Map<string, Visit>;
  clientById: Map<string, Client>;
  /** 担当（担当なしは null）。known：〈スタッフ〉がデータにいる（いなければ名前をボタンにしない） */
  ownerName: (id: string) => { id: string; name: string; known: boolean } | null;
  notes: (id: string) => VisitNotes;
  clientLabel: string;
  /** 訪問の種類（ADR-0012。種類なしは null） */
  typeOfVisit: (v: Visit) => VisitType | null;
  /** 〈利用者さん〉の休み（ADR-0013）のため無しの訪問（開始の順）。薄い行で後ろに出す（計算に入らない） */
  leaveVisits: Visit[];
  /** 休みの理由 */
  leaveNoteOf: (v: Visit) => string;
  onEdit: (id: string) => void;
  onCancel: (v: Visit) => void;
}) {
  const rowProps = { visitById, clientById, ownerName, notes, typeOfVisit, leaveNoteOf, onEdit, onCancel };
  /** 「固定」の説明は表の中で最初の1行だけ（PRD D241。2行目からは文字だけ） */
  const firstPinned = visits.find((id) => visitById.has(id) && notes(id).pinned);
  return (
    <section className="card stack visit-list" data-testid="visit-list">
      <SectionTitle icon={CalendarDays}>
        訪問の一覧（{visits.length}件{leaveVisits.length > 0 ? `・休みのため無し ${leaveVisits.length}件` : ''}）
      </SectionTitle>
      <div className="table-scroll">
        <table className="visit-table">
          <thead>
            <tr>
              <th>
                <WithIcon icon={Clock} size={14}>
                  時間
                </WithIcon>
              </th>
              <th>{clientLabel}</th>
              <th className="num">所要</th>
              <th>担当</th>
              <th>注意</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visits.map((id) => (
              <VisitRow key={id} id={id} {...rowProps} firstPinned={firstPinned} />
            ))}
            {leaveVisits.map((v) => (
              <LeaveRow key={v.id} v={v} {...rowProps} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type RowProps = {
  visitById: Map<string, Visit>;
  clientById: Map<string, Client>;
  ownerName: (id: string) => { id: string; name: string; known: boolean } | null;
  notes: (id: string) => VisitNotes;
  typeOfVisit: (v: Visit) => VisitType | null;
  leaveNoteOf: (v: Visit) => string;
  onEdit: (id: string) => void;
  onCancel: (v: Visit) => void;
};

/** 訪問の一覧の1行（時間・訪問先・所要・担当・注意・開く/取消） */
function VisitRow({
  id,
  visitById,
  clientById,
  ownerName,
  notes,
  typeOfVisit,
  onEdit,
  onCancel,
  firstPinned,
}: RowProps & { id: string; firstPinned: string | undefined }) {
  const v = visitById.get(id);
  if (!v) return null;
  const o = ownerName(id);
  const n = notes(id);
  const label = `${clientById.get(v.clientId)?.displayName ?? ''} ${windowText(v)}`;
  return (
    <tr className={o ? '' : 'row-unassigned'}>
      <td className="nowrap">
        <div className="time-cell">
          <Clock size={14} aria-hidden="true" />
          <span className="time-main">{windowText(v)}</span>
          {v.windowKind === 'window' && <span className="time-tag">この間に開始</span>}
        </div>
      </td>
      <td>
        <ClientName client={clientById.get(v.clientId)} detail />
        {(typeOfVisit(v) || v.pattern?.edited) && (
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            <TypeMark type={typeOfVisit(v)} compact />
            {v.pattern?.edited && (
              <span className="chip chip-warn" title="定期パターンのこの回だけ変えた訪問">
                この回だけの変更
              </span>
            )}
          </div>
        )}
        {v.note && <div className="sub">{v.note}</div>}
      </td>
      <td className="num nowrap">{v.durationMinutes}分</td>
      <td className="nowrap">
        {o ? (
          <span className="row" style={{ gap: 6 }}>
            <StaffMarkById id={o.id} size="xs" />
            <PersonButton kind="staff" id={o.id} name={o.known ? o.name : ''}>
              {o.name}
            </PersonButton>
          </span>
        ) : (
          <span className="sub">担当なし</span>
        )}
      </td>
      <td>
        <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
          {n.outside && <span className="chip chip-warn">計算に入れない</span>}
          {n.dropped && <span className="chip chip-warn">担当なし</span>}
          {n.pinned && (
            <span className="chip chip-pin">
              <Pin size={12} strokeWidth={2.4} aria-hidden="true" />
              <Term k="pinned" plain={id !== firstPinned} />
            </span>
          )}
          {n.hard?.map((h) => (
            <span key={h} className="chip chip-red" title="要対応">
              <ShieldAlert size={12} aria-hidden="true" />
              {h}
            </span>
          ))}
        </div>
      </td>
      <td className="nowrap">
        <div className="actions">
          <IconButton
            icon={PanelRightOpen}
            label={`${label}を開く`}
            onClick={() => onEdit(id)}
            data-testid="visit-row-open"
            data-visit={id}
          />
          <IconButton icon={Ban} label={`${label}を取り消す`} tone="danger" onClick={() => onCancel(v)} />
        </div>
      </td>
    </tr>
  );
}

/** 〈利用者さん〉の休みのため無しの訪問の行（薄い行。計算に入らない） */
function LeaveRow({ v, clientById, typeOfVisit, leaveNoteOf, onEdit }: RowProps & { v: Visit }) {
  const note = leaveNoteOf(v);
  const label = `${clientById.get(v.clientId)?.displayName ?? ''} ${windowText(v)}`;
  return (
    <tr className="row-leave" data-testid="visit-leave-row">
      <td className="nowrap">
        <div className="time-cell">
          <Clock size={14} aria-hidden="true" />
          <span className="time-main">{windowText(v)}</span>
        </div>
      </td>
      <td>
        <ClientName client={clientById.get(v.clientId)} detail />
        <TypeMark type={typeOfVisit(v)} compact />
      </td>
      <td className="num nowrap">{v.durationMinutes}分</td>
      <td className="nowrap">
        <span className="sub">—</span>
      </td>
      <td>
        <span className="chip chip-leave" title={note || undefined}>
          <BedSingle size={12} aria-hidden="true" />
          休みのため無し{note ? `（${note}）` : ''}
        </span>
      </td>
      <td className="nowrap">
        <div className="actions">
          <IconButton
            icon={PanelRightOpen}
            label={`${label}を開く`}
            onClick={() => onEdit(v.id)}
            data-testid="visit-row-open"
            data-visit={v.id}
          />
        </div>
      </td>
    </tr>
  );
}

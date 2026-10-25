// 訪問のドラッグ（PRD D339〜D341。ADR-0056）：落とし先の判定（lib/visitDrop）と影 DropShadow（visitParts から分けた）
import { type CSSProperties, type DragEvent, useMemo, useRef, useState } from 'react';
import { deferredDragStart } from '../lib/dragStart';
import { type DropTarget, type DropVerdict, dropShadowText, dropTone, dropVerdict } from '../lib/visitDrop';
import { fitCountAt } from '../lib/week';
import { useDemoData } from '../store';
import { useCompileInput } from './useDayModel';
import './visitParts.css';

/** 落とし先の影（どの画面でも同じ文と色） */
export type DropHover = { key: string; target: DropTarget; verdict: DropVerdict; fit: number | null | undefined };

/**
 * ドラッグ（HTML のドラッグ）。どの画面も同じ判定（lib/visitDrop）で、置けるときだけ落とせる。影は入る（ok）・入らない（warn。
 * 落とせる）・置けない（ng）の3つ。fit なら落とし先に入れる人の数を数える（その日・時刻で。覚えておく）。
 * staffWhy は担当の列・行へ落とすときの「担当できない理由」。落としたら onDrop（同じ日時・担当なら呼ばない）
 */
export function useVisitDrag(opts: {
  today: string;
  fit?: boolean;
  staffWhy?: (visitId: string, date: string, staffId: string) => string | null;
  onDrop: (visitId: string, v: Extract<DropVerdict, { ok: true }>) => void;
  /** 動かさない（予定のモード「確認」。PRD D348）：どの札もつかめない */
  readOnly?: boolean;
}) {
  const { data } = useDemoData();
  const compileInput = useCompileInput(data);
  const ref = useRef(opts);
  ref.current = opts;
  const dataRef = useRef(data);
  dataRef.current = data;
  /** つかんだ訪問と、帯の上端からつかんだ位置までの高さ（px） */
  const grab = useRef<{ visitId: string; offset: number } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hover, setHover] = useState<DropHover | null>(null);
  const hoverRef = useRef<DropHover | null>(null);
  const put = (h: DropHover | null) => {
    hoverRef.current = h;
    setHover(h);
  };
  /**
   * dragId の更新は dragstart の後へ遅らせる（src/lib/dragStart.ts）。dragstart の中で描き直すと帯が指の下からずれ、
   * Chrome がドラッグをすぐ終わらせる
   */
  const later = useRef(deferredDragStart()).current;
  const fits = useMemo(() => ({ input: compileInput, memo: new Map<string, number | null>() }), [compileInput]);
  /** 担当できない理由の覚え（訪問・日・人ごと。データが変われば作り直す。dragover は止めていても何度も来る） */
  const whys = useMemo(() => ({ data, memo: new Map<string, string | null>() }), [data]);
  const fitOf = (visitId: string, date: string, start: number): number | null => {
    const k = `${visitId}|${date}|${start}`;
    if (!fits.memo.has(k)) fits.memo.set(k, fitCountAt(fits.input, visitId, date, start));
    return fits.memo.get(k) ?? null;
  };
  const end = () => {
    grab.current = null;
    later.end();
    put(null);
    setDragId(null);
  };
  const judge = (visitId: string, t: DropTarget): { verdict: DropVerdict; fit: number | null | undefined } => {
    const o = ref.current;
    const d = dataRef.current;
    const first = dropVerdict(d, visitId, t, o.today);
    if (!first.ok || first.same) return { verdict: first, fit: undefined };
    const fit = o.fit && t.staffId === undefined ? fitOf(visitId, t.date, first.start) : undefined;
    // 担当の行・列へ落とすときは、担当が変わらなくても（同じ人の別の日へ）その日にその人が担当できるかを見る
    let staffWhy: string | null = null;
    if (t.staffId && o.staffWhy) {
      const k = `${visitId}|${t.date}|${t.staffId}`;
      if (!whys.memo.has(k)) whys.memo.set(k, o.staffWhy(visitId, t.date, t.staffId));
      staffWhy = whys.memo.get(k) ?? null;
    }
    return { verdict: dropVerdict(d, visitId, t, o.today, { fit, staffWhy }), fit };
  };
  return {
    dragId,
    hover,
    /** つかんだ帯の上端からの高さ（px。時間軸で落とした開始を出す） */
    offset: () => grab.current?.offset ?? 0,
    /** つかめる帯・行の props */
    source: (visitId: string, canMove: boolean) => {
      const movable = canMove && !opts.readOnly;
      return {
        draggable: movable,
        onDragStart: (e: DragEvent<HTMLElement>) => {
          if (!movable) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData('text/plain', visitId);
          e.dataTransfer.effectAllowed = 'move';
          grab.current = { visitId, offset: e.clientY - e.currentTarget.getBoundingClientRect().top };
          later.start(() => setDragId(visitId));
        },
        onDragEnd: end,
      };
    },
    /** 落とし先の props。at は落とした位置から落とし先（日付・開始・担当・行の〈利用者さん〉）を出す */
    target: (key: string, at: (e: DragEvent<HTMLElement>) => DropTarget | null) => ({
      onDragOver: (e: DragEvent<HTMLElement>) => {
        const g = grab.current;
        if (!g) return;
        const t = at(e);
        if (!t) {
          // 落とし先でない所（月の外のマス・見出しなど）の上では、前のマスの影を残さない
          if (hoverRef.current?.key === key) put(null);
          return;
        }
        const { verdict, fit } = judge(g.visitId, t);
        if (verdict.ok) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }
        const h = hoverRef.current;
        if (
          !h ||
          h.key !== key ||
          h.target.date !== t.date ||
          h.target.start !== t.start ||
          h.target.staffId !== t.staffId
        )
          put({ key, target: t, verdict, fit });
      },
      onDragLeave: (e: DragEvent<HTMLElement>) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        if (hoverRef.current?.key === key) put(null);
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        const g = grab.current;
        const t = at(e);
        end();
        if (!g || !t) return;
        const { verdict } = judge(g.visitId, t);
        if (verdict.ok && !verdict.same) ref.current.onDrop(g.visitId, verdict);
      },
    }),
  };
}
export type VisitDrag = ReturnType<typeof useVisitDrag>;

/**
 * 落とし先の影（入る＝緑・入らない＝赤い点線（落とせる）・置けない＝灰の斜線）と文。time は開始を出すか（時間軸）。
 * 文は lib/visitDrop の dropShadowText（どの画面も同じ）
 */
export function DropShadow({
  hover,
  style,
  className = '',
  testId,
  time = true,
}: {
  hover: DropHover;
  style?: CSSProperties;
  className?: string;
  testId?: string;
  time?: boolean;
}) {
  const tone = dropTone(hover.verdict);
  return (
    <div
      className={`vdrop is-${tone} ${className}`}
      style={style}
      aria-hidden="true"
      data-testid={testId}
      data-tone={tone}
    >
      <span className="vdrop-text" data-testid="drop-text">
        {dropShadowText(hover.verdict, { fit: hover.fit, time })}
      </span>
    </div>
  );
}

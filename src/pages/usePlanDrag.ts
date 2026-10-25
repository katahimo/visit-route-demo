// 日の予定のドラッグ（PRD D58・D217）：訪問のカード・帯を別の担当の列へ落とすと移す、「担当なしの訪問」の列へ落とすと担当なし
import { type DragEvent, useRef, useState } from 'react';
import { NONE } from '../domain/scheduleModel';
import { deferredDragStart } from '../lib/dragStart';

/** ドラッグの状態と、列（落とす先）・訪問（つかむもの）に付ける props */
export function usePlanDrag(x: {
  owner: Map<string, string>;
  running: boolean;
  moveTo: (visitId: string, staffId: string) => void;
  unassign: (visitId: string) => void;
}) {
  const [dragging, setDragging] = useState<string | null>(null);
  /** ドラッグの始まりの更新を dragstart の外へ出す（未割当の列が足されて Chrome がドラッグをやめるため） */
  const dragStart = useRef(deferredDragStart()).current;
  const [dropTo, setDropTo] = useState<string | null>(null);
  const dropProps = (to: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!dragging) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropTo !== to) setDropTo(to);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTo(null);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain') || dragging;
      dragStart.end();
      setDragging(null);
      setDropTo(null);
      if (!id) return;
      if (to === NONE) x.unassign(id);
      else if (x.owner.get(id) !== to) x.moveTo(id, to);
    },
  });
  const dragProps = (id: string) => ({
    draggable: !x.running,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      // ここで setDragging すると、未割当の列が先頭に足されて列がずれ、Chrome がドラッグをすぐ終わらせる
      dragStart.start(() => setDragging(id));
    },
    onDragEnd: () => {
      dragStart.end();
      setDragging(null);
      setDropTo(null);
    },
  });
  return { dragging, dropTo, dropProps, dragProps };
}

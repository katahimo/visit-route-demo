import { useLocation, useNavigate } from 'react-router-dom';
import type { PaletteItem } from '../lib/commandPalette';
import { confirmLeave } from '../lib/leaveGuard';
import { useDay } from './day';
import { useOpenVisit } from './VisitPanel';

/** 候補を選んだときの処理（閉じて、訪問の欄を開く／画面を移る）。today は「予定を入れる」の日付 */
export function usePalettePick(onClose: () => void, today: string) {
  const { setDate } = useDay();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const openVisit = useOpenVisit();
  return async (it: PaletteItem | undefined) => {
    if (!it) return;
    onClose();
    // 訪問・「予定を入れる」は画面を移らずに、今の画面の上で訪問の詳細の欄を開く（PRD D304）
    if (it.visitId) {
      openVisit({ visitId: it.visitId });
      return;
    }
    if (it.op === 'visit-add') {
      openVisit({ newVisit: { date: today } });
      return;
    }
    // 確定していない下書きのある画面（条件の重み）から移るときは確かめる（PRD D286。断れば移らない）
    if (it.to.split(/[?#]/)[0] !== pathname && !(await confirmLeave())) return;
    if (it.date) setDate(it.date);
    // 今の画面を選んだら閉じるだけ（URL のクエリ＝画面の状態を消さない。メニューと同じ）
    if (it.to === pathname) return;
    navigate(it.to);
  };
}

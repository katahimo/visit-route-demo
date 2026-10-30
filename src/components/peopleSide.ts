// 相性の画面で、〈利用者さん〉・〈スタッフ〉のどちらのタブから来たかの覚え（PRD D389。lib/peopleTabs）。
// 画面の状態なので保存しない。メニューの印（app/useAdminShell）とタブ（SettingsTabs の PeopleTabs）が同じ値を読むよう、モジュールに置く
import { activeNavPath } from '../lib/nav';
import { type PeopleSide, rememberedSide } from '../lib/peopleTabs';

let remembered: PeopleSide | undefined;

/** 今の画面から覚えを更新して返す（〈利用者さん〉・〈スタッフ〉の画面ならその側、相性などはそのまま。同じ画面で何度呼んでも同じ） */
export function rememberPeopleSide(pathname: string): PeopleSide | undefined {
  remembered = rememberedSide(activeNavPath(pathname), remembered);
  return remembered;
}

/** 今覚えている側（まだ無ければ undefined） */
export const rememberedPeopleSide = (): PeopleSide | undefined => remembered;

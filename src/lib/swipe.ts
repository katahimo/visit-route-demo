// スワイプの判定（スマホの日ごとのリスト。PRD D334）：横に大きく、縦は小さく動いたとき

/** スワイプとみなす横の動き（px）と、縦の動きの上限（px） */
export const SWIPE_X = 60;
export const SWIPE_Y = 40;
/** 押したあと、これより動けば押したことにしない（px） */
export const MOVE_SLOP = 10;

/** 押し始めからの動き（dx・dy。px）がスワイプか */
export const isSwipe = (dx: number, dy: number): boolean => Math.abs(dx) >= SWIPE_X && Math.abs(dy) <= SWIPE_Y;

/** 押し始めからの動きが、押したことにしない大きさか */
export const movedFar = (dx: number, dy: number): boolean => Math.abs(dx) > MOVE_SLOP || Math.abs(dy) > MOVE_SLOP;

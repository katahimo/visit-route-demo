// 〈利用者さん〉を選ぶ検索欄（PRD D61・D62・D108。design.md §4 pages「混み具合バーの3段・〈利用者さん〉の検索・週間の上限」）。
// 表示名・よみで絞り込む combobox。候補は listbox で最大10件、上下キーと Enter で選ぶ。選んだ人は上にチップで並べる。
// 近道（検索欄の上。候補の欄で隠れないように）：この期間に訪問がある人／〈スタッフ〉が担当する人／最近選んだ人（画面の状態に最大10人）／
// 仮押さえの人（tentativeShortcut のときだけ。月間）。
// 1人（月間の表示）と複数（週間の時間軸）の両方で使う。週間の表と〈利用者さん〉の画面の一覧は ClientFilter で絞り込む（PRD D108）
import { PickerBox, PickerChips, PickerShortcuts } from './ClientPickerParts';
import { type ClientPickerProps, PICKER_LIMIT, RECENT_LIMIT } from './clientPickerTypes';

// 呼ぶ側（ClientFilter など）が ClientPicker から import するので、ここからも出す
export { PICKER_LIMIT, RECENT_LIMIT };
export type { ClientPickerProps };

import { useClientPicker } from './useClientPicker';
import './clientPicker.css';

/**
 * 〈利用者さん〉の検索欄（combobox）。近道は候補を絞る切り替え（押すと候補が開く。もう一度押すと外れる）で、
 * 複数のときは近道で絞った人を「あと N人を選ぶ」（N＝足す人数）でまとめて選べる。
 * 上限を超えるときはボタンを残したまま押せなくし、理由の文を添える。
 * キーボード：↓↑で候補を移る、Enter で選ぶ（複数のときは選んでいる人を外す）、Esc で閉じる（閉じていれば文字を消す）、
 * 文字が空で Backspace は最後のチップを外す（複数のとき）
 */
export function ClientPicker(props: ClientPickerProps) {
  const { label, showChips = true, testId = 'client-picker' } = props;
  const m = useClientPicker(props);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: 部品の外へフォーカスが出たら候補を閉じるだけ（操作は中の要素で）
    <div ref={m.rootRef} className="client-picker" data-testid={testId} onBlur={m.onBlur}>
      <label className="client-picker-label" htmlFor={m.inputId}>
        {label}
      </label>
      {showChips && m.chips && <PickerChips {...m.chips} />}
      <PickerShortcuts {...m.shortcuts} />
      <PickerBox {...m.box} />
      <output className="client-picker-message" data-testid={`${testId}-message`}>
        {m.message}
      </output>
    </div>
  );
}

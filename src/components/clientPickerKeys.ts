import type { PickerKeyAction } from '../lib/search';

/** 検索欄のキーの働き（lib/search の pickerKeyAction が決めたもの）を、ClientPicker の操作に振り分ける。種類は never で網羅を確かめる */
export function runPickerKeyAction(
  act: PickerKeyAction,
  h: {
    open: (open: boolean) => void;
    move: (step: 1 | -1) => void;
    choose: () => void;
    clearQuery: () => void;
    unselectLast: () => void;
  },
): void {
  switch (act.type) {
    case 'none':
      break;
    case 'open':
      h.open(true);
      break;
    case 'close':
      h.open(false);
      break;
    case 'move':
      h.move(act.step);
      break;
    case 'choose':
      h.choose();
      break;
    case 'clearQuery':
      h.clearQuery();
      break;
    case 'unselectLast':
      h.unselectLast();
      break;
    default: {
      const _: never = act;
      throw new Error(`未対応のキーの働き: ${JSON.stringify(_)}`);
    }
  }
}

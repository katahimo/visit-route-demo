// 移動時間の見積もりの係数の欄（ADR-0101）：数を入れ、離れたとき・Enter で保存する。誤りは欄の下に出す
import { useEffect, useId, useState } from 'react';
import { type NumberRule, numberInput, numberInputError } from '../lib/roadTravelView';
import { FieldError, invalidAttrs } from './FieldError';

export function TravelNumberField({
  label,
  value,
  rule,
  onSave,
  testId,
}: {
  label: string;
  value: number;
  rule: NumberRule;
  /** 値が変わったときだけ呼ぶ */
  onSave: (n: number) => void;
  testId: string;
}) {
  const errId = useId();
  const [text, setText] = useState(String(value));
  // 別のタブ・元に戻すで変わったら欄も合わせる
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const error = numberInputError(text, rule);
  const save = () => {
    const n = numberInput(text, rule);
    if (n !== null && n !== value) onSave(n);
  };
  return (
    <label className="road-setting">
      <span>{label}</span>
      <input
        type="number"
        min={rule.min}
        max={rule.max}
        step={rule.decimals === 0 ? 1 : 0.1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
        }}
        {...invalidAttrs(!!error, errId)}
        data-testid={testId}
      />
      <span>{rule.unit}</span>
      <FieldError as="span" id={errId}>
        {error}
      </FieldError>
    </label>
  );
}

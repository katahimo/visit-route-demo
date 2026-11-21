// 所要（分）と終わりの時刻の2つの欄（PRD D462。ADR-0117）：どちらで入れても、もう一方に映す。データは所要（分）で持つ。
// 繰り返しの欄・訪問の詳細の欄・「定期の予定を追加」で使う。読み替えは lib/durationEnd
import { type ReactNode, useEffect, useId, useState } from 'react';
import { endDraftOnStart, endTimeError, endTimeOf, minutesBetween, minutesOfText } from '../lib/durationEnd';
import { FieldError, invalidAttrs } from './FieldError';

export function DurationEndFields({
  start,
  minutes,
  onMinutes,
  durationLabel,
  endLabel = '終わり',
  durationAttrs,
  required,
  testIdPrefix,
}: {
  /** 開始（幅のときは開始（早））の時刻（HH:mm） */
  start: string;
  /** 所要の欄の値（文字。空・数でないこともある） */
  minutes: string;
  /** 所要の欄の値を変える（終わりの時刻で入れたときも分にして渡す。終わりが開始より前なら '' を渡し、保存で止める） */
  onMinutes: (text: string) => void;
  /** 所要の欄の見出し（「所要（分）」と必須の札など） */
  durationLabel: ReactNode;
  /** 終わりの欄の見出し */
  endLabel?: ReactNode;
  /** 所要の欄の誤りの印（invalidAttrs） */
  durationAttrs?: ReturnType<typeof invalidAttrs>;
  required?: boolean;
  /** data-testid の頭（`${頭}-duration`・`${頭}-end`） */
  testIdPrefix: string;
}) {
  /** 開始より前の終わりを打った途中の値（所要に映せないので欄に残し、誤りを出す）。null は所要から作った値を出す */
  const [endDraft, setEndDraft] = useState<string | null>(null);
  const errorId = useId();
  // 開始が変わったら、打った途中の終わりが新しい開始で所要にできればその所要にし（打った終わりを保つ）、
  // 途中の値が無ければ所要を保って終わりを作り直す。まだ開始より前なら途中の値を残す（lib/durationEnd の endDraftOnStart）
  // biome-ignore lint/correctness/useExhaustiveDependencies: 開始が変わったときだけ途中の値を見直す
  useEffect(() => {
    if (endDraft === null) return;
    const next = endDraftOnStart(start, endDraft);
    setEndDraft(next.endDraft);
    if (next.minutes !== null) onMinutes(next.minutes);
  }, [start]);
  const end = endDraft ?? endTimeOf(start, minutesOfText(minutes));
  const error = endDraft === null ? null : endTimeError(start, endDraft);
  return (
    <>
      <label>
        {durationLabel}
        <input
          type="number"
          min={5}
          max={720}
          required={required}
          {...durationAttrs}
          value={minutes}
          onChange={(e) => {
            setEndDraft(null);
            onMinutes(e.target.value);
          }}
          data-testid={`${testIdPrefix}-duration`}
        />
      </label>
      <label>
        {endLabel}
        <input
          type="time"
          value={end}
          {...invalidAttrs(error !== null, errorId)}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') {
              setEndDraft(null);
              return;
            }
            const m = minutesBetween(start, v);
            setEndDraft(m === null ? v : null);
            onMinutes(m === null ? '' : String(m));
          }}
          data-testid={`${testIdPrefix}-end`}
        />
        <FieldError id={errorId} live={false} as="span">
          {error}
        </FieldError>
      </label>
    </>
  );
}

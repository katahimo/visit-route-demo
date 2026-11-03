// 〈利用者さん〉の移動時間（片道・分）と遠方（出張）の入力と、訪問の詳細・日の予定の控えめな表示（PRD D429。ADR-0096）
import { Train } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ClientPlace } from '../contracts/documents';
import { leaveHomeText, travelMinutesInput, travelNote, withTravel } from '../lib/clientTravel';
import { FOCUS_PARAM, TRAVEL_FOCUS } from '../lib/hardLinks';
import type { invalidAttrs } from './FieldError';

/**
 * 担当なしの理由の［移動時間・遠方を設定］（lib/hardLinks の clientTravelHref。PRD D430）から来たとき（`?focus=travel`）、
 * 移動時間の欄が出たらそこへフォーカスして見える所へ巻き、URL から focus を消す
 */
function useTravelFocus() {
  const ref = useRef<HTMLInputElement>(null);
  const [params, setParams] = useSearchParams();
  const wanted = params.get(FOCUS_PARAM) === TRAVEL_FOCUS;
  // 節を開く `?edit=` が URL から消えてから（同じ描き直しで URL を2回書くと、前の書き換えを古い URL で上書きするため）
  const opening = params.has('edit');
  useEffect(() => {
    if (!wanted || opening || !ref.current) return;
    ref.current.focus({ preventScroll: true });
    ref.current.scrollIntoView({ block: 'center' });
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.delete(FOCUS_PARAM);
        return p;
      },
      { replace: true },
    );
  }, [wanted, opening, setParams]);
  return ref;
}

/**
 * 場所の節の入力（住所・郵便番号・緯度経度の下）：移動時間（片道・分）と遠方（出張）の印。
 * onChange は今の場所を受けて直した場所を返す関数（住所の検索の結果と重ねても消し合わない）
 */
export function ClientTravelFields({
  value,
  onChange,
  bad,
}: {
  value: ClientPlace;
  onChange: (f: (p: ClientPlace) => ClientPlace) => void;
  bad: (field: string) => ReturnType<typeof invalidAttrs>;
}) {
  const [text, setText] = useState(value.travelMinutes === undefined ? '' : String(value.travelMinutes));
  const ref = useTravelFocus();
  return (
    <div className="stack" style={{ gap: 6 }} data-testid="client-travel">
      <label>
        移動時間（片道・分。新幹線・飛行機など距離で見積もれないとき）
        <input
          ref={ref}
          inputMode="numeric"
          value={text}
          placeholder="空なら距離から見積もる"
          {...bad('travelMinutes')}
          onChange={(e) => {
            setText(e.target.value);
            const n = travelMinutesInput(e.target.value);
            onChange((p) => withTravel(p, n, p.farTrip === true));
          }}
          data-testid="client-travel-minutes"
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={value.farTrip === true}
          onChange={(e) => {
            const on = e.target.checked;
            onChange((p) => withTravel(p, p.travelMinutes ?? null, on));
          }}
          data-testid="client-far-trip"
        />
        遠方（出張）：この日はほかの訪問を入れない
      </label>
    </div>
  );
}

/**
 * 訪問の詳細・日の予定の控えめな1行：「遠方（出張）・移動 片道180分・家を出る目安 7:00」。
 * start は組んだ開始（0時からの分。無ければ null）。移動時間も遠方の印も無い〈利用者さん〉には何も出さない
 */
export function TravelFact({ place, start }: { place: ClientPlace | undefined | null; start: number | null }) {
  if (!place) return null;
  const note = travelNote(place);
  if (note === '') return null;
  const text = [note, leaveHomeText(place, start)].filter(Boolean).join('・');
  return (
    <p className="sub visit-travel" data-testid="visit-travel">
      <Train size={13} aria-hidden="true" /> {text}
    </p>
  );
}

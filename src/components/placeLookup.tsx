import { MapPin, Search, Undo2 } from 'lucide-react';
import { useId, useRef } from 'react';
import type { ClientPlace, Place } from '../contracts/documents';
import {
  addressBlockReason,
  type CandidateItem,
  canUndoAddress,
  geoCandidates,
  postalBlockReason,
  postalCandidates,
  postalInputError,
  statusClass,
} from '../lib/addressLookup';
import { hasLocation } from '../lib/common';
import { EXTERNAL_NOTICE } from '../lib/geocode';
import { normalizePostalCode } from '../lib/postalCode';
import { FieldError } from './FieldError';
import { PlacePin } from './parts';
import { WithIcon } from './ui';
import { useAddressLookup } from './useAddressLookup';
import { useFeature } from './useFeature';
import './placeLookup.css';

/** data-testid の頭（〈利用者さん〉は今までどおり client-postal など） */
export type AddressFieldId = 'client' | 'vacancy' | 'staff-home';

type AddressFieldProps<T extends Place> = {
  /** 住所と位置（型はそのまま返す） */
  value: T;
  onChange: (p: T) => void;
  /** 郵便番号の欄の値。渡さなければ部品の中だけで持つ（保存しない） */
  postalCode?: string;
  onPostalCodeChange?: (code: string) => void;
  /** data-testid の頭。既定 client */
  testId?: AddressFieldId;
  /** 郵便番号の欄の見出し。既定「郵便番号（任意）」 */
  postalLabel?: string;
  /** 注記の後ろの説明（何を送らないか）。既定「（押したときだけ。名前などほかの項目は送りません）」 */
  noticeNote?: string;
};

/**
 * 住所の入力（PRD D86〜D88・D90・D118〜D121。ADR-0016）：郵便番号・住所・「住所を探す」「地図に置く」・注記・状態・候補・地図のピン。
 * 〈利用者さん〉の編集の欄・空き状況の場所・〈スタッフ〉の自宅で共通に使う。決まり（押せない理由・住所の当て方・知らせ）は lib/addressLookup。
 * 外部の検索を呼ぶのはボタンを押したときだけ（lib/geocode）。結果は onChange で欄（保存前の入力）に入れ、保存するかは呼ぶ画面が決める
 */
export function AddressField<T extends Place>({
  value,
  onChange,
  postalCode,
  onPostalCodeChange,
  testId = 'client',
  postalLabel = '郵便番号（任意）',
  noticeNote = '（押したときだけ。名前などほかの項目は送りません）',
}: AddressFieldProps<T>) {
  const {
    postalText,
    busy,
    status,
    postalHits,
    geoHits,
    undoAddress,
    cancel,
    setPostal,
    putAddress,
    putPin,
    findAddress,
    findPin,
    undo,
  } = useAddressLookup({ value, onChange, postalCode, onPostalCodeChange });
  const ids = useId();
  const postalErrorId = `${ids}-postal-error`;
  const postalWhyId = `${ids}-postal-why`;
  const addressWhyId = `${ids}-address-why`;
  // 〈利用者さん〉は今までの data-testid（place-notice など）を残す
  const tid = (name: string, legacy: string) => (testId === 'client' ? legacy : `${testId}-${name}`);

  // 郵便番号・住所の検索（ADR-0028 の geocode）を切っていれば、検索のボタン・注記を出さない（地図のクリックで置くのは残す）
  const geocodeOn = useFeature('geocode');
  const postal = normalizePostalCode(postalText);
  const postalWhy = postalBlockReason(postalText, busy);
  const addressWhy = addressBlockReason(value.address, busy);
  const postalError = postalInputError(postalText);

  return (
    <div className="stack place-lookup" data-testid={`${testId}-place`}>
      <PostalRow
        testId={testId}
        label={postalLabel}
        text={postalText}
        why={postalWhy}
        error={postalError}
        geocodeOn={geocodeOn}
        ids={{ error: postalErrorId, why: postalWhyId }}
        onInput={(code) => {
          cancel();
          setPostal(code);
        }}
        onBlur={() => {
          // 7桁にできるなら直して見せる（できなければそのまま。保存のときに止める）
          if (postal && postal !== postalText) setPostal(postal);
        }}
        onSearch={() => void findAddress()}
      />
      <FieldError as="span" id={postalErrorId} live={false} testId={`${testId}-postal-error`}>
        {postalError && '郵便番号は7桁の数字で入れてください（ハイフンは有っても無くても構いません）'}
      </FieldError>
      {postalHits.length > 0 && (
        <Candidates
          label="ほかの候補（押すと住所を置き換えます）"
          items={postalCandidates(postalHits, value.address)}
          onPick={(i) => putAddress(postalHits[i].address)}
          testId={tid('postal-candidate', 'postal-candidate')}
        />
      )}
      <label>
        住所（表示用）
        <input
          value={value.address}
          maxLength={200}
          onChange={(e) => {
            cancel();
            onChange({ ...value, address: e.target.value });
          }}
          data-testid={`${testId}-address`}
        />
      </label>
      {geocodeOn && (
        <PinActions
          testId={testId}
          why={addressWhy}
          whyId={addressWhyId}
          placed={hasLocation(value)}
          undoAddress={undoAddress}
          onSearch={() => void findPin()}
          onUndo={undo}
        />
      )}
      {geocodeOn && (
        <span className="sub place-notice" data-testid={tid('notice', 'place-notice')}>
          {EXTERNAL_NOTICE}
          {noticeNote}
        </span>
      )}
      <output className={statusClass(status)} data-testid={tid('status', 'place-lookup-status')}>
        {status?.text ?? ''}
      </output>
      {geoHits.length > 0 && (
        <Candidates
          label="ほかの候補（押すとピンを置き直します）"
          items={geoCandidates(geoHits, value)}
          onPick={(i) => putPin(geoHits[i])}
          testId={tid('geo-candidate', 'geo-candidate')}
        />
      )}
      <PlacePin
        value={value}
        onChange={(p) => {
          // 地図で置いた・消したら、探している途中の呼び出しを止める
          cancel();
          onChange(p);
        }}
      />
    </div>
  );
}

/** 郵便番号の欄と「住所を探す」ボタン（検索を切っていればボタン・理由は出さない） */
function PostalRow({
  testId,
  label,
  text,
  why,
  error,
  geocodeOn,
  ids,
  onInput,
  onBlur,
  onSearch,
}: {
  testId: AddressFieldId;
  label: string;
  text: string;
  why: string | null;
  error: boolean;
  geocodeOn: boolean;
  ids: { error: string; why: string };
  onInput: (code: string) => void;
  onBlur: () => void;
  onSearch: () => void;
}) {
  return (
    <div className="place-lookup-row">
      <label className="place-postal">
        {label}
        <input
          value={text}
          maxLength={16}
          inputMode="numeric"
          placeholder="例：980-0811"
          aria-invalid={error || undefined}
          aria-describedby={error ? ids.error : undefined}
          onChange={(e) => onInput(e.target.value)}
          onBlur={onBlur}
          data-testid={`${testId}-postal`}
        />
      </label>
      {geocodeOn && (
        <button
          type="button"
          className="btn btn-small"
          aria-disabled={why ? true : undefined}
          aria-describedby={why ? ids.why : undefined}
          title={why ?? '郵便番号から住所（都道府県・市区町村・町名）を探して入れます'}
          onClick={onSearch}
          data-testid={`${testId}-postal-search`}
        >
          <WithIcon icon={Search} size={14}>
            住所を探す
          </WithIcon>
        </button>
      )}
      {geocodeOn && why && (
        <span id={ids.why} className="sr-only">
          {why}
        </span>
      )}
    </div>
  );
}

/** 「地図に置く」と「住所を元に戻す」のボタン */
function PinActions({
  testId,
  why,
  whyId,
  placed,
  undoAddress,
  onSearch,
  onUndo,
}: {
  testId: AddressFieldId;
  why: string | null;
  whyId: string;
  placed: boolean;
  undoAddress: string | null;
  onSearch: () => void;
  onUndo: (before: string) => void;
}) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
      <button
        type="button"
        className="btn btn-small"
        aria-disabled={why ? true : undefined}
        aria-describedby={why ? whyId : undefined}
        title={why ?? '住所から位置を探して、地図にピンを置きます'}
        onClick={onSearch}
        data-testid={`${testId}-geo-search`}
      >
        <WithIcon icon={MapPin} size={14}>
          {placed ? '住所から置き直す' : '地図に置く'}
        </WithIcon>
      </button>
      {why && (
        <span id={whyId} className="sr-only">
          {why}
        </span>
      )}
      {canUndoAddress(undoAddress) && (
        <button
          type="button"
          className="btn btn-small"
          onClick={() => onUndo(undoAddress)}
          data-testid={`${testId}-address-undo`}
        >
          <WithIcon icon={Undo2} size={14}>
            住所を元に戻す
          </WithIcon>
        </button>
      )}
    </div>
  );
}

/**
 * 〈利用者さん〉の場所の入力（PRD D86〜D88・D90。ADR-0016）：AddressField に郵便番号（place.postalCode）を持たせたもの。
 * 保存は欄の「保存」（store の update）
 */
export function ClientPlaceEditor({ value, onChange }: { value: ClientPlace; onChange: (p: ClientPlace) => void }) {
  // 郵便番号と住所・位置を続けて書き換えても、最後の値に重ねる
  const latest = useRef(value);
  latest.current = value;
  const put = (p: ClientPlace) => {
    latest.current = p;
    onChange(p);
  };
  return (
    <AddressField
      value={value}
      onChange={(p) => put({ ...p, postalCode: latest.current.postalCode })}
      postalCode={value.postalCode}
      onPostalCodeChange={(postalCode) => put({ ...latest.current, postalCode })}
    />
  );
}

/** 候補のボタンの並び（選んでいるものは aria-pressed） */
function Candidates({
  label,
  items,
  onPick,
  testId,
}: {
  label: string;
  items: CandidateItem[];
  onPick: (i: number) => void;
  testId: string;
}) {
  return (
    <div className="place-candidates">
      <span className="sub">{label}</span>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {items.map((it, i) => (
          <button
            key={it.key}
            type="button"
            className={`btn btn-small place-candidate${it.on ? ' is-on' : ''}`}
            aria-pressed={it.on}
            onClick={() => onPick(i)}
            data-testid={testId}
          >
            {it.text}
          </button>
        ))}
      </div>
    </div>
  );
}

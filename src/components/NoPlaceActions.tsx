// 一覧の行の「位置なし」の印と、その場で［住所から探す］（1人だけ探して置く）・［地図で置く］（その人の画面の
// 場所・自宅の欄を開いて地図で置く）（PRD D427。ADR-0094）。〈利用者さん〉一覧・〈スタッフ〉一覧の行で使う
import { Map as MapIcon, Search } from 'lucide-react';
import { WithIcon } from './ui';
import './placeLookup.css';

export function NoPlaceActions({
  name,
  canSearch,
  onSearch,
  onMap,
}: {
  /** 読み上げに添える名前 */
  name: string;
  /** ［住所から探す］を出すか（lib/placeAll の canSearchOne） */
  canSearch: boolean;
  onSearch: () => void;
  onMap: () => void;
}) {
  return (
    <span className="no-place" data-testid="no-place">
      <span className="chip chip-warn">緯度・経度なし</span>
      {canSearch && (
        <button
          type="button"
          className="btn btn-small"
          onClick={onSearch}
          aria-label={`住所から探す（${name}）`}
          data-testid="no-place-search"
        >
          <WithIcon icon={Search} size={13}>
            住所から探す
          </WithIcon>
        </button>
      )}
      <button
        type="button"
        className="btn btn-small"
        onClick={onMap}
        aria-label={`緯度・経度を編集（${name}）`}
        data-testid="no-place-map"
      >
        <WithIcon icon={MapIcon} size={13}>
          緯度・経度を編集
        </WithIcon>
      </button>
    </span>
  );
}

/** 行に「位置なし」を出すための、一覧で1つの値（useNoPlaceRow で作る） */
export type NoPlaceRow = {
  /** 位置の無い人（数える人のうち） */
  missing: ReadonlySet<string>;
  canSearch: (id: string) => boolean;
  onSearch: (id: string) => void;
  onMap: (id: string) => void;
};

/** 行の「位置なし」（その人が位置なしでなければ何も出さない） */
export function NoPlaceCell({ id, name, row }: { id: string; name: string; row: NoPlaceRow }) {
  if (!row.missing.has(id)) return null;
  return (
    <NoPlaceActions
      name={name}
      canSearch={row.canSearch(id)}
      onSearch={() => row.onSearch(id)}
      onMap={() => row.onMap(id)}
    />
  );
}

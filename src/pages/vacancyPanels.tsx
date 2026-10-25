import { BookmarkPlus, Users, X } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { FieldError, invalidAttrs, RequiredMark } from '../components/FieldError';
import { Hint, SidePanel, WithIcon } from '../components/ui';
import type { VisitType } from '../contracts/documents';
import type { VacancyCell } from '../contracts/vacancy';
import { weekday } from '../domain/time';
import { WEEKDAY_LABELS } from '../lib/common';
import { clockTime, dateText } from '../lib/dateText';
import type { HoldSlot } from '../lib/hold';
import { dayHref } from '../lib/links';
import { verdictOf } from '../vacancy';
import type { HoldForm } from './useVacancyHold';
import { MARK, VERDICT_TEXT } from './vacancyParts';

/** マスを押したときの右の欄：日付ごとの人（名前）と入らない日付（PRD D204・D228） */
export function PickedPanel({
  picked,
  exact,
  durationNum,
  staffName,
  noPlan,
  onClose,
}: {
  picked: VacancyCell;
  exact: boolean;
  durationNum: number;
  staffName: ReadonlyMap<string, string>;
  noPlan: string[];
  onClose: () => void;
}) {
  return (
    <SidePanel
      icon={Users}
      narrow
      title={`${WEEKDAY_LABELS[picked.weekday]} ${clockTime(picked.start)}〜${clockTime(picked.start + durationNum)}`}
      onClose={onClose}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          <WithIcon icon={X}>閉じる</WithIcon>
        </button>
      }
    >
      <p>
        <strong>
          {MARK[verdictOf(picked)]} {VERDICT_TEXT[verdictOf(picked)]}
        </strong>
        <span className="sub">
          {' '}
          （{exact ? '移動を含む' : '目安'}・{picked.weeksOk}/{picked.weeksTotal}週）
        </span>
      </p>
      {picked.byDate.length === 0 ? (
        <p className="sub">数えられる日がありません</p>
      ) : (
        <ul className="vacancy-dates" data-testid="vacancy-dates">
          {picked.byDate.map((x) => (
            <li key={x.date} className={x.staffIds.length === 0 ? 'is-ng' : ''}>
              <strong>{dateText(x.date)}</strong>
              {x.staffIds.length === 0 ? (
                <span>× 入らない</span>
              ) : (
                <span>
                  {x.staffIds.length}人：{x.staffIds.map((id) => staffName.get(id) ?? '（不明）').join('、')}
                </span>
              )}
              {/* その日の案を日の画面で（PRD D204。名前の吹き出しは付けない：D124）。Link なので Ctrl+クリック・中クリックで
                  新しいタブにも開ける。ふつうに押すと同じタブで移る（日の予定が ?date= を読む） */}
              <Link
                to={dayHref(x.date)}
                className="vacancy-day-open"
                aria-label={`その日の予定を見る（${dateText(x.date)}・日の予定で開く）`}
                data-testid="vacancy-day-open"
                data-date={x.date}
              >
                その日の予定を見る
              </Link>
            </li>
          ))}
        </ul>
      )}
      {noPlan.some((d) => weekday(d) === picked.weekday) && (
        <p className="sub">計算できなかった日は数えていません（表の上の注意）。</p>
      )}
    </SidePanel>
  );
}

/** 仮押さえの欄（PRD D45〜D47）：表示名を入れて押さえる。押さえる定期パターンの曜日と開始時刻を並べる */
export function HoldPanel({
  hold,
  setHold,
  onSubmit,
  clientWord,
  from,
  slots,
  vType,
  durationNum,
  hasPin,
  address,
}: {
  hold: HoldForm;
  setHold: (h: HoldForm | null) => void;
  onSubmit: () => void;
  clientWord: string;
  from: string;
  slots: HoldSlot[];
  vType: VisitType | null;
  durationNum: number;
  /** 場所の位置があるか */
  hasPin: boolean;
  /** 場所の住所（打ちかけを含む） */
  address: string;
}) {
  /** 入力の誤りの文の id（入力欄の aria-describedby。PRD D250） */
  const holdErrId = useId();
  return (
    <SidePanel
      icon={BookmarkPlus}
      narrow
      title={`仮の${clientWord}として押さえる`}
      onClose={() => setHold(null)}
      onSubmit={onSubmit}
      footer={
        <>
          <button type="submit" className="btn btn-primary" data-testid="hold-register">
            <WithIcon icon={BookmarkPlus}>押さえる</WithIcon>
          </button>
          <button type="button" className="btn" onClick={() => setHold(null)}>
            <WithIcon icon={X}>閉じる</WithIcon>
          </button>
          <FieldError as="span" id={holdErrId} token={hold.error ? hold : null}>
            {hold.error}
          </FieldError>
        </>
      }
    >
      <label>
        <span>
          表示名
          <RequiredMark />
        </span>
        <input
          value={hold.name}
          maxLength={50}
          required
          {...invalidAttrs(!!hold.error && !!hold.nameBad, holdErrId)}
          data-testid="hold-name"
          onChange={(e) => setHold({ ...hold, name: e.target.value, error: null, nameBad: false })}
        />
      </label>
      <p>次の定期パターン（毎週）で、{dateText(from)}から押さえます。</p>
      <ul className="vacancy-dates">
        {slots.map((s) => (
          <li key={s.weekday}>
            <strong>
              {WEEKDAY_LABELS[s.weekday]} {clockTime(s.start)}
            </strong>
            <span>
              {vType ? `${vType.name}・` : ''}
              {durationNum}分
            </span>
          </li>
        ))}
      </ul>
      <Hint>
        「仮」の印の{clientWord}
        として登録し、繰り返しを足します。先4週の回は、ほかの人の予定を変えずに空き時間へ入れます。入らない回は担当なしになるので、日の予定で入れてください。
        あとで{clientWord}の画面で「本登録にする」か「仮押さえを取り消す」を選べます。
        {hasPin
          ? ''
          : address.trim() !== ''
            ? ' 位置はあとで入れてください。'
            : ' 場所が空なので、住所・位置はあとで入れてください。'}
      </Hint>
    </SidePanel>
  );
}

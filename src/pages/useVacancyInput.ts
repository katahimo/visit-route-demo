import { useEffect, useMemo, useState } from 'react';
import type { ClientPlace, VisitType } from '../contracts/documents';
import type { Condition } from '../contracts/rules';
import { VACANCY_DURATION_MAX, VACANCY_DURATION_MIN, type VacancyQuery, type VacancyRange } from '../contracts/vacancy';
import { rangeAfterDuration, type WishBand } from '../lib/vacancyBands';
import { loadVacancyInput, saveVacancyInput } from '../lib/vacancyInput';
import { type NoticePeriod, vacancyQuery } from '../lib/vacancyView';
import { appSessionStorage } from '../store';

/** 空き状況の場所の入力（ClientPlace に、ピンを置いたときの住所を足したもの） */
export type VacancyPlace = ClientPlace & { pinnedAddress: string };

/**
 * 空き状況の入力（チップ・くわしい条件・場所・問い合わせの試算・案内文の期間と種類。PRD D411）。
 * 入力はタブの間だけ覚える（sessionStorage。ほかの画面へ移って戻っても残り、閉じれば消える。PRD D258）
 */
export function useVacancyInput(today: string, visitTypes: readonly VisitType[]) {
  const [saved] = useState(() => loadVacancyInput(today, new Set(visitTypes.map((t) => t.id)), appSessionStorage()));
  // 条件の欄
  const [typeId, setTypeId] = useState(saved.typeId);
  const [duration, setDurationRaw] = useState(saved.duration);
  const [requirements, setRequirements] = useState<Condition[]>(saved.requirements);
  // 場所（データには保存しない一時の入力。郵便番号は住所を探すためと、仮押さえで〈利用者さん〉に写すため。PRD D118〜D121）
  // pinnedAddress はピンを置いたときの住所（見出し・試算に使う。住所を打っても置き直すまで変えない。PRD D119）
  const [place, setPlace] = useState<VacancyPlace>(saved.place);
  const [weeks, setWeeks] = useState(saved.weeks);
  const [from, setFrom] = useState(saved.from);
  // 問い合わせの試算
  const [wishDays, setWishDays] = useState<number[]>(saved.wishDays);
  const [wishFrom, setWishFromRaw] = useState(saved.wishFrom);
  const [wishTo, setWishToRaw] = useState(saved.wishTo);
  // 時間帯のチップ（空＝指定なし。PRD D411）。くわしい条件で開始の幅を変えたら指定なしに戻す
  const [wishBands, setWishBands] = useState<WishBand[]>(saved.wishBands);
  const setWishFrom = (v: string) => {
    setWishFromRaw(v);
    setWishBands([]);
  };
  const setWishTo = (v: string) => {
    setWishToRaw(v);
    setWishBands([]);
  };
  // 所要を変えたら、開始の幅が既定のままなら新しい所要の既定にする（指定なし＝所要を足して 20:00 に収まる開始まで。PRD D411）
  const setDuration = (v: string) => {
    const next = rangeAfterDuration({ from: wishFrom, to: wishTo }, duration, v);
    setDurationRaw(v);
    setWishFromRaw(next.from);
    setWishToRaw(next.to);
  };
  const [perWeek, setPerWeek] = useState(saved.perWeek);
  // 空き枠の案内文（PRD D67。ADR-0013）の期間・種類
  const [noticePeriod, setNoticePeriod] = useState<NoticePeriod>(saved.noticePeriod);
  const [noticeTypeId, setNoticeTypeId] = useState(saved.noticeTypeId);
  // 入力を覚える（PRD D258）
  useEffect(() => {
    saveVacancyInput(
      {
        typeId,
        duration,
        requirements,
        place,
        weeks,
        from,
        wishDays,
        wishFrom,
        wishTo,
        wishBands,
        perWeek,
        noticePeriod,
        noticeTypeId,
      },
      appSessionStorage(),
    );
  }, [
    typeId,
    duration,
    requirements,
    place,
    weeks,
    from,
    wishDays,
    wishFrom,
    wishTo,
    wishBands,
    perWeek,
    noticePeriod,
    noticeTypeId,
  ]);
  return {
    typeId,
    setTypeId,
    duration,
    setDuration,
    requirements,
    setRequirements,
    place,
    setPlace,
    weeks,
    setWeeks,
    from,
    setFrom,
    wishDays,
    setWishDays,
    wishFrom,
    setWishFrom,
    wishTo,
    setWishTo,
    wishBands,
    setWishBands,
    perWeek,
    setPerWeek,
    noticePeriod,
    setNoticePeriod,
    noticeTypeId,
    setNoticeTypeId,
  };
}

export type VacancyInputState = ReturnType<typeof useVacancyInput>;

/** 入力から試算の条件・範囲を作る（所要・開始日が正しくなければ null） */
export function useVacancyQuery(input: VacancyInputState) {
  const { typeId, duration, requirements, place, from, weeks } = input;
  const durationNum = Number(duration);
  const durationOk =
    Number.isInteger(durationNum) && durationNum >= VACANCY_DURATION_MIN && durationNum <= VACANCY_DURATION_MAX;
  const fromOk = /^\d{4}-\d{2}-\d{2}$/.test(from);
  // 試算に渡すのはピンの位置と、置いたときの住所だけ（契約の Place）。郵便番号・住所を打っても計算し直さない
  const exactPlace = useMemo(
    () =>
      place.lat !== null && place.lng !== null
        ? { address: place.pinnedAddress, lat: place.lat, lng: place.lng }
        : null,
    [place.pinnedAddress, place.lat, place.lng],
  );
  const query = useMemo<VacancyQuery | null>(
    () => (durationOk ? vacancyQuery(typeId || null, durationNum, requirements, exactPlace) : null),
    [durationOk, typeId, durationNum, requirements, exactPlace],
  );
  const range = useMemo<VacancyRange | null>(() => (fromOk ? { from, weeks } : null), [from, fromOk, weeks]);
  return { durationNum, durationOk, fromOk, exactPlace, query, range };
}

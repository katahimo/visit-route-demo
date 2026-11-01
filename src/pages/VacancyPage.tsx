import { CalendarSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui';
import { useFeature } from '../components/useFeature';
import type { VacancyCell } from '../contracts/vacancy';
import { jstDate } from '../domain/time';
import { copyText } from '../lib/clipboard';
import { WEEKDAY_LABELS } from '../lib/common';
import { mdText } from '../lib/dateText';
import { unassignedDays } from '../lib/dayPlan';
import { typeOf } from '../lib/patternText';
import { bandInquiry, startRangeText } from '../lib/vacancyBands';
import { whenWhatLine } from '../lib/vacancyView';
import { useDemoData } from '../store';
import { useVacancyHold } from './useVacancyHold';
import { useVacancyInput, useVacancyQuery } from './useVacancyInput';
import { useVacancyNotice } from './useVacancyNotice';
import { useNarrowGridScroll, useVacancyResult } from './useVacancyResult';
import { NoticeCard } from './vacancyNotice';
import { HoldPanel, PickedPanel } from './vacancyPanels';
import { ROW_WEEKDAYS } from './vacancyParts';
import { NextStage, PlaceStage, TableStage } from './vacancyStages';
import { WhenStage } from './vacancyWhen';
import './settings.css';
import './vacancy.css';

/**
 * 空き状況と問い合わせの試算（ADR-0012。段階3＝PRD D45〜D48。design.md §4 pages「空き状況と問い合わせの試算」）。
 * チップ（曜日・時間帯・所要）とくわしい条件 → 答えのカードと要約のコピー → 「詳しく ▾」の曜日×開始時刻の表（マスを押すと日付ごとの人）→ 仮押さえ（PRD D411・D412）。
 * データは読むだけ。仮押さえだけが1回の update で〈利用者さん〉（仮）と定期パターンを入れる（lib/hold の holdData）。
 * 入力は useVacancyInput、計算は useVacancyResult、案内文は useVacancyNotice、仮押さえは useVacancyHold、段階の見た目は vacancyWhen・vacancyStages
 */
export default function VacancyPage() {
  const { data, update } = useDemoData();
  const terms = data.org.terms;
  const noticeOn = useFeature('vacancyNotice');
  const mailOn = useFeature('mail');
  /** 段階・紹介元（ADR-0028 の clientStage）：切なら紹介元の名前・メールアドレスの一覧と BCC のメールを出さない（データは残す） */
  const stageOn = useFeature('clientStage');
  const toast = useToast();
  const today = jstDate(Date.now());

  const input = useVacancyInput(today, data.visitTypes);
  const { typeId, duration, requirements, place, weeks, from, wishDays, wishFrom, wishTo, wishBands, perWeek } = input;
  const { durationNum, durationOk, fromOk, exactPlace, query, range } = useVacancyQuery(input);
  const [picked, setPicked] = useState<VacancyCell | null>(null);
  const { result, busy } = useVacancyResult(data, query, range);
  const gridRef = useNarrowGridScroll(!!result && result.times.length > 0);
  const staffName = useMemo(() => new Map(data.staff.map((s) => [s.id, s.name])), [data.staff]);

  // 時間帯のチップ（PRD D411）：帯の外のマスは答え・要約・仮押さえから除く（lib/vacancyBands）
  const detailRange = { from: wishFrom, to: wishTo };
  const ask = { weekdays: wishDays, ...detailRange, bands: wishBands, perWeek, startDate: from };
  const { wish, wishOk, answerResult, answer, summary, slots } = bandInquiry(result, ask, terms);
  const vType = typeOf(data.visitTypes, typeId);

  const notice = useVacancyNotice(data, {
    today,
    noticePeriod: input.noticePeriod,
    noticeTypeId: input.noticeTypeId,
    requirements,
    exactPlace,
    durationOk,
    durationNum,
  });
  const { hold, setHold, register } = useVacancyHold(data, update, {
    today,
    query,
    slots,
    place,
    requirements,
    typeId: vType?.id ?? null,
    from,
  });

  const copy = async () => {
    if (!summary) return;
    toast((await copyText(summary)) ? '要約をコピーしました' : 'コピーできませんでした。文を選んでコピーしてください');
  };

  const noPlan = result?.noPlanDates ?? [];
  /** 担当の足りない日（範囲の今日以降の、担当なしの訪問がある・伝えていない日。PRD D259）。担当は担当を組むの画面か日の予定で入れる（ADR-0063） */
  const rangeKey = result ? result.dates.join(',') : '';
  // biome-ignore lint/correctness/useExhaustiveDependencies: 範囲は日付の並び（rangeKey）で見る
  const missing = useMemo(() => (result ? unassignedDays(data, result.dates, today) : []), [data, rangeKey, today]);
  const whenLine = whenWhatLine({
    durationOk,
    wishOk,
    typeName: vType?.name ?? null,
    duration,
    weekdayLabels: ROW_WEEKDAYS.filter((w) => wishDays.includes(w)).map((w) => WEEKDAY_LABELS[w]!),
    startRange: startRangeText(wishBands, detailRange),
    perWeek,
    startMd: fromOk ? mdText(from) : '—',
    weeks,
  });

  return (
    <div className="stack vacancy-page">
      <PageHeader
        icon={CalendarSearch}
        title="空き状況"
        lead={`曜日・時間帯・所要を選ぶと、受けられる時刻と${terms.staff}の人数が出ます。場所はあとから足せます`}
      />
      <WhenStage data={data} input={input} durationOk={durationOk} fromOk={fromOk} wishOk={wishOk} />
      <PlaceStage input={input} hasPin={exactPlace !== null} />
      <TableStage
        view={{
          result,
          answerResult,
          busy,
          exactPlace,
          whenLine,
          answer,
          noPlan,
          missing,
          summary,
          wish,
          vType,
          staffWord: terms.staff,
        }}
        picked={picked}
        onPick={setPicked}
        onCopy={copy}
        gridRef={gridRef}
      />
      <NextStage
        summary={summary}
        canHold={slots.length > 0}
        perWeek={perWeek}
        hasPlace={!!exactPlace}
        clientWord={terms.client}
        onHoldOpen={() => setHold({ name: '', error: null })}
      >
        {/* 空き枠の案内文（ADR-0028 の vacancyNotice）を切っていれば欄ごと出さない。メールを切っていれば紹介元へのメールを出さない */}
        {noticeOn && (
          <NoticeCard
            notice={notice}
            terms={terms}
            visitTypes={data.visitTypes}
            period={{ value: input.noticePeriod, set: input.setNoticePeriod }}
            typeId={{ value: input.noticeTypeId, set: input.setNoticeTypeId }}
            duration={durationOk ? durationNum : null}
            hasPlace={!!exactPlace}
            mailOn={mailOn}
            stageOn={stageOn}
          />
        )}
      </NextStage>

      {picked && result && (
        <PickedPanel
          picked={picked}
          exact={result.exact}
          durationNum={durationNum}
          staffName={staffName}
          noPlan={noPlan}
          onClose={() => setPicked(null)}
        />
      )}

      {hold && (
        <HoldPanel
          hold={hold}
          setHold={setHold}
          onSubmit={register}
          clientWord={terms.client}
          from={from}
          slots={slots}
          vType={vType}
          durationNum={durationNum}
          hasPin={!!exactPlace}
          address={place.address}
        />
      )}
    </div>
  );
}

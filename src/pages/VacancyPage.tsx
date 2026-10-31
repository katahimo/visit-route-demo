import { CalendarSearch } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui';
import { useFeature } from '../components/useFeature';
import type { VacancyCell } from '../contracts/vacancy';
import { timeText } from '../domain/availability';
import { hhmmToMinutes, jstDate } from '../domain/time';
import { copyText } from '../lib/clipboard';
import { WEEKDAY_LABELS } from '../lib/common';
import { mdText } from '../lib/dateText';
import { unassignedDays } from '../lib/dayPlan';
import { holdSlots } from '../lib/hold';
import { typeOf } from '../lib/patternText';
import { answerCard, whenWhatLine } from '../lib/vacancyView';
import { useDemoData } from '../store';
import { inquirySummary } from '../vacancy';
import { useVacancyHold } from './useVacancyHold';
import { useVacancyInput, useVacancyQuery } from './useVacancyInput';
import { useVacancyNotice } from './useVacancyNotice';
import { useNarrowGridScroll, useVacancyResult } from './useVacancyResult';
import { NoticeCard } from './vacancyNotice';
import { HoldPanel, PickedPanel } from './vacancyPanels';
import { ROW_WEEKDAYS } from './vacancyParts';
import { NextStage, PlaceStage, TableStage, WhenStage } from './vacancyStages';
import './settings.css';
import './vacancy.css';

/**
 * 空き状況と問い合わせの試算（ADR-0012。段階3＝PRD D45〜D48。design.md §4 pages「空き状況と問い合わせの試算」）。
 * 条件の欄 → 曜日×開始時刻の表（人数と ○△×？）→ マスを押すと日付ごとの人 → 問い合わせの試算の要約・コピー → 仮押さえ。
 * データは読むだけ。仮押さえだけが1回の update で〈利用者さん〉（仮）と定期パターンを入れる（lib/hold の holdData）。
 * 入力は useVacancyInput、計算は useVacancyResult、案内文は useVacancyNotice、仮押さえは useVacancyHold、段階の見た目は vacancyStages
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
  const { typeId, duration, requirements, place, weeks, from, wishDays, wishFrom, wishTo, perWeek } = input;
  const { durationNum, durationOk, fromOk, exactPlace, query, range } = useVacancyQuery(input);
  const [picked, setPicked] = useState<VacancyCell | null>(null);
  const { result, busy } = useVacancyResult(data, query, range);
  const gridRef = useNarrowGridScroll(!!result && result.times.length > 0);
  const staffName = useMemo(() => new Map(data.staff.map((s) => [s.id, s.name])), [data.staff]);

  const wish = { weekdays: wishDays, from: wishFrom, to: wishTo, perWeek, startDate: from };
  const wishOk = hhmmToMinutes(wishFrom) <= hhmmToMinutes(wishTo);
  const summary = result && wishOk ? inquirySummary(result, wish, terms) : null;
  const slots = result && wishOk ? holdSlots(result, wishDays, wishFrom, wishTo, perWeek) : [];
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
  /** 答えのカード（PRD D258） */
  const answer = result && wishOk ? answerCard(result, wish) : null;
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
    from: timeText(wishFrom),
    to: timeText(wishTo),
    perWeek,
    startMd: fromOk ? mdText(from) : '—',
    weeks,
  });

  return (
    <div className="stack vacancy-page">
      <PageHeader
        icon={CalendarSearch}
        title="空き状況"
        lead={`いつ・何を入れると、受けられる曜日・時間帯と${terms.staff}の人数が出ます。場所はあとから足せます`}
      />
      <WhenStage data={data} input={input} durationOk={durationOk} fromOk={fromOk} wishOk={wishOk} />
      <PlaceStage input={input} hasPin={exactPlace !== null} />
      <TableStage
        view={{
          result,
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
        gridRef={gridRef}
      />
      <NextStage
        summary={summary}
        canHold={slots.length > 0}
        perWeek={perWeek}
        hasPlace={!!exactPlace}
        clientWord={terms.client}
        onCopy={copy}
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

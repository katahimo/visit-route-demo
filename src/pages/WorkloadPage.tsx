import { Timer } from 'lucide-react';
import { useId, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDay } from '../components/day';
import { EmptyNext } from '../components/EmptyNext';
import { PeopleTabs } from '../components/SettingsTabs';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { jstDate } from '../domain/time';
import { copyText } from '../lib/clipboard';
import { byName } from '../lib/common';
import { periodEmptyGuide } from '../lib/emptyGuide';
import { activeVisitsOn } from '../lib/month';
import { type WorkDay, workloadTsv, workMonth, workTotals } from '../lib/workload';
import { pickedDaysOf, sumWork, workAxis } from '../lib/workloadView';
import { isYm, monthDates, ymOf } from '../lib/ym';
import { useDemoData } from '../store';
import { useWorkloadSettings } from './useWorkloadSettings';
import { WorkloadHead } from './workloadHead';
import { WorkloadDays, WorkloadGrid, WorkloadTotals } from './workloadTables';
import './workload.css';

/**
 * 稼働の見込み（PRD D72。ADR-0015。#/workload?ym=2026-11）：予定（確定した割当、無ければ今の案）から、
 * 〈スタッフ〉×日ごとの拘束・訪問・移動・待ちの時間と、移動の距離・交通費を見込む。実績ではない（記録・勤怠はやらない）。
 * 月の合計の表、〈スタッフ〉×日の表（拘束の長さの横棒）、選んだ人の日ごとの時間軸の横棒。交通費の単価と拘束の上限は事業所の設定
 */
export default function WorkloadPage() {
  const { data } = useDemoData();
  const { date, setDate } = useDay();
  const navigate = useNavigate();
  /** 上限の入力欄の名前（aria-labelledby） */
  const limitId = useId();
  const toast = useToast();
  const terms = data.org.terms;
  const [params, setParams] = useSearchParams();
  const raw = params.get('ym') ?? '';
  const ym = isYm(raw) ? raw : ymOf(date);
  const today = jstDate(Date.now());
  const org = data.org;
  // 交通費（ADR-0028 の fare）を切っていれば、単価の欄と交通費の列を出さない（単価の値は消さない）
  const fareFeature = useFeature('fare');
  const fareOn = fareFeature && org.fareYenPerKm > 0;

  const days: WorkDay[] = useMemo(() => workMonth(data, ym), [data, ym]);
  const totals = useMemo(() => workTotals(days), [days]);
  /** 表に出す人：利用中の人と、この月に見込みのある人（名前の順） */
  const staff = useMemo(
    () => [...data.staff].filter((s) => s.active || totals.has(s.id)).sort(byName),
    [data.staff, totals],
  );
  const rows = staff.filter((s) => totals.has(s.id));
  const overDays = sumWork(totals, rows, (t) => t.overDays);
  const planDays = days.filter((d) => d.source !== null).length;
  /** 空の画面の文とボタン（PRD D176。案のある日があれば null） */
  const emptyGuide = useMemo(() => {
    const dates = monthDates(ym);
    return periodEmptyGuide({
      period: 'この月',
      dates,
      today,
      visitDays: dates.filter((d) => activeVisitsOn(data, d).length > 0),
    });
  }, [ym, today, data]);

  // ---- 選んだ人の日ごと ----
  const sid = params.get('staff');
  const picked = rows.find((s) => s.id === sid) ?? rows[0];
  const pickedDays = useMemo(() => pickedDaysOf(days, picked?.id), [days, picked]);
  /** 時間軸の範囲（7:00〜20:00。はみ出す日があれば広げる） */
  const axis = useMemo(() => workAxis(pickedDays), [pickedDays]);

  /** その日の日の画面を開く（選んでいる日付をその日にしてから移る。PRD D202） */
  const openDay = (d: string) => {
    setDate(d);
    navigate('/plan');
  };

  const patch = (next: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(next)) {
          if (v === null) p.delete(k);
          else p.set(k, v);
        }
        return p;
      },
      { replace: true },
    );

  // ---- 設定（事業所の交通費の単価・拘束の上限） ----
  const settings = useWorkloadSettings(org);

  const copy = async () => {
    const ok = await copyText(workloadTsv(days, rows, org));
    toast(ok ? '表をコピーしました（表計算に貼り付けられます）' : 'コピーできませんでした');
  };

  return (
    <div className="stack">
      <PageHeader
        nav={<PeopleTabs />}
        icon={Timer}
        title="勤務の見込み"
        lead={`予定から見込んだ、${terms.staff}ごとの出勤〜退勤（拘束）・移動・空き時間（待ち）の時間${fareFeature ? 'と交通費' : ''}です。実績ではありません`}
      />

      <WorkloadHead
        ym={ym}
        thisYm={ymOf(today)}
        staffTerm={terms.staff}
        rowCount={rows.length}
        planDays={planDays}
        overDays={overDays}
        onMonth={(m) => patch({ ym: m })}
        onCopy={() => void copy()}
        fareFeature={fareFeature}
        settings={settings}
        limitId={limitId}
      />

      {rows.length === 0 ? (
        <div className="card" data-testid="work-empty">
          {/* 空の画面（PRD D176）：なぜ空かと次の一手（月の画面のまとめて作る・日の画面） */}
          {emptyGuide ? (
            <EmptyNext guide={emptyGuide} icon={Timer} onOpenDay={openDay} />
          ) : (
            <p className="sub">この月には、見込める予定（計算できる訪問）がありません。</p>
          )}
        </div>
      ) : (
        <>
          <WorkloadTotals
            rows={rows}
            totals={totals}
            pickedId={picked?.id}
            onPick={(id) => patch({ staff: id })}
            fareOn={fareOn}
            limitHours={org.spanLimitHours}
          />
          <WorkloadGrid
            rows={rows}
            days={days}
            staffTerm={terms.staff}
            limitHours={org.spanLimitHours}
            onOpenDay={openDay}
          />
          {picked && (
            <WorkloadDays
              picked={picked}
              rows={rows}
              onPick={(id) => patch({ staff: id })}
              staffTerm={terms.staff}
              pickedDays={pickedDays}
              axis={axis}
              fareOn={fareOn}
              onOpenDay={openDay}
            />
          )}
        </>
      )}
    </div>
  );
}

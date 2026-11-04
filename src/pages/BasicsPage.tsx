// 予定と相性の表（#/basics。PRD D361・D362。ADR-0067・ADR-0100）：〈利用者さん〉のタブの1つ。〈利用者さん〉の繰り返しごと・曜日ごとに
// 時間の約束・いつもの担当・相性・勤務時間の外を1枚の表で確かめ、マスで時刻を直す。名前から〈利用者さん〉・〈スタッフ〉の画面へ。
// 時刻を直すのは〈利用者さん〉の画面と同じく今日から分けて
// （確認のあと store の update の1回。全体の「元に戻す」で戻せる）
import { CalendarRange } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { PeopleTabs } from '../components/SettingsTabs';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { jstDate } from '../domain/time';
import { basicsRows, basicsWeekdays, canEditTime, changePatternTime, issueCount } from '../lib/basicsView';
import { newId, WEEKDAY_LABELS } from '../lib/common';
import { patternSplitConfirm } from '../lib/patternConfirm';
import { patternConfirmedDays } from '../lib/patternForm';
import { timesOn } from '../patterns';
import { useDemoData } from '../store';
import { type BasicsCellRef, BasicsTable, BasicsTimeEditor, focusCell } from './basicsParts';
import './settings.css';
import './basics.css';

export default function BasicsPage() {
  const { data, update } = useDemoData();
  const today = jstDate(Date.now());
  const compatOn = useFeature('compat');
  const perDayOn = useFeature('patternMonthly');
  const terms = data.org.terms;
  const rows = useMemo(() => basicsRows(data, today, compatOn), [data, today, compatOn]);
  const weekdays = useMemo(() => basicsWeekdays(rows.map((r) => r.pattern)), [rows]);
  const [open, setOpen] = useState<BasicsCellRef | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.displayName ?? id;
  const staffName = (id: string) => data.staff.find((s) => s.id === id)?.name ?? '（いない人）';
  const issues = issueCount(rows);
  const confirmDialog = useConfirm();
  const toast = useToast();

  /** マスの時刻を直す（今日から分ける。担当を組んだ回が戻る・確定した日が変わるなら確認） */
  const saveTime = async (ref: BasicsCellRef, times: { earliestStart: string; latestStart: string }) => {
    const nid = newId('pt');
    const c = changePatternTime(data, ref.patternId, ref.weekday, times, today, nid);
    if (!c) return;
    const m = patternConfirmedDays(data, ref.patternId, today, c);
    if ((c.removed.length > 0 || m > 0) && !(await confirmDialog(patternSplitConfirm(today, c.removed.length, m))))
      return;
    update((d) => {
      const x = changePatternTime(d, ref.patternId, ref.weekday, times, today, nid);
      return x ? { ...d, patterns: x.patterns, visits: x.visits } : d;
    }, '繰り返しの時刻');
    close(ref);
    toast('時刻を直しました（今日から）');
  };

  const close = (ref: BasicsCellRef | null) => {
    setOpen(null);
    if (ref) focusCell(cellRefs, ref);
  };

  return (
    <div className="stack basics-page">
      <PageHeader
        // 〈利用者さん〉のタブ（入切とも。ADR-0100）
        nav={<PeopleTabs />}
        icon={CalendarRange}
        title="予定と相性"
        lead={`${terms.client}の予定（繰り返し）と、いつもの担当・相性・勤務時間（シフト）を1枚の表で確かめて直します`}
      />
      <div className="card stack">
        {rows.length === 0 ? (
          <p className="sub" data-testid="basics-empty">
            繰り返しの予定がありません。<Link to="/clients">{terms.client}</Link>の画面で繰り返しを追加します
          </p>
        ) : (
          <>
            <p className="sub" data-testid="basics-summary">
              繰り返し {rows.length}件。時刻を押すと直せます。名前を押すと{terms.client}・{terms.staff}の画面へ
              {issues > 0 && (
                <>
                  。
                  <strong className="warn-text" data-testid="basics-issue-count">
                    勤務時間の外の担当 {issues}か所
                  </strong>
                </>
              )}
            </p>
            <BasicsTable
              rows={rows}
              weekdays={weekdays}
              clientName={clientName}
              staffName={staffName}
              compatOn={compatOn}
              canEdit={(p) => canEditTime(p, perDayOn)}
              open={open}
              onOpen={(ref) =>
                setOpen((o) => (o && o.patternId === ref.patternId && o.weekday === ref.weekday ? null : ref))
              }
              cellRefs={cellRefs}
              editor={(p, wd) => (
                <BasicsTimeEditor
                  key={`${p.id}|${wd}`}
                  pattern={p}
                  wd={wd}
                  times={timesOn(p, wd)}
                  title={`${clientName(p.clientId)} ${WEEKDAY_LABELS[wd]}曜の時刻`}
                  onDone={(early, late) =>
                    void saveTime({ patternId: p.id, weekday: wd }, { earliestStart: early, latestStart: late })
                  }
                  onClose={() => close({ patternId: p.id, weekday: wd })}
                />
              )}
            />
          </>
        )}
        <p className="sub">相性を直すのは「相性」のタブ、勤務日・勤務時間を直すのは{terms.staff}の「勤務」のタブ</p>
      </div>
    </div>
  );
}

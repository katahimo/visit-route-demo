// 基本情報・予定と相性の表（#/basics。PRD D361・D362。ADR-0067）：予定を組むの 1 の段。〈利用者さん〉の繰り返しごと・曜日ごとに
// 時間の約束・標準の担当・相性・勤務時間の外を1枚の表で確かめ、マスで時刻を直す。名前から〈利用者さん〉・〈スタッフ〉の画面へ。
// 決まったら［次へ］（標準が無ければ案をくらべる、あれば担当を組む）。時刻を直すのは〈利用者さん〉の画面と同じく今日から分けて
// （確認のあと store の update の1回。全体の「元に戻す」で戻せる）
import { CalendarRange } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog';
import { BasicsNav } from '../components/SettingsTabs';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { jstDate } from '../domain/time';
import { basicsRows, canEditTime, changePatternTime, issueCount } from '../lib/basicsView';
import { newId, WEEKDAY_LABELS } from '../lib/common';
import { arrangeSteps, nextArrangeStep } from '../lib/nav';
import { patternSplitConfirm } from '../lib/patternConfirm';
import { patternConfirmedDays } from '../lib/patternForm';
import { hasStandard } from '../lib/standard';
import { setStandardStep } from '../lib/standardDraft';
import { standardWeekdays } from '../lib/standardView';
import { timesOn } from '../patterns';
import { useDemoData } from '../store';
import { type BasicsCellRef, BasicsTable, BasicsTimeEditor, focusCell } from './basicsParts';
import './settings.css';
import './standard.css';

export default function BasicsPage() {
  const { data, update } = useDemoData();
  const today = jstDate(Date.now());
  const compatOn = useFeature('compat');
  const perDayOn = useFeature('patternMonthly');
  const terms = data.org.terms;
  const rows = useMemo(() => basicsRows(data, today, compatOn), [data, today, compatOn]);
  const weekdays = useMemo(() => standardWeekdays(rows.map((r) => r.pattern)), [rows]);
  const [open, setOpen] = useState<BasicsCellRef | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.displayName ?? id;
  const staffName = (id: string) => data.staff.find((s) => s.id === id)?.name ?? '（いない人）';
  const expert = useFeature('expert');
  // 段はエキスパート機能が入のときだけ（切なら「次へ」は出さない。ADR-0072）
  const next = expert ? nextArrangeStep(arrangeSteps(!hasStandard(data)), 'basics') : null;
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
        // 切は基本情報のタブを出さない（旧画面。〈利用者さん〉・〈スタッフ〉の小さいタブに予定と相性は無い。PRD D389）
        nav={expert ? <BasicsNav /> : undefined}
        icon={CalendarRange}
        title="予定と相性"
        lead={`${terms.client}の予定（繰り返し）と、${expert ? '標準の担当' : 'いつもの担当'}・相性・勤務時間（シフト）を1枚の表で確かめて直します。決まったら AI で担当を組みます`}
      />
      <div className="card stack">
        {rows.length === 0 ? (
          <p className="sub" data-testid="basics-empty">
            繰り返しの予定がありません。<Link to="/clients">{terms.client}</Link>の画面で繰り返しを足します
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
        <p className="sub">
          相性を直すのは「相性」、勤務日・勤務時間を直すのは「勤務時間（シフト）」のタブ。
          {expert && '標準の担当は組み方の標準で決めます'}
        </p>
      </div>
      {next && (
        <div className="row standard-step-nav" data-testid="basics-step-nav">
          <Link
            to={next.to}
            className="btn btn-primary"
            onClick={() => {
              if (next.key === 'proposals') setStandardStep('proposals');
            }}
            data-testid="basics-next"
          >
            次へ：{next.label}
          </Link>
        </div>
      )}
    </div>
  );
}

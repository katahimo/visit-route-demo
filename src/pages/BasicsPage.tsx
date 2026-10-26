// 基本情報・予定と相性の表（#/basics。PRD D361・D362。ADR-0067）：予定を組むの 1 の段。〈利用者さん〉の繰り返しごと・曜日ごとに
// 時間の約束・標準の担当・相性・勤務時間の外を1枚の表で確かめ、マスで時刻を直す。名前から〈利用者さん〉・〈スタッフ〉の画面へ。
// 決まったら［次へ］（標準が無ければ案をくらべる、あれば担当を組む）。直すのは store の update の1回（全体の「元に戻す」で戻せる）
import { CalendarRange } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BasicsNav } from '../components/SettingsTabs';
import { PageHeader } from '../components/ui';
import { useFeature } from '../components/useFeature';
import { jstDate } from '../domain/time';
import { basicsRows, canEditTime, setPatternTime } from '../lib/basicsView';
import { WEEKDAY_LABELS } from '../lib/common';
import { arrangeSteps, nextArrangeStep } from '../lib/nav';
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
  const next = nextArrangeStep(arrangeSteps(!hasStandard(data)), 'basics');
  const issues = rows.reduce((n, r) => n + Object.values(r.cells).filter((c) => c.issue).length, 0);

  const close = (ref: BasicsCellRef | null) => {
    setOpen(null);
    if (ref) focusCell(cellRefs, ref);
  };

  return (
    <div className="stack basics-page">
      <PageHeader
        nav={<BasicsNav />}
        icon={CalendarRange}
        title="予定と相性"
        lead={`${terms.client}の予定（繰り返し）と、標準の担当・相性・勤務時間（シフト）を1枚の表で確かめて直します。決まったら AI で担当を組みます`}
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
                  onDone={(early, late) => {
                    update(
                      (d) => ({
                        ...d,
                        patterns: d.patterns.map((x) => (x.id === p.id ? setPatternTime(x, wd, early, late) : x)),
                      }),
                      '繰り返しの時刻',
                    );
                    close({ patternId: p.id, weekday: wd });
                  }}
                  onClose={() => close({ patternId: p.id, weekday: wd })}
                />
              )}
            />
          </>
        )}
        <p className="sub">
          相性を直すのは「相性」、勤務日・勤務時間を直すのは「勤務時間（シフト）」のタブ。標準の担当は組み方の標準で決めます
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

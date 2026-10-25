// 勤務の見込みの画面の上の枠（PRD D72。ADR-0015）：月の送り・今月・表をコピー・要約の行と、
// 事業所の設定（交通費の単価・拘束の上限）・見込みの数え方
import { ArrowLeft, ChevronLeft, ChevronRight, ClipboardCopy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FieldError, invalidAttrs } from '../components/FieldError';
import { Term } from '../components/Term';
import { Hint, WithIcon } from '../components/ui';
import { ymText } from '../lib/dateText';
import { addMonths } from '../lib/ym';
import type { WorkloadSettings } from './useWorkloadSettings';

export function WorkloadHead({
  ym,
  thisYm,
  staffTerm,
  rowCount,
  planDays,
  overDays,
  onMonth,
  onCopy,
  fareFeature,
  settings,
  limitId,
}: {
  ym: string;
  /** 今月 */
  thisYm: string;
  staffTerm: string;
  /** 表に出す人の数 */
  rowCount: number;
  /** 訪問のある日の数 */
  planDays: number;
  /** 拘束が上限を超える日（のべ） */
  overDays: number;
  /** 表示する月を替える */
  onMonth: (ym: string) => void;
  onCopy: () => void;
  fareFeature: boolean;
  settings: WorkloadSettings;
  /** 上限の入力欄の名前（aria-labelledby）の元 */
  limitId: string;
}) {
  return (
    <div className="card stack work-head">
      <div className="row work-nav">
        <Link className="btn btn-small" to={`/month?ym=${ym}`}>
          <WithIcon icon={ArrowLeft} size={14}>
            月の予定に戻る
          </WithIcon>
        </Link>
        <button type="button" className="icon-btn" aria-label="前の月" onClick={() => onMonth(addMonths(ym, -1))}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h2 className="work-title" data-testid="work-title">
          {ymText(ym)}
        </h2>
        <button type="button" className="icon-btn" aria-label="次の月" onClick={() => onMonth(addMonths(ym, 1))}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-small"
          aria-disabled={ym === thisYm || undefined}
          title={ym === thisYm ? 'いま今月を見ています' : '今月を見る'}
          onClick={() => {
            if (ym !== thisYm) onMonth(thisYm);
          }}
        >
          今月
        </button>
        <button
          type="button"
          className="btn btn-small"
          aria-disabled={rowCount === 0 || undefined}
          title={rowCount === 0 ? 'この月には見込める予定がありません' : '表計算に貼り付けられる形でコピーします'}
          onClick={() => {
            if (rowCount > 0) onCopy();
          }}
          data-testid="work-copy"
        >
          <WithIcon icon={ClipboardCopy} size={14}>
            表をコピー
          </WithIcon>
        </button>
        <span className="sub" data-testid="work-summary">
          訪問のある日 {planDays}日・{staffTerm} {rowCount}人
          {overDays > 0 ? `・出勤〜退勤（拘束）が上限を超える ${overDays}日（のべ）` : ''}
        </span>
      </div>
      <WorkloadSettingsRow fareFeature={fareFeature} settings={settings} limitId={limitId} />
      <Hint label="見込みの数え方">
        <ul className="hint-list">
          <li>数えるのは、その日の今の担当です。</li>
          <li>出勤〜退勤（拘束）に、自宅との行き帰りは入れません。距離と交通費には入れます。</li>
          <li>移動の時間と距離は、直線距離からの見積もりです。</li>
          <li>出勤〜退勤（拘束）の上限は、注意を出すだけです。AI の条件には入りません。</li>
          <li>予定からの見込みで、実績ではありません。</li>
        </ul>
      </Hint>
    </div>
  );
}

/** 事業所の設定の行（交通費の単価・拘束の上限） */
function WorkloadSettingsRow({
  fareFeature,
  settings,
  limitId,
}: {
  fareFeature: boolean;
  settings: WorkloadSettings;
  limitId: string;
}) {
  const { fare, setFare, limit, setLimit, fareError, limitError, saveFare, saveLimit } = settings;
  return (
    <div className="row work-settings">
      {fareFeature && (
        <label className="work-setting">
          <span>交通費の単価</span>
          <input
            type="number"
            min={0}
            max={1000}
            step={1}
            value={fare}
            onChange={(e) => setFare(e.target.value)}
            onBlur={saveFare}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveFare();
            }}
            {...invalidAttrs(!!fareError, `${limitId}-fare-error`)}
            data-testid="work-fare"
          />
          <span>円/km（0 なら交通費を出しません）</span>
          <FieldError as="span" id={`${limitId}-fare-error`}>
            {fareError}
          </FieldError>
        </label>
      )}
      {/* 用語の説明（ボタン）は label の中に置かない（PR #42 のレビュー）。入力欄の名前は aria-labelledby でつなぐ */}
      <div className="work-setting">
        <span>
          <Term k="span" testId="term-span" id={`${limitId}-term`} />
          <span id={`${limitId}-label`}>の上限</span>
        </span>
        <input
          aria-labelledby={`${limitId}-term ${limitId}-label`}
          type="number"
          min={0}
          max={24}
          step={0.5}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          onBlur={saveLimit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveLimit();
          }}
          {...invalidAttrs(!!limitError, `${limitId}-error`)}
          data-testid="work-limit"
        />
        <span>時間（超える日に注意。0 なら出しません）</span>
        <FieldError as="span" id={`${limitId}-error`}>
          {limitError}
        </FieldError>
      </div>
    </div>
  );
}

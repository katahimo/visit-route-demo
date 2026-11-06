// 「休みのカレンダーを取り込む」の右の欄（PRD D440。ADR-0107）：予定（月・週・日）の操作の行と、登録の案内の②から開く。
// Google カレンダーの書き出しの zip（〈スタッフ〉ごとの .ics）をそのまま選ぶと、件名に「休み」などのある予定を今日から約3か月分読み、
// カレンダーから入れた欠勤を 入れる・直す・外す 一覧（チェック）を出す。主ボタン［N件を反映する］で1回で書く（元に戻せる）。
// ファイルはこの端末の中で読むだけで送らない。状態と処理は useCalendarOff
import { CalendarSync, Check, X } from 'lucide-react';
import { CAL_OFF_DAYS, CAL_OFF_KIND_LABEL, calOffApplyLabel, calOffSummaryText } from '../lib/calendarOff';
import { FilePick } from './FilePick';
import { SidePanel, WithIcon } from './ui';
import { useCalendarOff } from './useCalendarOff';
import { COMPACT_QUERY, useMedia } from './useMedia';
import './pastePanel.css';

/** 欄の見出しとボタンの名前 */
export const CAL_OFF_LABEL = '休みのカレンダーを取り込む';
/** 操作の行の短い名前 */
export const CAL_OFF_SHORT = '休みを取り込む';
/** 欄とボタンのアイコン */
export const CAL_OFF_ICON = CalendarSync;

export function CalendarOffPanel({ onClose }: { onClose: () => void }) {
  const p = useCalendarOff(onClose);
  const narrow = useMedia(COMPACT_QUERY);
  const s = p.summary;
  return (
    <SidePanel
      icon={CalendarSync}
      title={CAL_OFF_LABEL}
      sheet={narrow}
      onClose={onClose}
      onSubmit={p.save}
      footer={
        <>
          <button
            type="submit"
            className="btn btn-primary"
            aria-disabled={p.count === 0 || undefined}
            data-testid="cal-off-apply"
          >
            <WithIcon icon={Check}>{calOffApplyLabel(p.count)}</WithIcon>
          </button>
          <button type="button" className="btn" onClick={onClose} data-testid="cal-off-close">
            <WithIcon icon={X}>閉じる</WithIcon>
          </button>
        </>
      }
    >
      <div className="paste-panel stack" data-testid="cal-off-panel">
        <p className="sub">
          Google カレンダーの書き出し（{p.terms.staff}ごとのカレンダーをまとめた .zip。.ics 1つでも可）を選びます。
          カレンダーの名前を{p.terms.staff}の名前に当て、件名に「休み」などのある予定を今日から{CAL_OFF_DAYS}
          日分、欠勤にします。毎日取り込み直すと、カレンダーで直した・消した休みも反映します。手で入れた欠勤は変えません。担当は振り直しません。
        </p>
        <FilePick
          caption="カレンダーのファイル"
          accept=".zip,.ics,application/zip,text/calendar"
          onPick={(f) => void p.pick(f)}
          disabled={p.reading}
          testId="cal-off-file"
        />
        {p.reading && <p className="sub">読んでいます…</p>}
        {p.error && (
          <p className="paste-row-reason" role="alert" data-testid="cal-off-error">
            {p.error}
          </p>
        )}
        {s && (
          <div className="stack" aria-live="polite" data-testid="cal-off-summary">
            <p className="paste-count">
              {calOffSummaryText(s, p.terms.staff)}
              {s.unchanged > 0 && `。変わらない休み ${s.unchanged}件`}
            </p>
            {s.unmatched.length > 0 && (
              <p className="sub" data-testid="cal-off-unmatched">
                {p.terms.staff}に合わないカレンダー（読みません）：{s.unmatched.join('、')}
              </p>
            )}
            {s.unsupported > 0 && <p className="sub">読めない繰り返しの予定 {s.unsupported}件は飛ばしました</p>}
          </div>
        )}
        {s && p.rows.length === 0 && <p data-testid="cal-off-none">変わる休みはありません</p>}
        {p.rows.length > 0 && (
          <ul className="paste-rows" aria-label="反映する休み" data-testid="cal-off-rows">
            {p.rows.map((r) =>
              r.kind !== 'skip' ? (
                <li key={r.key} className="paste-row" data-state="ok" data-kind={r.kind} data-testid="cal-off-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={p.checked(r)}
                      onChange={() => p.toggle(r)}
                      data-testid="cal-off-row-check"
                    />
                    <span className="paste-row-text">
                      <span className="cal-off-kind">{CAL_OFF_KIND_LABEL[r.kind]}</span> {r.text}
                    </span>
                  </label>
                </li>
              ) : (
                <li key={r.key} className="paste-row" data-state="ng" data-testid="cal-off-row">
                  <span className="paste-row-text">{r.text}</span>
                  <span className="paste-row-reason">{r.reason}</span>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </SidePanel>
  );
}

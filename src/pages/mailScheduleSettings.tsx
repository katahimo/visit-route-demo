// 管理者設定の「メールの予約送信」（PRD D366・D369。ADR-0069）：事業所の Google のスプレッドシート（GAS 付き）のひな型をコピーする
// リンクと手順、GAS の URL・合言葉・送る時刻の欄、「接続を試す」。設定はこの端末だけに残す（データの書き出し・読み込みに入らない）
import { CalendarClock, ExternalLink, PlugZap, Save, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react';
import { useConfirm } from '../components/ConfirmDialog';
import { DetailsFold } from '../components/DetailsFold';
import { FieldError, invalidAttrs } from '../components/FieldError';
import { useToast } from '../components/Toast';
import { Hint, WithIcon } from '../components/ui';
import { useMailSchedule } from '../components/useMailSchedule';
import {
  EMPTY_SETTINGS,
  GAS_TEMPLATE_URL,
  GAS_TRIGGER_MINUTES,
  type MailScheduleSettings,
  mailScheduleFailText,
  normalizeSettings,
  settingsErrors,
} from '../lib/mailSchedule';
import { mailStepsHeading } from '../lib/settingsView';

export function MailScheduleSettingsCard() {
  const ms = useMailSchedule();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const titleId = useId();
  const ids = { url: useId(), token: useId(), sendTime: useId() };
  const [form, setForm] = useState<MailScheduleSettings>(ms.settings);
  /** 保存・試すを押したあとだけ誤りを出す */
  const [shown, setShown] = useState(false);
  // 別のタブで変えたら欄も合わせる
  useEffect(() => {
    setForm(ms.settings);
  }, [ms.settings]);
  const fixed = normalizeSettings(form);
  const errs = shown ? settingsErrors(fixed) : {};
  const ok = Object.keys(settingsErrors(fixed)).length === 0;
  const set = (k: keyof MailScheduleSettings) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = (e?: FormEvent) => {
    e?.preventDefault();
    setShown(true);
    if (!ok) return;
    ms.saveSettings(fixed);
    toast('メールの予約送信の設定を保存しました（この端末だけ）');
  };
  const test = async () => {
    setShown(true);
    if (!ok) return;
    const r = await ms.ping(fixed);
    toast(
      r.ok
        ? `つながりました。${r.res.quota !== undefined ? `今日あと ${r.res.quota}件 送れます。` : ''}「保存」を押すと使えます`
        : `つながりませんでした。${mailScheduleFailText(r)}`,
    );
  };
  const clear = async () => {
    const yes = await confirmDialog({
      title: 'この端末の設定を消しますか？',
      body: '日の予定のメールの欄から予約できなくなります。Google のシートに預けた予約は消えません（シートで取り消せます）。',
      confirmLabel: '消す',
    });
    if (!yes) return;
    ms.saveSettings(EMPTY_SETTINGS);
    setForm(EMPTY_SETTINGS);
    setShown(false);
    toast('この端末の設定を消しました');
  };

  return (
    <section className="card stack" aria-labelledby={titleId} data-testid="mail-schedule-settings">
      <h2 id={titleId} className="feature-section-title">
        <CalendarClock size={18} aria-hidden="true" />
        メールの予約送信（Google）
        {ms.ready && <span className="feature-badge">つないでいます</span>}
      </h2>
      <div className="feature-desc-line">
        <span className="sub">
          日の予定のメールを、確定するときにまとめて事業所の Google のアカウントに預け、前日の決めた時刻に自動で送ります
        </span>
        <Hint ariaLabel="メールの予約送信の説明">
          <span data-testid="mail-schedule-notes">
            {`送るまでに${GAS_TRIGGER_MINUTES}分ほど遅れることがあります。予定・住所は事業所の Google のアカウント（スプレッドシート）を通ります。Google を使わないときは、今までどおり「メールを作る」でメールアプリから送れます。`}
          </span>
        </Hint>
      </div>
      <MailScheduleSteps />
      <form className="stack" onSubmit={save} noValidate>
        <label className="stack" style={{ gap: 4 }}>
          ウェブアプリの URL
          <input
            type="url"
            value={form.url}
            onChange={set('url')}
            placeholder="https://script.google.com/macros/s/…/exec"
            autoComplete="off"
            data-testid="mail-schedule-url"
            {...invalidAttrs(!!errs.url, ids.url)}
          />
          <FieldError id={ids.url} live={false}>
            {errs.url}
          </FieldError>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          合言葉
          <input
            type="password"
            value={form.token}
            onChange={set('token')}
            autoComplete="off"
            data-testid="mail-schedule-token"
            {...invalidAttrs(!!errs.token, ids.token)}
          />
          <FieldError id={ids.token} live={false}>
            {errs.token}
          </FieldError>
        </label>
        <label className="stack" style={{ gap: 4 }}>
          送る時刻（訪問の前日）
          <input
            type="time"
            value={form.sendTime}
            onChange={set('sendTime')}
            style={{ width: 'auto' }}
            data-testid="mail-schedule-time"
            {...invalidAttrs(!!errs.sendTime, ids.sendTime)}
          />
          <FieldError id={ids.sendTime} live={false}>
            {errs.sendTime}
          </FieldError>
        </label>
        <p className="sub">URL と合言葉はこの端末（ブラウザ）だけに残ります。データの書き出しには入りません。</p>
        <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            onClick={() => void test()}
            disabled={ms.busy}
            data-testid="mail-schedule-test"
          >
            <WithIcon icon={PlugZap}>接続を試す</WithIcon>
          </button>
          <button type="submit" className="btn" data-testid="mail-schedule-save">
            <WithIcon icon={Save}>保存</WithIcon>
          </button>
          {(ms.settings.url || ms.settings.token) && (
            <button
              type="button"
              className="btn btn-text"
              onClick={() => void clear()}
              data-testid="mail-schedule-clear"
            >
              <WithIcon icon={Trash2}>この端末の設定を消す</WithIcon>
            </button>
          )}
          {ms.busy && <span className="sub">Google とやりとりしています…</span>}
        </span>
      </form>
    </section>
  );
}

/** ひな型をコピーしてつなぐまでの手順（畳んで始める。開閉は覚えない。PRD D395。ひな型のリンクが無ければその旨） */
function MailScheduleSteps() {
  const steps: { key: string; body: ReactNode }[] = [
    {
      key: 'copy',
      body: (
        <>
          {GAS_TEMPLATE_URL ? (
            <a href={GAS_TEMPLATE_URL} target="_blank" rel="noopener noreferrer" data-testid="mail-schedule-template">
              <WithIcon icon={ExternalLink} size={14}>
                ひな型のスプレッドシートをコピー
              </WithIcon>
            </a>
          ) : (
            <span data-testid="mail-schedule-template">
              ひな型のスプレッドシートをコピー（コピー用のリンクはまだ用意されていません。提供元に聞いてください）
            </span>
          )}
          します。事業所の共用の Google のアカウントで開いてください。
        </>
      ),
    },
    {
      key: 'init',
      body: (
        <>
          コピーしたシートのメニュー「訪問予定 › 初期設定」を押し、許可します（「確認されていません」と出たら「詳細 ›
          移動」）。
        </>
      ),
    },
    {
      key: 'deploy',
      body: (
        <>
          Apps Script の「デプロイ › 新しいデプロイ ›
          ウェブアプリ」で、実行するユーザーを「自分」、アクセスできるユーザーを「全員」にします。
        </>
      ),
    },
    { key: 'paste', body: <>出た URL（…/exec）と、シートの「設定」の合言葉を下に貼り、「接続を試す」→「保存」。</> },
  ];
  return (
    <DetailsFold testId="mail-schedule-steps-fold" heading={mailStepsHeading(steps.length)}>
      <ol className="mail-schedule-steps">
        {steps.map((step) => (
          <li key={step.key}>{step.body}</li>
        ))}
      </ol>
    </DetailsFold>
  );
}

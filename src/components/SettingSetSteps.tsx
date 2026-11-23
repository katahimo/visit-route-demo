import { Download, Settings } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { firstRunBackupDone } from '../lib/firstRun';
import {
  SETTING_BACKUP_BUTTON,
  SETTING_RELEASE_LINE,
  SETTING_RELEASE_OPEN,
  SETTING_STEP_APPLY,
  SETTING_STEP_BACKUP,
  SETTING_STEP_CHANGES,
  settingSetBackupStep,
  settingSetStepsTitle,
} from '../lib/settingSets';
import { useDemoData } from '../store';
import { DialogShell } from './DialogShell';
import { ReleaseChanges } from './FirstRunPage';
import './firstRun.css';
import './settingSetSteps.css';
import { WithIcon } from './ui';
import { type BackupDownload, useBackupDownload } from './useBackupDownload';
import type { SettingSetPending } from './useSettingSetLink';

/**
 * 設定のひな形をリンクで適用する手順の画面（PRD D484〜D487。ADR-0122）：独自の確認ダイアログの殻（DialogShell。ADR-0026）に
 * ① データの控え（開いたときに自動で残した更新前の控えの時刻と［控えをファイルに書き出す］。書き出すまで［適用］を押せない。ADR-0113）
 * ② 変わる設定（今 → 適用後）③［取り消す］［適用］を1枚で出す。更新の知らせを出さずに開いたときは1行と［変わったことを見る］
 */
export function SettingSetSteps({
  pending,
  onApply,
  onCancel,
}: {
  pending: SettingSetPending;
  onApply: () => void;
  onCancel: () => void;
}) {
  const { releaseBackup, freshStart, releaseNotesAtOpen } = useDemoData();
  const downloadBackup = useBackupDownload();
  const [exported, setExported] = useState<BackupDownload | null>(null);
  const step = settingSetBackupStep({
    auto: releaseBackup,
    fresh: freshStart,
    exported: exported !== null && 'name' in exported,
  });
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const blockedId = useId();
  return (
    <DialogShell
      onCancel={onCancel}
      initialFocus={cancelRef}
      className="setting-steps"
      labelledBy={titleId}
      testId="setting-steps"
    >
      <div className="confirm-head">
        <span className="confirm-icon" aria-hidden="true">
          <Settings size={20} strokeWidth={2.2} />
        </span>
        <h2 id={titleId} data-testid="setting-steps-title">
          {settingSetStepsTitle(pending.set.label)}
        </h2>
      </div>
      {releaseNotesAtOpen.length > 0 && (
        <div className="setting-steps-release">
          <p>{SETTING_RELEASE_LINE}</p>
          <ReleaseChanges notes={releaseNotesAtOpen} summary={SETTING_RELEASE_OPEN} testId="setting-steps-release" />
        </div>
      )}
      <section className="setting-steps-step" data-testid="setting-steps-backup">
        <h3>{SETTING_STEP_BACKUP}</h3>
        <p data-testid="setting-steps-backup-lead">{step.lead}</p>
        {step.needsExport && (
          <>
            <button
              type="button"
              className="btn"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setExported(downloadBackup())}
              data-testid="setting-steps-export"
            >
              <WithIcon icon={Download}>{SETTING_BACKUP_BUTTON}</WithIcon>
            </button>
            <output className="setting-steps-result" data-testid="setting-steps-export-result">
              {exported === null ? '' : 'name' in exported ? firstRunBackupDone(exported.name) : exported.error}
            </output>
          </>
        )}
      </section>
      <section className="setting-steps-step" data-testid="setting-steps-changes">
        <h3>{SETTING_STEP_CHANGES}</h3>
        <p className="confirm-body" data-testid="setting-steps-body">
          {pending.body}
        </p>
      </section>
      <section className="setting-steps-step">
        <h3>{SETTING_STEP_APPLY}</h3>
        {step.blocked && (
          <p id={blockedId} className="setting-steps-blocked" data-testid="setting-steps-blocked">
            {step.blocked}
          </p>
        )}
        <div className="confirm-actions">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel} data-testid="setting-steps-cancel">
            取り消す
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!step.canApply}
            aria-describedby={step.blocked ? blockedId : undefined}
            onClick={onApply}
            data-testid="setting-steps-apply"
          >
            適用
          </button>
        </div>
      </section>
    </DialogShell>
  );
}

import { AlertTriangle, CheckCircle2, Cloud, GitCommitHorizontal, HardDrive, History, KeyRound, Link2, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { BackupCommit, BackupRemoteAuthMode, BackupRemoteProvider, BackupRemoteSetupMode, BackupRemoteStatus, BackupStatus, BackupSyncResult, BackupTimeline, ConfigureBackupRemoteInput, WorkspaceSnapshot } from '../../shared/types';
import { Copy, fillTemplate, getApi } from '../appModel';

const defaultRemoteForm: ConfigureBackupRemoteInput = {
  provider: 'github',
  remoteUrl: '',
  branch: 'main',
  authMode: 'system',
  username: '',
  token: ''
};

export function BackupView({
  snapshot,
  t,
  onRestore,
  onSnapshotChange
}: {
  snapshot: WorkspaceSnapshot;
  t: Copy;
  onRestore: (commitId: string) => Promise<void>;
  onSnapshotChange: (snapshot: WorkspaceSnapshot) => void;
}) {
  const [timeline, setTimeline] = useState<BackupTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupCommit | null>(null);
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);
  const [remoteForm, setRemoteForm] = useState<ConfigureBackupRemoteInput>(defaultRemoteForm);
  const [remoteTestStatus, setRemoteTestStatus] = useState<BackupRemoteStatus | null>(null);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);

  useEffect(() => {
    void loadTimeline();
  }, [snapshot.manifest.workspaceId]);

  async function loadTimeline() {
    setLoading(true);
    setError(null);
    try {
      const next = await getApi().listBackups(120);
      setTimeline(next);
      if (next.status.remote?.setupRequired) {
        setSetupDialogOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function createBackup() {
    setWorking(true);
    setError(null);
    try {
      await getApi().createBackup(t.backupManualCreated);
      await loadTimeline();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function syncRemote() {
    setWorking(true);
    setError(null);
    try {
      applySyncResult(await getApi().syncBackupRemote());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function clearRemote() {
    if (!window.confirm(t.backupRemoteClearConfirm)) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const status = await getApi().clearBackupRemote();
      setTimeline((current) => (current ? { ...current, status } : current));
      await loadTimeline();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function testRemote() {
    setWorking(true);
    setError(null);
    setRemoteTestStatus(null);
    try {
      setRemoteTestStatus(await getApi().testBackupRemote(remoteForm));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function configureRemote(event: FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    setRemoteTestStatus(null);
    try {
      const status = await getApi().configureBackupRemote(remoteForm);
      setTimeline((current) => (current ? { ...current, status } : current));
      setRemoteDialogOpen(false);
      if (status.remote?.setupRequired) {
        setSetupDialogOpen(true);
      }
      await loadTimeline();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function resolveRemoteSetup(mode: BackupRemoteSetupMode) {
    setWorking(true);
    setError(null);
    try {
      applySyncResult(await getApi().resolveBackupRemoteSetup(mode));
      setSetupDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  function applySyncResult(result: BackupSyncResult) {
    setTimeline(result.timeline);
    if (result.snapshot) {
      onSnapshotChange(result.snapshot);
    }
    if (result.status.remote?.setupRequired || result.action === 'blocked') {
      setSetupDialogOpen(true);
    }
  }

  async function confirmRestore() {
    if (!restoreTarget) {
      return;
    }
    const commitId = restoreTarget.commitId;
    setWorking(true);
    setError(null);
    setRestoreTarget(null);
    try {
      await onRestore(commitId);
      await loadTimeline();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  const status = timeline?.status;
  const remote = status?.remote;
  const commits = timeline?.commits ?? [];
  const latestCommitId = status?.lastBackupCommitId;
  const lastBackupDate = status?.lastBackupAt ? new Date(status.lastBackupAt) : null;
  const lastBackupText = lastBackupDate ? lastBackupDate.toLocaleString() : '-';
  const lastBackupTooltip = lastBackupDate ? formatFullBackupTime(lastBackupDate) : undefined;

  return (
    <article className="detail-view workspace-home-view backup-view">
      <header className="detail-header top-level-entry-header workspace-home-header">
        <div className="workspace-home-title">
          <p className="eyebrow">{t.backup}</p>
          <h2>{t.backupTimeline}</h2>
          <p className="detail-subtitle">{t.backupHelp}</p>
        </div>
        <div className="header-actions">
          <button className="detail-action-button" type="button" onClick={() => void loadTimeline()} disabled={loading || working} aria-label={t.backupRefresh} data-tooltip={t.backupRefresh}>
            <RefreshCw size={16} />
          </button>
          <button className="detail-action-button primary" type="button" onClick={() => void createBackup()} disabled={loading || working || status?.gitAvailable === false} aria-label={t.backupCreate} data-tooltip={t.backupCreate}>
            <HardDrive size={16} />
          </button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="workspace-home-stats" aria-label={t.backupStatus}>
        <BackupStat icon={status?.gitAvailable === false ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />} label={t.backupStatus} value={statusLabel(status, t)} />
        <BackupStat icon={<GitCommitHorizontal size={18} />} label={t.backupTimeline} value={commits.length} />
        <BackupStat icon={<History size={18} />} label={t.backupLastBackup} value={lastBackupText} tooltip={lastBackupTooltip} />
        <BackupStat icon={status?.hasChanges ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />} label={status?.hasChanges ? t.backupHasChanges : t.backupClean} value={status?.hasChanges ? '!' : 'OK'} />
      </section>

      {status?.gitAvailable === false ? (
        <section className="workspace-home-empty">
          <div className="workspace-home-empty-icon">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3>{t.backupUnavailable}</h3>
            <p>{status.error ?? t.backupGitUnavailable}</p>
          </div>
        </section>
      ) : (
        <>
          <RemoteBackupPanel
            remote={remote}
            disabled={loading || working}
            t={t}
            onConnect={() => {
              setRemoteForm(defaultRemoteForm);
              setRemoteTestStatus(null);
              setRemoteDialogOpen(true);
            }}
            onSync={() => void syncRemote()}
            onClear={() => void clearRemote()}
            onResolve={() => setSetupDialogOpen(true)}
          />

          <section className="workspace-home-section backup-timeline-section" aria-label={t.backupTimeline}>
            <div className="workspace-home-section-title">
              <h3>{t.backupTimeline}</h3>
              <small>{status?.backupPath ?? t.backupPath}</small>
            </div>
            <div className="backup-timeline">
              {loading ? <p className="workspace-home-muted-line">{t.loadingWorkspace}...</p> : null}
              {!loading && commits.length === 0 ? <p className="backup-empty-node">{t.backupNoCommits}</p> : null}
              {!loading
                ? commits.map((commit) => (
                    <BackupCommitRow
                      key={commit.commitId}
                      commit={commit}
                      current={commit.commitId === latestCommitId}
                      disabled={working}
                      t={t}
                      onRestore={() => setRestoreTarget(commit)}
                    />
                  ))
                : null}
            </div>
          </section>
        </>
      )}

      {remoteDialogOpen ? (
        <div className="app-confirm-backdrop" role="presentation" onMouseDown={() => setRemoteDialogOpen(false)}>
          <section className="app-confirm-dialog backup-remote-dialog" role="dialog" aria-modal="true" aria-labelledby="backup-remote-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="backup-remote-title">{t.backupRemoteConnect}</h2>
            <p>{t.backupRemoteConnectHelp}</p>
            <form className="backup-remote-form" onSubmit={configureRemote}>
              <label>
                <span>{t.backupRemoteProvider}</span>
                <select value={remoteForm.provider} onChange={(event) => setRemoteForm((current) => ({ ...current, provider: event.target.value as BackupRemoteProvider }))}>
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                  <option value="generic">{t.backupRemoteGeneric}</option>
                </select>
              </label>
              <label>
                <span>{t.backupRemoteBranch}</span>
                <input value={remoteForm.branch ?? 'main'} onChange={(event) => setRemoteForm((current) => ({ ...current, branch: event.target.value }))} placeholder="main" />
              </label>
              <label className="backup-remote-form-wide">
                <span>{t.backupRemoteUrl}</span>
                <input value={remoteForm.remoteUrl} onChange={(event) => setRemoteForm((current) => ({ ...current, remoteUrl: event.target.value }))} placeholder="https://github.com/user/mindline-backup.git" />
              </label>
              <label>
                <span>{t.backupRemoteAuth}</span>
                <select value={remoteForm.authMode} onChange={(event) => setRemoteForm((current) => ({ ...current, authMode: event.target.value as BackupRemoteAuthMode }))}>
                  <option value="system">{t.backupRemoteSystemAuth}</option>
                  <option value="pat">{t.backupRemotePatAuth}</option>
                </select>
              </label>
              {remoteForm.authMode === 'pat' ? (
                <>
                  <label>
                    <span>{t.backupRemoteUsername}</span>
                    <input value={remoteForm.username ?? ''} onChange={(event) => setRemoteForm((current) => ({ ...current, username: event.target.value }))} placeholder="git" />
                  </label>
                  <label className="backup-remote-form-wide">
                    <span>{t.backupRemoteToken}</span>
                    <input value={remoteForm.token ?? ''} onChange={(event) => setRemoteForm((current) => ({ ...current, token: event.target.value }))} type="password" placeholder={t.backupRemoteTokenPlaceholder} />
                  </label>
                </>
              ) : (
                <p className="backup-remote-note backup-remote-form-wide">
                  <KeyRound size={15} />
                  <span>{t.backupRemoteSshHelp}</span>
                </p>
              )}
              <p className="backup-remote-note backup-remote-form-wide">
                <ShieldCheck size={15} />
                <span>{remoteForm.provider === 'github' ? t.backupRemoteGithubScope : remoteForm.provider === 'gitlab' ? t.backupRemoteGitlabScope : t.backupRemoteGenericScope}</span>
              </p>
              {remoteTestStatus ? (
                <p className={`backup-remote-test backup-remote-form-wide ${remoteTestStatus.lastError ? 'error' : 'ok'}`}>
                  {remoteTestStatus.lastError ?? t.backupRemoteTestOk}
                </p>
              ) : null}
              <div className="app-confirm-actions backup-remote-form-wide">
                <button type="button" className="app-confirm-secondary" onClick={() => setRemoteDialogOpen(false)}>
                  {t.cancel}
                </button>
                <button type="button" className="app-confirm-secondary" onClick={() => void testRemote()} disabled={working || !remoteForm.remoteUrl.trim()}>
                  {t.backupRemoteTest}
                </button>
                <button type="submit" className="app-confirm-primary" disabled={working || !remoteForm.remoteUrl.trim()}>
                  {t.backupRemoteSave}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {setupDialogOpen && remote?.configured ? (
        <div className="app-confirm-backdrop" role="presentation" onMouseDown={() => setSetupDialogOpen(false)}>
          <section className="app-confirm-dialog backup-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="backup-remote-setup-title" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="backup-remote-setup-title">{t.backupRemoteSetupTitle}</h2>
            <p>{t.backupRemoteSetupHelp}</p>
            <code>{remote.remoteUrlLabel} · {remote.branch}</code>
            <div className="app-confirm-actions">
              <button type="button" className="app-confirm-secondary" onClick={() => setSetupDialogOpen(false)}>
                {t.cancel}
              </button>
              <button type="button" className="app-confirm-secondary" disabled={working} onClick={() => void resolveRemoteSetup('import-remote')}>
                {t.backupRemoteImport}
              </button>
              <button type="button" className="app-confirm-danger" disabled={working} onClick={() => void resolveRemoteSetup('overwrite-remote')}>
                {t.backupRemoteOverwrite}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {restoreTarget ? (
        <div className="app-confirm-backdrop" role="presentation" onMouseDown={() => setRestoreTarget(null)}>
          <section className="app-confirm-dialog backup-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="backup-restore-title" aria-describedby="backup-restore-description" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="backup-restore-title">{t.backupRestoreConfirmTitle}</h2>
            <p id="backup-restore-description">{t.backupRestoreConfirm}</p>
            <p>{t.backupRestoreSafety}</p>
            <code>{restoreTarget.shortId} · {restoreTarget.message}</code>
            <div className="app-confirm-actions">
              <button type="button" className="app-confirm-secondary" onClick={() => setRestoreTarget(null)}>
                {t.cancel}
              </button>
              <button type="button" className="app-confirm-danger" onClick={() => void confirmRestore()}>
                {t.backupRestore}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </article>
  );
}

function RemoteBackupPanel({
  remote,
  disabled,
  t,
  onConnect,
  onSync,
  onClear,
  onResolve
}: {
  remote?: BackupRemoteStatus;
  disabled: boolean;
  t: Copy;
  onConnect: () => void;
  onSync: () => void;
  onClear: () => void;
  onResolve: () => void;
}) {
  const configured = Boolean(remote?.configured);
  const state = remoteState(remote, t);
  return (
    <section className="workspace-home-section backup-remote-panel" aria-label={t.backupRemote}>
      <div className="backup-remote-header">
        <div>
          <p className="eyebrow">{t.backupRemote}</p>
          <h3>{configured ? t.backupRemoteConnected : t.backupRemoteNotConnected}</h3>
          <p>{configured ? remote?.remoteUrlLabel : t.backupRemoteEmptyHelp}</p>
        </div>
        <span className={`backup-remote-pill ${state.kind}`}>{state.label}</span>
      </div>
      <div className="backup-remote-grid">
        <BackupRemoteInfo icon={<Cloud size={17} />} label={t.backupRemoteProvider} value={remoteProviderLabel(remote?.provider, t)} />
        <BackupRemoteInfo icon={<Link2 size={17} />} label={t.backupRemoteBranch} value={remote?.branch ?? '-'} />
        <BackupRemoteInfo icon={<KeyRound size={17} />} label={t.backupRemoteAuth} value={remoteAuthLabel(remote?.authMode, t)} />
      </div>
      {remote?.lastError ? <p className="backup-remote-error">{remote.lastError}</p> : null}
      <div className="backup-remote-actions">
        <button type="button" className="app-confirm-secondary" onClick={onConnect} disabled={disabled}>
          {configured ? t.backupRemoteReconnect : t.backupRemoteConnect}
        </button>
        {configured ? (
          <>
            {remote?.setupRequired || remote?.diverged ? (
              <button type="button" className="app-confirm-secondary" onClick={onResolve} disabled={disabled}>
                {t.backupRemoteResolve}
              </button>
            ) : null}
            <button type="button" className="app-confirm-primary" onClick={onSync} disabled={disabled || remote?.setupRequired}>
              {t.backupRemoteSync}
            </button>
            <button type="button" className="app-confirm-secondary" onClick={onClear} disabled={disabled}>
              {t.backupRemoteClear}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}

function BackupRemoteInfo({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="backup-remote-info">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function BackupCommitRow({ commit, current, disabled, t, onRestore }: { commit: BackupCommit; current: boolean; disabled: boolean; t: Copy; onRestore: () => void }) {
  return (
    <div className={`backup-commit-row ${current ? 'current' : ''}`}>
      <span className="backup-commit-rail" aria-hidden="true">
        <span />
      </span>
      <div className="backup-commit-card">
        <div className="backup-commit-main">
          <strong>{commit.message}</strong>
          <small>{new Date(commit.createdAt).toLocaleString()} · {commit.shortId}</small>
        </div>
        <span className="backup-commit-files">{fillTemplate(t.backupFilesChanged, { count: commit.filesChanged })}</span>
        {current ? <span className="backup-current-pill">{t.backupCurrent}</span> : null}
        <button type="button" onClick={onRestore} disabled={disabled || current} aria-label={`${t.backupRestore}: ${commit.shortId}`}>
          <RotateCcw size={15} />
          {t.backupRestore}
        </button>
      </div>
    </div>
  );
}

function BackupStat({ icon, label, value, tooltip }: { icon: ReactNode; label: string; value: string | number; tooltip?: string }) {
  return (
    <div className="workspace-stat-card">
      <span className="workspace-stat-icon">{icon}</span>
      <span className="workspace-stat-value" data-tooltip={tooltip}>{value}</span>
      <span className="workspace-stat-label">{label}</span>
    </div>
  );
}

function formatFullBackupTime(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short'
  });
}

function statusLabel(status: BackupStatus | undefined, t: Copy): string {
  if (!status) {
    return '-';
  }
  if (!status.gitAvailable) {
    return t.backupUnavailable;
  }
  return status.initialized ? t.backupReady : t.backupUnavailable;
}

function remoteState(remote: BackupRemoteStatus | undefined, t: Copy): { kind: 'ok' | 'warn' | 'idle'; label: string } {
  if (!remote?.configured) {
    return { kind: 'idle', label: t.backupRemoteNotConnected };
  }
  if (remote.setupRequired || remote.diverged) {
    return { kind: 'warn', label: t.backupRemoteNeedsAction };
  }
  if ((remote.behind ?? 0) > 0) {
    return { kind: 'warn', label: fillTemplate(t.backupRemoteBehind, { count: remote.behind ?? 0 }) };
  }
  if ((remote.ahead ?? 0) > 0) {
    return { kind: 'warn', label: fillTemplate(t.backupRemoteAhead, { count: remote.ahead ?? 0 }) };
  }
  return { kind: 'ok', label: t.backupRemoteSynced };
}

function remoteProviderLabel(provider: BackupRemoteProvider | undefined, t: Copy): string {
  if (provider === 'github') {
    return 'GitHub';
  }
  if (provider === 'gitlab') {
    return 'GitLab';
  }
  if (provider === 'generic') {
    return t.backupRemoteGeneric;
  }
  return '-';
}

function remoteAuthLabel(authMode: BackupRemoteAuthMode | undefined, t: Copy): string {
  if (authMode === 'pat') {
    return t.backupRemotePatAuth;
  }
  if (authMode === 'system') {
    return t.backupRemoteSystemAuth;
  }
  return '-';
}

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  BackupCommit,
  BackupRemoteAuthMode,
  BackupRemoteConfig,
  BackupRemoteProvider,
  BackupRemoteSetupMode,
  BackupRemoteStatus,
  BackupStatus,
  BackupSyncResult,
  BackupTimeline,
  ConfigureBackupRemoteInput,
  Id
} from '../shared/types.js';
import { assertManifest } from '../shared/validation.js';
import { manifestPath } from './paths.js';

const execFileAsync = promisify(execFile);
const BACKUP_PATHS = ['.mindline', 'topics', 'phases'];
const REMOTE_NAME = 'mindline';
const DEFAULT_REMOTE_BRANCH = 'main';

interface BackupRemoteStore {
  version: 1;
  remotes: Record<Id, BackupRemoteConfig>;
}

interface RemoteSecret {
  token: string;
}

type RemoteInspection =
  | { type: 'empty' }
  | { type: 'compatible'; remoteRef: string }
  | { type: 'incompatible'; message: string };

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readWorkspaceId(workspacePath: string): Promise<Id> {
  const parsed = JSON.parse(await fs.readFile(manifestPath(workspacePath), 'utf8')) as unknown;
  assertManifest(parsed);
  return parsed.workspaceId;
}

function backupRepoName(workspaceId: Id): string {
  return workspaceId.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'workspace';
}

function gitIdentityArgs(repoPath: string, workspacePath: string, args: string[]): string[] {
  return ['--git-dir', repoPath, '--work-tree', workspacePath, ...args];
}

function now(): string {
  return new Date().toISOString();
}

function isBackupRemoteProvider(value: string): value is BackupRemoteProvider {
  return value === 'github' || value === 'gitlab' || value === 'generic';
}

function isBackupRemoteAuthMode(value: string): value is BackupRemoteAuthMode {
  return value === 'system' || value === 'pat';
}

function isBackupRemoteSetupMode(value: string): value is BackupRemoteSetupMode {
  return value === 'import-remote' || value === 'overwrite-remote';
}

function isSafeBranchName(value: string): boolean {
  return /^[A-Za-z0-9._/-]{1,100}$/.test(value) && !value.startsWith('-') && !value.includes('..') && !value.endsWith('/') && !value.includes('//');
}

function remoteRefFor(branch: string): string {
  return `refs/remotes/${REMOTE_NAME}/${branch}`;
}

function remoteHeadRefFor(branch: string): string {
  return `refs/heads/${branch}`;
}

function hasEmbeddedCredentials(remoteUrl: string): boolean {
  try {
    const parsed = new URL(remoteUrl);
    return Boolean(parsed.username || parsed.password);
  } catch {
    return /^https?:\/\/[^/\s:@]+:[^/\s@]+@/i.test(remoteUrl);
  }
}

function redactRemoteUrl(remoteUrl: string): string {
  try {
    const parsed = new URL(remoteUrl);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return remoteUrl.replace(/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/i, '$1');
  }
}

function parseRemoteHeads(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[1])
    .filter((entry): entry is string => Boolean(entry?.startsWith('refs/heads/')));
}

function normalizeGitError(error: unknown, token?: string): string {
  const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number };
  const raw = `${err.stderr ?? ''}\n${err.stdout ?? ''}\n${err.message ?? ''}`.trim();
  const message = token ? raw.replaceAll(token, '***') : raw;
  if (/Authentication failed|could not read Username|could not read Password|terminal prompts disabled|HTTP Basic: Access denied|403/i.test(message)) {
    return '远端认证失败，请检查 Personal Access Token、用户名或系统 Git 凭据。';
  }
  if (/Permission denied \(publickey\)|publickey|Could not read from remote repository/i.test(message)) {
    return 'SSH 认证失败，请确认 SSH key 已加入 ssh-agent，并且公钥已添加到 GitHub 或 GitLab。';
  }
  if (/Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i.test(message)) {
    return 'SSH 主机指纹校验失败，请先在系统终端确认远端主机身份。';
  }
  if (/Repository not found|not found|does not appear to be a git repository/i.test(message)) {
    return '远端仓库不存在或当前凭据无访问权限。';
  }
  if (/unable to access|Could not resolve host|Failed to connect|Connection timed out|Network is unreachable/i.test(message)) {
    return '无法连接远端仓库，请检查网络、仓库地址或私有 GitLab 域名。';
  }
  return message || '远端 Git 操作失败。';
}

export class GitBackupService {
  constructor(private readonly appHomePath: string) {}

  async getStatus(workspacePath: string): Promise<BackupStatus> {
    return this.withStatusFallback(workspacePath, async () => {
      if (!(await this.gitAvailable())) {
        return { gitAvailable: false, initialized: false, hasChanges: false, remote: await this.readRemoteStatus(workspacePath), error: '未检测到系统 Git，备份功能暂不可用。' };
      }
      await this.ensureInitialBackup(workspacePath);
      return this.readStatus(workspacePath);
    });
  }

  async createBackup(workspacePath: string, label = '手动备份'): Promise<BackupStatus> {
    return this.withStatusFallback(workspacePath, async () => {
      if (!(await this.gitAvailable())) {
        return { gitAvailable: false, initialized: false, hasChanges: false, remote: await this.readRemoteStatus(workspacePath), error: '未检测到系统 Git，备份功能暂不可用。' };
      }
      await this.ensureRepository(workspacePath);
      await this.commitCurrentState(workspacePath, label);
      return this.readStatus(workspacePath);
    });
  }

  async listBackups(workspacePath: string, limit = 80): Promise<BackupTimeline> {
    const status = await this.getStatus(workspacePath);
    if (!status.gitAvailable || !status.initialized || status.error || !status.lastBackupCommitId) {
      return { status, commits: [] };
    }

    const repoPath = await this.backupRepoPath(workspacePath);
    const { stdout } = await this.git(repoPath, workspacePath, ['log', `--max-count=${Math.max(1, Math.min(limit, 200))}`, '--date=iso-strict', '--pretty=format:%H%x1f%h%x1f%cI%x1f%P%x1f%s']);
    const commits = await Promise.all(
      stdout
        .split('\n')
        .filter(Boolean)
        .map(async (line) => {
          const [commitId, shortId, createdAt, parents, ...messageParts] = line.split('\x1f');
          const filesChanged = await this.changedFileCount(repoPath, workspacePath, commitId);
          return {
            commitId,
            shortId,
            createdAt,
            parentIds: parents ? parents.split(' ').filter(Boolean) : [],
            message: messageParts.join('\x1f'),
            filesChanged
          } satisfies BackupCommit;
        })
    );
    return { status, commits };
  }

  async restoreBackup(workspacePath: string, commitId: string): Promise<void> {
    if (!/^[0-9a-f]{7,40}$/i.test(commitId)) {
      throw new Error('备份点参数无效。');
    }
    if (!(await this.gitAvailable())) {
      throw new Error('未检测到系统 Git，无法恢复备份。');
    }

    await this.ensureRepository(workspacePath);
    const repoPath = await this.backupRepoPath(workspacePath);
    await this.git(repoPath, workspacePath, ['rev-parse', '--verify', `${commitId}^{commit}`]);
    await this.commitCurrentState(workspacePath, '恢复前自动备份');
    const { stdout } = await this.git(repoPath, workspacePath, ['rev-parse', '--short', commitId]);
    const shortId = stdout.trim();
    await this.git(repoPath, workspacePath, ['restore', `--source=${commitId}`, '--staged', '--worktree', '--', ':/']);
    await this.commitCurrentState(workspacePath, `恢复到备份 ${shortId}`);
  }

  async getRemoteStatus(workspacePath: string): Promise<BackupRemoteStatus> {
    return this.readRemoteStatus(workspacePath);
  }

  async testRemote(workspacePath: string, input: ConfigureBackupRemoteInput): Promise<BackupRemoteStatus> {
    const config = this.normalizeRemoteInput(input);
    if (!(await this.gitAvailable())) {
      return this.remoteStatusFromConfig(config, false, { lastError: '未检测到系统 Git，无法连接远端仓库。' });
    }
    try {
      await this.ensureRepository(workspacePath);
      const repoPath = await this.backupRepoPath(workspacePath);
      const inspection = await this.inspectRemote(workspacePath, repoPath, config, input.token?.trim());
      if (inspection.type === 'incompatible') {
        return this.remoteStatusFromConfig(config, false, { lastError: inspection.message });
      }
      return this.remoteStatusFromConfig(config, false, { remoteReady: true, setupRequired: inspection.type === 'compatible' });
    } catch (error) {
      return this.remoteStatusFromConfig(config, false, { lastError: error instanceof Error ? error.message : String(error) });
    }
  }

  async configureRemote(workspacePath: string, input: ConfigureBackupRemoteInput): Promise<BackupStatus> {
    if (!(await this.gitAvailable())) {
      throw new Error('未检测到系统 Git，无法连接远端仓库。');
    }
    const config = this.normalizeRemoteInput(input);
    const workspaceId = await readWorkspaceId(workspacePath);
    await this.ensureInitialBackup(workspacePath);
    if (config.authMode === 'pat' && !input.token?.trim() && !(await this.readRemoteToken(workspaceId))) {
      throw new Error('Personal Access Token 不能为空。');
    }

    const repoPath = await this.backupRepoPath(workspacePath);
    const inspection = await this.inspectRemote(workspacePath, repoPath, config, input.token?.trim());
    if (inspection.type === 'incompatible') {
      throw new Error(inspection.message);
    }

    await this.ensureRemoteSecret(workspaceId, config, input.token);
    await this.saveRemoteConfig(workspaceId, { ...config, setupRequired: inspection.type === 'compatible' });
    await this.setRemoteUrl(repoPath, workspacePath, config.remoteUrl);

    if (inspection.type === 'empty') {
      const syncedAt = now();
      await this.pushRemote(workspacePath, repoPath, { ...config, lastSyncAt: syncedAt }, false);
      await this.saveRemoteConfig(workspaceId, { ...config, lastSyncAt: syncedAt, setupRequired: false });
    }

    return this.readStatus(workspacePath);
  }

  async clearRemote(workspacePath: string): Promise<BackupStatus> {
    const workspaceId = await readWorkspaceId(workspacePath);
    const store = await this.readRemoteStore();
    delete store.remotes[workspaceId];
    await this.writeRemoteStore(store);
    await fs.rm(this.remoteSecretPath(workspaceId), { force: true });
    const repoPath = await this.backupRepoPath(workspacePath).catch(() => undefined);
    if (repoPath && (await exists(path.join(repoPath, 'config')))) {
      await this.gitAllowFailure(repoPath, workspacePath, ['remote', 'remove', REMOTE_NAME]);
    }
    return this.readStatus(workspacePath);
  }

  async syncRemote(workspacePath: string): Promise<BackupSyncResult> {
    const config = await this.requireRemoteConfig(workspacePath);
    if (!(await this.gitAvailable())) {
      throw new Error('未检测到系统 Git，无法同步远端仓库。');
    }

    await this.ensureInitialBackup(workspacePath);
    const repoPath = await this.backupRepoPath(workspacePath);
    await this.setRemoteUrl(repoPath, workspacePath, config.remoteUrl);

    const inspection = await this.inspectRemote(workspacePath, repoPath, config);
    if (inspection.type === 'incompatible') {
      throw new Error(inspection.message);
    }
    if (inspection.type === 'empty') {
      const syncedAt = now();
      await this.pushRemote(workspacePath, repoPath, { ...config, lastSyncAt: syncedAt }, false);
      await this.updateRemoteConfig(workspacePath, { ...config, lastSyncAt: syncedAt, setupRequired: false });
      return this.syncResult(workspacePath, 'published', '已发布本地备份到远端。');
    }

    const divergence = await this.readDivergence(repoPath, workspacePath, inspection.remoteRef);
    if (divergence.ahead > 0 && divergence.behind > 0) {
      return this.syncResult(workspacePath, 'blocked', '本地和远端备份都发生了变化，请先选择保留哪一端。');
    }
    if (divergence.behind > 0) {
      const previousWorkspaceId = await readWorkspaceId(workspacePath);
      await this.git(repoPath, workspacePath, ['reset', '--hard', inspection.remoteRef]);
      await this.migrateImportedWorkspaceIdentity(workspacePath, previousWorkspaceId, repoPath);
      const syncedAt = now();
      await this.updateRemoteConfig(workspacePath, { ...config, lastSyncAt: syncedAt, setupRequired: false });
      return this.syncResult(workspacePath, 'pulled', '已从远端同步备份。', true);
    }
    if (divergence.ahead > 0) {
      const syncedAt = now();
      await this.pushRemote(workspacePath, repoPath, { ...config, lastSyncAt: syncedAt }, false);
      await this.updateRemoteConfig(workspacePath, { ...config, lastSyncAt: syncedAt, setupRequired: false });
      return this.syncResult(workspacePath, 'pushed', '已推送本地备份到远端。');
    }

    const syncedAt = now();
    await this.updateRemoteConfig(workspacePath, { ...config, lastSyncAt: syncedAt, setupRequired: false });
    return this.syncResult(workspacePath, 'none', '本地和远端已保持一致。');
  }

  async resolveRemoteSetup(workspacePath: string, mode: BackupRemoteSetupMode): Promise<BackupSyncResult> {
    if (!isBackupRemoteSetupMode(mode)) {
      throw new Error('远端初始化方式无效。');
    }
    const config = await this.requireRemoteConfig(workspacePath);
    if (!(await this.gitAvailable())) {
      throw new Error('未检测到系统 Git，无法同步远端仓库。');
    }
    await this.ensureInitialBackup(workspacePath);
    const repoPath = await this.backupRepoPath(workspacePath);
    await this.setRemoteUrl(repoPath, workspacePath, config.remoteUrl);
    const inspection = await this.inspectRemote(workspacePath, repoPath, config);
    if (inspection.type === 'incompatible') {
      throw new Error(inspection.message);
    }
    if (inspection.type === 'empty') {
      const syncedAt = now();
      await this.pushRemote(workspacePath, repoPath, { ...config, lastSyncAt: syncedAt }, false);
      await this.updateRemoteConfig(workspacePath, { ...config, lastSyncAt: syncedAt, setupRequired: false });
      return this.syncResult(workspacePath, 'published', '已发布本地备份到远端。');
    }

    if (mode === 'overwrite-remote') {
      const syncedAt = now();
      await this.pushRemote(workspacePath, repoPath, { ...config, lastSyncAt: syncedAt }, true);
      await this.updateRemoteConfig(workspacePath, { ...config, lastSyncAt: syncedAt, setupRequired: false });
      return this.syncResult(workspacePath, 'pushed', '已用本地备份覆盖远端。');
    }

    await this.commitCurrentState(workspacePath, '导入远端前自动备份');
    const previousWorkspaceId = await readWorkspaceId(workspacePath);
    await this.createSafetyRef(repoPath, workspacePath, 'pre-remote-import');
    await this.git(repoPath, workspacePath, ['reset', '--hard', inspection.remoteRef]);
    await this.migrateImportedWorkspaceIdentity(workspacePath, previousWorkspaceId, repoPath);
    const syncedAt = now();
    await this.updateRemoteConfig(workspacePath, { ...config, lastSyncAt: syncedAt, setupRequired: false });
    return this.syncResult(workspacePath, 'pulled', '已导入远端备份。', true);
  }

  private async withStatusFallback(workspacePath: string, action: () => Promise<BackupStatus>): Promise<BackupStatus> {
    try {
      return await action();
    } catch (error) {
      const repoPath = await this.backupRepoPath(workspacePath).catch(() => undefined);
      const initialized = repoPath ? await this.hasHead(repoPath, workspacePath).catch(() => false) : false;
      return {
        gitAvailable: true,
        initialized,
        hasChanges: false,
        backupPath: repoPath,
        remote: await this.readRemoteStatus(workspacePath).catch(() => ({ configured: false })),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async gitAvailable(): Promise<boolean> {
    try {
      await execFileAsync('git', ['--version']);
      return true;
    } catch {
      return false;
    }
  }

  private async backupRepoPath(workspacePath: string): Promise<string> {
    return this.backupRepoPathForWorkspaceId(await readWorkspaceId(workspacePath));
  }

  private backupRepoPathForWorkspaceId(workspaceId: Id): string {
    return path.join(this.appHomePath, 'backups', `${backupRepoName(workspaceId)}.git`);
  }

  private async ensureInitialBackup(workspacePath: string): Promise<void> {
    await this.ensureRepository(workspacePath);
    const repoPath = await this.backupRepoPath(workspacePath);
    if (!(await this.hasHead(repoPath, workspacePath))) {
      await this.commitCurrentState(workspacePath, '初始化备份');
    }
  }

  private async ensureRepository(workspacePath: string): Promise<void> {
    const repoPath = await this.backupRepoPath(workspacePath);
    if (!(await exists(path.join(repoPath, 'HEAD')))) {
      await fs.mkdir(path.dirname(repoPath), { recursive: true });
      await execFileAsync('git', gitIdentityArgs(repoPath, workspacePath, ['init']));
    }
    await this.git(repoPath, workspacePath, ['config', 'user.name', 'Mindline']);
    await this.git(repoPath, workspacePath, ['config', 'user.email', 'mindline.local@example.invalid']);
  }

  private async readStatus(workspacePath: string): Promise<BackupStatus> {
    const repoPath = await this.backupRepoPath(workspacePath);
    const initialized = await this.hasHead(repoPath, workspacePath);
    const trackedPaths = await this.existingBackupPaths(workspacePath);
    const statusOutput = initialized ? (await this.git(repoPath, workspacePath, ['status', '--porcelain=v1', '--', ...trackedPaths])).stdout : '';
    const lastCommit = initialized ? await this.latestCommit(repoPath, workspacePath) : undefined;
    return {
      gitAvailable: true,
      initialized,
      hasChanges: statusOutput.trim().length > 0,
      backupPath: repoPath,
      lastBackupAt: lastCommit?.createdAt,
      lastBackupCommitId: lastCommit?.commitId,
      remote: await this.readRemoteStatus(workspacePath)
    };
  }

  private async commitCurrentState(workspacePath: string, label: string): Promise<void> {
    const repoPath = await this.backupRepoPath(workspacePath);
    const trackedPaths = await this.existingBackupPaths(workspacePath);
    if (trackedPaths.length === 0) {
      return;
    }
    await this.git(repoPath, workspacePath, ['add', '-A', '--', ...trackedPaths]);
    const { stdout: statusOutput } = await this.git(repoPath, workspacePath, ['status', '--porcelain=v1', '--', ...trackedPaths]);
    const hasHead = await this.hasHead(repoPath, workspacePath);
    const { stdout: cachedFiles } = hasHead ? { stdout: '' } : await this.git(repoPath, workspacePath, ['ls-files', '--cached', '--', ...trackedPaths]);
    if (!statusOutput.trim() && !(cachedFiles.trim() && !hasHead)) {
      return;
    }
    await this.git(repoPath, workspacePath, ['commit', '-m', label]);
  }

  private async hasHead(repoPath: string, workspacePath: string): Promise<boolean> {
    const result = await this.gitAllowFailure(repoPath, workspacePath, ['rev-parse', '--verify', 'HEAD^{commit}']);
    return result.code === 0;
  }

  private async latestCommit(repoPath: string, workspacePath: string): Promise<{ commitId: Id; createdAt: string } | undefined> {
    const result = await this.gitAllowFailure(repoPath, workspacePath, ['log', '-1', '--pretty=format:%H%x1f%cI']);
    if (result.code !== 0 || !result.stdout.trim()) {
      return undefined;
    }
    const [commitId, createdAt] = result.stdout.trim().split('\x1f');
    return { commitId, createdAt };
  }

  private async changedFileCount(repoPath: string, workspacePath: string, commitId: string): Promise<number> {
    const trackedPaths = await this.existingBackupPaths(workspacePath);
    const { stdout } = await this.git(repoPath, workspacePath, ['show', '--name-only', '--pretty=format:', commitId, '--', ...trackedPaths]);
    return new Set(stdout.split('\n').map((entry) => entry.trim()).filter(Boolean)).size;
  }

  private async existingBackupPaths(workspacePath: string): Promise<string[]> {
    const existingPaths: string[] = [];
    for (const relativePath of BACKUP_PATHS) {
      if (await exists(path.join(workspacePath, relativePath))) {
        existingPaths.push(relativePath);
      }
    }
    return existingPaths;
  }

  private normalizeRemoteInput(input: ConfigureBackupRemoteInput): BackupRemoteConfig {
    const provider = isBackupRemoteProvider(input.provider) ? input.provider : 'generic';
    const authMode = isBackupRemoteAuthMode(input.authMode) ? input.authMode : 'system';
    const remoteUrl = input.remoteUrl.trim();
    const branch = (input.branch?.trim() || DEFAULT_REMOTE_BRANCH).replace(/^refs\/heads\//, '');
    const username = input.username?.trim();
    if (!remoteUrl || /\s/.test(remoteUrl)) {
      throw new Error('远端仓库地址不能为空，也不能包含空格。');
    }
    if (hasEmbeddedCredentials(remoteUrl)) {
      throw new Error('远端仓库地址不能包含用户名、密码或 token。请把 token 填入单独的访问令牌输入框。');
    }
    if (!isSafeBranchName(branch)) {
      throw new Error('远端分支名无效。');
    }
    return {
      provider,
      remoteUrl,
      branch,
      authMode,
      username: username || (authMode === 'pat' ? 'git' : undefined)
    };
  }

  private remoteConfigPath(): string {
    return path.join(this.appHomePath, 'backup-remotes', 'config.json');
  }

  private remoteSecretsDir(): string {
    return path.join(this.appHomePath, 'backup-remotes', 'secrets');
  }

  private remoteSecretPath(workspaceId: Id): string {
    return path.join(this.remoteSecretsDir(), `${backupRepoName(workspaceId)}.json`);
  }

  private async readRemoteStore(): Promise<BackupRemoteStore> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.remoteConfigPath(), 'utf8')) as Partial<BackupRemoteStore>;
      return { version: 1, remotes: parsed.version === 1 && parsed.remotes && typeof parsed.remotes === 'object' ? parsed.remotes : {} };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { version: 1, remotes: {} };
      }
      throw error;
    }
  }

  private async writeRemoteStore(store: BackupRemoteStore): Promise<void> {
    await fs.mkdir(path.dirname(this.remoteConfigPath()), { recursive: true });
    await fs.writeFile(this.remoteConfigPath(), `${JSON.stringify(store, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  }

  private async readRemoteConfig(workspacePath: string): Promise<{ workspaceId: Id; config?: BackupRemoteConfig }> {
    const workspaceId = await readWorkspaceId(workspacePath);
    const store = await this.readRemoteStore();
    return { workspaceId, config: store.remotes[workspaceId] };
  }

  private async requireRemoteConfig(workspacePath: string): Promise<BackupRemoteConfig> {
    const { config } = await this.readRemoteConfig(workspacePath);
    if (!config) {
      throw new Error('还没有连接远端备份仓库。');
    }
    return config;
  }

  private async saveRemoteConfig(workspaceId: Id, config: BackupRemoteConfig): Promise<void> {
    const store = await this.readRemoteStore();
    store.remotes[workspaceId] = config;
    await this.writeRemoteStore(store);
  }

  private async updateRemoteConfig(workspacePath: string, config: BackupRemoteConfig): Promise<void> {
    await this.saveRemoteConfig(await readWorkspaceId(workspacePath), config);
  }

  private async ensureRemoteSecret(workspaceId: Id, config: BackupRemoteConfig, token?: string): Promise<void> {
    if (config.authMode !== 'pat') {
      await fs.rm(this.remoteSecretPath(workspaceId), { force: true });
      return;
    }
    const trimmed = token?.trim();
    if (trimmed) {
      await fs.mkdir(this.remoteSecretsDir(), { recursive: true });
      await fs.writeFile(this.remoteSecretPath(workspaceId), `${JSON.stringify({ token: trimmed }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      return;
    }
    if (!(await exists(this.remoteSecretPath(workspaceId)))) {
      throw new Error('Personal Access Token 不能为空。');
    }
  }

  private async readRemoteToken(workspaceId: Id): Promise<string | undefined> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.remoteSecretPath(workspaceId), 'utf8')) as Partial<RemoteSecret>;
      return typeof parsed.token === 'string' && parsed.token ? parsed.token : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  private async readRemoteStatus(workspacePath: string): Promise<BackupRemoteStatus> {
    const { workspaceId, config } = await this.readRemoteConfig(workspacePath);
    if (!config) {
      return { configured: false };
    }
    const hasToken = config.authMode === 'pat' ? Boolean(await this.readRemoteToken(workspaceId)) : undefined;
    const base = this.remoteStatusFromConfig(config, true, { hasToken, setupRequired: config.setupRequired ?? false });
    const repoPath = await this.backupRepoPath(workspacePath).catch(() => undefined);
    if (!repoPath || !(await exists(path.join(repoPath, 'HEAD')))) {
      return base;
    }
    const ref = remoteRefFor(config.branch);
    if (!(await this.refExists(repoPath, workspacePath, ref))) {
      return base;
    }
    const divergence = await this.readDivergence(repoPath, workspacePath, ref).catch(() => undefined);
    if (!divergence) {
      return base;
    }
    return {
      ...base,
      ahead: divergence.ahead,
      behind: divergence.behind,
      diverged: divergence.ahead > 0 && divergence.behind > 0
    };
  }

  private remoteStatusFromConfig(config: BackupRemoteConfig, configured: boolean, extra: Partial<BackupRemoteStatus> = {}): BackupRemoteStatus {
    return {
      configured,
      provider: config.provider,
      remoteUrlLabel: redactRemoteUrl(config.remoteUrl),
      branch: config.branch,
      authMode: config.authMode,
      lastSyncAt: config.lastSyncAt,
      ...extra
    };
  }

  private async inspectRemote(workspacePath: string, repoPath: string, config: BackupRemoteConfig, tokenOverride?: string): Promise<RemoteInspection> {
    const { stdout } = await this.gitWithRemoteAuth(repoPath, workspacePath, config, ['ls-remote', '--heads', config.remoteUrl], tokenOverride);
    const heads = parseRemoteHeads(stdout);
    if (heads.length === 0) {
      return { type: 'empty' };
    }
    const targetHead = remoteHeadRefFor(config.branch);
    if (!heads.includes(targetHead)) {
      return { type: 'incompatible', message: `远端仓库已有内容，但没有 ${config.branch} 分支。请使用空仓库，或选择已有 Mindline 备份分支。` };
    }
    const ref = remoteRefFor(config.branch);
    await this.gitWithRemoteAuth(repoPath, workspacePath, config, ['fetch', config.remoteUrl, `+${targetHead}:${ref}`], tokenOverride);
    const compatible = await this.isCompatibleRemoteTree(repoPath, workspacePath, ref);
    if (!compatible) {
      return { type: 'incompatible', message: '远端分支不是 Mindline 备份仓库。为避免覆盖项目代码，请换用空仓库或专用备份仓库。' };
    }
    return { type: 'compatible', remoteRef: ref };
  }

  private async isCompatibleRemoteTree(repoPath: string, workspacePath: string, ref: string): Promise<boolean> {
    const { stdout } = await this.git(repoPath, workspacePath, ['ls-tree', '-r', '--name-only', ref]);
    const files = stdout.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!files.includes('.mindline/manifest.json')) {
      return false;
    }
    return files.every((file) => BACKUP_PATHS.some((backupPath) => file === backupPath || file.startsWith(`${backupPath}/`)));
  }

  private async setRemoteUrl(repoPath: string, workspacePath: string, remoteUrl: string): Promise<void> {
    const current = await this.gitAllowFailure(repoPath, workspacePath, ['remote', 'get-url', REMOTE_NAME]);
    if (current.code === 0) {
      await this.git(repoPath, workspacePath, ['remote', 'set-url', REMOTE_NAME, remoteUrl]);
    } else {
      await this.git(repoPath, workspacePath, ['remote', 'add', REMOTE_NAME, remoteUrl]);
    }
  }

  private async pushRemote(workspacePath: string, repoPath: string, config: BackupRemoteConfig, forceWithLease: boolean): Promise<void> {
    await this.setRemoteUrl(repoPath, workspacePath, config.remoteUrl);
    await this.gitWithRemoteAuth(repoPath, workspacePath, config, ['push', ...(forceWithLease ? ['--force-with-lease'] : []), REMOTE_NAME, `HEAD:${remoteHeadRefFor(config.branch)}`]);
  }

  private async readDivergence(repoPath: string, workspacePath: string, ref: string): Promise<{ ahead: number; behind: number }> {
    const { stdout } = await this.git(repoPath, workspacePath, ['rev-list', '--left-right', '--count', `HEAD...${ref}`]);
    const [aheadText, behindText] = stdout.trim().split(/\s+/);
    return { ahead: Number(aheadText || 0), behind: Number(behindText || 0) };
  }

  private async refExists(repoPath: string, workspacePath: string, ref: string): Promise<boolean> {
    const result = await this.gitAllowFailure(repoPath, workspacePath, ['rev-parse', '--verify', `${ref}^{commit}`]);
    return result.code === 0;
  }

  private async createSafetyRef(repoPath: string, workspacePath: string, label: string): Promise<void> {
    const current = await this.gitAllowFailure(repoPath, workspacePath, ['rev-parse', '--verify', 'HEAD']);
    if (current.code !== 0 || !current.stdout.trim()) {
      return;
    }
    const safeLabel = label.replace(/[^a-zA-Z0-9._-]+/g, '-');
    await this.git(repoPath, workspacePath, ['update-ref', `refs/mindline/safety/${safeLabel}-${Date.now()}`, current.stdout.trim()]);
  }

  private async migrateImportedWorkspaceIdentity(workspacePath: string, previousWorkspaceId: Id, previousRepoPath: string): Promise<void> {
    const nextWorkspaceId = await readWorkspaceId(workspacePath);
    if (nextWorkspaceId === previousWorkspaceId) {
      return;
    }
    const nextRepoPath = this.backupRepoPathForWorkspaceId(nextWorkspaceId);
    if (nextRepoPath !== previousRepoPath) {
      if (await exists(nextRepoPath)) {
        await fs.rename(nextRepoPath, `${nextRepoPath}.pre-import-${Date.now()}`);
      }
      await fs.mkdir(path.dirname(nextRepoPath), { recursive: true });
      await fs.rename(previousRepoPath, nextRepoPath);
    }

    const store = await this.readRemoteStore();
    const previousConfig = store.remotes[previousWorkspaceId];
    if (previousConfig) {
      store.remotes[nextWorkspaceId] = previousConfig;
      delete store.remotes[previousWorkspaceId];
      await this.writeRemoteStore(store);
    }
    const previousSecret = this.remoteSecretPath(previousWorkspaceId);
    const nextSecret = this.remoteSecretPath(nextWorkspaceId);
    if ((await exists(previousSecret)) && !(await exists(nextSecret))) {
      await fs.mkdir(path.dirname(nextSecret), { recursive: true });
      await fs.rename(previousSecret, nextSecret);
    }
  }

  private async syncResult(workspacePath: string, action: BackupSyncResult['action'], message: string, appliedRemoteChanges = false): Promise<BackupSyncResult> {
    const timeline = await this.listBackups(workspacePath);
    return {
      status: timeline.status,
      timeline,
      action,
      message,
      appliedRemoteChanges
    };
  }

  private async git(repoPath: string, workspacePath: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync('git', gitIdentityArgs(repoPath, workspacePath, args));
  }

  private async gitWithRemoteAuth(repoPath: string, workspacePath: string, config: BackupRemoteConfig, args: string[], tokenOverride?: string): Promise<{ stdout: string; stderr: string }> {
    const workspaceId = await readWorkspaceId(workspacePath);
    const token = config.authMode === 'pat' ? tokenOverride || await this.readRemoteToken(workspaceId) : undefined;
    let askPassDir: string | undefined;
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
    if (config.authMode === 'pat') {
      if (!token) {
        throw new Error('Personal Access Token 不能为空。');
      }
      askPassDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mindline-git-askpass-'));
      const askPassPath = path.join(askPassDir, process.platform === 'win32' ? 'askpass.cmd' : 'askpass.sh');
      const script =
        process.platform === 'win32'
          ? '@echo off\r\n' + 'echo %1 | findstr /i "Username" >nul\r\n' + 'if %errorlevel%==0 (echo %MINDLINE_GIT_USERNAME%) else (echo %MINDLINE_GIT_TOKEN%)\r\n'
          : '#!/bin/sh\n' + 'case "$1" in\n' + '  *Username*|*username*) printf "%s\\n" "$MINDLINE_GIT_USERNAME" ;;\n' + '  *) printf "%s\\n" "$MINDLINE_GIT_TOKEN" ;;\n' + 'esac\n';
      await fs.writeFile(askPassPath, script, { encoding: 'utf8', mode: 0o700 });
      env.GIT_ASKPASS = askPassPath;
      env.MINDLINE_GIT_USERNAME = config.username || 'git';
      env.MINDLINE_GIT_TOKEN = token;
    }
    try {
      return await execFileAsync('git', gitIdentityArgs(repoPath, workspacePath, args), { env });
    } catch (error) {
      throw new Error(normalizeGitError(error, token));
    } finally {
      if (askPassDir) {
        await fs.rm(askPassDir, { recursive: true, force: true });
      }
    }
  }

  private async gitAllowFailure(repoPath: string, workspacePath: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    try {
      const result = await this.git(repoPath, workspacePath, args);
      return { code: 0, ...result };
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number };
      return { code: typeof err.code === 'number' ? err.code : 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
  }
}

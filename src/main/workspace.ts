import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TEXT_ATTACHMENT_MAX_BYTES, TEXT_ATTACHMENT_MAX_COUNT, TEXT_ATTACHMENT_MAX_TOTAL_BYTES, isSensitiveTextAttachmentName, isSupportedTextAttachment, looksLikeUtf8Text } from '../shared/attachmentPolicy.js';
import { buildSelectionContext, buildSelectionExportMarkdown, uniqueSourceRefs } from '../shared/cart.js';
import { randomPhaseIcon } from '../shared/phaseIcons.js';
import type {
  CreateMessageInput,
  AddModelProviderInput,
  BackupRemoteSetupMode,
  BackupRemoteStatus,
  BackupSyncResult,
  BackupStatus,
  BackupTimeline,
  ConfigureBackupRemoteInput,
  CreatePhaseInput,
  CreateTopicInput,
  CreateWorkspaceInput,
  DiscussionResult,
  Id,
  Message,
  MarkdownExportAsset,
  MarkdownExportResult,
  MessageAttachment,
  MessageAttachmentInput,
  Phase,
  SelectionCartItem,
  Summary,
  Topic,
  UpdatePhaseInput,
  UpdateModelProviderInput,
  UpdateTopicInput,
  WorkspaceManifest,
  WorkspaceSnapshot,
  ModelRunOptions,
  ModelAdapter
} from '../shared/types.js';
import { DEFAULT_PHASE_ID } from '../shared/types.js';
import { assertManifest, assertPhase, assertTopic } from '../shared/validation.js';
import { createModelAdapter } from './modelAdapter.js';
import { GitBackupService } from './gitBackup.js';
import { ModelProviderService } from './modelProviders.js';
import { legacyModelProviderSecretPath, legacyModelProviderSecretsDir, legacyModelProvidersPath, messagesPath, manifestPath, modelProviderSecretPath, modelProviderSecretsDir, modelProviderSettingsDir, modelProvidersPath, phaseDir, phaseJsonPath, phaseSummaryPath, topicDir, topicJsonPath, topicSummaryPath, topicsRootDir } from './paths.js';
import { parseMessages, parseSummary, serializeMessage, serializePhaseExport, serializeSummary, serializeTopicExport } from './markdown.js';

type ModelAdapterFactory = (workspacePath: string, modelProviderService: ModelProviderService, providerId?: Id, projectPath?: string) => Promise<ModelAdapter>;

async function activeProviderAdapterFactory(workspacePath: string, modelProviderService: ModelProviderService, providerId?: Id, projectPath?: string): Promise<ModelAdapter> {
  const active = providerId ? await modelProviderService.getProviderWithSecret(workspacePath, providerId) : await modelProviderService.getActiveProviderWithSecret(workspacePath);
  if (!active) {
    throw new Error(providerId ? '选中的模型供应商不存在或已停用，请重新选择。' : '请先在设置中添加并启用一个真实模型供应商。');
  }
  return createModelAdapter(active.provider, active.apiKey, projectPath);
}

function now(): string {
  return new Date().toISOString();
}

function defaultPhaseFallbackTitle(language: 'zh' | 'en' = 'en'): string {
  return language === 'zh' ? '默认阶段' : 'Default phase';
}

function slugifySegment(value: string, fallback: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

function uniqueSlug(baseSlug: string, takenSlugs: Set<string>, currentSlug?: string): string {
  if (currentSlug === baseSlug) {
    return currentSlug;
  }
  if (!takenSlugs.has(baseSlug)) {
    return baseSlug;
  }
  let index = 2;
  while (takenSlugs.has(`${baseSlug}-${index}`)) {
    index += 1;
  }
  return `${baseSlug}-${index}`;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const IMAGE_ATTACHMENT_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const IMAGE_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
const IMAGE_ATTACHMENT_MAX_COUNT = 10;

function parseDataUrl(dataUrl: string): { mediaType: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!match) {
    throw new Error('附件数据格式无效。');
  }
  const mediaType = match[1].trim().toLowerCase();
  const isBase64 = Boolean(match[2]);
  const payload = match[3];
  return {
    mediaType,
    buffer: isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8')
  };
}

function safeAttachmentFileName(fileName: string): string {
  const baseName = path.basename(fileName).replace(/[<>:"|?*\u0000-\u001f\\/]+/g, '-').trim();
  return baseName || 'attachment';
}

function extensionForAttachment(fileName: string, mediaType: string, type: 'image' | 'text'): string {
  const existing = path.extname(fileName).toLowerCase();
  if (existing) {
    return existing;
  }
  if (type === 'text') {
    return '.txt';
  }
  if (mediaType === 'image/jpeg') return '.jpg';
  if (mediaType === 'image/png') return '.png';
  if (mediaType === 'image/webp') return '.webp';
  if (mediaType === 'image/gif') return '.gif';
  return '.bin';
}

function attachmentInputType(input: MessageAttachmentInput): 'image' | 'text' {
  return input.type ?? (input.mediaType.startsWith('image/') ? 'image' : 'text');
}

async function readJson<T>(filePath: string, assertFn: (value: unknown) => asserts value is T): Promise<T> {
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
  assertFn(parsed);
  return parsed;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readManifest(workspacePath: string): Promise<WorkspaceManifest> {
  return readJson(manifestPath(workspacePath), assertManifest);
}

async function writeManifest(workspacePath: string, manifest: WorkspaceManifest): Promise<void> {
  await writeJson(manifestPath(workspacePath), { ...manifest, updatedAt: now() });
}

function appHomePath(customHome?: string): string {
  return customHome ?? process.env.MINDLINE_HOME ?? path.join(os.homedir(), '.mindline');
}

function safeProjectName(projectPath: string): string {
  return (path.basename(projectPath) || 'project').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 48);
}

function safeFileName(value: string, fallback: string): string {
  return (value.trim() || fallback).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 96) || fallback;
}

function imageExtension(mediaType: string): string {
  switch (mediaType) {
    case 'image/png':
      return '.png';
    case 'image/jpeg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '';
  }
}

function projectDataPath(projectPath: string): string {
  return path.resolve(projectPath);
}

function legacyProjectDataPath(projectPath: string, customHome?: string): string {
  const resolved = path.resolve(projectPath);
  const digest = createHash('sha256').update(resolved).digest('hex').slice(0, 16);
  return path.join(appHomePath(customHome), 'workspaces', `${safeProjectName(resolved)}-${digest}`);
}

function legacyManifestPath(workspacePath: string): string {
  return path.join(workspacePath, 'manifest.json');
}

function isMindlineInternalSegment(segment: string): boolean {
  return segment === '.mindline' || segment === 'phases' || segment === 'topics';
}

async function readLooseJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!(await exists(filePath))) {
    return fallback;
  }
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

interface MindlineConfig {
  version: 1;
  recentProjectPaths: string[];
}

async function updateMindlineConfig(projectPath: string, customHome?: string): Promise<void> {
  const configPath = path.join(appHomePath(customHome), 'config.json');
  let current: MindlineConfig = { version: 1, recentProjectPaths: [] };
  if (await exists(configPath)) {
    try {
      const parsed = JSON.parse(await fs.readFile(configPath, 'utf8')) as Partial<MindlineConfig>;
      current = {
        version: 1,
        recentProjectPaths: Array.isArray(parsed.recentProjectPaths) ? parsed.recentProjectPaths.filter((entry): entry is string => typeof entry === 'string') : []
      };
    } catch {
      current = { version: 1, recentProjectPaths: [] };
    }
  }
  current.recentProjectPaths = [projectPath, ...current.recentProjectPaths.filter((entry) => entry !== projectPath)].slice(0, 20);
  await writeJson(configPath, current);
}

export class WorkspaceService {
  private workspacePath: string | null = null;
  private projectPath: string | null = null;
  private readonly modelProviderService = new ModelProviderService();
  private readonly gitBackupService: GitBackupService;
  private readonly modelAdapterFactory: ModelAdapterFactory;
  private readonly appHome?: string;

  constructor(options: { modelAdapterFactory?: ModelAdapterFactory; appHome?: string } = {}) {
    this.modelAdapterFactory = options.modelAdapterFactory ?? activeProviderAdapterFactory;
    this.appHome = options.appHome;
    this.gitBackupService = new GitBackupService(appHomePath(this.appHome));
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceSnapshot> {
    const projectPath = await this.resolveProjectPathInput(input.workspacePath);
    const workspacePath = projectDataPath(projectPath);
    if (await exists(manifestPath(workspacePath))) {
      throw new Error('This project already has a Mindline workspace. Use Open to load it.');
    }
    if (await exists(legacyManifestPath(workspacePath))) {
      throw new Error('This folder already contains a legacy Mindline workspace. Use Open to load it.');
    }
    if (await exists(legacyManifestPath(legacyProjectDataPath(projectPath, this.appHome)))) {
      throw new Error('This project already has a legacy Mindline workspace. Use Open to migrate and load it.');
    }

    const timestamp = now();
    const manifest: WorkspaceManifest = {
      version: 1,
      workspaceId: randomUUID(),
      name: input.name?.trim() || path.basename(projectPath) || 'Mindline Project',
      projectPath,
      createdAt: timestamp,
      updatedAt: timestamp,
      topicIds: [],
      phaseIds: [],
      topicPaths: {},
      phasePaths: {
        [DEFAULT_PHASE_ID]: 'default-phase'
      }
    };

    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(topicsRootDir(workspacePath), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'phases'), { recursive: true });
    await this.modelProviderService.ensureStore(this.settingsPath());
    await writeJson(manifestPath(workspacePath), manifest);
    await this.syncDefaultPhaseStorage(workspacePath, manifest);
    await updateMindlineConfig(projectPath, this.appHome);
    this.workspacePath = workspacePath;
    this.projectPath = projectPath;
    await this.autoBackup('初始化备份');
    return this.snapshot();
  }

  async openWorkspace(workspacePath: string): Promise<WorkspaceSnapshot> {
    const resolved = await this.resolveProjectPathInput(workspacePath);
    if (await exists(manifestPath(resolved))) {
      await this.migrateHiddenProjectDataIfNeeded(resolved);
      await this.ensureReadableStorageLayout(resolved);
      const manifest = await readManifest(resolved);
      this.workspacePath = resolved;
      this.projectPath = manifest.projectPath ? path.resolve(manifest.projectPath) : resolved;
      await updateMindlineConfig(this.projectPath, this.appHome);
      return this.snapshot();
    }

    if (await exists(legacyManifestPath(resolved))) {
      const manifest = await readJson(legacyManifestPath(resolved), assertManifest);
      const manifestProjectPath = manifest.projectPath ? path.resolve(manifest.projectPath) : resolved;
      if (manifest.projectPath && path.resolve(resolved) === legacyProjectDataPath(manifestProjectPath, this.appHome)) {
        const migratedPath = await this.migrateLegacyWorkspace(manifestProjectPath);
        this.workspacePath = migratedPath;
        this.projectPath = manifestProjectPath;
        await updateMindlineConfig(this.projectPath, this.appHome);
        return this.snapshot();
      }
      if (manifest.projectPath && path.resolve(resolved) === path.join(manifestProjectPath, '.mindline')) {
        await this.migrateHiddenProjectDataIfNeeded(manifestProjectPath);
        await this.ensureReadableStorageLayout(manifestProjectPath);
        this.workspacePath = manifestProjectPath;
        this.projectPath = manifestProjectPath;
        await updateMindlineConfig(this.projectPath, this.appHome);
        return this.snapshot();
      }
    }

    const migratedPath = await this.migrateLegacyWorkspace(resolved);
    if (migratedPath) {
      await this.ensureReadableStorageLayout(migratedPath);
      const manifest = await readManifest(migratedPath);
      this.workspacePath = migratedPath;
      this.projectPath = manifest.projectPath ?? resolved;
      await updateMindlineConfig(this.projectPath, this.appHome);
      return this.snapshot();
    }

    return this.createWorkspace({ workspacePath: resolved });
  }

  getWorkspaceDataPathForProject(projectPathInput: string): string {
    return projectDataPath(projectPathInput);
  }

  getLegacyWorkspaceDataPathForProject(projectPathInput: string): string {
    return legacyProjectDataPath(projectPathInput, this.appHome);
  }

  getAppHomePath(): string {
    return appHomePath(this.appHome);
  }

  async openDataWorkspace(workspacePath: string): Promise<WorkspaceSnapshot> {
    const resolved = path.resolve(workspacePath);
    if (await exists(legacyManifestPath(resolved))) {
      const manifest = await readJson(legacyManifestPath(resolved), assertManifest);
      const manifestProjectPath = manifest.projectPath ? path.resolve(manifest.projectPath) : resolved;
      if (manifest.projectPath && path.resolve(resolved) === path.join(manifestProjectPath, '.mindline')) {
        await this.migrateHiddenProjectDataIfNeeded(manifestProjectPath);
        this.workspacePath = manifestProjectPath;
        this.projectPath = manifestProjectPath;
        await updateMindlineConfig(this.projectPath, this.appHome);
        return this.snapshot();
      }
    }
    if (!(await exists(manifestPath(resolved)))) {
      throw new Error('This folder is not a Mindline data workspace.');
    }
    await this.migrateHiddenProjectDataIfNeeded(resolved);
    await this.ensureReadableStorageLayout(resolved);
    const manifest = await readManifest(resolved);
    this.workspacePath = resolved;
    this.projectPath = manifest.projectPath ?? resolved;
    await updateMindlineConfig(this.projectPath, this.appHome);
    return this.snapshot();
  }

  async getBackupStatus(): Promise<BackupStatus> {
    return this.gitBackupService.getStatus(this.requireWorkspace());
  }

  async createBackup(label?: string): Promise<BackupStatus> {
    return this.gitBackupService.createBackup(this.requireWorkspace(), label?.trim() || '手动备份');
  }

  async listBackups(limit?: number): Promise<BackupTimeline> {
    return this.gitBackupService.listBackups(this.requireWorkspace(), limit);
  }

  async restoreBackup(commitId: string): Promise<WorkspaceSnapshot> {
    const workspacePath = this.requireWorkspace();
    await this.gitBackupService.restoreBackup(workspacePath, commitId);
    await this.ensureReadableStorageLayout(workspacePath);
    return this.snapshot();
  }

  async getBackupRemoteStatus(): Promise<BackupRemoteStatus> {
    return this.gitBackupService.getRemoteStatus(this.requireWorkspace());
  }

  async testBackupRemote(input: ConfigureBackupRemoteInput): Promise<BackupRemoteStatus> {
    return this.gitBackupService.testRemote(this.requireWorkspace(), input);
  }

  async configureBackupRemote(input: ConfigureBackupRemoteInput): Promise<BackupStatus> {
    return this.gitBackupService.configureRemote(this.requireWorkspace(), input);
  }

  async clearBackupRemote(): Promise<BackupStatus> {
    return this.gitBackupService.clearRemote(this.requireWorkspace());
  }

  async syncBackupRemote(): Promise<BackupSyncResult> {
    const workspacePath = this.requireWorkspace();
    const result = await this.gitBackupService.syncRemote(workspacePath);
    if (result.appliedRemoteChanges) {
      await this.ensureReadableStorageLayout(workspacePath);
      result.snapshot = await this.snapshot();
    }
    return result;
  }

  async resolveBackupRemoteSetup(mode: BackupRemoteSetupMode): Promise<BackupSyncResult> {
    const workspacePath = this.requireWorkspace();
    const result = await this.gitBackupService.resolveRemoteSetup(workspacePath, mode);
    if (result.appliedRemoteChanges) {
      await this.ensureReadableStorageLayout(workspacePath);
      result.snapshot = await this.snapshot();
    }
    return result;
  }

  async getSnapshot(): Promise<WorkspaceSnapshot | null> {
    return this.workspacePath ? this.snapshot() : null;
  }

  async createTopic(input: CreateTopicInput): Promise<WorkspaceSnapshot> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    const timestamp = now();
    const title = input.title.trim() || 'New';
    const topic: Topic = {
      id: randomUUID(),
      title,
      phaseId: input.phaseId,
      createdAt: timestamp,
      updatedAt: timestamp,
      status: 'active',
      shareId: randomUUID()
    };
    const parentPhasePath = this.phaseStoragePath(manifest, input.phaseId ?? DEFAULT_PHASE_ID);
    const topicSlug = uniqueSlug(
      slugifySegment(title, 'topic'),
      new Set(
        Object.values(manifest.topicPaths ?? {})
          .filter((entryPath) => entryPath.startsWith(`${parentPhasePath}/topics/`))
          .map((entryPath) => path.basename(entryPath))
      )
    );
    const topicPath = this.buildTopicStoragePath(parentPhasePath, topicSlug);
    const nextManifest: WorkspaceManifest = {
      ...manifest,
      topicPaths: { ...(manifest.topicPaths ?? {}), [topic.id]: topicPath }
    };

    await fs.mkdir(topicDir(workspacePath, topicPath), { recursive: true });
    await writeJson(topicJsonPath(workspacePath, topicPath), topic);
    await fs.writeFile(messagesPath(workspacePath, topicPath), '', 'utf8');
    await fs.mkdir(path.join(topicsRootDir(workspacePath), topicPath), { recursive: true });
    await writeJson(path.join(topicsRootDir(workspacePath), topicPath, 'topic.json'), topic);
    await fs.writeFile(path.join(topicsRootDir(workspacePath), topicPath, 'messages.md'), '', 'utf8');
    manifest.topicIds.push(topic.id);

    if (topic.phaseId) {
      const phase = await this.readPhase(topic.phaseId);
      phase.topicIds = [...new Set([...phase.topicIds, topic.id])];
      await writeJson(this.phaseJsonFilePath(workspacePath, nextManifest, phase.id), phase);
    }

    await writeManifest(workspacePath, { ...nextManifest, topicIds: manifest.topicIds });
    return this.snapshotAfterAutoBackup('创建话题');
  }

  async updateTopic(topicId: Id, input: UpdateTopicInput): Promise<WorkspaceSnapshot> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    const topic = await this.readTopic(topicId);
    const previousPhaseId = topic.phaseId;
    const nextPhaseId = input.phaseId === null ? undefined : input.phaseId ?? topic.phaseId;
    const updated: Topic = {
      ...topic,
      title: input.title?.trim() || topic.title,
      phaseId: nextPhaseId,
      status: input.status ?? topic.status,
      updatedAt: now()
    };

    const currentTopicPath = this.topicStoragePath(manifest, topicId);
    const nextParentPhasePath = this.phaseStoragePath(manifest, nextPhaseId ?? DEFAULT_PHASE_ID);
    const currentTopicSlug = path.basename(currentTopicPath);
    const nextTopicSlug = input.title === undefined && previousPhaseId === nextPhaseId
      ? currentTopicSlug
      : uniqueSlug(
          slugifySegment(updated.title, 'topic'),
          new Set(
            Object.entries(manifest.topicPaths ?? {})
              .filter(([id, entryPath]) => id !== topicId && entryPath.startsWith(`${nextParentPhasePath}/topics/`))
              .map(([, entryPath]) => path.basename(entryPath))
          ),
          previousPhaseId === nextPhaseId ? currentTopicSlug : undefined
        );
    const nextTopicPath = this.buildTopicStoragePath(nextParentPhasePath, nextTopicSlug);
    const nextManifest: WorkspaceManifest = {
      ...manifest,
      topicPaths: { ...(manifest.topicPaths ?? {}), [topicId]: nextTopicPath }
    };

    if (currentTopicPath !== nextTopicPath) {
      await this.renameStorageDirectory(topicDir(workspacePath, currentTopicPath), topicDir(workspacePath, nextTopicPath));
      await this.renameStorageDirectory(path.join(topicsRootDir(workspacePath), currentTopicPath), path.join(topicsRootDir(workspacePath), nextTopicPath));
    }
    await writeJson(topicJsonPath(workspacePath, nextTopicPath), updated);
    await writeJson(path.join(topicsRootDir(workspacePath), nextTopicPath, 'topic.json'), updated);
    await writeManifest(workspacePath, nextManifest);
    await this.syncTopicPhaseMembership(topicId, previousPhaseId, nextPhaseId);
    return this.snapshotAfterAutoBackup('更新话题');
  }

  async createPhase(input: CreatePhaseInput): Promise<WorkspaceSnapshot> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    const title = input.title.trim() || 'New';
    const phase: Phase = {
      id: randomUUID(),
      title,
      icon: randomPhaseIcon(),
      description: input.description?.trim() || undefined,
      startedAt: now(),
      topicIds: [],
      status: 'active',
      shareId: randomUUID()
    };
    const phaseSlug = uniqueSlug(
      slugifySegment(title, 'phase'),
      new Set(Object.entries(manifest.phasePaths ?? {}).filter(([phaseId]) => phaseId !== DEFAULT_PHASE_ID).map(([, entryPath]) => entryPath))
    );
    await fs.mkdir(phaseDir(workspacePath, phaseSlug), { recursive: true });
    await writeJson(phaseJsonPath(workspacePath, phaseSlug), phase);
    manifest.phaseIds.push(phase.id);
    await writeManifest(workspacePath, {
      ...manifest,
      phasePaths: { ...(manifest.phasePaths ?? {}), [phase.id]: phaseSlug }
    });
    return this.snapshotAfterAutoBackup('创建阶段');
  }

  async updatePhase(phaseId: Id, input: UpdatePhaseInput): Promise<WorkspaceSnapshot> {
    const workspacePath = this.requireWorkspace();
    if (phaseId === DEFAULT_PHASE_ID) {
      const manifest = await readManifest(workspacePath);
      const [topics, phases] = await Promise.all([
        Promise.all(manifest.topicIds.map((topicId) => this.readTopic(topicId))),
        Promise.all(manifest.phaseIds.map((entryId) => this.readPhase(entryId)))
      ]);
      const current = this.buildDefaultPhase(manifest, topics, phases);
      const nextDefaultPhase = {
        ...manifest.defaultPhase,
        title: input.title?.trim() || manifest.defaultPhase?.title,
        icon: input.icon === null ? undefined : input.icon?.trim() || manifest.defaultPhase?.icon,
        description: input.description === undefined ? manifest.defaultPhase?.description : input.description.trim() || undefined,
        startedAt: manifest.defaultPhase?.startedAt ?? current.startedAt,
        endedAt: input.endedAt === null ? undefined : input.endedAt ?? manifest.defaultPhase?.endedAt,
        shareId: manifest.defaultPhase?.shareId ?? current.shareId
      };
      const nextManifest = { ...manifest, defaultPhase: nextDefaultPhase, phasePaths: { ...(manifest.phasePaths ?? {}), [DEFAULT_PHASE_ID]: 'default-phase' } };
      await writeManifest(workspacePath, nextManifest);
      await this.syncDefaultPhaseStorage(workspacePath, nextManifest);
      if (input.status === 'trashed') {
        await Promise.all(
          current.topicIds.map(async (topicId) => {
            const topic = await this.readTopic(topicId);
            await writeJson(this.topicJsonFilePath(workspacePath, nextManifest, topicId), { ...topic, status: 'trashed', updatedAt: now() });
          })
        );
      }
      return this.snapshotAfterAutoBackup('更新默认阶段');
    }
    const manifest = await readManifest(workspacePath);
    const phase = await this.readPhase(phaseId);
    const updated: Phase = {
      ...phase,
      title: input.title?.trim() || phase.title,
      icon: input.icon === null ? undefined : input.icon?.trim() || phase.icon,
      description: input.description === undefined ? phase.description : input.description.trim() || undefined,
      endedAt: input.endedAt === null ? undefined : input.endedAt ?? phase.endedAt,
      status: input.status ?? phase.status ?? 'active'
    };
    const currentPhasePath = this.phaseStoragePath(manifest, phaseId);
    const nextPhasePath = input.title === undefined
      ? currentPhasePath
      : uniqueSlug(
          slugifySegment(updated.title, 'phase'),
          new Set(Object.entries(manifest.phasePaths ?? {}).filter(([id]) => id !== DEFAULT_PHASE_ID && id !== phaseId).map(([, entryPath]) => entryPath)),
          currentPhasePath
        );
    const nextTopicPaths = { ...(manifest.topicPaths ?? {}) };
    if (currentPhasePath !== nextPhasePath) {
      for (const topicId of phase.topicIds) {
        const currentTopicPath = this.topicStoragePath(manifest, topicId);
        nextTopicPaths[topicId] = this.buildTopicStoragePath(nextPhasePath, path.basename(currentTopicPath));
      }
    }
    const nextManifest: WorkspaceManifest = {
      ...manifest,
      topicPaths: nextTopicPaths,
      phasePaths: { ...(manifest.phasePaths ?? {}), [phaseId]: nextPhasePath, [DEFAULT_PHASE_ID]: manifest.phasePaths?.[DEFAULT_PHASE_ID] ?? 'default-phase' }
    };
    if (currentPhasePath !== nextPhasePath) {
      await this.renameStorageDirectory(phaseDir(workspacePath, currentPhasePath), phaseDir(workspacePath, nextPhasePath));
    }
    await writeJson(phaseJsonPath(workspacePath, nextPhasePath), updated);
    await writeManifest(workspacePath, nextManifest);
    if (input.status === 'trashed' || input.status === 'active') {
      await Promise.all(
        phase.topicIds.map(async (topicId) => {
          const topic = await this.readTopic(topicId);
          await writeJson(this.topicJsonFilePath(workspacePath, nextManifest, topicId), { ...topic, status: input.status, updatedAt: now() });
        })
      );
    }
    return this.snapshotAfterAutoBackup('更新阶段');
  }

  async reorderPhases(phaseIds: Id[]): Promise<WorkspaceSnapshot> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    if (phaseIds.length !== manifest.phaseIds.length) {
      throw new Error('阶段排序参数无效。');
    }

    const currentPhaseIds = new Set(manifest.phaseIds);
    if (new Set(phaseIds).size !== phaseIds.length || phaseIds.some((phaseId) => !currentPhaseIds.has(phaseId))) {
      throw new Error('阶段排序参数无效。');
    }

    await writeManifest(workspacePath, { ...manifest, phaseIds: [...phaseIds] });
    return this.snapshotAfterAutoBackup('调整阶段顺序');
  }

  async clearTrash(): Promise<WorkspaceSnapshot> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    const [topics, phases] = await Promise.all([
      Promise.all(manifest.topicIds.map((topicId) => this.readTopicFromManifest(workspacePath, manifest, topicId))),
      Promise.all(manifest.phaseIds.map((phaseId) => this.readPhaseFromManifest(workspacePath, manifest, phaseId)))
    ]);
    const trashedPhaseIds = new Set(phases.filter((phase) => phase.status === 'trashed').map((phase) => phase.id));
    const trashedTopicIds = new Set(topics.filter((topic) => topic.status === 'trashed' || (topic.phaseId !== undefined && trashedPhaseIds.has(topic.phaseId))).map((topic) => topic.id));

    for (const phase of phases) {
      if (trashedPhaseIds.has(phase.id)) {
        phase.topicIds.forEach((topicId) => trashedTopicIds.add(topicId));
      }
    }

    await Promise.all([...trashedTopicIds].map(async (topicId) => fs.rm(await this.existingTopicDirectoryPath(workspacePath, manifest, topicId), { recursive: true, force: true })));
    await Promise.all([...trashedPhaseIds].map((phaseId) => fs.rm(phaseDir(workspacePath, this.phaseStoragePath(manifest, phaseId)), { recursive: true, force: true })));
    await Promise.all(
      phases
        .filter((phase) => !trashedPhaseIds.has(phase.id))
        .map((phase) => {
          const topicIds = phase.topicIds.filter((topicId) => !trashedTopicIds.has(topicId));
          return topicIds.length === phase.topicIds.length ? Promise.resolve() : writeJson(this.phaseJsonFilePath(workspacePath, manifest, phase.id), { ...phase, topicIds });
        })
    );

    const topicPaths = { ...(manifest.topicPaths ?? {}) };
    const phasePaths = { ...(manifest.phasePaths ?? {}) };
    for (const topicId of trashedTopicIds) {
      delete topicPaths[topicId];
    }
    for (const phaseId of trashedPhaseIds) {
      delete phasePaths[phaseId];
    }

    await writeManifest(workspacePath, {
      ...manifest,
      topicIds: manifest.topicIds.filter((topicId) => !trashedTopicIds.has(topicId)),
      phaseIds: manifest.phaseIds.filter((phaseId) => !trashedPhaseIds.has(phaseId)),
      topicPaths,
      phasePaths
    });
    return this.snapshotAfterAutoBackup('清空回收站');
  }

  async addMessage(input: CreateMessageInput): Promise<Message> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    await this.readTopicFromManifest(workspacePath, manifest, input.topicId);
    const attachments = input.attachments?.length ? await this.saveMessageAttachments(workspacePath, input.topicId, input.attachments) : undefined;
    const message: Message = {
      id: randomUUID(),
      topicId: input.topicId,
      role: input.role,
      content: input.content.trim(),
      createdAt: now(),
      modelId: input.modelId,
      attachments,
      contextItems: input.contextItems?.length ? input.contextItems : undefined
    };

    if (!message.content && (!message.attachments || message.attachments.length === 0)) {
      throw new Error('Message content is required');
    }

    const serializedMessage = `${serializeMessage(message)}\n`;
    await fs.appendFile(this.messagesFilePath(workspacePath, manifest, input.topicId), serializedMessage, 'utf8');
    await fs.appendFile(path.join(topicsRootDir(workspacePath), this.topicStoragePath(manifest, input.topicId), 'messages.md'), serializedMessage, 'utf8').catch(() => undefined);
    const topic = await this.readTopicFromManifest(workspacePath, manifest, input.topicId);
    const updatedTopic = { ...topic, updatedAt: now() };
    await writeJson(this.topicJsonFilePath(workspacePath, manifest, input.topicId), updatedTopic);
    await writeJson(path.join(topicsRootDir(workspacePath), this.topicStoragePath(manifest, input.topicId), 'topic.json'), updatedTopic).catch(() => undefined);
    return message;
  }

  async addUserMessage(topicId: Id, content: string): Promise<WorkspaceSnapshot> {
    await this.addMessage({ topicId, role: 'user', content });
    return this.snapshotAfterAutoBackup('添加用户消息');
  }

  async generateAssistantReply(topicId: Id, prompt: string, options?: ModelRunOptions): Promise<WorkspaceSnapshot> {
    const workspacePath = this.requireWorkspace();
    const modelAdapter = await this.getModelAdapter(options?.providerId);
    if (options?.attachments?.some((attachment) => attachmentInputType(attachment) === 'image') && (modelAdapter as { supportsAttachments?: boolean }).supportsAttachments === false) {
      throw new Error('当前本地工具暂不支持发送图片，请切换到支持视觉输入的云端模型。');
    }
    const contextMarkdown = options?.contextItems?.length ? buildSelectionContext(await this.snapshot(), options.contextItems) : undefined;
    const effectiveOptions = contextMarkdown ? { ...options, contextMarkdown } : options;
    await this.addMessage({ topicId, role: 'user', content: prompt, attachments: options?.attachments, contextItems: options?.contextItems });
    const topic = await this.readTopic(topicId);
    const messages = await this.readMessages(topicId);
    const reply = await modelAdapter.sendMessage({ topic, messages, prompt, options: effectiveOptions });
    const manifest = await readManifest(workspacePath);
    const serializedReply = `${serializeMessage(reply)}\n`;
    await fs.appendFile(this.messagesFilePath(workspacePath, manifest, topicId), serializedReply, 'utf8');
    await fs.appendFile(path.join(topicsRootDir(workspacePath), this.topicStoragePath(manifest, topicId), 'messages.md'), serializedReply, 'utf8').catch(() => undefined);
    const updatedTopic = { ...topic, updatedAt: now() };
    await writeJson(this.topicJsonFilePath(workspacePath, manifest, topicId), updatedTopic);
    await writeJson(path.join(topicsRootDir(workspacePath), this.topicStoragePath(manifest, topicId), 'topic.json'), updatedTopic).catch(() => undefined);
    return this.snapshotAfterAutoBackup('生成助手回复');
  }

  async generateAssistantReplyStream(
    topicId: Id,
    prompt: string,
    options: ModelRunOptions | undefined,
    handlers: { signal?: AbortSignal; onChunk: (delta: string, content: string) => void }
  ): Promise<{ snapshot: WorkspaceSnapshot; message: Message }> {
    const workspacePath = this.requireWorkspace();
    const modelAdapter = await this.getModelAdapter(options?.providerId);
    if (options?.attachments?.some((attachment) => attachmentInputType(attachment) === 'image') && (modelAdapter as { supportsAttachments?: boolean }).supportsAttachments === false) {
      throw new Error('当前本地工具暂不支持发送图片，请切换到支持视觉输入的云端模型。');
    }
    const contextMarkdown = options?.contextItems?.length ? buildSelectionContext(await this.snapshot(), options.contextItems) : undefined;
    const effectiveOptions = contextMarkdown ? { ...options, contextMarkdown } : options;
    await this.addMessage({ topicId, role: 'user', content: prompt, attachments: options?.attachments, contextItems: options?.contextItems });
    const topic = await this.readTopic(topicId);
    const messages = await this.readMessages(topicId);
    const reply = modelAdapter.sendMessageStream
      ? await modelAdapter.sendMessageStream({ topic, messages, prompt, options: effectiveOptions, signal: handlers.signal, onChunk: handlers.onChunk })
      : await modelAdapter.sendMessage({ topic, messages, prompt, options: effectiveOptions });

    if (!modelAdapter.sendMessageStream) {
      handlers.onChunk(reply.content, reply.content);
    }

    const manifest = await readManifest(workspacePath);
    const serializedReply = `${serializeMessage(reply)}\n`;
    await fs.appendFile(this.messagesFilePath(workspacePath, manifest, topicId), serializedReply, 'utf8');
    await fs.appendFile(path.join(topicsRootDir(workspacePath), this.topicStoragePath(manifest, topicId), 'messages.md'), serializedReply, 'utf8').catch(() => undefined);
    const updatedTopic = { ...topic, updatedAt: now() };
    await writeJson(this.topicJsonFilePath(workspacePath, manifest, topicId), updatedTopic);
    await writeJson(path.join(topicsRootDir(workspacePath), this.topicStoragePath(manifest, topicId), 'topic.json'), updatedTopic).catch(() => undefined);
    return { snapshot: await this.snapshotAfterAutoBackup('生成助手回复'), message: reply };
  }

  async summarizeTopic(topicId: Id): Promise<WorkspaceSnapshot> {
    const workspacePath = this.requireWorkspace();
    const topic = await this.readTopic(topicId);
    const messages = await this.readMessages(topicId);
    const modelAdapter = await this.getModelAdapter();
    const summary = await modelAdapter.summarizeTopic({ topic, messages });
    const manifest = await readManifest(workspacePath);
    await fs.writeFile(this.topicSummaryFilePath(workspacePath, manifest, topicId), serializeSummary({ ...summary, shareId: randomUUID() }), 'utf8');
    return this.snapshotAfterAutoBackup('总结话题');
  }

  async summarizePhase(phaseId: Id): Promise<WorkspaceSnapshot> {
    const workspacePath = this.requireWorkspace();
    const [manifest, allTopics, allPhases] = await Promise.all([
      readManifest(workspacePath),
      this.readAllTopics(workspacePath),
      this.readAllPhases(workspacePath)
    ]);
    const phase = phaseId === DEFAULT_PHASE_ID ? this.buildDefaultPhase(manifest, allTopics, allPhases) : await this.readPhase(phaseId);
    const topics = allTopics.filter((topic) => phase.topicIds.includes(topic.id) && topic.status !== 'trashed');
    const topicSummaries = (await Promise.all(topics.map((topic) => this.readTopicSummary(topic.id)))).filter((summary): summary is Summary => Boolean(summary));
    const messagesByTopic = Object.fromEntries(await Promise.all(topics.map(async (topic) => [topic.id, await this.readMessages(topic.id)] as const)));
    const modelAdapter = await this.getModelAdapter();
    const summary = await modelAdapter.summarizePhase({ phase, topics, topicSummaries, messagesByTopic });
    await fs.mkdir(phaseDir(workspacePath, this.phaseStoragePath(manifest, phaseId)), { recursive: true });
    await fs.writeFile(this.phaseSummaryFilePath(workspacePath, manifest, phaseId), serializeSummary({ ...summary, shareId: randomUUID() }), 'utf8');
    return this.snapshotAfterAutoBackup('总结阶段');
  }

  async buildTopicExportMarkdown(topicId: Id, language: 'zh' | 'en' = 'en'): Promise<MarkdownExportResult> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    const topic = await this.readTopic(topicId);
    const phase = topic.phaseId
      ? await this.readPhase(topic.phaseId)
      : manifest.defaultPhase?.title?.trim()
        ? {
            id: DEFAULT_PHASE_ID,
            title: manifest.defaultPhase.title.trim(),
            icon: manifest.defaultPhase.icon?.trim() || undefined,
            description: manifest.defaultPhase.description?.trim() || undefined,
            startedAt: manifest.defaultPhase.startedAt ?? manifest.createdAt,
            endedAt: manifest.defaultPhase.endedAt?.trim() || undefined,
            topicIds: [topic.id],
            status: 'active' as const,
            shareId: manifest.defaultPhase.shareId
          }
        : undefined;
    const messages = await this.readMessages(topicId);
    const summary = await this.readTopicSummary(topicId);
    const filename = `${this.safeExportName(topic.title)}.md`;
    const assetDirName = `${path.basename(filename, '.md')}.assets`;
    return {
      filename,
      markdown: serializeTopicExport({ topic, phase, messages, summary, language, attachmentPathFor: (_message, attachment) => this.exportAttachmentRelativePath(assetDirName, attachment) }),
      assets: this.collectMessageExportAssets(messages, assetDirName)
    };
  }

  async buildPhaseExportMarkdown(phaseId: Id, language: 'zh' | 'en' = 'en'): Promise<MarkdownExportResult> {
    const workspacePath = this.requireWorkspace();
    const [manifest, allTopics, allPhases] = await Promise.all([
      readManifest(workspacePath),
      this.readAllTopics(workspacePath),
      this.readAllPhases(workspacePath)
    ]);
    const phase = phaseId === DEFAULT_PHASE_ID
      ? {
          ...this.buildDefaultPhase(manifest, allTopics, allPhases),
          title: manifest.defaultPhase?.title?.trim() || defaultPhaseFallbackTitle(language)
        }
      : await this.readPhase(phaseId);
    const topics = allTopics.filter((topic) => phase.topicIds.includes(topic.id) && topic.status !== 'trashed');
    const messagesByTopic = Object.fromEntries(await Promise.all(topics.map(async (topic) => [topic.id, await this.readMessages(topic.id)] as const)));
    const topicSummaries = Object.fromEntries(await Promise.all(topics.map(async (topic) => [topic.id, await this.readTopicSummary(topic.id)] as const)));
    const summary = await this.readPhaseSummary(phaseId);
    const filename = `${this.safeExportName(phase.title)}.md`;
    const assetDirName = `${path.basename(filename, '.md')}.assets`;
    const messages = Object.values(messagesByTopic).flat();
    return {
      filename,
      markdown: serializePhaseExport({ phase, topics, messagesByTopic, topicSummaries, summary, language, attachmentPathFor: (_message, attachment) => this.exportAttachmentRelativePath(assetDirName, attachment) }),
      assets: this.collectMessageExportAssets(messages, assetDirName)
    };
  }

  async buildSelectionExportMarkdown(items: SelectionCartItem[], language: 'zh' | 'en' = 'en'): Promise<MarkdownExportResult> {
    const snapshot = await this.snapshot();
    const filename = `${this.safeExportName(language === 'zh' ? '资料篮导出' : 'Selection Export')}.md`;
    const assetDirName = `${path.basename(filename, '.md')}.assets`;
    const messages = this.messagesForSelectionExport(snapshot, items);
    return {
      filename,
      markdown: buildSelectionExportMarkdown(snapshot, items, language, (_message, attachment) => this.exportAttachmentRelativePath(assetDirName, attachment)),
      assets: this.collectMessageExportAssets(messages, assetDirName)
    };
  }

  async discussSelection(prompt: string, items: SelectionCartItem[]): Promise<DiscussionResult> {
    const snapshot = await this.snapshot();
    const contextMarkdown = buildSelectionContext(snapshot, items);
    const sourceRefs = uniqueSourceRefs(items);
    const modelAdapter = await this.getModelAdapter();
    const message = await modelAdapter.discussSelection({ prompt, contextMarkdown, sourceRefs });
    return { message, contextMarkdown };
  }

  async addModelProvider(input: AddModelProviderInput): Promise<WorkspaceSnapshot> {
    this.requireWorkspace();
    await this.modelProviderService.add(this.settingsPath(), input);
    return this.snapshot();
  }

  async updateModelProvider(providerId: Id, input: UpdateModelProviderInput): Promise<WorkspaceSnapshot> {
    this.requireWorkspace();
    await this.modelProviderService.update(this.settingsPath(), providerId, input);
    return this.snapshot();
  }

  async deleteModelProvider(providerId: Id): Promise<WorkspaceSnapshot> {
    this.requireWorkspace();
    await this.modelProviderService.delete(this.settingsPath(), providerId);
    return this.snapshot();
  }

  async setActiveModelProvider(providerId: Id | null): Promise<WorkspaceSnapshot> {
    this.requireWorkspace();
    await this.modelProviderService.setActive(this.settingsPath(), providerId);
    return this.snapshot();
  }

  private async saveMessageAttachments(workspacePath: string, topicId: Id, inputs: MessageAttachmentInput[]): Promise<MessageAttachment[]> {
    const manifest = await readManifest(workspacePath);
    const imageInputs = inputs.filter((input) => attachmentInputType(input) === 'image');
    const textInputs = inputs.filter((input) => attachmentInputType(input) === 'text');
    if (imageInputs.length > IMAGE_ATTACHMENT_MAX_COUNT) {
      throw new Error(`一次最多发送 ${IMAGE_ATTACHMENT_MAX_COUNT} 张图片。`);
    }
    if (textInputs.length > TEXT_ATTACHMENT_MAX_COUNT) {
      throw new Error(`一次最多发送 ${TEXT_ATTACHMENT_MAX_COUNT} 个文本文件。`);
    }

    const attachmentRelativeDir = 'attachments';
    const attachmentDir = path.join(topicsRootDir(workspacePath), topicId, attachmentRelativeDir);
    const phaseAttachmentDir = path.join(this.topicDirectoryPath(workspacePath, manifest, topicId), 'attachments');
    await fs.mkdir(attachmentDir, { recursive: true });
    await fs.mkdir(phaseAttachmentDir, { recursive: true });
    let textTotalBytes = 0;
    const saved: MessageAttachment[] = [];

    for (const input of inputs) {
      const parsed = parseDataUrl(input.dataUrl);
      const type = attachmentInputType(input);
      const mediaType = input.mediaType.trim().toLowerCase() || parsed.mediaType;
      if (parsed.mediaType !== mediaType) {
        throw new Error('附件 MIME 与实际数据不一致。');
      }
      const fileName = safeAttachmentFileName(input.fileName);
      const size = parsed.buffer.byteLength;
      if (input.size !== size) {
        throw new Error('附件大小与实际数据不一致。');
      }

      if (type === 'image') {
        if (!IMAGE_ATTACHMENT_MEDIA_TYPES.has(mediaType)) {
          throw new Error('仅支持 PNG、JPEG、WebP、GIF 图片。');
        }
        if (size > IMAGE_ATTACHMENT_MAX_BYTES) {
          throw new Error('单张图片不能超过 20 MB。');
        }
      } else {
        if (isSensitiveTextAttachmentName(fileName)) {
          throw new Error('密钥配置文件不能作为文本附件发送。');
        }
        if (!isSupportedTextAttachment(fileName, mediaType)) {
          throw new Error('暂不支持 PDF、Office 文档或二进制文件，请发送常见 UTF-8 文本、Markdown、CSV、JSON、YAML、XML、HTML、日志或代码文件。');
        }
        if (size > TEXT_ATTACHMENT_MAX_BYTES) {
          throw new Error('单个文本文件不能超过 256 KB。');
        }
        textTotalBytes += size;
        if (textTotalBytes > TEXT_ATTACHMENT_MAX_TOTAL_BYTES) {
          throw new Error('本次发送的文本文件总量不能超过 512 KB。');
        }
        const text = parsed.buffer.toString('utf8');
        if (!looksLikeUtf8Text(text)) {
          throw new Error('仅支持 UTF-8 文本文件。');
        }
      }

      const extension = extensionForAttachment(fileName, mediaType, type);
      const storedName = `${randomUUID()}${extension}`;
      await fs.writeFile(path.join(attachmentDir, storedName), parsed.buffer);
      await fs.writeFile(path.join(phaseAttachmentDir, storedName), parsed.buffer);
      saved.push({
        id: randomUUID(),
        type,
        fileName,
        mediaType,
        size,
        path: path.posix.join(attachmentRelativeDir, storedName)
      });
    }

    return saved;
  }

  private requireWorkspace(): string {
    if (!this.workspacePath) {
      throw new Error('Open or create a workspace first');
    }
    if (path.basename(this.workspacePath) === '.mindline') {
      const projectPath = this.projectPath ? path.resolve(this.projectPath) : path.dirname(this.workspacePath);
      if (path.resolve(this.workspacePath) === path.join(projectPath, '.mindline')) {
        this.workspacePath = projectPath;
        this.projectPath = projectPath;
      }
    }
    return this.workspacePath;
  }

  private requireProjectPath(): string {
    return this.projectPath ?? this.requireWorkspace();
  }

  private settingsPath(): string {
    return appHomePath(this.appHome);
  }

  private async resolveProjectPathInput(projectPathInput: string): Promise<string> {
    const resolved = path.resolve(projectPathInput);
    let current = resolved;
    let projectPath: string | null = null;

    while (true) {
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }

      const relativeToParent = path.relative(parent, resolved);
      const firstSegment = relativeToParent.split(path.sep)[0];
      if (isMindlineInternalSegment(firstSegment) && (await exists(manifestPath(parent)))) {
        projectPath = parent;
      }

      current = parent;
    }

    return projectPath ?? resolved;
  }

  private async getModelAdapter(providerId?: Id): Promise<ModelAdapter> {
    this.requireWorkspace();
    return this.modelAdapterFactory(this.settingsPath(), this.modelProviderService, providerId, this.requireProjectPath());
  }

  private async migrateLegacyWorkspace(projectPathInput: string): Promise<string | null> {
    const projectPath = path.resolve(projectPathInput);
    const workspacePath = projectDataPath(projectPath);
    if (await exists(manifestPath(workspacePath))) {
      await this.migrateHiddenProjectDataIfNeeded(workspacePath);
      return workspacePath;
    }

    const legacyPath = legacyProjectDataPath(projectPath, this.appHome);
    if (!(await exists(legacyManifestPath(legacyPath)))) {
      return null;
    }

    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(workspacePath, '.mindline'), { recursive: true });
    await fs.cp(legacyManifestPath(legacyPath), manifestPath(workspacePath), { force: false, errorOnExist: false });
    await this.copyDirectoryIfPresent(path.join(legacyPath, 'topics'), path.join(workspacePath, 'topics'));
    await this.copyDirectoryIfPresent(path.join(legacyPath, 'phases'), path.join(workspacePath, 'phases'));
    await this.migrateLegacyModelProviderSettings(legacyPath);

    const manifest = await readManifest(workspacePath);
    if (manifest.projectPath !== projectPath) {
      await writeManifest(workspacePath, { ...manifest, projectPath });
    }

    await fs.rm(path.join(workspacePath, '.groupai'), { recursive: true, force: true });
    await fs.rm(path.join(workspacePath, '.git'), { recursive: true, force: true });
    await fs.rm(path.join(workspacePath, '.gitignore'), { force: true });
    return workspacePath;
  }

  private async migrateHiddenProjectDataIfNeeded(projectPath: string): Promise<void> {
    const hiddenPath = path.join(projectPath, '.mindline');
    await this.moveVisibleDataIfPresent(path.join(hiddenPath, 'topics'), path.join(projectPath, 'topics'));
    await this.moveVisibleDataIfPresent(path.join(hiddenPath, 'phases'), path.join(projectPath, 'phases'));
    await fs.rm(path.join(hiddenPath, '.groupai'), { recursive: true, force: true });
    await fs.rm(path.join(hiddenPath, '.git'), { recursive: true, force: true });
    await fs.rm(path.join(hiddenPath, '.gitignore'), { force: true });
  }

  private async copyDirectoryIfPresent(sourcePath: string, targetPath: string): Promise<void> {
    if (!(await exists(sourcePath))) {
      return;
    }
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.cp(sourcePath, targetPath, { recursive: true, force: false, errorOnExist: false });
  }

  private async moveVisibleDataIfPresent(sourcePath: string, targetPath: string): Promise<void> {
    await this.copyDirectoryIfPresent(sourcePath, targetPath);
    if (await exists(targetPath)) {
      await fs.rm(sourcePath, { recursive: true, force: true });
    }
  }

  private async migrateLegacyModelProviderSettings(legacyWorkspacePath: string): Promise<void> {
    const settingsPath = this.settingsPath();
    await this.modelProviderService.ensureStore(settingsPath);

    const sourceStorePath = legacyModelProvidersPath(legacyWorkspacePath);
    const targetStorePath = modelProvidersPath(settingsPath);
    const emptyProviderStore = { version: 1 as const, providers: [] as unknown[], activeModelProviderId: undefined as Id | undefined };
    const sourceStore = await readLooseJson(sourceStorePath, emptyProviderStore);
    const targetStore = await readLooseJson(targetStorePath, emptyProviderStore);
    const targetProviderIds = new Set(targetStore.providers.map((provider) => (provider as { id?: unknown }).id).filter((id): id is Id => typeof id === 'string'));
    const migratedProviders = sourceStore.providers.filter((provider) => {
      const id = (provider as { id?: unknown }).id;
      return typeof id === 'string' && !targetProviderIds.has(id);
    });

    if (migratedProviders.length > 0 || (!targetStore.activeModelProviderId && sourceStore.activeModelProviderId)) {
      const nextStore = {
        version: 1 as const,
        providers: [...targetStore.providers, ...migratedProviders],
        activeModelProviderId: targetStore.activeModelProviderId ?? sourceStore.activeModelProviderId
      };
      await writeJson(targetStorePath, nextStore);
    }

    const sourceSecretsDir = legacyModelProviderSecretsDir(legacyWorkspacePath);
    const targetSecretsDir = modelProviderSecretsDir(settingsPath);
    if (!(await exists(sourceSecretsDir))) {
      return;
    }
    await fs.mkdir(targetSecretsDir, { recursive: true });
    for (const entry of await fs.readdir(sourceSecretsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const providerId = path.basename(entry.name, '.json');
      const targetPath = modelProviderSecretPath(settingsPath, providerId);
      if (!(await exists(targetPath))) {
        await fs.copyFile(legacyModelProviderSecretPath(legacyWorkspacePath, providerId), targetPath);
        await fs.chmod(targetPath, 0o600).catch(() => undefined);
      }
    }
  }

  private async readTopic(topicId: Id): Promise<Topic> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    return this.readTopicFromManifest(workspacePath, manifest, topicId);
  }

  private async readPhase(phaseId: Id): Promise<Phase> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    return this.readPhaseFromManifest(workspacePath, manifest, phaseId);
  }

  private async readTopicFromManifest(workspacePath: string, manifest: WorkspaceManifest, topicId: Id): Promise<Topic> {
    return readJson(path.join(await this.existingTopicDirectoryPath(workspacePath, manifest, topicId), 'topic.json'), assertTopic);
  }

  private async readPhaseFromManifest(workspacePath: string, manifest: WorkspaceManifest, phaseId: Id): Promise<Phase> {
    if (phaseId === DEFAULT_PHASE_ID) {
      return this.readStoredDefaultPhase(workspacePath, manifest);
    }
    return readJson(this.phaseJsonFilePath(workspacePath, manifest, phaseId), assertPhase);
  }

  private async readMessages(topicId: Id): Promise<Message[]> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    const filePath = path.join(await this.existingTopicDirectoryPath(workspacePath, manifest, topicId), 'messages.md');
    if (!(await exists(filePath))) {
      return [];
    }
    return parseMessages(await fs.readFile(filePath, 'utf8'));
  }

  private async readTopicSummary(topicId: Id): Promise<Summary | null> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    const filePath = path.join(await this.existingTopicDirectoryPath(workspacePath, manifest, topicId), 'summary.md');
    return (await exists(filePath)) ? parseSummary(await fs.readFile(filePath, 'utf8')) : null;
  }

  private async readPhaseSummary(phaseId: Id): Promise<Summary | null> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    const filePath = this.phaseSummaryFilePath(workspacePath, manifest, phaseId);
    return (await exists(filePath)) ? parseSummary(await fs.readFile(filePath, 'utf8')) : null;
  }

  private safeExportName(value: string): string {
    return value.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'mindline-export';
  }

  private exportAttachmentRelativePath(assetDirName: string, attachment: MessageAttachment): string {
    const extension = path.extname(attachment.fileName) || imageExtension(attachment.mediaType) || '.img';
    const baseName = path.basename(safeFileName(attachment.fileName, 'image'), path.extname(attachment.fileName));
    return `${assetDirName}/${attachment.id}-${baseName}${extension}`;
  }

  private attachmentSourcePath(workspacePath: string, message: Message, attachment: MessageAttachment): string {
    if (path.isAbsolute(attachment.path)) {
      return attachment.path;
    }
    if (attachment.path.startsWith('phases/') || attachment.path.startsWith('topics/')) {
      return path.join(workspacePath, attachment.path);
    }
    return path.join(topicsRootDir(workspacePath), message.topicId, attachment.path);
  }

  private collectMessageExportAssets(messages: Message[], assetDirName: string): MarkdownExportAsset[] {
    const workspacePath = this.requireWorkspace();
    const assets = new Map<string, MarkdownExportAsset>();
    for (const message of messages) {
      for (const attachment of message.attachments ?? []) {
        const relativePath = this.exportAttachmentRelativePath(assetDirName, attachment);
        assets.set(relativePath, {
          sourcePath: this.attachmentSourcePath(workspacePath, message, attachment),
          relativePath
        });
      }
    }
    return [...assets.values()];
  }

  private messagesForSelectionExport(snapshot: WorkspaceSnapshot, items: SelectionCartItem[]): Message[] {
    const messagesById = new Map(Object.values(snapshot.messagesByTopic).flat().map((message) => [message.id, message]));
    const topicsById = new Map(snapshot.topics.map((topic) => [topic.id, topic]));
    const phasesById = new Map(snapshot.phases.map((phase) => [phase.id, phase]));
    const phaseIdSet = new Set(snapshot.phases.map((phase) => phase.id));
    const messages: Message[] = [];

    function pushTopic(topicId: Id) {
      messages.push(...(snapshot.messagesByTopic[topicId] ?? []));
    }

    for (const item of items) {
      if (item.type === 'message') {
        const message = messagesById.get(item.id);
        if (message) {
          messages.push(message);
        }
      }
      if (item.type === 'topic') {
        pushTopic(item.id);
      }
      if (item.type === 'phase') {
        const phaseTopicIds =
          item.id === DEFAULT_PHASE_ID
            ? snapshot.topics.filter((topic) => topic.status !== 'trashed' && (!topic.phaseId || !phaseIdSet.has(topic.phaseId))).map((topic) => topic.id)
            : phasesById.get(item.id)?.topicIds ?? [];
        phaseTopicIds.forEach(pushTopic);
      }
      if (item.type === 'topic-summary') {
        const summary = Object.values(snapshot.topicSummaries).find((entry) => entry?.id === item.id);
        if (summary && topicsById.has(summary.targetId)) {
          pushTopic(summary.targetId);
        }
      }
    }

    return messages;
  }

  private async syncTopicPhaseMembership(topicId: Id, previousPhaseId?: Id, nextPhaseId?: Id): Promise<void> {
    const workspacePath = this.requireWorkspace();
    const manifest = await readManifest(workspacePath);
    const affectedIds = [...new Set([previousPhaseId, nextPhaseId].filter((id): id is Id => Boolean(id)))];
    for (const phaseId of affectedIds) {
      const phase = await this.readPhase(phaseId);
      const topicIds = phaseId === nextPhaseId ? [...new Set([...phase.topicIds, topicId])] : phase.topicIds.filter((id) => id !== topicId);
      await writeJson(this.phaseJsonFilePath(workspacePath, manifest, phaseId), { ...phase, topicIds });
    }
  }

  private async autoBackup(label: string): Promise<void> {
    await this.gitBackupService.createBackup(this.requireWorkspace(), label).catch(() => undefined);
  }

  private async snapshotAfterAutoBackup(label: string): Promise<WorkspaceSnapshot> {
    await this.autoBackup(label);
    return this.snapshot();
  }

  private async snapshot(): Promise<WorkspaceSnapshot> {
    const workspacePath = this.requireWorkspace();
    const projectPath = this.requireProjectPath();
    const manifest = await readManifest(workspacePath);
    const [topics, phases] = await Promise.all([this.readAllTopics(workspacePath), this.readAllPhases(workspacePath)]);
    const messagesByTopic = Object.fromEntries(await Promise.all(topics.map(async (topic) => [topic.id, await this.readMessages(topic.id)] as const)));
    const topicSummaries = Object.fromEntries(await Promise.all(topics.map(async (topic) => [topic.id, await this.readTopicSummary(topic.id)] as const)));
    const phaseSummaries = Object.fromEntries(await Promise.all([...phases.map(async (phase) => [phase.id, await this.readPhaseSummary(phase.id)] as const), (async () => [DEFAULT_PHASE_ID, await this.readPhaseSummary(DEFAULT_PHASE_ID)] as const)()]));
    const settingsPath = this.settingsPath();
    const modelProviderState = await this.modelProviderService.list(settingsPath);

    return {
      workspacePath: projectPath,
      dataPath: workspacePath,
      settingsPath: modelProviderSettingsDir(settingsPath),
      secretsPath: modelProviderSecretsDir(settingsPath),
      manifest,
      topics,
      phases,
      messagesByTopic,
      topicSummaries,
      phaseSummaries,
      modelProviders: modelProviderState.providers,
      activeModelProviderId: modelProviderState.activeModelProviderId
    };
  }

  private buildDefaultPhase(manifest: WorkspaceManifest, topics: Topic[], phases: Phase[]): Phase {
    const phaseIdSet = new Set(phases.map((phase) => phase.id));
    const defaultPhase = manifest.defaultPhase;
    return {
      id: DEFAULT_PHASE_ID,
      title: defaultPhase?.title?.trim() || defaultPhaseFallbackTitle(),
      icon: defaultPhase?.icon?.trim() || undefined,
      description: defaultPhase?.description?.trim() || undefined,
      startedAt: defaultPhase?.startedAt ?? manifest.createdAt,
      endedAt: defaultPhase?.endedAt?.trim() || undefined,
      topicIds: topics.filter((topic) => topic.status !== 'trashed' && (!topic.phaseId || !phaseIdSet.has(topic.phaseId))).map((topic) => topic.id),
      status: 'active',
      shareId: defaultPhase?.shareId ?? `${manifest.workspaceId}:${DEFAULT_PHASE_ID}`
    };
  }

  private topicStoragePath(manifest: WorkspaceManifest, topicId: Id): string {
    return manifest.topicPaths?.[topicId] ?? topicId;
  }

  private buildTopicStoragePath(phasePath: string, topicSlug: string): string {
    return `${phasePath}/topics/${topicSlug}`;
  }

  private phaseStoragePath(manifest: WorkspaceManifest, phaseId: Id): string {
    if (phaseId === DEFAULT_PHASE_ID) {
      return manifest.phasePaths?.[DEFAULT_PHASE_ID] ?? 'default-phase';
    }
    return manifest.phasePaths?.[phaseId] ?? phaseId;
  }

  private topicDirectoryPath(workspacePath: string, manifest: WorkspaceManifest, topicId: Id): string {
    return path.join(workspacePath, 'phases', this.topicStoragePath(manifest, topicId));
  }

  private topicCandidateDirectoryPaths(workspacePath: string, manifest: WorkspaceManifest, topicId: Id): string[] {
    const topicPath = this.topicStoragePath(manifest, topicId);
    const topicSlug = path.basename(topicPath);
    return [
      path.join(workspacePath, 'phases', topicPath),
      path.join(topicsRootDir(workspacePath), topicPath),
      path.join(topicsRootDir(workspacePath), topicSlug),
      path.join(topicsRootDir(workspacePath), topicId),
      path.join(workspacePath, 'phases', this.buildTopicStoragePath(this.phaseStoragePath(manifest, DEFAULT_PHASE_ID), topicSlug)),
      ...manifest.phaseIds.flatMap((phaseId) => [
        path.join(workspacePath, 'phases', this.buildTopicStoragePath(this.phaseStoragePath(manifest, phaseId), topicSlug)),
        path.join(phaseDir(workspacePath, this.phaseStoragePath(manifest, phaseId)), 'topics', topicId)
      ])
    ];
  }

  private async existingTopicDirectoryPath(workspacePath: string, manifest: WorkspaceManifest, topicId: Id): Promise<string> {
    for (const directoryPath of this.topicCandidateDirectoryPaths(workspacePath, manifest, topicId)) {
      if (await exists(path.join(directoryPath, 'topic.json'))) {
        return directoryPath;
      }
    }
    return this.topicDirectoryPath(workspacePath, manifest, topicId);
  }

  private topicJsonFilePath(workspacePath: string, manifest: WorkspaceManifest, topicId: Id): string {
    return path.join(this.topicDirectoryPath(workspacePath, manifest, topicId), 'topic.json');
  }

  private messagesFilePath(workspacePath: string, manifest: WorkspaceManifest, topicId: Id): string {
    return path.join(this.topicDirectoryPath(workspacePath, manifest, topicId), 'messages.md');
  }

  private topicSummaryFilePath(workspacePath: string, manifest: WorkspaceManifest, topicId: Id): string {
    return path.join(this.topicDirectoryPath(workspacePath, manifest, topicId), 'summary.md');
  }

  private phaseJsonFilePath(workspacePath: string, manifest: WorkspaceManifest, phaseId: Id): string {
    return phaseJsonPath(workspacePath, this.phaseStoragePath(manifest, phaseId));
  }

  private phaseSummaryFilePath(workspacePath: string, manifest: WorkspaceManifest, phaseId: Id): string {
    return phaseSummaryPath(workspacePath, this.phaseStoragePath(manifest, phaseId));
  }

  private async renameStorageDirectory(currentPath: string, nextPath: string): Promise<void> {
    if (currentPath === nextPath || !(await exists(currentPath))) {
      return;
    }
    await fs.mkdir(path.dirname(nextPath), { recursive: true });
    await fs.rename(currentPath, nextPath);
  }

  private async readStoredDefaultPhase(workspacePath: string, manifest: WorkspaceManifest): Promise<Phase> {
    const filePath = this.phaseJsonFilePath(workspacePath, manifest, DEFAULT_PHASE_ID);
    if (await exists(filePath)) {
      return readJson(filePath, assertPhase);
    }
    return {
      id: DEFAULT_PHASE_ID,
      title: manifest.defaultPhase?.title?.trim() || defaultPhaseFallbackTitle(),
      icon: manifest.defaultPhase?.icon?.trim() || undefined,
      description: manifest.defaultPhase?.description?.trim() || undefined,
      startedAt: manifest.defaultPhase?.startedAt ?? manifest.createdAt,
      endedAt: manifest.defaultPhase?.endedAt?.trim() || undefined,
      topicIds: [],
      status: 'active',
      shareId: manifest.defaultPhase?.shareId ?? `${manifest.workspaceId}:${DEFAULT_PHASE_ID}`
    };
  }

  private async syncDefaultPhaseStorage(workspacePath: string, manifest: WorkspaceManifest): Promise<void> {
    const stored = await this.readStoredDefaultPhase(workspacePath, manifest);
    const nextPhase: Phase = {
      ...stored,
      id: DEFAULT_PHASE_ID,
      title: manifest.defaultPhase?.title?.trim() || stored.title || defaultPhaseFallbackTitle(),
      icon: manifest.defaultPhase?.icon?.trim() || stored.icon,
      description: manifest.defaultPhase?.description?.trim() || stored.description,
      startedAt: manifest.defaultPhase?.startedAt ?? stored.startedAt ?? manifest.createdAt,
      endedAt: manifest.defaultPhase?.endedAt?.trim() || stored.endedAt,
      topicIds: [],
      status: 'active',
      shareId: manifest.defaultPhase?.shareId ?? stored.shareId ?? `${manifest.workspaceId}:${DEFAULT_PHASE_ID}`
    };
    await writeJson(this.phaseJsonFilePath(workspacePath, manifest, DEFAULT_PHASE_ID), nextPhase);
  }

  private async ensureReadableStorageLayout(workspacePath: string): Promise<void> {
    const manifest = await readManifest(workspacePath);
    const nextManifest: WorkspaceManifest = {
      ...manifest,
      topicPaths: { ...(manifest.topicPaths ?? {}) },
      phasePaths: { ...(manifest.phasePaths ?? {}), [DEFAULT_PHASE_ID]: manifest.phasePaths?.[DEFAULT_PHASE_ID] ?? 'default-phase' }
    };
    let changed = manifest.phasePaths?.[DEFAULT_PHASE_ID] !== nextManifest.phasePaths?.[DEFAULT_PHASE_ID] || !manifest.topicPaths || !manifest.phasePaths;

    const takenPhasePaths = new Set<string>([
      nextManifest.phasePaths?.[DEFAULT_PHASE_ID] ?? 'default-phase',
      ...manifest.phaseIds.map((phaseId) => nextManifest.phasePaths?.[phaseId] ?? phaseId)
    ]);
    for (const phaseId of manifest.phaseIds) {
      const currentPath = nextManifest.phasePaths?.[phaseId] ?? phaseId;
      const phase = await readJson(phaseJsonPath(workspacePath, currentPath), assertPhase);
      takenPhasePaths.delete(currentPath);
      const desiredPath = uniqueSlug(slugifySegment(phase.title, 'phase'), takenPhasePaths, nextManifest.phasePaths?.[phaseId]);
      if (currentPath !== desiredPath) {
        await this.renameStorageDirectory(phaseDir(workspacePath, currentPath), phaseDir(workspacePath, desiredPath));
        changed = true;
      }
      nextManifest.phasePaths![phaseId] = desiredPath;
      takenPhasePaths.add(desiredPath);
    }

    const takenTopicPaths = new Set<string>(
      Object.values(nextManifest.topicPaths ?? {})
        .filter((topicPath) => topicPath.includes('/topics/'))
        .map((topicPath) => path.basename(topicPath))
    );
    for (const topicId of manifest.topicIds) {
      const currentPath = nextManifest.topicPaths?.[topicId] ?? topicId;
      const topic = await readJson(path.join(await this.existingTopicDirectoryPath(workspacePath, nextManifest, topicId), 'topic.json'), assertTopic);
      const parentPhasePath = this.phaseStoragePath(nextManifest, topic.phaseId ?? DEFAULT_PHASE_ID);
      const currentSlug = currentPath.includes('/topics/') ? path.basename(currentPath) : undefined;
      if (currentSlug) {
        takenTopicPaths.delete(currentSlug);
      }
      const desiredSlug = uniqueSlug(slugifySegment(topic.title, 'topic'), takenTopicPaths, currentSlug);
      const desiredPath = this.buildTopicStoragePath(parentPhasePath, desiredSlug);
      nextManifest.topicPaths![topicId] = desiredPath;
      const currentTopicDir = await this.existingTopicDirectoryPath(workspacePath, manifest, topicId);
      const desiredTopicDir = path.join(workspacePath, 'phases', desiredPath);
      if (currentTopicDir !== desiredTopicDir) {
        await this.renameStorageDirectory(currentTopicDir, desiredTopicDir);
        changed = true;
      }
      takenTopicPaths.add(desiredSlug);
    }

    if (changed) {
      await writeManifest(workspacePath, nextManifest);
    }
    await this.syncDefaultPhaseStorage(workspacePath, nextManifest);
  }

  private async readAllTopics(workspacePath: string): Promise<Topic[]> {
    const manifest = await readManifest(workspacePath);
    return Promise.all(manifest.topicIds.map((topicId) => this.readTopic(topicId)));
  }

  private async readAllPhases(workspacePath: string): Promise<Phase[]> {
    const manifest = await readManifest(workspacePath);
    return Promise.all(manifest.phaseIds.map((phaseId) => this.readPhase(phaseId)));
  }
}

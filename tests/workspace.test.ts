import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMessageCartItem, createPhaseCartItem, createTopicCartItem, createTopicSummaryCartItem, buildSelectionContext } from '../src/shared/cart';
import { cloudModelPresets, getModelProviderDefault } from '../src/shared/modelProviderPresets';
import { PHASE_ICON_OPTIONS, randomPhaseIcon } from '../src/shared/phaseIcons';
import { WorkspaceService } from '../src/main/workspace';
import { DEFAULT_PHASE_ID, type Message, type ModelAdapter, type Phase, type Summary } from '../src/shared/types';

let tempRoot: string;

async function createTempWorkspace(name = 'groupai-test') {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), `${name}-`));
  return path.join(tempRoot, 'workspace');
}

function createTestAdapter(): ModelAdapter {
  return {
    id: 'test-adapter',
    label: 'Test Adapter',
    async sendMessage({ topic, messages, prompt }) {
      return {
        id: `assistant-${messages.length}`,
        topicId: topic.id,
        role: 'assistant',
        content: `Test reply for "${topic.title}": ${prompt}`,
        createdAt: new Date().toISOString(),
        modelId: this.id
      } satisfies Message;
    },
    async sendMessageStream({ topic, messages, prompt, onChunk }) {
      onChunk('Streamed ', 'Streamed ');
      onChunk(`reply: ${prompt}`, `Streamed reply: ${prompt}`);
      return {
        id: `assistant-stream-${messages.length}`,
        topicId: topic.id,
        role: 'assistant',
        content: `Streamed reply: ${prompt}`,
        createdAt: new Date().toISOString(),
        modelId: this.id
      } satisfies Message;
    },
    async summarizeTopic({ topic, messages }) {
      return {
        id: `summary-${topic.id}`,
        targetType: 'topic',
        targetId: topic.id,
        content: `Topic "${topic.title}" has ${messages.length} message(s).`,
        createdAt: new Date().toISOString(),
        sourceRefs: messages.map((message) => ({ type: 'message', id: message.id, topicId: topic.id }))
      } satisfies Summary;
    },
    async summarizePhase({ phase, topics }) {
      return {
        id: `summary-${phase.id}`,
        targetType: 'phase',
        targetId: phase.id,
        content: [`Phase "${phase.title}" includes ${topics.length} topic(s).`, ...topics.map((topic) => `- ${topic.title}`)].join('\n'),
        createdAt: new Date().toISOString(),
        sourceRefs: topics.map((topic) => ({ type: 'topic', id: topic.id, phaseId: phase.id }))
      } satisfies Summary;
    },
    async discussSelection({ prompt, contextMarkdown, sourceRefs }) {
      return {
        id: 'selection-reply',
        topicId: 'selection',
        role: 'assistant',
        content: `Selection reply: ${prompt}\n${contextMarkdown.slice(0, 40)}\nSources: ${sourceRefs.length}`,
        createdAt: new Date().toISOString(),
        modelId: this.id
      } satisfies Message;
    }
  };
}

function createService(): WorkspaceService {
  return new WorkspaceService({ appHome: path.join(tempRoot, '.mindline'), modelAdapterFactory: async () => createTestAdapter() });
}

async function git(args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${stderr || stdout || error.message}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function createBareRemote(name: string): Promise<string> {
  const remotePath = path.join(tempRoot, name);
  await git(['init', '--bare', remotePath]);
  return remotePath;
}

async function seedPlainRemote(remotePath: string): Promise<void> {
  const clonePath = path.join(tempRoot, 'plain-remote-seed');
  await git(['init', clonePath]);
  await git(['config', 'user.name', 'Mindline Test'], clonePath);
  await git(['config', 'user.email', 'mindline-test@example.invalid'], clonePath);
  await fs.writeFile(path.join(clonePath, 'README.md'), '# plain project\n', 'utf8');
  await git(['add', 'README.md'], clonePath);
  await git(['commit', '-m', 'plain project'], clonePath);
  await git(['branch', '-M', 'main'], clonePath);
  await git(['remote', 'add', 'origin', remotePath], clonePath);
  await git(['push', 'origin', 'main'], clonePath);
}

function requireDataPath(snapshot: { dataPath?: string }): string {
  expect(snapshot.dataPath).toBeTruthy();
  return snapshot.dataPath!;
}

function requireSettingsPath(snapshot: { settingsPath?: string }): string {
  expect(snapshot.settingsPath).toBeTruthy();
  return snapshot.settingsPath!;
}

function resolveTestAttachmentPath(workspacePath: string, topicId: string, attachmentPath: string): string {
  return attachmentPath.startsWith('phases/') || attachmentPath.startsWith('topics/')
    ? path.join(workspacePath, attachmentPath)
    : path.join(workspacePath, 'topics', topicId, attachmentPath);
}

async function readManifestFile(workspacePath: string): Promise<{
  phaseIds?: string[];
  phasePaths?: Record<string, string>;
  topicPaths?: Record<string, string>;
}> {
  return JSON.parse(await fs.readFile(path.join(workspacePath, '.mindline', 'manifest.json'), 'utf8')) as {
    phaseIds?: string[];
    phasePaths?: Record<string, string>;
    topicPaths?: Record<string, string>;
  };
}

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'groupai-suite-'));
});

afterEach(async () => {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

describe('WorkspaceService', () => {
  it('chooses a phase icon from the shared icon set', () => {
    expect(randomPhaseIcon(() => 0)).toBe(PHASE_ICON_OPTIONS[0]);
    expect(randomPhaseIcon(() => 1)).toBe(PHASE_ICON_OPTIONS[PHASE_ICON_OPTIONS.length - 1]);
  });

  it('initializes project data under the selected project folder', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();

    const snapshot = await service.createWorkspace({ workspacePath, name: 'Think Lab' });
    const dataPath = requireDataPath(snapshot);
    const settingsPath = requireSettingsPath(snapshot);

    expect(snapshot.manifest.name).toBe('Think Lab');
    expect(snapshot.workspacePath).toBe(workspacePath);
    expect(snapshot.manifest.projectPath).toBe(workspacePath);
    expect(dataPath).toBe(workspacePath);
    expect(settingsPath).toBe(path.join(tempRoot, '.mindline', 'model-providers'));
    await expect(fs.stat(path.join(workspacePath, 'manifest.json'))).rejects.toThrow();
    await expect(fs.stat(path.join(workspacePath, '.mindline', 'manifest.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dataPath, 'phases'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dataPath, 'phases', 'default-phase', 'phase.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(settingsPath, 'secrets'))).resolves.toBeTruthy();
  });

  it('opens an arbitrary project folder by creating Mindline project data inside it', async () => {
    const workspacePath = path.join(tempRoot, 'empty-folder');
    await fs.mkdir(workspacePath, { recursive: true });
    const service = createService();

    const snapshot = await service.openWorkspace(workspacePath);
    const dataPath = requireDataPath(snapshot);

    expect(snapshot.workspacePath).toBe(workspacePath);
    expect(dataPath).toBe(workspacePath);
    await expect(fs.stat(path.join(dataPath, '.mindline', 'manifest.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dataPath, 'phases'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dataPath, 'phases', 'default-phase', 'phase.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(workspacePath, 'manifest.json'))).rejects.toThrow();
  });

  it('opens the parent project when an internal storage folder is selected', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    const snapshot = await service.openWorkspace(path.join(workspacePath, 'phases'));

    expect(snapshot.workspacePath).toBe(workspacePath);
    expect(requireDataPath(snapshot)).toBe(workspacePath);
    await expect(fs.stat(path.join(workspacePath, 'phases', '.mindline', 'manifest.json'))).rejects.toThrow();
  });

  it('ignores accidental nested workspaces inside internal storage folders', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });
    await fs.mkdir(path.join(workspacePath, 'phases', '.mindline'), { recursive: true });
    await fs.writeFile(
      path.join(workspacePath, 'phases', '.mindline', 'manifest.json'),
      `${JSON.stringify(
        {
          version: 1,
          workspaceId: 'nested-workspace',
          name: 'phases',
          projectPath: path.join(workspacePath, 'phases'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          topicIds: [],
          phaseIds: []
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const snapshot = await service.openWorkspace(path.join(workspacePath, 'phases'));

    expect(snapshot.workspacePath).toBe(workspacePath);
    expect(requireDataPath(snapshot)).toBe(workspacePath);
    expect(snapshot.manifest.workspaceId).not.toBe('nested-workspace');
  });

  it('creates readable phase and topic directories with manifest path indexes', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    let snapshot = await service.createPhase({ title: 'Research Plan' });
    const phaseId = snapshot.phases[0].id;
    snapshot = await service.createTopic({ title: 'New', phaseId });
    snapshot = await service.createTopic({ title: 'New', phaseId });

    const manifest = await readManifestFile(workspacePath);
    expect(manifest.phasePaths?.[phaseId]).toBe('research-plan');
    expect(manifest.phasePaths?.[DEFAULT_PHASE_ID]).toBe('default-phase');

    const topicPaths = Object.values(manifest.topicPaths ?? {}).sort();
    expect(topicPaths).toEqual(['research-plan/topics/new', 'research-plan/topics/new-2']);

    await expect(fs.stat(path.join(workspacePath, 'phases', 'research-plan', 'phase.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(workspacePath, 'phases', 'default-phase', 'phase.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(workspacePath, 'phases', 'research-plan', 'topics', 'new', 'topic.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(workspacePath, 'phases', 'research-plan', 'topics', 'new-2', 'topic.json'))).resolves.toBeTruthy();
  });

  it('keeps readable duplicate phase slugs stable after reordering and reopening', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    const phaseIds: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      const snapshot = await service.createPhase({ title: 'New' });
      phaseIds.push(snapshot.manifest.phaseIds[snapshot.manifest.phaseIds.length - 1]);
    }

    const manifestPath = path.join(workspacePath, '.mindline', 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { phaseIds: string[]; phasePaths: Record<string, string> };
    expect(phaseIds.map((phaseId) => manifest.phasePaths[phaseId])).toEqual(['new', 'new-2', 'new-3', 'new-4', 'new-5', 'new-6']);

    manifest.phaseIds = [phaseIds[5], phaseIds[0], phaseIds[1], phaseIds[2], phaseIds[3], phaseIds[4]];
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    await createService().openWorkspace(workspacePath);

    const reopenedManifest = await readManifestFile(workspacePath);
    expect(phaseIds.map((phaseId) => reopenedManifest.phasePaths?.[phaseId])).toEqual(['new', 'new-2', 'new-3', 'new-4', 'new-5', 'new-6']);
    await Promise.all(['new', 'new-2', 'new-3', 'new-4', 'new-5', 'new-6'].map((phasePath) => expect(fs.stat(path.join(workspacePath, 'phases', phasePath, 'phase.json'))).resolves.toBeTruthy()));
  });

  it('migrates legacy uuid directories into readable slug directories on open', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const phaseId = 'phase-legacy-id';
    const topicId = 'topic-legacy-id';
    await fs.mkdir(path.join(workspacePath, '.mindline'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'phases', phaseId), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'topics', topicId), { recursive: true });
    await fs.writeFile(
      path.join(workspacePath, '.mindline', 'manifest.json'),
      `${JSON.stringify(
        {
          version: 1,
          workspaceId: 'workspace-legacy',
          name: 'Legacy Project',
          projectPath: workspacePath,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          topicIds: [topicId],
          phaseIds: [phaseId],
          defaultPhase: {
            title: '默认阶段',
            startedAt: new Date().toISOString(),
            shareId: 'workspace-legacy:__default_phase__'
          }
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await fs.writeFile(
      path.join(workspacePath, 'phases', phaseId, 'phase.json'),
      `${JSON.stringify(
        {
          id: phaseId,
          title: 'Legacy Phase',
          icon: '💡',
          startedAt: new Date().toISOString(),
          topicIds: [topicId],
          status: 'active',
          shareId: 'legacy-phase-share'
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await fs.writeFile(
      path.join(workspacePath, 'topics', topicId, 'topic.json'),
      `${JSON.stringify(
        {
          id: topicId,
          title: 'Legacy Topic',
          phaseId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active',
          shareId: 'legacy-topic-share'
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await fs.writeFile(path.join(workspacePath, 'topics', topicId, 'messages.md'), '', 'utf8');

    const service = createService();
    await service.openWorkspace(workspacePath);

    const manifest = await readManifestFile(workspacePath);
    expect(manifest.phasePaths?.[phaseId]).toBe('legacy-phase');
    expect(manifest.topicPaths?.[topicId]).toBe('legacy-phase/topics/legacy-topic');
    expect(manifest.phasePaths?.[DEFAULT_PHASE_ID]).toBe('default-phase');

    await expect(fs.stat(path.join(workspacePath, 'phases', 'legacy-phase', 'phase.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(workspacePath, 'phases', 'legacy-phase', 'topics', 'legacy-topic', 'topic.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(workspacePath, 'phases', 'default-phase', 'phase.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(workspacePath, 'phases', phaseId))).rejects.toThrow();
    await expect(fs.stat(path.join(workspacePath, 'topics', topicId))).rejects.toThrow();
  });

  it('moves topic directories with their target phase', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    let snapshot = await service.createPhase({ title: 'Phase A' });
    const phaseAId = snapshot.phases[0].id;
    snapshot = await service.createPhase({ title: 'Phase B' });
    const phaseBId = snapshot.phases[1].id;
    snapshot = await service.createTopic({ title: 'Move Me', phaseId: phaseAId });
    const topicId = snapshot.topics[0].id;

    const manifestBefore = await readManifestFile(workspacePath);
    const topicPath = manifestBefore.topicPaths?.[topicId];
    expect(topicPath).toBe('phase-a/topics/move-me');
    await expect(fs.stat(path.join(workspacePath, 'phases', 'phase-a', 'topics', 'move-me', 'topic.json'))).resolves.toBeTruthy();

    await service.updateTopic(topicId, { phaseId: phaseBId });

    await expect(fs.stat(path.join(workspacePath, 'phases', 'phase-b', 'topics', 'move-me', 'topic.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(workspacePath, 'phases', 'phase-a', 'topics', 'move-me'))).rejects.toThrow();
  });

  it('keeps topic paths writable after renaming their phase directory', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    let snapshot = await service.createPhase({ title: 'Old Phase' });
    const phaseId = snapshot.phases[0].id;
    snapshot = await service.createTopic({ title: 'Child Topic', phaseId });
    const topicId = snapshot.topics[0].id;

    await service.updatePhase(phaseId, { title: 'New Phase' });
    snapshot = await service.addUserMessage(topicId, 'message after phase rename');

    const manifest = await readManifestFile(workspacePath);
    expect(manifest.phasePaths?.[phaseId]).toBe('new-phase');
    expect(manifest.topicPaths?.[topicId]).toBe('new-phase/topics/child-topic');
    expect(snapshot.messagesByTopic[topicId].map((message) => message.content)).toEqual(['message after phase rename']);
    await expect(fs.stat(path.join(workspacePath, 'phases', 'new-phase', 'topics', 'child-topic', 'messages.md'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(workspacePath, 'phases', 'old-phase'))).rejects.toThrow();
  });

  it('migrates legacy app-home workspace data into visible project folders', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    const legacyPath = service.getLegacyWorkspaceDataPathForProject(workspacePath);
    await fs.mkdir(path.join(legacyPath, 'topics'), { recursive: true });
    await fs.mkdir(path.join(legacyPath, 'phases'), { recursive: true });
    await fs.writeFile(
      path.join(legacyPath, 'manifest.json'),
      `${JSON.stringify(
        {
          version: 1,
          workspaceId: 'legacy-workspace',
          name: 'Legacy Project',
          projectPath: workspacePath,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          topicIds: [],
          phaseIds: []
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await fs.mkdir(path.join(legacyPath, '.groupai', 'secrets', 'model-providers'), { recursive: true });
    await fs.writeFile(
      path.join(legacyPath, '.groupai', 'model-providers.json'),
      `${JSON.stringify(
        {
          version: 1,
          activeModelProviderId: 'provider-1',
          providers: [
            {
              id: 'provider-1',
              name: 'Legacy Provider',
              kind: 'cloud-model',
              providerKey: 'minimax',
              enabled: true,
              config: { baseUrl: 'https://minimax-m2.com/api/v1', defaultModel: 'MiniMax-M2' },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await fs.writeFile(path.join(legacyPath, '.groupai', 'secrets', 'model-providers', 'provider-1.json'), `${JSON.stringify({ apiKey: 'sk-legacy' })}\n`, 'utf8');

    const snapshot = await service.openWorkspace(workspacePath);
    const dataPath = requireDataPath(snapshot);
    const settingsPath = requireSettingsPath(snapshot);

    expect(dataPath).toBe(workspacePath);
    await expect(fs.stat(path.join(dataPath, '.mindline', 'manifest.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dataPath, 'phases'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dataPath, 'phases', 'default-phase', 'phase.json'))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(dataPath, '.mindline', '.groupai'))).rejects.toThrow();
    expect(snapshot.modelProviders[0].name).toBe('Legacy Provider');
    expect(snapshot.modelProviders[0].hasApiKey).toBe(true);
    await expect(fs.readFile(path.join(settingsPath, 'config.json'), 'utf8')).resolves.toContain('Legacy Provider');
    await expect(fs.readFile(path.join(settingsPath, 'secrets', 'provider-1.json'), 'utf8')).resolves.toContain('sk-legacy');
  });

  it('migrates old user-level .groupai model settings into the model providers folder', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const oldSettingsRoot = path.join(tempRoot, '.mindline', '.groupai');
    await fs.mkdir(path.join(oldSettingsRoot, 'secrets', 'model-providers'), { recursive: true });
    await fs.writeFile(
      path.join(oldSettingsRoot, 'model-providers.json'),
      `${JSON.stringify(
        {
          version: 1,
          activeModelProviderId: 'provider-legacy-user',
          providers: [
            {
              id: 'provider-legacy-user',
              name: 'Old User Provider',
              kind: 'cloud-model',
              providerKey: 'minimax',
              enabled: true,
              config: { baseUrl: 'https://minimax-m2.com/api/v1', defaultModel: 'MiniMax-M2' },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await fs.writeFile(path.join(oldSettingsRoot, 'secrets', 'model-providers', 'provider-legacy-user.json'), `${JSON.stringify({ apiKey: 'sk-user-legacy' })}\n`, 'utf8');

    const service = createService();
    const snapshot = await service.createWorkspace({ workspacePath });
    const settingsPath = requireSettingsPath(snapshot);

    expect(snapshot.modelProviders[0].name).toBe('Old User Provider');
    expect(snapshot.modelProviders[0].hasApiKey).toBe(true);
    await expect(fs.readFile(path.join(settingsPath, 'config.json'), 'utf8')).resolves.toContain('Old User Provider');
    await expect(fs.readFile(path.join(settingsPath, 'secrets', 'provider-legacy-user.json'), 'utf8')).resolves.toContain('sk-user-legacy');
  });

  it('migrates split settings and secrets folders into the model providers folder', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    await fs.mkdir(path.join(tempRoot, '.mindline', 'settings'), { recursive: true });
    await fs.mkdir(path.join(tempRoot, '.mindline', 'secrets', 'model-providers'), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, '.mindline', 'settings', 'model-providers.json'),
      `${JSON.stringify(
        {
          version: 1,
          activeModelProviderId: 'provider-split',
          providers: [
            {
              id: 'provider-split',
              name: 'Split Provider',
              kind: 'cloud-model',
              providerKey: 'minimax',
              enabled: true,
              config: { baseUrl: 'https://minimax-m2.com/api/v1', defaultModel: 'MiniMax-M2' },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ]
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await fs.writeFile(path.join(tempRoot, '.mindline', 'secrets', 'model-providers', 'provider-split.json'), `${JSON.stringify({ apiKey: 'sk-split' })}\n`, 'utf8');

    const service = createService();
    const snapshot = await service.createWorkspace({ workspacePath });
    const settingsPath = requireSettingsPath(snapshot);

    expect(snapshot.modelProviders[0].name).toBe('Split Provider');
    expect(snapshot.modelProviders[0].hasApiKey).toBe(true);
    await expect(fs.readFile(path.join(settingsPath, 'config.json'), 'utf8')).resolves.toContain('Split Provider');
    await expect(fs.readFile(path.join(settingsPath, 'secrets', 'provider-split.json'), 'utf8')).resolves.toContain('sk-split');
  });

  it('persists phases, topics, messages, and summaries across reopen', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    let snapshot = await service.createPhase({ title: 'Research' });
    const phaseId = snapshot.phases[0].id;
    snapshot = await service.createTopic({ title: 'Local AI notes', phaseId });
    const topicId = snapshot.topics[0].id;
    snapshot = await service.generateAssistantReply(topicId, 'How should local storage work?');
    snapshot = await service.summarizeTopic(topicId);
    snapshot = await service.summarizePhase(phaseId);

    expect(snapshot.messagesByTopic[topicId]).toHaveLength(2);
    expect(snapshot.topicSummaries[topicId]?.content).toContain('Local AI notes');
    expect(snapshot.phaseSummaries[phaseId]?.content).toContain('Research');

    const reopened = createService();
    const reopenedSnapshot = await reopened.openWorkspace(workspacePath);

    expect(reopenedSnapshot.workspacePath).toBe(workspacePath);
    expect(reopenedSnapshot.phases[0].topicIds).toEqual([topicId]);
    expect(reopenedSnapshot.messagesByTopic[topicId]).toHaveLength(2);
    expect(reopenedSnapshot.topicSummaries[topicId]?.targetId).toBe(topicId);
    expect(reopenedSnapshot.phaseSummaries[phaseId]?.targetId).toBe(phaseId);
  });

  it('normalizes stale hidden .mindline workspace roots back to the project folder', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    let snapshot = await service.createWorkspace({ workspacePath });
    snapshot = await service.createTopic({ title: 'Visible Topic' });
    const topicId = snapshot.topics[0].id;
    const staleService = service as unknown as { workspacePath: string; projectPath: string };
    staleService.workspacePath = path.join(workspacePath, '.mindline');
    staleService.projectPath = workspacePath;

    const reopenedSnapshot = await service.getSnapshot();

    expect(reopenedSnapshot?.dataPath).toBe(workspacePath);
    expect(reopenedSnapshot?.topics[0].id).toBe(topicId);
  });

  it('streams assistant replies and persists the final assistant message', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });
    const snapshot = await service.createTopic({ title: 'Streaming Topic' });
    const topicId = snapshot.topics[0].id;
    const chunks: string[] = [];

    const result = await service.generateAssistantReplyStream(topicId, 'stream this', undefined, {
      onChunk: (_delta, content) => chunks.push(content)
    });

    expect(chunks).toEqual(['Streamed ', 'Streamed reply: stream this']);
    expect(result.message.content).toBe('Streamed reply: stream this');
    expect(result.snapshot.messagesByTopic[topicId].map((entry) => entry.role)).toEqual(['user', 'assistant']);
  });

  it('saves image attachments and exports them with markdown assets', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });
    const snapshot = await service.createTopic({ title: 'Image Topic' });
    const topicId = snapshot.topics[0].id;
    const imageDataUrl = `data:image/png;base64,${Buffer.from('fake-image').toString('base64')}`;

    const result = await service.generateAssistantReplyStream(topicId, 'Describe this', {
      attachments: [{ fileName: 'screen.png', mediaType: 'image/png', size: 10, dataUrl: imageDataUrl }]
    }, {
      onChunk: () => undefined
    });
    const userMessage = result.snapshot.messagesByTopic[topicId][0];

    expect(userMessage.attachments?.[0]?.fileName).toBe('screen.png');
    expect(userMessage.attachments?.[0]?.path).toContain('attachments/');
    const imagePath = resolveTestAttachmentPath(workspacePath, topicId, userMessage.attachments![0].path);
    await expect(fs.access(imagePath)).resolves.toBeUndefined();

    const exported = await service.buildTopicExportMarkdown(topicId, 'zh');
    expect(exported.markdown).toContain('![screen.png]');
    expect(exported.markdown).toContain('Image Topic.assets/');
    expect(exported.assets?.[0]?.sourcePath).toBe(imagePath);
    expect(exported.assets?.[0]?.relativePath).toContain('Image Topic.assets/');
  });

  it('saves text attachments and exports them as markdown asset links', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });
    const snapshot = await service.createTopic({ title: 'Text Topic' });
    const topicId = snapshot.topics[0].id;
    const textDataUrl = `data:text/markdown;base64,${Buffer.from('# Notes\n\nImportant context').toString('base64')}`;

    const result = await service.generateAssistantReplyStream(topicId, 'Read this', {
      attachments: [{ type: 'text', fileName: 'notes.md', mediaType: 'text/markdown', size: Buffer.byteLength('# Notes\n\nImportant context'), dataUrl: textDataUrl }]
    }, {
      onChunk: () => undefined
    });
    const userMessage = result.snapshot.messagesByTopic[topicId][0];

    expect(userMessage.attachments?.[0]?.type).toBe('text');
    expect(userMessage.attachments?.[0]?.fileName).toBe('notes.md');
    const textPath = resolveTestAttachmentPath(workspacePath, topicId, userMessage.attachments![0].path);
    await expect(fs.readFile(textPath, 'utf8')).resolves.toContain('Important context');

    const exported = await service.buildTopicExportMarkdown(topicId, 'zh');
    expect(exported.markdown).toContain('[notes.md]');
    expect(exported.assets?.[0]?.sourcePath).toBe(textPath);
  });

  it('rejects sensitive config files as text attachments', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });
    const snapshot = await service.createTopic({ title: 'Sensitive Text Topic' });
    const topicId = snapshot.topics[0].id;
    const textDataUrl = `data:text/plain;base64,${Buffer.from('API_KEY=secret').toString('base64')}`;

    await expect(service.generateAssistantReplyStream(topicId, 'Read this', {
      attachments: [{ type: 'text', fileName: '.env', mediaType: 'text/plain', size: 14, dataUrl: textDataUrl }]
    }, {
      onChunk: () => undefined
    })).rejects.toThrow('密钥配置文件');
  });

  it('rejects unsupported document extensions even when marked as text', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });
    const snapshot = await service.createTopic({ title: 'Unsupported Text Topic' });
    const topicId = snapshot.topics[0].id;
    const textDataUrl = `data:text/plain;base64,${Buffer.from('fake pdf').toString('base64')}`;

    await expect(service.generateAssistantReplyStream(topicId, 'Read this', {
      attachments: [{ type: 'text', fileName: 'report.pdf', mediaType: 'text/plain', size: 8, dataUrl: textDataUrl }]
    }, {
      onChunk: () => undefined
    })).rejects.toThrow('暂不支持 PDF');
  });

  it('creates git backups for workspace data changes without storing project files or secrets', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });
    await fs.writeFile(path.join(workspacePath, 'project-note.txt'), 'outside backup\n', 'utf8');

    let timeline = await service.listBackups();
    const initialCount = timeline.commits.length;
    expect(initialCount).toBeGreaterThan(0);

    const snapshot = await service.createTopic({ title: 'Backed Topic' });
    const topicId = snapshot.topics[0].id;
    await service.addModelProvider({
      kind: 'cloud-model',
      providerKey: 'minimax',
      name: 'Secret Provider',
      config: { baseUrl: 'https://minimax-m2.com/api/v1', defaultModel: 'MiniMax-M2' },
      apiKey: 'sk-backup-secret'
    });

    timeline = await service.listBackups();
    expect(timeline.status.gitAvailable).toBe(true);
    expect(timeline.status.initialized).toBe(true);
    expect(timeline.commits.length).toBeGreaterThan(initialCount);

    const repoPath = timeline.status.backupPath!;
    const tree = await new Promise<string>((resolve, reject) => {
      execFile('git', ['--git-dir', repoPath, 'ls-tree', '-r', '--name-only', 'HEAD'], (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
    expect(tree).toContain('.mindline/manifest.json');
    expect(tree).toContain(`topics/${snapshot.manifest.topicPaths?.[topicId]}/topic.json`);
    expect(tree).not.toContain('project-note.txt');
    expect(tree).not.toContain('sk-backup-secret');
  });

  it('restores Mindline data to a previous git backup snapshot', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });
    let snapshot = await service.createTopic({ title: 'Original Topic' });
    const topicId = snapshot.topics[0].id;
    await service.addUserMessage(topicId, 'first message');
    const originalTimeline = await service.listBackups();
    const restoreTarget = originalTimeline.commits[0];

    snapshot = await service.updateTopic(topicId, { title: 'Changed Topic' });
    await service.addUserMessage(topicId, 'second message');
    await fs.writeFile(path.join(workspacePath, 'project-note.txt'), 'keep me\n', 'utf8');

    const restored = await service.restoreBackup(restoreTarget.commitId);

    expect(restored.topics.find((topic) => topic.id === topicId)?.title).toBe('Original Topic');
    expect(restored.messagesByTopic[topicId].map((message) => message.content)).toEqual(['first message']);
    await expect(fs.readFile(path.join(workspacePath, 'project-note.txt'), 'utf8')).resolves.toBe('keep me\n');
    const afterRestoreTimeline = await service.listBackups();
    expect(afterRestoreTimeline.commits[0].message).toContain(restoreTarget.shortId);
  });

  it('syncs git backups to an empty remote without project files', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const remotePath = await createBareRemote('mindline-remote.git');
    const service = createService();
    let snapshot = await service.createWorkspace({ workspacePath });
    snapshot = await service.createTopic({ title: 'Remote Topic' });
    await fs.writeFile(path.join(workspacePath, 'project-note.txt'), 'outside backup\n', 'utf8');

    const status = await service.configureBackupRemote({
      provider: 'generic',
      remoteUrl: remotePath,
      branch: 'main',
      authMode: 'system'
    });

    expect(status.remote?.configured).toBe(true);
    expect(status.remote?.lastSyncAt).toBeTruthy();
    const tree = await git(['--git-dir', remotePath, 'ls-tree', '-r', '--name-only', 'main']);
    expect(tree).toContain('.mindline/manifest.json');
    expect(tree).toContain(`phases/${snapshot.manifest.topicPaths?.[snapshot.topics[0].id]}/topic.json`);
    expect(tree).not.toContain('project-note.txt');
  });

  it('keeps PAT tokens out of git config, remote URL, status, and commits', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const remotePath = await createBareRemote('pat-remote.git');
    const service = createService();
    const snapshot = await service.createWorkspace({ workspacePath });
    await service.createTopic({ title: 'Token Safe Topic' });
    const token = 'ghp_mindline_secret_token';

    const status = await service.configureBackupRemote({
      provider: 'github',
      remoteUrl: remotePath,
      branch: 'main',
      authMode: 'pat',
      username: 'x-access-token',
      token
    });

    const backupPath = status.backupPath!;
    const remoteUrl = await git(['--git-dir', backupPath, 'config', '--get', 'remote.mindline.url']);
    const configText = await fs.readFile(path.join(tempRoot, '.mindline', 'backup-remotes', 'config.json'), 'utf8');
    const secretText = await fs.readFile(path.join(tempRoot, '.mindline', 'backup-remotes', 'secrets', `${snapshot.manifest.workspaceId}.json`), 'utf8');
    const commitTree = await git(['--git-dir', backupPath, 'ls-tree', '-r', '--name-only', 'HEAD']);

    expect(remoteUrl).not.toContain(token);
    expect(configText).not.toContain(token);
    expect(JSON.stringify(status)).not.toContain(token);
    expect(commitTree).not.toContain(token);
    expect(secretText).toContain(token);
  });

  it('imports a compatible remote backup into another workspace', async () => {
    const remotePath = await createBareRemote('import-remote.git');
    const sourceService = createService();
    const sourcePath = path.join(tempRoot, 'source-workspace');
    let sourceSnapshot = await sourceService.createWorkspace({ workspacePath: sourcePath });
    sourceSnapshot = await sourceService.createTopic({ title: 'Imported Topic' });
    await sourceService.configureBackupRemote({ provider: 'generic', remoteUrl: remotePath, branch: 'main', authMode: 'system' });

    const targetService = new WorkspaceService({ appHome: path.join(tempRoot, '.mindline-target'), modelAdapterFactory: async () => createTestAdapter() });
    const targetPath = path.join(tempRoot, 'target-workspace');
    await targetService.createWorkspace({ workspacePath: targetPath });
    const configured = await targetService.configureBackupRemote({ provider: 'generic', remoteUrl: remotePath, branch: 'main', authMode: 'system' });
    expect(configured.remote?.setupRequired).toBe(true);

    const result = await targetService.resolveBackupRemoteSetup('import-remote');

    expect(result.action).toBe('pulled');
    expect(result.appliedRemoteChanges).toBe(true);
    expect(result.snapshot?.manifest.workspaceId).toBe(sourceSnapshot.manifest.workspaceId);
    expect(result.snapshot?.topics.map((topic) => topic.title)).toContain('Imported Topic');
  });

  it('overwrites a compatible remote only after explicit setup resolution', async () => {
    const remotePath = await createBareRemote('overwrite-remote.git');
    const sourceService = createService();
    await sourceService.createWorkspace({ workspacePath: path.join(tempRoot, 'overwrite-source') });
    await sourceService.createTopic({ title: 'Remote Original' });
    await sourceService.configureBackupRemote({ provider: 'generic', remoteUrl: remotePath, branch: 'main', authMode: 'system' });

    const targetService = createService();
    let targetSnapshot = await targetService.createWorkspace({ workspacePath: path.join(tempRoot, 'overwrite-target') });
    targetSnapshot = await targetService.createTopic({ title: 'Local Replacement' });
    const configured = await targetService.configureBackupRemote({ provider: 'generic', remoteUrl: remotePath, branch: 'main', authMode: 'system' });
    expect(configured.remote?.setupRequired).toBe(true);

    const result = await targetService.resolveBackupRemoteSetup('overwrite-remote');
    const manifestText = await git(['--git-dir', remotePath, 'show', 'main:.mindline/manifest.json']);

    expect(result.action).toBe('pushed');
    expect(JSON.parse(manifestText).workspaceId).toBe(targetSnapshot.manifest.workspaceId);
  });

  it('blocks diverged local and remote backup histories without merging', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const remotePath = await createBareRemote('diverged-remote.git');
    const service = createService();
    await service.createWorkspace({ workspacePath });
    await service.createTopic({ title: 'Base Topic' });
    await service.configureBackupRemote({ provider: 'generic', remoteUrl: remotePath, branch: 'main', authMode: 'system' });

    const clonePath = path.join(tempRoot, 'remote-clone');
    await git(['clone', '--branch', 'main', remotePath, clonePath]);
    await git(['config', 'user.name', 'Mindline Test'], clonePath);
    await git(['config', 'user.email', 'mindline-test@example.invalid'], clonePath);
    await fs.writeFile(path.join(clonePath, '.mindline', 'remote-only.txt'), 'remote change\n', 'utf8');
    await git(['add', '.mindline/remote-only.txt'], clonePath);
    await git(['commit', '-m', 'remote only'], clonePath);
    await git(['push', 'origin', 'main'], clonePath);

    await service.createTopic({ title: 'Local Only' });
    const result = await service.syncBackupRemote();

    expect(result.action).toBe('blocked');
    expect(result.status.remote?.diverged).toBe(true);
    expect((await service.getSnapshot())?.topics.map((topic) => topic.title)).toContain('Local Only');
  });

  it('rejects non-Mindline remote repositories', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const remotePath = await createBareRemote('plain-remote.git');
    await seedPlainRemote(remotePath);
    const service = createService();
    await service.createWorkspace({ workspacePath });

    await expect(service.configureBackupRemote({
      provider: 'gitlab',
      remoteUrl: remotePath,
      branch: 'main',
      authMode: 'system'
    })).rejects.toThrow('不是 Mindline 备份仓库');
  });

  it('stores model provider configs while keeping API keys out of snapshots', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    const created = await service.createWorkspace({ workspacePath });
    const settingsPath = requireSettingsPath(created);

    let snapshot = await service.addModelProvider({
      kind: 'cloud-model',
      providerKey: 'minimax',
      name: 'MiniMax Team',
      config: { baseUrl: 'https://minimax-m2.com/api/v1', defaultModel: 'MiniMax-M2' },
      apiKey: 'sk-test-secret',
      setActive: true
    });

    const provider = snapshot.modelProviders[0];
    expect(provider.name).toBe('MiniMax Team');
    expect(provider.hasApiKey).toBe(true);
    expect(JSON.stringify(provider)).not.toContain('sk-test-secret');
    expect(snapshot.activeModelProviderId).toBe(provider.id);

    const configText = await fs.readFile(path.join(settingsPath, 'config.json'), 'utf8');
    expect(configText).not.toContain('sk-test-secret');
    await expect(fs.readFile(path.join(settingsPath, 'secrets', `${provider.id}.json`), 'utf8')).resolves.toContain('sk-test-secret');

    snapshot = await service.deleteModelProvider(provider.id);
    expect(snapshot.modelProviders).toHaveLength(0);
    await expect(fs.stat(path.join(settingsPath, 'secrets', `${provider.id}.json`))).rejects.toThrow();
  });

  it('maps cc-switch compatible cloud presets into Mindline defaults', () => {
    expect(cloudModelPresets.map((preset) => preset.key)).toEqual(expect.arrayContaining(['deepseek', 'z-ai-coding', 'minimax-global']));

    const deepseekDefault = getModelProviderDefault('deepseek');
    expect(deepseekDefault).toMatchObject({
      name: 'DeepSeek',
      kind: 'cloud-model',
      config: {
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
        protocol: 'openai-chat'
      }
    });

    const zAiCodingDefault = getModelProviderDefault('z-ai-coding');
    expect(zAiCodingDefault).toMatchObject({
      kind: 'cloud-model',
      config: {
        baseUrl: 'https://api.z.ai/api/anthropic',
        defaultModel: 'glm-5',
        protocol: 'anthropic-messages'
      }
    });
  });

  it('creates unnamed topics and phases with a New title', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    let snapshot = await service.createPhase({ title: '' });
    expect(snapshot.phases[0].title).toBe('New');
    expect(snapshot.phases[0].icon).toBeTruthy();
    expect(PHASE_ICON_OPTIONS).toContain(snapshot.phases[0].icon);

    snapshot = await service.createTopic({ title: '   ', phaseId: snapshot.phases[0].id });
    expect(snapshot.topics[0].title).toBe('New');
    expect(snapshot.phases[0].topicIds).toEqual([snapshot.topics[0].id]);
  });

  it('summarizes only topics assigned to the selected phase', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    let snapshot = await service.createPhase({ title: 'Included Phase' });
    const includedPhaseId = snapshot.phases[0].id;
    snapshot = await service.createPhase({ title: 'Other Phase' });
    const otherPhaseId = snapshot.phases[1].id;
    snapshot = await service.createTopic({ title: 'Included Topic', phaseId: includedPhaseId });
    const includedTopicId = snapshot.topics[0].id;
    snapshot = await service.createTopic({ title: 'Other Topic', phaseId: otherPhaseId });
    const otherTopicId = snapshot.topics[1].id;

    await service.generateAssistantReply(includedTopicId, 'Included prompt');
    await service.generateAssistantReply(otherTopicId, 'Other prompt');
    await service.summarizeTopic(includedTopicId);
    await service.summarizeTopic(otherTopicId);
    snapshot = await service.summarizePhase(includedPhaseId);

    const phaseSummary = snapshot.phaseSummaries[includedPhaseId]?.content ?? '';
    expect(phaseSummary).toContain('Included Topic');
    expect(phaseSummary).not.toContain('Other Topic');
  });

  it('supports rename, summary, export, and cart context for the default phase', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    let snapshot = await service.createPhase({ title: 'Named Phase' });
    const namedPhaseId = snapshot.phases[0].id;
    snapshot = await service.createTopic({ title: 'Unassigned Topic' });
    const defaultTopicId = snapshot.topics[0].id;
    snapshot = await service.createTopic({ title: 'Assigned Topic', phaseId: namedPhaseId });
    const assignedTopicId = snapshot.topics.find((topic) => topic.id !== defaultTopicId)!.id;

    await service.generateAssistantReply(defaultTopicId, 'Only summarize the default phase');
    await service.generateAssistantReply(assignedTopicId, 'This should stay outside the default phase');
    await service.summarizeTopic(defaultTopicId);
    await service.summarizeTopic(assignedTopicId);
    snapshot = await service.updatePhase(DEFAULT_PHASE_ID, {
      title: '收纳箱',
      description: '未归类的话题会先留在这里。',
      icon: '🤖'
    });
    snapshot = await service.summarizePhase(DEFAULT_PHASE_ID);

    expect(snapshot.manifest.defaultPhase).toMatchObject({
      title: '收纳箱',
      description: '未归类的话题会先留在这里。',
      icon: '🤖'
    });
    expect(snapshot.phaseSummaries[DEFAULT_PHASE_ID]?.content).toContain('Unassigned Topic');
    expect(snapshot.phaseSummaries[DEFAULT_PHASE_ID]?.content).not.toContain('Assigned Topic');

    const exported = await service.buildPhaseExportMarkdown(DEFAULT_PHASE_ID, 'zh');
    expect(exported.filename).toBe('收纳箱.md');
    expect(exported.markdown).toContain('# 收纳箱');
    expect(exported.markdown).toContain('### Unassigned Topic');
    expect(exported.markdown).not.toContain('### Assigned Topic');

    const defaultPhase: Phase = {
      id: DEFAULT_PHASE_ID,
      title: '收纳箱',
      startedAt: snapshot.manifest.defaultPhase?.startedAt ?? snapshot.manifest.createdAt,
      topicIds: [defaultTopicId],
      status: 'active'
    };
    const context = buildSelectionContext(snapshot, [createPhaseCartItem(defaultPhase)]);
    expect(context).toContain('## Phase: 收纳箱');
    expect(context).toContain('### Topic: Unassigned Topic');
    expect(context).not.toContain('### Topic: Assigned Topic');
  });

  it('moves phases and their topics to trash and restores them together', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    let snapshot = await service.createPhase({ title: 'Trashable Phase' });
    const phaseId = snapshot.phases[0].id;
    snapshot = await service.createTopic({ title: 'Trashable Topic', phaseId });
    const topicId = snapshot.topics[0].id;

    snapshot = await service.updatePhase(phaseId, { status: 'trashed' });
    expect(snapshot.phases[0].status).toBe('trashed');
    expect(snapshot.topics.find((topic) => topic.id === topicId)?.status).toBe('trashed');

    snapshot = await service.updatePhase(phaseId, { status: 'active' });
    expect(snapshot.phases[0].status).toBe('active');
    expect(snapshot.topics.find((topic) => topic.id === topicId)?.status).toBe('active');
    expect(snapshot.phases[0].topicIds).toEqual([topicId]);
  });

  it('deleting the default phase only moves unassigned topics to trash', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    let snapshot = await service.createPhase({ title: 'Pinned Phase' });
    const phaseId = snapshot.phases[0].id;
    snapshot = await service.createTopic({ title: 'Loose Topic' });
    const looseTopicId = snapshot.topics[0].id;
    snapshot = await service.createTopic({ title: 'Pinned Topic', phaseId });
    const pinnedTopicId = snapshot.topics.find((topic) => topic.id !== looseTopicId)!.id;

    snapshot = await service.updatePhase(DEFAULT_PHASE_ID, { status: 'trashed' });

    expect(snapshot.topics.find((topic) => topic.id === looseTopicId)?.status).toBe('trashed');
    expect(snapshot.topics.find((topic) => topic.id === pinnedTopicId)?.status).toBe('active');
    expect(snapshot.phases.find((phase) => phase.id === phaseId)?.topicIds).toEqual([pinnedTopicId]);
  });

  it('clears trashed topics and phases from disk and manifest', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });

    let snapshot = await service.createPhase({ title: 'Active Phase' });
    const activePhaseId = snapshot.phases[0].id;
    snapshot = await service.createTopic({ title: 'Standalone Trash' });
    const standaloneTopicId = snapshot.topics[0].id;
    snapshot = await service.createPhase({ title: 'Trashed Phase' });
    const trashedPhaseId = snapshot.phases[1].id;
    snapshot = await service.createTopic({ title: 'Nested Trash', phaseId: trashedPhaseId });
    const nestedTopicId = snapshot.topics[1].id;

    await service.updateTopic(standaloneTopicId, { status: 'trashed' });
    await service.updatePhase(trashedPhaseId, { status: 'trashed' });
    snapshot = await service.clearTrash();

    expect(snapshot.phases.map((phase) => phase.id)).toEqual([activePhaseId]);
    expect(snapshot.topics).toEqual([]);
    expect(snapshot.phases[0].topicIds).toEqual([]);
    await expect(fs.access(path.join(workspacePath, 'topics', standaloneTopicId))).rejects.toThrow();
    await expect(fs.access(path.join(workspacePath, 'topics', nestedTopicId))).rejects.toThrow();
    await expect(fs.access(path.join(workspacePath, 'phases', trashedPhaseId))).rejects.toThrow();
  });

  it('builds selection context in cart order', async () => {
    const workspacePath = path.join(tempRoot, 'workspace');
    const service = createService();
    await service.createWorkspace({ workspacePath });
    let snapshot = await service.createPhase({ title: 'Cart Phase' });
    const phase = snapshot.phases[0];
    snapshot = await service.createTopic({ title: 'Cart Topic', phaseId: phase.id });
    const topic = snapshot.topics[0];
    snapshot = await service.generateAssistantReply(topic.id, 'First cart prompt');
    snapshot = await service.summarizeTopic(topic.id);

    const message = snapshot.messagesByTopic[topic.id][0];
    const summary = snapshot.topicSummaries[topic.id];
    expect(summary).toBeTruthy();

    const items = [createMessageCartItem(message), createTopicCartItem(topic), createTopicSummaryCartItem(topic, summary!), createPhaseCartItem(phase)];
    const context = buildSelectionContext(snapshot, items);

    expect(context.indexOf('## Message: user')).toBeLessThan(context.indexOf('## Topic: Cart Topic'));
    expect(context.indexOf('## Topic: Cart Topic')).toBeLessThan(context.indexOf('## Topic Summary: Cart Topic'));
    expect(context).toContain('## Phase:');
    expect(context).toContain('### Topic: Cart Topic');
  });
});

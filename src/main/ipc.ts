import { dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AddModelProviderInput, BackupRemoteSetupMode, ConfigureBackupRemoteInput, CreatePhaseInput, CreateTopicInput, CreateWorkspaceInput, MarkdownExportResult, ModelRunOptions, SelectionCartItem, UpdateModelProviderInput, UpdatePhaseInput, UpdateTopicInput } from '../shared/types.js';
import { WorkspaceService } from './workspace.js';

async function saveMarkdownExport(exportResult: MarkdownExportResult): Promise<string | null> {
  const result = await dialog.showSaveDialog({ defaultPath: exportResult.filename, filters: [{ name: 'Markdown', extensions: ['md'] }] });
  if (result.canceled || !result.filePath) {
    return null;
  }

  const defaultAssetDir = `${path.basename(exportResult.filename, path.extname(exportResult.filename))}.assets`;
  const savedAssetDir = `${path.basename(result.filePath, path.extname(result.filePath))}.assets`;
  const markdown = defaultAssetDir === savedAssetDir
    ? exportResult.markdown
    : exportResult.markdown.replaceAll(`${defaultAssetDir}/`, `${savedAssetDir}/`);
  await fs.writeFile(result.filePath, markdown, 'utf8');

  for (const asset of exportResult.assets ?? []) {
    const relativePath = defaultAssetDir === savedAssetDir
      ? asset.relativePath
      : asset.relativePath.replace(new RegExp(`^${defaultAssetDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`), `${savedAssetDir}/`);
    const targetPath = path.join(path.dirname(result.filePath), ...relativePath.split('/'));
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(asset.sourcePath, targetPath);
  }

  return result.filePath;
}

export function registerIpc(workspaceService: WorkspaceService): void {
  const activeMessageStreams = new Map<string, AbortController>();

  ipcMain.handle('workspace:create', (_event, input: CreateWorkspaceInput) => workspaceService.createWorkspace(input));
  ipcMain.handle('workspace:open', (_event, workspacePath: string) => workspaceService.openWorkspace(workspacePath));
  ipcMain.handle('workspace:snapshot', () => workspaceService.getSnapshot());
  ipcMain.handle('workspace:pickDirectory', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('topic:create', (_event, input: CreateTopicInput) => workspaceService.createTopic(input));
  ipcMain.handle('topic:update', (_event, topicId: string, input: UpdateTopicInput) => workspaceService.updateTopic(topicId, input));
  ipcMain.handle('phase:create', (_event, input: CreatePhaseInput) => workspaceService.createPhase(input));
  ipcMain.handle('phase:update', (_event, phaseId: string, input: UpdatePhaseInput) => workspaceService.updatePhase(phaseId, input));
  ipcMain.handle('phase:reorder', (_event, phaseIds: string[]) => workspaceService.reorderPhases(phaseIds));
  ipcMain.handle('trash:clear', () => workspaceService.clearTrash());
  ipcMain.handle('message:addUser', (_event, topicId: string, content: string) => workspaceService.addUserMessage(topicId, content));
  ipcMain.handle('message:assistant', (_event, topicId: string, prompt: string, options?: ModelRunOptions) => workspaceService.generateAssistantReply(topicId, prompt, options));
  ipcMain.handle('message:stream', async (event, topicId: string, prompt: string, options: ModelRunOptions | undefined, requestId: string) => {
    const controller = new AbortController();
    activeMessageStreams.set(requestId, controller);
    try {
      const result = await workspaceService.generateAssistantReplyStream(topicId, prompt, options, {
        signal: controller.signal,
        onChunk: (delta, content) => {
          event.sender.send('message:stream:event', { requestId, type: 'chunk', topicId, delta, content });
        }
      });
      event.sender.send('message:stream:event', { requestId, type: 'done', topicId, message: result.message, snapshot: result.snapshot });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      event.sender.send('message:stream:event', { requestId, type: controller.signal.aborted ? 'aborted' : 'error', topicId, error: message });
    } finally {
      activeMessageStreams.delete(requestId);
    }
    return { requestId };
  });
  ipcMain.handle('message:cancel', (_event, requestId: string) => {
    activeMessageStreams.get(requestId)?.abort();
  });
  ipcMain.handle('summary:topic', (_event, topicId: string) => workspaceService.summarizeTopic(topicId));
  ipcMain.handle('summary:phase', (_event, phaseId: string) => workspaceService.summarizePhase(phaseId));
  ipcMain.handle('export:topicMarkdown', async (_event, topicId: string, language: 'zh' | 'en' = 'en') => {
    return saveMarkdownExport(await workspaceService.buildTopicExportMarkdown(topicId, language));
  });
  ipcMain.handle('export:phaseMarkdown', async (_event, phaseId: string, language: 'zh' | 'en' = 'en') => {
    return saveMarkdownExport(await workspaceService.buildPhaseExportMarkdown(phaseId, language));
  });
  ipcMain.handle('export:selectionMarkdown', async (_event, items: SelectionCartItem[], language: 'zh' | 'en' = 'en') => {
    return saveMarkdownExport(await workspaceService.buildSelectionExportMarkdown(items, language));
  });
  ipcMain.handle('selection:discuss', (_event, prompt: string, items: SelectionCartItem[]) => workspaceService.discussSelection(prompt, items));
  ipcMain.handle('modelProvider:add', (_event, input: AddModelProviderInput) => workspaceService.addModelProvider(input));
  ipcMain.handle('modelProvider:update', (_event, providerId: string, input: UpdateModelProviderInput) => workspaceService.updateModelProvider(providerId, input));
  ipcMain.handle('modelProvider:delete', (_event, providerId: string) => workspaceService.deleteModelProvider(providerId));
  ipcMain.handle('modelProvider:setActive', (_event, providerId: string | null) => workspaceService.setActiveModelProvider(providerId));
  ipcMain.handle('backup:getStatus', () => workspaceService.getBackupStatus());
  ipcMain.handle('backup:create', (_event, label?: string) => workspaceService.createBackup(label));
  ipcMain.handle('backup:list', (_event, limit?: number) => workspaceService.listBackups(limit));
  ipcMain.handle('backup:restore', (_event, commitId: string) => workspaceService.restoreBackup(commitId));
  ipcMain.handle('backup:getRemoteStatus', () => workspaceService.getBackupRemoteStatus());
  ipcMain.handle('backup:testRemote', (_event, input: ConfigureBackupRemoteInput) => workspaceService.testBackupRemote(input));
  ipcMain.handle('backup:configureRemote', (_event, input: ConfigureBackupRemoteInput) => workspaceService.configureBackupRemote(input));
  ipcMain.handle('backup:clearRemote', () => workspaceService.clearBackupRemote());
  ipcMain.handle('backup:syncRemote', () => workspaceService.syncBackupRemote());
  ipcMain.handle('backup:resolveRemoteSetup', (_event, mode: BackupRemoteSetupMode) => workspaceService.resolveBackupRemoteSetup(mode));
}

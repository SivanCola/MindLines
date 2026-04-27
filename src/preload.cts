import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { AddModelProviderInput, BackupRemoteSetupMode, ConfigureBackupRemoteInput, CreatePhaseInput, CreateTopicInput, CreateWorkspaceInput, GroupAIApi, MarkdownExportLanguage, MessageStreamEvent, ModelRunOptions, SelectionCartItem, UpdateModelProviderInput, UpdatePhaseInput, UpdateTopicInput } from './shared/types.js';

const api: GroupAIApi = {
  createWorkspace: (input: CreateWorkspaceInput) => ipcRenderer.invoke('workspace:create', input),
  openWorkspace: (workspacePath: string) => ipcRenderer.invoke('workspace:open', workspacePath),
  getSnapshot: () => ipcRenderer.invoke('workspace:snapshot'),
  createTopic: (input: CreateTopicInput) => ipcRenderer.invoke('topic:create', input),
  updateTopic: (topicId: string, input: UpdateTopicInput) => ipcRenderer.invoke('topic:update', topicId, input),
  createPhase: (input: CreatePhaseInput) => ipcRenderer.invoke('phase:create', input),
  updatePhase: (phaseId: string, input: UpdatePhaseInput) => ipcRenderer.invoke('phase:update', phaseId, input),
  reorderPhases: (phaseIds: string[]) => ipcRenderer.invoke('phase:reorder', phaseIds),
  clearTrash: () => ipcRenderer.invoke('trash:clear'),
  addUserMessage: (topicId: string, content: string) => ipcRenderer.invoke('message:addUser', topicId, content),
  generateAssistantReply: (topicId: string, prompt: string, options?: ModelRunOptions) => ipcRenderer.invoke('message:assistant', topicId, prompt, options),
  generateAssistantReplyStream: (topicId: string, prompt: string, options: ModelRunOptions | undefined, requestId: string) => ipcRenderer.invoke('message:stream', topicId, prompt, options, requestId),
  cancelAssistantReply: (requestId: string) => ipcRenderer.invoke('message:cancel', requestId),
  onMessageStream: (listener: (event: MessageStreamEvent) => void) => {
    const wrapped = (_event: IpcRendererEvent, payload: MessageStreamEvent) => listener(payload);
    ipcRenderer.on('message:stream:event', wrapped);
    return () => ipcRenderer.removeListener('message:stream:event', wrapped);
  },
  summarizeTopic: (topicId: string) => ipcRenderer.invoke('summary:topic', topicId),
  summarizePhase: (phaseId: string) => ipcRenderer.invoke('summary:phase', phaseId),
  exportTopicMarkdown: (topicId: string, language?: MarkdownExportLanguage) => ipcRenderer.invoke('export:topicMarkdown', topicId, language),
  exportPhaseMarkdown: (phaseId: string, language?: MarkdownExportLanguage) => ipcRenderer.invoke('export:phaseMarkdown', phaseId, language),
  exportSelectionMarkdown: (items: SelectionCartItem[], language?: MarkdownExportLanguage) => ipcRenderer.invoke('export:selectionMarkdown', items, language),
  discussSelection: (prompt: string, items: SelectionCartItem[]) => ipcRenderer.invoke('selection:discuss', prompt, items),
  addModelProvider: (input: AddModelProviderInput) => ipcRenderer.invoke('modelProvider:add', input),
  updateModelProvider: (providerId: string, input: UpdateModelProviderInput) => ipcRenderer.invoke('modelProvider:update', providerId, input),
  deleteModelProvider: (providerId: string) => ipcRenderer.invoke('modelProvider:delete', providerId),
  setActiveModelProvider: (providerId: string | null) => ipcRenderer.invoke('modelProvider:setActive', providerId),
  getBackupStatus: () => ipcRenderer.invoke('backup:getStatus'),
  createBackup: (label?: string) => ipcRenderer.invoke('backup:create', label),
  listBackups: (limit?: number) => ipcRenderer.invoke('backup:list', limit),
  restoreBackup: (commitId: string) => ipcRenderer.invoke('backup:restore', commitId),
  getBackupRemoteStatus: () => ipcRenderer.invoke('backup:getRemoteStatus'),
  testBackupRemote: (input: ConfigureBackupRemoteInput) => ipcRenderer.invoke('backup:testRemote', input),
  configureBackupRemote: (input: ConfigureBackupRemoteInput) => ipcRenderer.invoke('backup:configureRemote', input),
  clearBackupRemote: () => ipcRenderer.invoke('backup:clearRemote'),
  syncBackupRemote: () => ipcRenderer.invoke('backup:syncRemote'),
  resolveBackupRemoteSetup: (mode: BackupRemoteSetupMode) => ipcRenderer.invoke('backup:resolveRemoteSetup', mode),
  pickDirectory: () => ipcRenderer.invoke('workspace:pickDirectory')
};

contextBridge.exposeInMainWorld('groupAI', api);

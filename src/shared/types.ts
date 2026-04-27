export type Id = string;
export const DEFAULT_PHASE_ID = '__default_phase__';

export type MessageRole = 'user' | 'assistant' | 'system';
export type TopicStatus = 'active' | 'archived' | 'trashed';
export type PhaseStatus = 'active' | 'trashed';
export type SummaryTargetType = 'topic' | 'phase' | 'selection';
export type SelectionCartItemType = 'message' | 'topic' | 'phase' | 'topic-summary' | 'phase-summary';
export type ModelProviderKind = 'local-tool' | 'cloud-model';
export type LocalToolProviderKey = 'claude-code' | 'codex' | 'openclaw' | 'custom-local';
export type KnownCloudModelProviderKey =
  | 'minimax'
  | 'minimax-global'
  | 'zhipu'
  | 'zhipu-coding'
  | 'z-ai'
  | 'z-ai-coding'
  | 'kimi'
  | 'kimi-coding'
  | 'deepseek'
  | 'custom-cloud';
export type CloudModelProviderKey = KnownCloudModelProviderKey | (string & {});
export type ModelProviderKey = LocalToolProviderKey | CloudModelProviderKey;
export type CloudModelProtocol = 'openai-chat' | 'anthropic-messages';
export type ModelPresetId = 'balanced' | 'precise' | 'creative' | 'longform' | 'code';
export type ModelRolePresetId = 'assistant' | 'engineer' | 'writer' | 'analyst';
export type MarkdownExportLanguage = 'zh' | 'en';

export interface MessageAttachmentInput {
  type?: 'image' | 'text';
  fileName: string;
  mediaType: string;
  dataUrl: string;
  size: number;
}

export interface MessageAttachment {
  id: Id;
  type: 'image' | 'text';
  fileName: string;
  mediaType: string;
  size: number;
  path: string;
  width?: number;
  height?: number;
}

export interface ModelRunOptions {
  providerId?: Id;
  presetId?: ModelPresetId;
  rolePresetId?: ModelRolePresetId;
  roleInstruction?: string;
  profileInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  attachments?: MessageAttachmentInput[];
  contextItems?: SelectionCartItem[];
  contextMarkdown?: string;
}

export interface SourceRef {
  type: 'message' | 'topic' | 'topic-summary' | 'phase' | 'phase-summary';
  id: Id;
  topicId?: Id;
  phaseId?: Id;
}

export interface Topic {
  id: Id;
  title: string;
  phaseId?: Id;
  createdAt: string;
  updatedAt: string;
  status: TopicStatus;
  shareId?: Id;
}

export interface Phase {
  id: Id;
  title: string;
  icon?: string;
  description?: string;
  startedAt: string;
  endedAt?: string;
  topicIds: Id[];
  status?: PhaseStatus;
  shareId?: Id;
}

export interface DefaultPhaseState {
  title?: string;
  icon?: string;
  description?: string;
  startedAt?: string;
  endedAt?: string;
  shareId?: Id;
}

export interface Message {
  id: Id;
  topicId: Id;
  role: MessageRole;
  content: string;
  createdAt: string;
  modelId?: string;
  attachments?: MessageAttachment[];
  contextItems?: SelectionCartItem[];
}

export interface Summary {
  id: Id;
  targetType: SummaryTargetType;
  targetId: Id;
  content: string;
  createdAt: string;
  sourceRefs: SourceRef[];
  shareId?: Id;
}

export interface SelectionCartItem {
  type: SelectionCartItemType;
  id: Id;
  label: string;
  sourceRefs: SourceRef[];
}

export interface WorkspaceManifest {
  version: 1;
  workspaceId: Id;
  name: string;
  projectPath?: string;
  createdAt: string;
  updatedAt: string;
  topicIds: Id[];
  phaseIds: Id[];
  defaultPhase?: DefaultPhaseState;
  topicPaths?: Record<Id, string>;
  phasePaths?: Record<Id, string>;
}

export interface WorkspaceSnapshot {
  workspacePath: string;
  dataPath?: string;
  settingsPath?: string;
  secretsPath?: string;
  manifest: WorkspaceManifest;
  topics: Topic[];
  phases: Phase[];
  messagesByTopic: Record<Id, Message[]>;
  topicSummaries: Record<Id, Summary | null>;
  phaseSummaries: Record<Id, Summary | null>;
  modelProviders: ModelProvider[];
  activeModelProviderId?: Id;
}

export interface BackupStatus {
  gitAvailable: boolean;
  initialized: boolean;
  hasChanges: boolean;
  backupPath?: string;
  lastBackupAt?: string;
  lastBackupCommitId?: Id;
  remote?: BackupRemoteStatus;
  error?: string;
}

export type BackupRemoteProvider = 'github' | 'gitlab' | 'generic';
export type BackupRemoteAuthMode = 'system' | 'pat';
export type BackupRemoteSetupMode = 'import-remote' | 'overwrite-remote';

export interface BackupRemoteConfig {
  provider: BackupRemoteProvider;
  remoteUrl: string;
  branch: string;
  authMode: BackupRemoteAuthMode;
  username?: string;
  lastSyncAt?: string;
  setupRequired?: boolean;
}

export interface ConfigureBackupRemoteInput {
  provider: BackupRemoteProvider;
  remoteUrl: string;
  branch?: string;
  authMode: BackupRemoteAuthMode;
  username?: string;
  token?: string;
}

export interface BackupRemoteStatus {
  configured: boolean;
  provider?: BackupRemoteProvider;
  remoteUrlLabel?: string;
  branch?: string;
  authMode?: BackupRemoteAuthMode;
  hasToken?: boolean;
  remoteReady?: boolean;
  setupRequired?: boolean;
  ahead?: number;
  behind?: number;
  diverged?: boolean;
  lastSyncAt?: string;
  lastError?: string;
}

export interface BackupCommit {
  commitId: Id;
  shortId: string;
  message: string;
  createdAt: string;
  filesChanged: number;
  parentIds: Id[];
}

export interface BackupTimeline {
  status: BackupStatus;
  commits: BackupCommit[];
}

export interface BackupSyncResult {
  status: BackupStatus;
  timeline: BackupTimeline;
  action: 'none' | 'published' | 'pushed' | 'pulled' | 'blocked';
  message?: string;
  appliedRemoteChanges?: boolean;
  snapshot?: WorkspaceSnapshot;
}

export interface CreateWorkspaceInput {
  workspacePath: string;
  name?: string;
}

export interface CreateTopicInput {
  title: string;
  phaseId?: Id;
}

export interface UpdateTopicInput {
  title?: string;
  phaseId?: Id | null;
  status?: TopicStatus;
}

export interface CreatePhaseInput {
  title: string;
  description?: string;
}

export interface UpdatePhaseInput {
  title?: string;
  icon?: string | null;
  description?: string;
  endedAt?: string | null;
  status?: PhaseStatus;
}

export interface CreateMessageInput {
  topicId: Id;
  role: MessageRole;
  content: string;
  modelId?: string;
  attachments?: MessageAttachmentInput[];
  contextItems?: SelectionCartItem[];
}

export interface DiscussionResult {
  message: Message;
  contextMarkdown: string;
}

export type MessageStreamEvent =
  | { requestId: Id; type: 'chunk'; topicId: Id; content: string; delta: string }
  | { requestId: Id; type: 'done'; topicId: Id; message: Message; snapshot: WorkspaceSnapshot }
  | { requestId: Id; type: 'error'; topicId?: Id; error: string }
  | { requestId: Id; type: 'aborted'; topicId?: Id; error?: string };

export interface LocalToolModelProviderConfig {
  command: string;
  configPath?: string;
  args?: string;
}

export interface CloudModelProviderConfig {
  baseUrl?: string;
  defaultModel?: string;
  protocol?: CloudModelProtocol;
}

export interface ModelProvider {
  id: Id;
  name: string;
  kind: ModelProviderKind;
  providerKey: ModelProviderKey;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  websiteUrl?: string;
  notes?: string;
  config: LocalToolModelProviderConfig | CloudModelProviderConfig;
  hasApiKey?: boolean;
}

export interface AddModelProviderInput {
  name: string;
  kind: ModelProviderKind;
  providerKey: ModelProviderKey;
  websiteUrl?: string;
  notes?: string;
  config: LocalToolModelProviderConfig | CloudModelProviderConfig;
  apiKey?: string;
  setActive?: boolean;
}

export interface UpdateModelProviderInput {
  name?: string;
  websiteUrl?: string;
  notes?: string;
  enabled?: boolean;
  config?: LocalToolModelProviderConfig | CloudModelProviderConfig;
  apiKey?: string;
  clearApiKey?: boolean;
  setActive?: boolean;
}

export interface MarkdownExportAsset {
  sourcePath: string;
  relativePath: string;
}

export interface MarkdownExportResult {
  filename: string;
  markdown: string;
  assets?: MarkdownExportAsset[];
}

export interface ModelAdapter {
  id: string;
  label: string;
  sendMessage(input: { topic: Topic; messages: Message[]; prompt: string; options?: ModelRunOptions }): Promise<Message>;
  sendMessageStream?(input: { topic: Topic; messages: Message[]; prompt: string; options?: ModelRunOptions; signal?: AbortSignal; onChunk: (delta: string, content: string) => void }): Promise<Message>;
  summarizeTopic(input: { topic: Topic; messages: Message[] }): Promise<Summary>;
  summarizePhase(input: { phase: Phase; topics: Topic[]; topicSummaries: Summary[]; messagesByTopic: Record<Id, Message[]> }): Promise<Summary>;
  discussSelection(input: { prompt: string; contextMarkdown: string; sourceRefs: SourceRef[] }): Promise<Message>;
}

export interface GroupAIApi {
  createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceSnapshot>;
  openWorkspace(workspacePath: string): Promise<WorkspaceSnapshot>;
  getSnapshot(): Promise<WorkspaceSnapshot | null>;
  createTopic(input: CreateTopicInput): Promise<WorkspaceSnapshot>;
  updateTopic(topicId: Id, input: UpdateTopicInput): Promise<WorkspaceSnapshot>;
  createPhase(input: CreatePhaseInput): Promise<WorkspaceSnapshot>;
  updatePhase(phaseId: Id, input: UpdatePhaseInput): Promise<WorkspaceSnapshot>;
  reorderPhases(phaseIds: Id[]): Promise<WorkspaceSnapshot>;
  clearTrash(): Promise<WorkspaceSnapshot>;
  addUserMessage(topicId: Id, content: string): Promise<WorkspaceSnapshot>;
  generateAssistantReply(topicId: Id, prompt: string, options?: ModelRunOptions): Promise<WorkspaceSnapshot>;
  generateAssistantReplyStream(topicId: Id, prompt: string, options: ModelRunOptions | undefined, requestId: Id): Promise<{ requestId: Id }>;
  cancelAssistantReply(requestId: Id): Promise<void>;
  onMessageStream(listener: (event: MessageStreamEvent) => void): () => void;
  summarizeTopic(topicId: Id): Promise<WorkspaceSnapshot>;
  summarizePhase(phaseId: Id): Promise<WorkspaceSnapshot>;
  exportTopicMarkdown(topicId: Id, language?: MarkdownExportLanguage): Promise<string | null>;
  exportPhaseMarkdown(phaseId: Id, language?: MarkdownExportLanguage): Promise<string | null>;
  exportSelectionMarkdown(items: SelectionCartItem[], language?: MarkdownExportLanguage): Promise<string | null>;
  discussSelection(prompt: string, items: SelectionCartItem[]): Promise<DiscussionResult>;
  addModelProvider(input: AddModelProviderInput): Promise<WorkspaceSnapshot>;
  updateModelProvider(providerId: Id, input: UpdateModelProviderInput): Promise<WorkspaceSnapshot>;
  deleteModelProvider(providerId: Id): Promise<WorkspaceSnapshot>;
  setActiveModelProvider(providerId: Id | null): Promise<WorkspaceSnapshot>;
  getBackupStatus(): Promise<BackupStatus>;
  createBackup(label?: string): Promise<BackupStatus>;
  listBackups(limit?: number): Promise<BackupTimeline>;
  restoreBackup(commitId: string): Promise<WorkspaceSnapshot>;
  getBackupRemoteStatus(): Promise<BackupRemoteStatus>;
  testBackupRemote(input: ConfigureBackupRemoteInput): Promise<BackupRemoteStatus>;
  configureBackupRemote(input: ConfigureBackupRemoteInput): Promise<BackupStatus>;
  clearBackupRemote(): Promise<BackupStatus>;
  syncBackupRemote(): Promise<BackupSyncResult>;
  resolveBackupRemoteSetup(mode: BackupRemoteSetupMode): Promise<BackupSyncResult>;
  pickDirectory(): Promise<string | null>;
}

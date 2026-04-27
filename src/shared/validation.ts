import type { DefaultPhaseState, Message, MessageAttachment, Phase, SelectionCartItem, SourceRef, Summary, Topic, WorkspaceManifest } from './types.js';

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertOptionalString(value: unknown, label: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must be a string array`);
  }
}

function assertStringValue(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }
}

function assertStringRecord(value: unknown, label: string): asserts value is Record<string, string> {
  assertRecord(value, label);
  for (const [key, entry] of Object.entries(value)) {
    assertString(key, `${label} key`);
    assertString(entry, `${label}.${key}`);
  }
}

function assertDefaultPhaseState(value: unknown, label: string): asserts value is DefaultPhaseState {
  assertRecord(value, label);
  assertOptionalString(value.title, `${label}.title`);
  assertOptionalString(value.icon, `${label}.icon`);
  assertOptionalString(value.description, `${label}.description`);
  assertOptionalString(value.startedAt, `${label}.startedAt`);
  assertOptionalString(value.endedAt, `${label}.endedAt`);
  assertOptionalString(value.shareId, `${label}.shareId`);
}

function assertSourceRef(value: unknown, label: string): asserts value is SourceRef {
  assertRecord(value, label);
  if (value.type !== 'message' && value.type !== 'topic' && value.type !== 'topic-summary' && value.type !== 'phase' && value.type !== 'phase-summary') {
    throw new Error(`${label}.type is invalid`);
  }
  assertString(value.id, `${label}.id`);
  assertOptionalString(value.topicId, `${label}.topicId`);
  assertOptionalString(value.phaseId, `${label}.phaseId`);
}

function assertSelectionCartItem(value: unknown, label: string): asserts value is SelectionCartItem {
  assertRecord(value, label);
  if (value.type !== 'message' && value.type !== 'topic' && value.type !== 'topic-summary' && value.type !== 'phase' && value.type !== 'phase-summary') {
    throw new Error(`${label}.type is invalid`);
  }
  assertString(value.id, `${label}.id`);
  assertString(value.label, `${label}.label`);
  if (!Array.isArray(value.sourceRefs)) {
    throw new Error(`${label}.sourceRefs must be an array`);
  }
  value.sourceRefs.forEach((sourceRef, index) => assertSourceRef(sourceRef, `${label}.sourceRefs[${index}]`));
}

function assertMessageAttachment(value: unknown, label: string): asserts value is MessageAttachment {
  assertRecord(value, label);
  assertString(value.id, `${label}.id`);
  if (value.type !== 'image' && value.type !== 'text') {
    throw new Error(`${label}.type must be image or text`);
  }
  assertString(value.fileName, `${label}.fileName`);
  assertString(value.mediaType, `${label}.mediaType`);
  if (typeof value.size !== 'number' || !Number.isFinite(value.size) || value.size < 0) {
    throw new Error(`${label}.size must be a non-negative number`);
  }
  assertString(value.path, `${label}.path`);
  if (value.width !== undefined && (typeof value.width !== 'number' || !Number.isFinite(value.width))) {
    throw new Error(`${label}.width must be a number`);
  }
  if (value.height !== undefined && (typeof value.height !== 'number' || !Number.isFinite(value.height))) {
    throw new Error(`${label}.height must be a number`);
  }
}

export function assertManifest(value: unknown): asserts value is WorkspaceManifest {
  assertRecord(value, 'manifest');
  if (value.version !== 1) {
    throw new Error('manifest.version must be 1');
  }
  assertString(value.workspaceId, 'manifest.workspaceId');
  assertString(value.name, 'manifest.name');
  assertOptionalString(value.projectPath, 'manifest.projectPath');
  assertString(value.createdAt, 'manifest.createdAt');
  assertString(value.updatedAt, 'manifest.updatedAt');
  assertStringArray(value.topicIds, 'manifest.topicIds');
  assertStringArray(value.phaseIds, 'manifest.phaseIds');
  if (value.defaultPhase !== undefined) {
    assertDefaultPhaseState(value.defaultPhase, 'manifest.defaultPhase');
  }
  if (value.topicPaths !== undefined) {
    assertStringRecord(value.topicPaths, 'manifest.topicPaths');
  }
  if (value.phasePaths !== undefined) {
    assertStringRecord(value.phasePaths, 'manifest.phasePaths');
  }
}

export function assertTopic(value: unknown): asserts value is Topic {
  assertRecord(value, 'topic');
  assertString(value.id, 'topic.id');
  assertString(value.title, 'topic.title');
  assertOptionalString(value.phaseId, 'topic.phaseId');
  assertString(value.createdAt, 'topic.createdAt');
  assertString(value.updatedAt, 'topic.updatedAt');
  if (value.status !== 'active' && value.status !== 'archived' && value.status !== 'trashed') {
    throw new Error('topic.status must be active, archived, or trashed');
  }
}

export function assertPhase(value: unknown): asserts value is Phase {
  assertRecord(value, 'phase');
  assertString(value.id, 'phase.id');
  assertString(value.title, 'phase.title');
  assertOptionalString(value.icon, 'phase.icon');
  assertOptionalString(value.description, 'phase.description');
  assertString(value.startedAt, 'phase.startedAt');
  assertOptionalString(value.endedAt, 'phase.endedAt');
  assertStringArray(value.topicIds, 'phase.topicIds');
  if (value.status !== undefined && value.status !== 'active' && value.status !== 'trashed') {
    throw new Error('phase.status must be active or trashed');
  }
}

export function assertMessage(value: unknown): asserts value is Message {
  assertRecord(value, 'message');
  assertString(value.id, 'message.id');
  assertString(value.topicId, 'message.topicId');
  if (value.role !== 'user' && value.role !== 'assistant' && value.role !== 'system') {
    throw new Error('message.role must be user, assistant, or system');
  }
  assertStringValue(value.content, 'message.content');
  assertString(value.createdAt, 'message.createdAt');
  assertOptionalString(value.modelId, 'message.modelId');
  if (value.attachments !== undefined) {
    if (!Array.isArray(value.attachments)) {
      throw new Error('message.attachments must be an array');
    }
    value.attachments.forEach((attachment, index) => assertMessageAttachment(attachment, `message.attachments[${index}]`));
  }
  if (value.contextItems !== undefined) {
    if (!Array.isArray(value.contextItems)) {
      throw new Error('message.contextItems must be an array');
    }
    value.contextItems.forEach((item, index) => assertSelectionCartItem(item, `message.contextItems[${index}]`));
  }
}

export function assertSummary(value: unknown): asserts value is Summary {
  assertRecord(value, 'summary');
  assertString(value.id, 'summary.id');
  if (value.targetType !== 'topic' && value.targetType !== 'phase' && value.targetType !== 'selection') {
    throw new Error('summary.targetType is invalid');
  }
  assertString(value.targetId, 'summary.targetId');
  assertString(value.content, 'summary.content');
  assertString(value.createdAt, 'summary.createdAt');
  if (!Array.isArray(value.sourceRefs)) {
    throw new Error('summary.sourceRefs must be an array');
  }
}

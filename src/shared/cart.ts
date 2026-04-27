import { DEFAULT_PHASE_ID, type MarkdownExportLanguage, type Message, type MessageAttachment, type Phase, type SelectionCartItem, type SourceRef, type Summary, type Topic, type WorkspaceSnapshot } from './types.js';

export function createMessageCartItem(message: Message): SelectionCartItem {
  const label = message.content.trim() || message.attachments?.map((attachment) => attachment.fileName).join(', ') || 'Attachment message';
  return {
    type: 'message',
    id: message.id,
    label: `${message.role}: ${label.slice(0, 48)}`,
    sourceRefs: [{ type: 'message', id: message.id, topicId: message.topicId }]
  };
}

export function createTopicCartItem(topic: Topic): SelectionCartItem {
  return {
    type: 'topic',
    id: topic.id,
    label: `Topic: ${topic.title}`,
    sourceRefs: [{ type: 'topic', id: topic.id }]
  };
}

export function createPhaseCartItem(phase: Phase): SelectionCartItem {
  return {
    type: 'phase',
    id: phase.id,
    label: `Phase: ${phase.title}`,
    sourceRefs: [{ type: 'phase', id: phase.id }]
  };
}

export function createTopicSummaryCartItem(topic: Topic, summary: Summary): SelectionCartItem {
  return {
    type: 'topic-summary',
    id: summary.id,
    label: `Topic summary: ${topic.title}`,
    sourceRefs: [{ type: 'topic-summary', id: summary.id, topicId: topic.id }]
  };
}

export function createPhaseSummaryCartItem(phase: Phase, summary: Summary): SelectionCartItem {
  return {
    type: 'phase-summary',
    id: summary.id,
    label: `Phase summary: ${phase.title}`,
    sourceRefs: [{ type: 'phase-summary', id: summary.id, phaseId: phase.id }]
  };
}

export function uniqueSourceRefs(items: SelectionCartItem[]): SourceRef[] {
  const seen = new Set<string>();
  const refs: SourceRef[] = [];

  for (const item of items) {
    for (const ref of item.sourceRefs) {
      const key = `${ref.type}:${ref.id}:${ref.topicId ?? ''}:${ref.phaseId ?? ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        refs.push(ref);
      }
    }
  }

  return refs;
}

type AttachmentPathResolver = (message: Message, attachment: MessageAttachment) => string;

function messageAttachmentMarkdown(message: Message, attachmentPathFor?: AttachmentPathResolver): string {
  if (!message.attachments?.length) {
    return '';
  }
  return message.attachments
    .map((attachment) => {
      const href = attachmentPathFor ? attachmentPathFor(message, attachment) : attachment.path;
      return attachment.type === 'image' ? `![${attachment.fileName}](${href})` : `- [${attachment.fileName}](${href})`;
    })
    .join('\n\n');
}

function messageContextMarkdown(message: Message): string {
  if (!message.contextItems?.length) {
    return '';
  }
  return ['### Context', ...message.contextItems.map((item) => `- ${item.label}`)].join('\n');
}

function formatMessageContent(message: Message, attachmentPathFor?: AttachmentPathResolver): string {
  return [message.content, messageContextMarkdown(message), messageAttachmentMarkdown(message, attachmentPathFor)].filter(Boolean).join('\n\n');
}

function buildSnapshotDefaultPhase(snapshot: WorkspaceSnapshot): Phase {
  const phaseIdSet = new Set(snapshot.phases.map((phase) => phase.id));
  const defaultPhase = snapshot.manifest.defaultPhase;
  return {
    id: DEFAULT_PHASE_ID,
    title: defaultPhase?.title?.trim() || 'Default phase',
    icon: defaultPhase?.icon?.trim() || undefined,
    description: defaultPhase?.description?.trim() || undefined,
    startedAt: defaultPhase?.startedAt ?? snapshot.manifest.createdAt,
    endedAt: defaultPhase?.endedAt?.trim() || undefined,
    topicIds: snapshot.topics.filter((topic) => topic.status !== 'trashed' && (!topic.phaseId || !phaseIdSet.has(topic.phaseId))).map((topic) => topic.id),
    status: 'active',
    shareId: defaultPhase?.shareId
  };
}

export function buildSelectionContext(snapshot: WorkspaceSnapshot, items: SelectionCartItem[], attachmentPathFor?: AttachmentPathResolver): string {
  const sections: string[] = [];

  for (const item of items) {
    if (item.type === 'message') {
      const message = Object.values(snapshot.messagesByTopic).flat().find((entry) => entry.id === item.id);
      if (message) {
        sections.push(`## Message: ${message.role}\n\n${formatMessageContent(message, attachmentPathFor)}`);
      }
      continue;
    }

    if (item.type === 'topic') {
      const topic = snapshot.topics.find((entry) => entry.id === item.id);
      const messages = snapshot.messagesByTopic[item.id] ?? [];
      if (topic) {
        sections.push(`## Topic: ${topic.title}\n\n${messages.map((message) => `### ${message.role}\n${formatMessageContent(message, attachmentPathFor)}`).join('\n\n')}`);
      }
      continue;
    }

    if (item.type === 'phase') {
      const phase = item.id === DEFAULT_PHASE_ID ? buildSnapshotDefaultPhase(snapshot) : snapshot.phases.find((entry) => entry.id === item.id);
      if (phase) {
        const topics = phase.topicIds
          .map((topicId) => snapshot.topics.find((entry) => entry.id === topicId && entry.status !== 'trashed'))
          .filter((topic): topic is Topic => Boolean(topic));
        const topicSections = topics.map((topic) => {
          const summary = snapshot.topicSummaries[topic.id];
          const messages = snapshot.messagesByTopic[topic.id] ?? [];
          return [
            `### Topic: ${topic.title}`,
            summary ? `#### Topic Summary\n${summary.content}` : undefined,
            messages.map((message) => `#### ${message.role}\n${formatMessageContent(message, attachmentPathFor)}`).join('\n\n')
          ].filter((section): section is string => Boolean(section)).join('\n\n');
        });
        sections.push(`## Phase: ${phase.title}\n\n${topicSections.join('\n\n')}`);
      }
      continue;
    }

    if (item.type === 'topic-summary') {
      const summary = Object.values(snapshot.topicSummaries).find((entry) => entry?.id === item.id);
      const topic = summary ? snapshot.topics.find((entry) => entry.id === summary.targetId) : undefined;
      if (summary) {
        sections.push(`## Topic Summary: ${topic?.title ?? summary.targetId}\n\n${summary.content}`);
      }
      continue;
    }

    if (item.type === 'phase-summary') {
      const summary = Object.values(snapshot.phaseSummaries).find((entry) => entry?.id === item.id);
      const phase = summary ? (summary.targetId === DEFAULT_PHASE_ID ? buildSnapshotDefaultPhase(snapshot) : snapshot.phases.find((entry) => entry.id === summary.targetId)) : undefined;
      if (summary) {
        sections.push(`## Phase Summary: ${phase?.title ?? summary.targetId}\n\n${summary.content}`);
      }
    }
  }

  return sections.join('\n\n---\n\n');
}

const selectionExportCopy = {
  en: {
    title: 'Selection Export',
    empty: 'No selected context.',
    sourceCount: 'Selected items',
    exportedAt: 'Exported',
    content: 'Content'
  },
  zh: {
    title: '资料篮导出',
    empty: '当前没有已选资料。',
    sourceCount: '已选资料数',
    exportedAt: '导出于',
    content: '内容'
  }
} as const;

export function buildSelectionExportMarkdown(snapshot: WorkspaceSnapshot, items: SelectionCartItem[], language: MarkdownExportLanguage = 'en', attachmentPathFor?: AttachmentPathResolver): string {
  const labels = selectionExportCopy[language];
  const contextMarkdown = buildSelectionContext(snapshot, items, attachmentPathFor).trim();
  const lines = [
    `# ${labels.title}`,
    '',
    `- ${labels.sourceCount}: ${items.length}`,
    `- ${labels.exportedAt}: ${new Date().toLocaleString()}`,
    '',
    `## ${labels.content}`,
    '',
    contextMarkdown || labels.empty
  ];

  return `${lines.join('\n').trim()}\n`;
}

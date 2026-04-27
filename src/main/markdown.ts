import type { MarkdownExportLanguage, Message, MessageAttachment, Phase, Summary, Topic } from '../shared/types.js';
import { assertMessage, assertSummary } from '../shared/validation.js';

const messageStart = '<!-- groupai-message ';
const messageEnd = '<!-- /groupai-message -->';
const summaryStart = '<!-- groupai-summary ';
const summaryEnd = '<!-- /groupai-summary -->';

export function serializeMessage(message: Message): string {
  return `${messageStart}${JSON.stringify(message)} -->\n\n### ${message.role} · ${message.createdAt}\n\n${message.content}\n\n${messageEnd}\n`;
}

export function parseMessages(markdown: string): Message[] {
  const pattern = /<!-- groupai-message (.*?) -->/g;
  const messages: Message[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown))) {
    const parsed = JSON.parse(match[1]) as unknown;
    assertMessage(parsed);
    messages.push(parsed);
  }

  return messages;
}

export function serializeSummary(summary: Summary): string {
  return `${summaryStart}${JSON.stringify(summary)} -->\n\n# Summary\n\n${summary.content}\n\n${summaryEnd}\n`;
}

export function parseSummary(markdown: string): Summary | null {
  const match = markdown.match(/<!-- groupai-summary (.*?) -->/);
  if (!match) {
    return null;
  }
  const parsed = JSON.parse(match[1]) as unknown;
  assertSummary(parsed);
  return parsed;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

type AttachmentPathResolver = (message: Message, attachment: MessageAttachment) => string;

function attachmentMarkdown(message: Message, attachmentPathFor?: AttachmentPathResolver): string[] {
  if (!message.attachments?.length) {
    return [];
  }
  const lines = ['#### Attachments', ''];
  for (const attachment of message.attachments) {
    const href = attachmentPathFor ? attachmentPathFor(message, attachment) : attachment.path;
    lines.push(attachment.type === 'image' ? `![${attachment.fileName}](${href})` : `- [${attachment.fileName}](${href})`, '');
  }
  return lines;
}

function contextMarkdown(message: Message): string[] {
  if (!message.contextItems?.length) {
    return [];
  }
  return ['#### Context', '', ...message.contextItems.map((item) => `- ${item.label}`), ''];
}

function pushMessageExport(lines: string[], heading: string, message: Message, attachmentPathFor?: AttachmentPathResolver): void {
  lines.push(heading, '', message.content, '', ...contextMarkdown(message), ...attachmentMarkdown(message, attachmentPathFor));
}

const exportCopy = {
  en: {
    topicId: 'Topic ID',
    phaseId: 'Phase ID',
    phase: 'Phase',
    defaultPhase: 'Default phase',
    created: 'Created',
    updated: 'Updated',
    started: 'Started',
    ended: 'Ended',
    shareId: 'Share ID',
    summary: 'Summary',
    phaseSummary: 'Phase Summary',
    topicSummaryFallback: 'No topic summary yet.',
    summaryFallback: 'No summary yet.',
    phaseSummaryFallback: 'No phase summary yet.',
    messages: 'Messages',
    topics: 'Topics'
  },
  zh: {
    topicId: '话题 ID',
    phaseId: '阶段 ID',
    phase: '阶段',
    defaultPhase: '默认阶段',
    created: '创建于',
    updated: '更新于',
    started: '开始于',
    ended: '结束于',
    shareId: '分享 ID',
    summary: '总结',
    phaseSummary: '阶段总结',
    topicSummaryFallback: '暂无话题总结。',
    summaryFallback: '暂无总结。',
    phaseSummaryFallback: '暂无阶段总结。',
    messages: '消息',
    topics: '话题'
  }
} as const;

export function serializeTopicExport(input: { topic: Topic; phase?: Phase; messages: Message[]; summary?: Summary | null; language?: MarkdownExportLanguage; attachmentPathFor?: AttachmentPathResolver }): string {
  const labels = exportCopy[input.language ?? 'en'];
  const lines = [
    `# ${input.topic.title}`,
    '',
    `- ${labels.topicId}: ${input.topic.id}`,
    `- ${labels.phase}: ${input.phase?.title ?? labels.defaultPhase}`,
    `- ${labels.created}: ${formatDate(input.topic.createdAt)}`,
    `- ${labels.updated}: ${formatDate(input.topic.updatedAt)}`,
    input.topic.shareId ? `- ${labels.shareId}: ${input.topic.shareId}` : undefined,
    '',
    `## ${labels.summary}`,
    '',
    input.summary?.content ?? labels.summaryFallback,
    '',
    `## ${labels.messages}`,
    ''
  ].filter((line): line is string => typeof line === 'string');

  for (const message of input.messages) {
    pushMessageExport(lines, `### ${message.role} · ${formatDate(message.createdAt)}`, message, input.attachmentPathFor);
  }

  return `${lines.join('\n').trim()}\n`;
}

export function serializePhaseExport(input: { phase: Phase; topics: Topic[]; messagesByTopic: Record<string, Message[]>; topicSummaries: Record<string, Summary | null>; summary?: Summary | null; language?: MarkdownExportLanguage; attachmentPathFor?: AttachmentPathResolver }): string {
  const labels = exportCopy[input.language ?? 'en'];
  const lines = [
    `# ${input.phase.title}`,
    '',
    `- ${labels.phaseId}: ${input.phase.id}`,
    `- ${labels.started}: ${formatDate(input.phase.startedAt)}`,
    input.phase.endedAt ? `- ${labels.ended}: ${formatDate(input.phase.endedAt)}` : undefined,
    input.phase.shareId ? `- ${labels.shareId}: ${input.phase.shareId}` : undefined,
    '',
    `## ${labels.phaseSummary}`,
    '',
    input.summary?.content ?? labels.phaseSummaryFallback,
    '',
    `## ${labels.topics}`,
    ''
  ].filter((line): line is string => typeof line === 'string');

  for (const topic of input.topics) {
    const messages = input.messagesByTopic[topic.id] ?? [];
    lines.push(`### ${topic.title}`, '', input.topicSummaries[topic.id]?.content ?? labels.topicSummaryFallback, '', `${labels.messages}: ${messages.length}`, '');
    for (const message of messages) {
      pushMessageExport(lines, `#### ${message.role} · ${formatDate(message.createdAt)}`, message, input.attachmentPathFor);
    }
  }

  return `${lines.join('\n').trim()}\n`;
}

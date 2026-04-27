import { describe, expect, it } from 'vitest';
import { parseMessages, parseSummary, serializeMessage, serializePhaseExport, serializeSummary, serializeTopicExport } from '../src/main/markdown';
import type { Message, Phase, Summary, Topic } from '../src/shared/types';

const topic: Topic = {
  id: 'topic-1',
  title: 'Round trip',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:01:00.000Z',
  status: 'active',
  shareId: 'share-topic'
};

const phase: Phase = {
  id: 'phase-1',
  title: 'Research',
  startedAt: '2026-01-01T00:00:00.000Z',
  topicIds: [topic.id],
  status: 'active',
  shareId: 'share-phase'
};

const message: Message = {
  id: 'message-1',
  topicId: topic.id,
  role: 'user',
  content: 'Hello **Mindline**',
  createdAt: '2026-01-01T00:02:00.000Z'
};

const imageMessage: Message = {
  ...message,
  id: 'message-image',
  content: '',
  attachments: [
    {
      id: 'attachment-1',
      type: 'image',
      fileName: 'diagram.png',
      mediaType: 'image/png',
      size: 12,
      path: 'phases/default-phase/topics/round-trip/attachments/attachment-1-diagram.png'
    }
  ],
  contextItems: [
    {
      type: 'topic',
      id: topic.id,
      label: 'Topic: Round trip',
      sourceRefs: [{ type: 'topic', id: topic.id }]
    }
  ]
};

const summary: Summary = {
  id: 'summary-1',
  targetType: 'topic',
  targetId: topic.id,
  content: 'A compact summary.',
  createdAt: '2026-01-01T00:03:00.000Z',
  sourceRefs: [{ type: 'message', id: message.id, topicId: topic.id }]
};

describe('markdown serialization', () => {
  it('round trips message metadata', () => {
    expect(parseMessages(serializeMessage(message))).toEqual([message]);
  });

  it('round trips message attachments and context refs', () => {
    expect(parseMessages(serializeMessage(imageMessage))).toEqual([imageMessage]);
  });

  it('round trips summary metadata', () => {
    expect(parseSummary(serializeSummary(summary))).toEqual(summary);
  });

  it('exports readable topic markdown', () => {
    const markdown = serializeTopicExport({
      topic,
      phase,
      messages: [message, imageMessage],
      summary,
      attachmentPathFor: (_message, attachment) => `Round trip.assets/${attachment.id}.png`
    });
    expect(markdown).toContain('# Round trip');
    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('Hello **Mindline**');
    expect(markdown).toContain('![diagram.png](Round trip.assets/attachment-1.png)');
    expect(markdown).toContain('- Topic: Round trip');
  });

  it('exports localized topic markdown headings', () => {
    const markdown = serializeTopicExport({ topic, messages: [message], summary: null, language: 'zh' });
    expect(markdown).toContain('- 话题 ID: topic-1');
    expect(markdown).toContain('- 阶段: 默认阶段');
    expect(markdown).toContain('## 总结');
    expect(markdown).toContain('暂无总结。');
    expect(markdown).toContain('## 消息');
  });

  it('exports readable phase markdown with topic content', () => {
    const markdown = serializePhaseExport({
      phase,
      topics: [topic],
      messagesByTopic: { [topic.id]: [message] },
      topicSummaries: { [topic.id]: summary },
      summary: { ...summary, targetType: 'phase', targetId: phase.id }
    });
    expect(markdown).toContain('# Research');
    expect(markdown).toContain('### Round trip');
    expect(markdown).toContain('Messages: 1');
  });

  it('exports localized phase markdown headings', () => {
    const markdown = serializePhaseExport({
      phase,
      topics: [topic],
      messagesByTopic: { [topic.id]: [message] },
      topicSummaries: { [topic.id]: null },
      summary: null,
      language: 'zh'
    });
    expect(markdown).toContain('- 阶段 ID: phase-1');
    expect(markdown).toContain('## 阶段总结');
    expect(markdown).toContain('暂无阶段总结。');
    expect(markdown).toContain('## 话题');
    expect(markdown).toContain('消息: 1');
  });
});

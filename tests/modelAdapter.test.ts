import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModelAdapter, extractResponseContent, extractStreamDelta } from '../src/main/modelAdapter';
import type { Message, ModelProvider } from '../src/shared/types';

describe('modelAdapter response parsing', () => {
  it('extracts OpenAI chat response content', () => {
    expect(extractResponseContent({ choices: [{ message: { content: ' hello ' } }] })).toBe('hello');
  });

  it('extracts Anthropic content blocks', () => {
    expect(extractResponseContent({ content: [{ type: 'text', text: 'one' }, { type: 'text', text: 'two' }] })).toBe('one\ntwo');
  });

  it('extracts text-compatible completion responses', () => {
    expect(extractResponseContent({ choices: [{ text: 'legacy text' }] })).toBe('legacy text');
    expect(extractResponseContent({ output_text: 'responses text' })).toBe('responses text');
  });

  it('throws when no readable content exists', () => {
    expect(() => extractResponseContent({ choices: [{}] })).toThrow('模型响应中没有可读取的文本内容');
  });

  it('extracts stream deltas from OpenAI and Anthropic SSE payloads', () => {
    expect(extractStreamDelta({ choices: [{ delta: { content: 'hel' } }] })).toBe('hel');
    expect(extractStreamDelta({ type: 'content_block_delta', delta: { text: 'lo' } })).toBe('lo');
    expect(extractStreamDelta({ type: 'ping' })).toBe('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends image attachments as OpenAI chat content parts', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mindline-model-openai-'));
    await fs.mkdir(path.join(tempRoot, 'topics', 'topic-1', 'attachments'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'topics', 'topic-1', 'attachments', 'screen.png'), 'image');
    const provider: ModelProvider = {
      id: 'openai-provider',
      name: 'OpenAI Compatible',
      kind: 'cloud-model',
      providerKey: 'custom-cloud',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: { baseUrl: 'https://example.test/v1', defaultModel: 'vision-model', protocol: 'openai-chat' },
      hasApiKey: true
    };
    let requestBody: any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }) as any).mockImplementation(async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    });
    const adapter = createModelAdapter(provider, 'sk-test', tempRoot);
    const message = imageMessage('topic-1');

    await adapter.sendMessage({ topic: { id: 'topic-1', title: 'Vision', createdAt: '', updatedAt: '', status: 'active' }, messages: [message], prompt: 'Look' });

    expect(requestBody.messages[1].content[0]).toEqual({ type: 'text', text: 'Look' });
    expect(requestBody.messages[1].content[1].type).toBe('image_url');
    expect(requestBody.messages[1].content[1].image_url.url).toContain('data:image/png;base64,');
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('keeps image-only messages as multimodal content parts', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mindline-model-image-only-'));
    await fs.mkdir(path.join(tempRoot, 'topics', 'topic-1', 'attachments'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'topics', 'topic-1', 'attachments', 'screen.png'), 'image');
    const provider: ModelProvider = {
      id: 'openai-provider',
      name: 'OpenAI Compatible',
      kind: 'cloud-model',
      providerKey: 'custom-cloud',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: { baseUrl: 'https://example.test/v1', defaultModel: 'vision-model', protocol: 'openai-chat' },
      hasApiKey: true
    };
    let requestBody: any;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    });

    await createModelAdapter(provider, 'sk-test', tempRoot).sendMessage({
      topic: { id: 'topic-1', title: 'Vision', createdAt: '', updatedAt: '', status: 'active' },
      messages: [imageMessage('topic-1', '')],
      prompt: ''
    });

    expect(requestBody.messages[1].content[0].type).toBe('image_url');
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('sends image attachments as Anthropic image blocks', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mindline-model-anthropic-'));
    await fs.mkdir(path.join(tempRoot, 'topics', 'topic-1', 'attachments'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'topics', 'topic-1', 'attachments', 'screen.png'), 'image');
    const provider: ModelProvider = {
      id: 'anthropic-provider',
      name: 'Anthropic Compatible',
      kind: 'cloud-model',
      providerKey: 'custom-cloud',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: { baseUrl: 'https://example.test', defaultModel: 'vision-model', protocol: 'anthropic-messages' },
      hasApiKey: true
    };
    let requestBody: any;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), { status: 200 });
    });
    const adapter = createModelAdapter(provider, 'sk-test', tempRoot);

    await adapter.sendMessage({ topic: { id: 'topic-1', title: 'Vision', createdAt: '', updatedAt: '', status: 'active' }, messages: [imageMessage('topic-1')], prompt: 'Look' });

    expect(requestBody.messages[0].content[0]).toEqual({ type: 'text', text: 'Look' });
    expect(requestBody.messages[0].content[1]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/png' } });
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('sends text attachments as text parts for OpenAI-compatible providers', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mindline-model-text-'));
    await fs.mkdir(path.join(tempRoot, 'topics', 'topic-1', 'attachments'), { recursive: true });
    await fs.writeFile(path.join(tempRoot, 'topics', 'topic-1', 'attachments', 'notes.md'), '# Notes\n\nImportant context', 'utf8');
    const provider: ModelProvider = {
      id: 'openai-provider',
      name: 'OpenAI Compatible',
      kind: 'cloud-model',
      providerKey: 'custom-cloud',
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: { baseUrl: 'https://example.test/v1', defaultModel: 'text-model', protocol: 'openai-chat' },
      hasApiKey: true
    };
    let requestBody: any;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
    });

    await createModelAdapter(provider, 'sk-test', tempRoot).sendMessage({
      topic: { id: 'topic-1', title: 'Text', createdAt: '', updatedAt: '', status: 'active' },
      messages: [textMessage('topic-1')],
      prompt: 'Read'
    });

    expect(requestBody.messages[1].content[0]).toEqual({ type: 'text', text: 'Read' });
    expect(requestBody.messages[1].content[1]).toEqual({ type: 'text', text: expect.stringContaining('## 文本附件：notes.md') });
    expect(requestBody.messages[1].content[1].text).toContain('Important context');
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
});

function imageMessage(topicId: string, content = 'Look'): Message {
  return {
    id: 'message-1',
    topicId,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
    attachments: [
      {
        id: 'attachment-1',
        type: 'image',
        fileName: 'screen.png',
        mediaType: 'image/png',
        size: 5,
        path: 'attachments/screen.png'
      }
    ]
  };
}

function textMessage(topicId: string, content = 'Read'): Message {
  return {
    id: 'message-1',
    topicId,
    role: 'user',
    content,
    createdAt: new Date().toISOString(),
    attachments: [
      {
        id: 'attachment-1',
        type: 'text',
        fileName: 'notes.md',
        mediaType: 'text/markdown',
        size: 26,
        path: 'attachments/notes.md'
      }
    ]
  };
}

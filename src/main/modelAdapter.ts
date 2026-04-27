import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { CloudModelProviderConfig, Id, LocalToolModelProviderConfig, Message, MessageAttachment, ModelAdapter, ModelProvider, ModelPresetId, ModelRolePresetId, ModelRunOptions, Summary } from '../shared/types.js';

const execFileAsync = promisify(execFile);
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ERROR_BODY_LENGTH = 600;

type ChatRole = 'system' | 'user' | 'assistant';
type ChatContentPart = { type: 'text'; text: string } | { type: 'image'; attachment: MessageAttachment; topicId: Id };

interface ChatMessage {
  role: ChatRole;
  content: string | ChatContentPart[];
}

interface NormalizedRunOptions {
  presetId: ModelPresetId;
  rolePresetId: ModelRolePresetId;
  roleInstruction: string;
  profileInstruction: string;
  temperature: number;
  maxTokens: number;
}

interface RuntimeProfile {
  roleName: string;
  roleRules: string[];
  presetName: string;
  presetRules: string[];
}

const presetProfiles: Record<ModelPresetId, { name: string; rules: string[] }> = {
  balanced: {
    name: '均衡',
    rules: [
      '先给用户可直接使用的结论，再补充必要依据。',
      '兼顾准确性、完整性和可读性，避免过短导致信息不足。',
      '当存在多个可行方向时，给出最推荐的一种，并说明取舍。'
    ]
  },
  precise: {
    name: '精确',
    rules: [
      '优先事实、边界条件、定义和明确结论。',
      '不确定时直接说明不确定，不编造来源、数据或能力。',
      '减少发散、类比和装饰性表达，必要时给出验证方式。'
    ]
  },
  creative: {
    name: '发散',
    rules: [
      '提供多个可选方向、替代方案或灵感路径。',
      '允许探索性假设，但必须标明假设和适用场景。',
      '最后收敛出最推荐方案或下一步，不停留在想法堆叠。'
    ]
  },
  longform: {
    name: '长文',
    rules: [
      '适合深度展开、结构化总结和复杂问题拆解。',
      '使用清晰分层组织内容，先概览再展开。',
      '保留关键细节、结论、待办和可继续追问的问题。'
    ]
  },
  code: {
    name: '代码',
    rules: [
      '优先给出可运行方案、关键代码、验证步骤和潜在风险。',
      '说明实现取舍、边界条件、错误路径和测试方式。',
      '除非用户只要求解释，否则不要只给概念说明。'
    ]
  }
};

const roleInstructions: Record<ModelRolePresetId, string> = {
  assistant: '角色：通用助手。直接理解用户问题，给出清晰、准确、可执行的回答。',
  engineer: '角色：工程师。优先关注实现方案、边界条件、代码质量、验证步骤和风险。',
  writer: '角色：写作者。优先关注表达结构、语气、叙事连贯性和可读性。',
  analyst: '角色：分析师。优先拆解问题、提炼结论、比较方案，并明确假设和证据。'
};

function roleProfileFor(roleInstruction: string): { name: string; rules: string[] } {
  const roleName = roleInstruction.replace(/^角色[：:]\s*/, '').trim() || '助手';
  const normalized = roleName.toLowerCase();

  if (/(产品经理|product\s*manager|pm\b)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '从用户目标、使用场景、约束和成功标准出发。',
        '关注需求边界、优先级、风险、验收标准和下一步决策。',
        '不要默认进入代码实现细节，除非用户明确要求。'
      ]
    };
  }

  if (/(首席执行官|执行官|ceo|chief\s*executive\s*officer)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '从战略目标、市场定位、组织能力、增长路径和关键资源配置出发。',
        '优先给出决策结论，再说明战略取舍、核心风险和关键指标。',
        '关注长期方向与短期执行之间的平衡，并明确下一步负责人。'
      ]
    };
  }

  if (/(首席技术官|技术官|cto|chief\s*technology\s*officer)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '从技术战略、架构演进、系统边界、安全可靠性和工程效能出发。',
        '关注技术债、团队能力、长期扩展性和短期落地路径。',
        '给出技术判断、风险控制、验证方式和必要的替代方案。'
      ]
    };
  }

  if (/(首席运营官|运营官|coo|chief\s*operating\s*officer)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '从流程效率、资源调度、跨团队协同、执行节奏和交付质量出发。',
        '优先识别运营瓶颈、责任分工、节奏安排和可追踪指标。',
        '给出可执行的运营动作，并说明依赖、风险和复盘方式。'
      ]
    };
  }

  if (/(首席财务官|财务官|cfo|chief\s*financial\s*officer)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '从现金流、预算约束、成本结构、投入产出和财务风险出发。',
        '量化关键假设，区分短期现金影响、长期价值和合规边界。',
        '给出风险边界、财务检查点和需要补充的数据。'
      ]
    };
  }

  if (/(程序开发者|开发者|工程师|developer|engineer)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '从实现路径、系统边界、代码质量和可维护性出发。',
        '关注异常场景、安全性、性能、测试和验证步骤。',
        '给出可执行的技术方案，必要时指出风险和替代实现。'
      ]
    };
  }

  if (/(设计师|designer|ux|ui)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '从用户任务、信息层级、交互成本和视觉一致性出发。',
        '关注可读性、可访问性、状态反馈、响应式和真实使用流程。',
        '给出设计取舍、界面行为和可落地的改进建议。'
      ]
    };
  }

  if (/(心理咨询师|咨询师|counselor|therapist)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '使用支持性、审慎、非评判的表达，优先倾听和澄清。',
        '避免诊断、开药或替代专业医疗建议；涉及危机风险时建议寻求现实帮助。',
        '给出温和、具体、低风险的下一步行动建议。'
      ]
    };
  }

  if (/(数据分析师|数据分析|data\s*analyst)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '先确认数据口径、样本范围、时间窗口和分析目标。',
        '关注关键指标、趋势、异常点、分群差异和结论可信度。',
        '区分观察、推断和建议，必要时给出下一步验证方式。'
      ]
    };
  }

  if (/(家庭教师|教师|家教|导师|tutor|teacher)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '按学习者当前水平循序解释，避免一次性灌输过多概念。',
        '优先使用简单例子、类比、启发式问题和短练习。',
        '指出常见误区，并给出可继续练习或复盘的下一步。'
      ]
    };
  }

  if (/(写作者|writer)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '关注表达结构、语气、叙事连贯性和读者感受。',
        '优先改进措辞、段落组织、标题和信息节奏。',
        '必要时给出可直接替换的文本版本。'
      ]
    };
  }

  if (/(分析师|analyst)/i.test(roleName)) {
    return {
      name: roleName,
      rules: [
        '先拆解问题，再提炼结论、依据和假设。',
        '比较方案时明确评价维度、优劣和适用条件。',
        '避免无根据判断，必要时指出还缺哪些信息。'
      ]
    };
  }

  if (/(助手|assistant)/i.test(normalized)) {
    return {
      name: roleName,
      rules: [
        '直接理解用户问题，给出清晰、准确、可执行的回答。',
        '在信息不足时指出缺口，并给出合理假设或下一步问题。',
        '保持简洁，不无故扩展到用户没有要求的方向。'
      ]
    };
  }

  return {
    name: roleName,
    rules: [
      `以“${roleName}”的视角回应，体现该角色最关注的目标、约束、判断标准和下一步。`,
      '如果该角色含义不明确，按通用助手处理，并避免伪装专业资质或编造背景。',
      '输出要让用户能看出当前角色确实影响了关注点和建议。'
    ]
  };
}

function now(): string {
  return new Date().toISOString();
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function truncate(value: string, max = MAX_ERROR_BODY_LENGTH): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max)}...` : compact;
}

function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return trimmed.endsWith('/chat/completions') ? trimmed : `${trimmed}/chat/completions`;
}

export function extractResponseContent(payload: unknown): string {
  const data = payload as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> }; text?: string }>;
    content?: string | Array<{ type?: string; text?: string }>;
    output_text?: string;
  };

  const messageContent = data.choices?.[0]?.message?.content;
  if (typeof messageContent === 'string') {
    return messageContent.trim();
  }
  if (Array.isArray(messageContent)) {
    return messageContent
      .map((part) => part.text)
      .filter((part): part is string => Boolean(part))
      .join('\n')
      .trim();
  }
  if (typeof data.choices?.[0]?.text === 'string') {
    return data.choices[0].text.trim();
  }
  if (typeof data.output_text === 'string') {
    return data.output_text.trim();
  }
  if (typeof data.content === 'string') {
    return data.content.trim();
  }
  if (Array.isArray(data.content)) {
    return data.content
      .map((part) => part.text)
      .filter((part): part is string => Boolean(part))
      .join('\n')
      .trim();
  }
  throw new Error('模型响应中没有可读取的文本内容。');
}

export function extractStreamDelta(payload: unknown): string {
  const data = payload as {
    choices?: Array<{ delta?: { content?: string | Array<{ text?: string }> }; text?: string }>;
    delta?: { text?: string };
    type?: string;
    content_block?: { text?: string };
  };

  const openAiDelta = data.choices?.[0]?.delta?.content;
  if (typeof openAiDelta === 'string') {
    return openAiDelta;
  }
  if (Array.isArray(openAiDelta)) {
    return openAiDelta
      .map((part) => part.text)
      .filter((part): part is string => Boolean(part))
      .join('');
  }
  if (typeof data.choices?.[0]?.text === 'string') {
    return data.choices[0].text;
  }
  if (data.type === 'content_block_delta' && typeof data.delta?.text === 'string') {
    return data.delta.text;
  }
  if (data.type === 'content_block_start' && typeof data.content_block?.text === 'string') {
    return data.content_block.text;
  }
  return '';
}

function isLegacyMockAssistantMessage(message: Message): boolean {
  return message.role === 'assistant' && (message.modelId === 'mock-local' || /^Mock reply for /i.test(message.content.trim()));
}

function realContextMessages(messages: Message[]): Message[] {
  return messages.filter((message) => !isLegacyMockAssistantMessage(message));
}

function textFromChatContent(content: string | ChatContentPart[]): string {
  if (typeof content === 'string') {
    return content;
  }
  return content
    .map((part) => (part.type === 'text' ? part.text : `[图片：${part.attachment.fileName}]`))
    .filter(Boolean)
    .join('\n');
}

function hasImageParts(messages: ChatMessage[]): boolean {
  return messages.some((message) => Array.isArray(message.content) && message.content.some((part) => part.type === 'image'));
}

function appendContextMarkdown(content: string, contextMarkdown?: string): string {
  if (!contextMarkdown?.trim()) {
    return content;
  }
  return [content, '## 插入的上下文篮内容', contextMarkdown.trim()].filter(Boolean).join('\n\n');
}

type TextAttachmentReader = (message: Message, attachment: MessageAttachment) => Promise<string>;

function formatTextAttachment(fileName: string, text: string): string {
  return [`## 文本附件：${fileName}`, '', '```text', text.trim(), '```'].join('\n');
}

async function messageToChatMessage(message: Message, contextMarkdown: string | undefined, readTextAttachment: TextAttachmentReader): Promise<ChatMessage> {
  const content = appendContextMarkdown(message.content, contextMarkdown);
  const parts: ChatContentPart[] = content ? [{ type: 'text', text: content }] : [];
  for (const attachment of message.attachments ?? []) {
    if (attachment.type === 'image') {
      parts.push({ type: 'image', attachment, topicId: message.topicId });
      continue;
    }
    parts.push({ type: 'text', text: formatTextAttachment(attachment.fileName, await readTextAttachment(message, attachment)) });
  }
  return {
    role: message.role as ChatRole,
    content: message.attachments?.length ? parts : content
  };
}

function splitAnthropicMessages(messages: ChatMessage[]): { system?: string; messages: Array<{ role: 'user' | 'assistant'; content: string | ChatContentPart[] }> } {
  const systemParts: string[] = [];
  const conversation: Array<{ role: 'user' | 'assistant'; content: string | ChatContentPart[] }> = [];

  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(textFromChatContent(message.content));
      continue;
    }
    conversation.push({ role: message.role, content: message.content });
  }

  if (conversation.length === 0) {
    conversation.push({ role: 'user', content: '请继续。' });
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: conversation
  };
}

async function toChatHistory(messages: Message[], options: ModelRunOptions | undefined, readTextAttachment: TextAttachmentReader): Promise<ChatMessage[]> {
  const filtered = realContextMessages(messages)
    .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'system')
  const lastUserIndex = [...filtered].reverse().findIndex((message) => message.role === 'user');
  const lastUserMessageIndex = lastUserIndex === -1 ? -1 : filtered.length - 1 - lastUserIndex;
  return Promise.all(filtered.map((message, index) => messageToChatMessage(message, index === lastUserMessageIndex ? options?.contextMarkdown : undefined, readTextAttachment)));
}

function normalizeRunOptions(options?: ModelRunOptions): NormalizedRunOptions {
  const temperature = typeof options?.temperature === 'number' && Number.isFinite(options.temperature) ? options.temperature : 0.3;
  const maxTokens = typeof options?.maxTokens === 'number' && Number.isFinite(options.maxTokens) ? options.maxTokens : 4096;
  const rolePresetId = options?.rolePresetId ?? 'assistant';
  const customRole = typeof options?.roleInstruction === 'string' ? options.roleInstruction.trim() : '';
  return {
    presetId: options?.presetId ?? 'balanced',
    rolePresetId,
    roleInstruction: customRole || roleInstructions[rolePresetId],
    profileInstruction: typeof options?.profileInstruction === 'string' ? options.profileInstruction.trim() : '',
    temperature: Math.min(2, Math.max(0, temperature)),
    maxTokens: Math.min(32_000, Math.max(256, Math.round(maxTokens)))
  };
}

function runtimeProfileFor(options?: ModelRunOptions): RuntimeProfile {
  const normalized = normalizeRunOptions(options);
  const roleProfile = roleProfileFor(normalized.roleInstruction);
  const presetProfile = presetProfiles[normalized.presetId];
  return {
    roleName: roleProfile.name,
    roleRules: roleProfile.rules,
    presetName: presetProfile.name,
    presetRules: presetProfile.rules
  };
}

function listRules(rules: string[]): string {
  return rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n');
}

function buildRuntimeSystemPrompt(topicTitle: string, options?: ModelRunOptions): string {
  const normalized = normalizeRunOptions(options);
  const profile = runtimeProfileFor(options);

  return [
    `你是 Mindline 中的真实模型适配器。当前话题是“${topicTitle}”。保持这个话题上下文隔离，直接回答用户最新问题。`,
    '',
    '## 本次运行画像',
    `角色：${profile.roleName}`,
    `预设：${profile.presetName}`,
    `温度：${normalized.temperature}`,
    `最大输出 tokens：${normalized.maxTokens}`,
    '',
    '## 执行优先级',
    '1. 严格回答用户最新问题。',
    '2. 在回答中明确体现当前角色视角。',
    '3. 按当前预设控制输出策略、深度和发散程度。',
    '4. 使用历史上下文，但不要被旧上下文覆盖用户最新意图。',
    '5. 如果角色、预设与用户明确要求冲突，以用户最新要求和安全边界为准。',
    '',
    '## 角色必须体现',
    listRules(profile.roleRules),
    '',
    '## 预设必须体现',
    listRules(profile.presetRules),
    normalized.profileInstruction
      ? ['', '## 用户自定义画像补充', normalized.profileInstruction].join('\n')
      : '',
    '',
    '## 回复要求',
    '1. 不要在回答中机械复述这些系统规则，除非用户询问运行设置。',
    '2. 内容应可执行、可验证，并尽量给出清晰下一步。',
    '3. 信息不足时明确说明缺口，不要编造事实。'
  ].join('\n');
}

function runtimeSettingsText(options?: ModelRunOptions): string {
  const normalized = normalizeRunOptions(options);
  const profile = runtimeProfileFor(options);
  return [
    `运行画像：${profile.roleName} × ${profile.presetName}`,
    '',
    '角色执行要求：',
    listRules(profile.roleRules),
    '',
    '预设执行要求：',
    listRules(profile.presetRules),
    normalized.profileInstruction ? `\n画像补充内容：\n${normalized.profileInstruction}` : '',
    '',
    `温度：${normalized.temperature}`,
    `最大输出 tokens：${normalized.maxTokens}`
  ].join('\n');
}

async function attachmentSummary(message: Message, readTextAttachment: TextAttachmentReader): Promise<string> {
  if (!message.attachments?.length) {
    return '';
  }
  const sections = await Promise.all(message.attachments.map(async (attachment) => {
    if (attachment.type === 'image') {
      return `图片附件：${attachment.fileName}`;
    }
    return formatTextAttachment(attachment.fileName, await readTextAttachment(message, attachment));
  }));
  return `\n${sections.join('\n\n')}`;
}

async function transcript(messages: Message[], options: ModelRunOptions | undefined, readTextAttachment: TextAttachmentReader): Promise<string> {
  const filtered = realContextMessages(messages);
  if (filtered.length === 0) {
    return '暂无对话。';
  }
  const lastUserIndex = [...filtered].reverse().findIndex((message) => message.role === 'user');
  const lastUserMessageIndex = lastUserIndex === -1 ? -1 : filtered.length - 1 - lastUserIndex;
  const entries = await Promise.all(filtered
    .map(async (message, index) => {
      const content = appendContextMarkdown(message.content, index === lastUserMessageIndex ? options?.contextMarkdown : undefined);
      const attachments = await attachmentSummary(message, readTextAttachment);
      return `${message.role}: ${content}${attachments}`;
    }));
  return entries.join('\n\n');
}

function splitArgs(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (const char of input) {
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = null;
      continue;
    }
    if (/\s/.test(char) && !quote) {
      if (current) {
        result.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (current) {
    result.push(current);
  }
  return result;
}

function defaultLocalArgs(provider: ModelProvider, prompt: string): string[] {
  const config = provider.config as LocalToolModelProviderConfig;
  if (config.args?.trim()) {
    return splitArgs(config.args).map((arg) => arg.replaceAll('{prompt}', prompt));
  }

  switch (provider.providerKey) {
    case 'claude-code':
    case 'openclaw':
      return ['-p', prompt];
    case 'codex':
      return ['exec', prompt];
    default:
      return [prompt];
  }
}

export function createModelAdapter(provider: ModelProvider, apiKey?: string | null, projectPath?: string): ModelAdapter {
  return new ConfiguredModelAdapter(provider, apiKey ?? undefined, projectPath);
}

class ConfiguredModelAdapter implements ModelAdapter {
  readonly id: string;
  readonly label: string;
  readonly supportsAttachments: boolean;

  constructor(
    private readonly provider: ModelProvider,
    private readonly apiKey?: string,
    private readonly projectPath?: string
  ) {
    this.id = provider.id;
    this.label = provider.name;
    this.supportsAttachments = provider.kind === 'cloud-model';
  }

  async sendMessage({ topic, messages, options }: Parameters<ModelAdapter['sendMessage']>[0]): Promise<Message> {
    const readTextAttachment = (message: Message, attachment: MessageAttachment) => this.attachmentText(message.topicId, attachment);
    const chatHistory = await toChatHistory(messages, options, readTextAttachment);
    const transcriptText = await transcript(messages, options, readTextAttachment);
    const content = await this.complete({
      chatMessages: [
        {
          role: 'system',
          content: buildRuntimeSystemPrompt(topic.title, options)
        },
        ...chatHistory
      ],
      plainPrompt: `当前话题：${topic.title}\n\n运行设置：\n${runtimeSettingsText(options)}\n\n对话记录：\n${transcriptText}\n\n请回答最后一条用户消息。`
    }, options);

    return {
      id: randomUUID(),
      topicId: topic.id,
      role: 'assistant',
      content,
      createdAt: now(),
      modelId: this.id
    };
  }

  async sendMessageStream({ topic, messages, options, signal, onChunk }: Parameters<NonNullable<ModelAdapter['sendMessageStream']>>[0]): Promise<Message> {
    const readTextAttachment = (message: Message, attachment: MessageAttachment) => this.attachmentText(message.topicId, attachment);
    const chatHistory = await toChatHistory(messages, options, readTextAttachment);
    const transcriptText = await transcript(messages, options, readTextAttachment);
    const content = await this.completeStream({
      chatMessages: [
        {
          role: 'system',
          content: buildRuntimeSystemPrompt(topic.title, options)
        },
        ...chatHistory
      ],
      plainPrompt: `当前话题：${topic.title}\n\n运行设置：\n${runtimeSettingsText(options)}\n\n对话记录：\n${transcriptText}\n\n请回答最后一条用户消息。`
    }, options, signal, onChunk);

    return {
      id: randomUUID(),
      topicId: topic.id,
      role: 'assistant',
      content,
      createdAt: now(),
      modelId: this.id
    };
  }

  async summarizeTopic({ topic, messages }: Parameters<ModelAdapter['summarizeTopic']>[0]): Promise<Summary> {
    const transcriptText = await transcript(messages, undefined, (message, attachment) => this.attachmentText(message.topicId, attachment));
    const content = await this.complete({
      chatMessages: [
        { role: 'system', content: '你是严谨的中文总结助手。输出结构清晰、可复用的 Markdown 总结。' },
        {
          role: 'user',
          content: `请总结话题“${topic.title}”的全部对话，保留关键结论、待办、分歧和可继续追问的问题。\n\n${transcriptText}`
        }
      ],
      plainPrompt: `请总结话题“${topic.title}”的全部对话，保留关键结论、待办、分歧和可继续追问的问题。\n\n${transcriptText}`
    });

    return {
      id: randomUUID(),
      targetType: 'topic',
      targetId: topic.id,
      content,
      createdAt: now(),
      sourceRefs: realContextMessages(messages).map((message) => ({ type: 'message', id: message.id, topicId: topic.id }))
    };
  }

  async summarizePhase({ phase, topics, topicSummaries, messagesByTopic }: Parameters<ModelAdapter['summarizePhase']>[0]): Promise<Summary> {
    const phaseContext = (await Promise.all(topics
      .map(async (topic) => {
        const summary = topicSummaries.find((entry) => entry.targetId === topic.id);
        const transcriptText = await transcript(messagesByTopic[topic.id] ?? [], undefined, (message, attachment) => this.attachmentText(message.topicId, attachment));
        return [
          `## 话题：${topic.title}`,
          summary ? `### 已有话题总结\n${summary.content}` : `### 对话记录\n${transcriptText}`
        ].join('\n\n');
      })))
      .join('\n\n');

    const content = await this.complete({
      chatMessages: [
        { role: 'system', content: '你是阶段复盘助手。只基于给定阶段内的话题内容总结，不引入阶段外信息。' },
        { role: 'user', content: `请总结阶段“${phase.title}”的产出。\n\n${phaseContext}` }
      ],
      plainPrompt: `请总结阶段“${phase.title}”的产出。只基于给定阶段内的话题内容总结，不引入阶段外信息。\n\n${phaseContext}`
    });

    return {
      id: randomUUID(),
      targetType: 'phase',
      targetId: phase.id,
      content,
      createdAt: now(),
      sourceRefs: [
        { type: 'phase', id: phase.id },
        ...topics.map((topic) => ({ type: 'topic' as const, id: topic.id, phaseId: phase.id })),
        ...topicSummaries.map((summary) => ({ type: 'topic-summary' as const, id: summary.id, phaseId: phase.id }))
      ]
    };
  }

  async discussSelection({ prompt, contextMarkdown, sourceRefs }: Parameters<ModelAdapter['discussSelection']>[0]): Promise<Message> {
    const content = await this.complete({
      chatMessages: [
        { role: 'system', content: '你是 Mindline 的上下文讨论助手。只基于用户选择的上下文回答，必要时指出信息不足。' },
        { role: 'user', content: `用户选择的上下文：\n\n${contextMarkdown}\n\n用户问题：${prompt}` }
      ],
      plainPrompt: `用户选择的上下文：\n\n${contextMarkdown}\n\n用户问题：${prompt}\n\n请基于上下文回答，必要时指出信息不足。`
    });

    return {
      id: randomUUID(),
      topicId: 'selection',
      role: 'assistant',
      content,
      createdAt: now(),
      modelId: this.id
    };
  }

  private async complete(input: { chatMessages: ChatMessage[]; plainPrompt: string }, options?: ModelRunOptions): Promise<string> {
    if (!this.provider.enabled) {
      throw new Error('当前模型供应商已停用，请在设置中启用其他供应商。');
    }

    if (this.provider.kind === 'cloud-model') {
      const config = this.provider.config as CloudModelProviderConfig;
      return config.protocol === 'anthropic-messages' ? this.completeWithAnthropicMessages(input.chatMessages, options) : this.completeWithOpenAiChat(input.chatMessages, options);
    }
    if (hasImageParts(input.chatMessages)) {
      throw new Error('当前本地工具模型暂不支持图片发送，请切换到支持视觉输入的云端模型。');
    }
    return this.completeWithLocalTool(input.plainPrompt);
  }

  private async completeStream(input: { chatMessages: ChatMessage[]; plainPrompt: string }, options: ModelRunOptions | undefined, signal: AbortSignal | undefined, onChunk: (delta: string, content: string) => void): Promise<string> {
    if (!this.provider.enabled) {
      throw new Error('当前模型供应商已停用，请在设置中启用其他供应商。');
    }

    if (this.provider.kind === 'cloud-model') {
      const config = this.provider.config as CloudModelProviderConfig;
      return config.protocol === 'anthropic-messages'
        ? this.completeWithAnthropicMessagesStream(input.chatMessages, options, signal, onChunk)
        : this.completeWithOpenAiChatStream(input.chatMessages, options, signal, onChunk);
    }

    if (hasImageParts(input.chatMessages)) {
      throw new Error('当前本地工具模型暂不支持图片发送，请切换到支持视觉输入的云端模型。');
    }
    const content = await this.completeWithLocalTool(input.plainPrompt, signal);
    onChunk(content, content);
    return content;
  }

  private async completeWithOpenAiChat(messages: ChatMessage[], options?: ModelRunOptions): Promise<string> {
    const config = this.provider.config as CloudModelProviderConfig;
    const normalizedOptions = normalizeRunOptions(options);
    const baseUrl = config.baseUrl?.trim();
    const model = config.defaultModel?.trim();
    if (!baseUrl) {
      throw new Error('当前云端模型缺少 API 地址，请在设置中补充。');
    }
    if (!model) {
      throw new Error('当前云端模型缺少默认模型名，请在设置中补充。');
    }
    if (!this.apiKey) {
      throw new Error('当前云端模型未保存 API Key，请在设置中重新添加密钥。');
    }

    return this.postJsonForText(chatCompletionsUrl(baseUrl), {
      'content-type': 'application/json',
      authorization: `Bearer ${this.apiKey}`
    }, { model, messages: await this.toOpenAiMessages(messages), temperature: normalizedOptions.temperature, max_tokens: normalizedOptions.maxTokens, stream: false });
  }

  private async completeWithOpenAiChatStream(messages: ChatMessage[], options: ModelRunOptions | undefined, signal: AbortSignal | undefined, onChunk: (delta: string, content: string) => void): Promise<string> {
    const config = this.provider.config as CloudModelProviderConfig;
    const normalizedOptions = normalizeRunOptions(options);
    const baseUrl = config.baseUrl?.trim();
    const model = config.defaultModel?.trim();
    if (!baseUrl) {
      throw new Error('当前云端模型缺少 API 地址，请在设置中补充。');
    }
    if (!model) {
      throw new Error('当前云端模型缺少默认模型名，请在设置中补充。');
    }
    if (!this.apiKey) {
      throw new Error('当前云端模型未保存 API Key，请在设置中重新添加密钥。');
    }

    return this.postJsonForStream(chatCompletionsUrl(baseUrl), {
      'content-type': 'application/json',
      authorization: `Bearer ${this.apiKey}`
    }, { model, messages: await this.toOpenAiMessages(messages), temperature: normalizedOptions.temperature, max_tokens: normalizedOptions.maxTokens, stream: true }, signal, onChunk);
  }

  private async completeWithAnthropicMessages(messages: ChatMessage[], options?: ModelRunOptions): Promise<string> {
    const config = this.provider.config as CloudModelProviderConfig;
    const normalizedOptions = normalizeRunOptions(options);
    const baseUrl = config.baseUrl?.trim();
    const model = config.defaultModel?.trim();
    if (!baseUrl) {
      throw new Error('当前云端模型缺少 API 地址，请在设置中补充。');
    }
    if (!model) {
      throw new Error('当前云端模型缺少默认模型名，请在设置中补充。');
    }
    if (!this.apiKey) {
      throw new Error('当前云端模型未保存 API Key，请在设置中重新添加密钥。');
    }

    const anthropicInput = splitAnthropicMessages(messages);
    return this.postJsonForText(`${baseUrl.replace(/\/+$/, '')}/v1/messages`, {
      'content-type': 'application/json',
      authorization: `Bearer ${this.apiKey}`,
      'anthropic-version': '2023-06-01'
    }, {
      model,
      system: anthropicInput.system,
      messages: await this.toAnthropicMessages(anthropicInput.messages),
      max_tokens: normalizedOptions.maxTokens,
      temperature: normalizedOptions.temperature,
      stream: false
    });
  }

  private async completeWithAnthropicMessagesStream(messages: ChatMessage[], options: ModelRunOptions | undefined, signal: AbortSignal | undefined, onChunk: (delta: string, content: string) => void): Promise<string> {
    const config = this.provider.config as CloudModelProviderConfig;
    const normalizedOptions = normalizeRunOptions(options);
    const baseUrl = config.baseUrl?.trim();
    const model = config.defaultModel?.trim();
    if (!baseUrl) {
      throw new Error('当前云端模型缺少 API 地址，请在设置中补充。');
    }
    if (!model) {
      throw new Error('当前云端模型缺少默认模型名，请在设置中补充。');
    }
    if (!this.apiKey) {
      throw new Error('当前云端模型未保存 API Key，请在设置中重新添加密钥。');
    }

    const anthropicInput = splitAnthropicMessages(messages);
    return this.postJsonForStream(`${baseUrl.replace(/\/+$/, '')}/v1/messages`, {
      'content-type': 'application/json',
      authorization: `Bearer ${this.apiKey}`,
      'anthropic-version': '2023-06-01'
    }, {
      model,
      system: anthropicInput.system,
      messages: await this.toAnthropicMessages(anthropicInput.messages),
      max_tokens: normalizedOptions.maxTokens,
      temperature: normalizedOptions.temperature,
      stream: true
    }, signal, onChunk);
  }

  private async attachmentDataUrl(topicId: Id, attachment: MessageAttachment): Promise<string> {
    if (!this.projectPath) {
      throw new Error('无法读取图片附件：缺少工作区路径。');
    }
    const data = await fs.readFile(await this.resolveAttachmentPath(topicId, attachment));
    return `data:${attachment.mediaType};base64,${data.toString('base64')}`;
  }

  private async attachmentBase64(topicId: Id, attachment: MessageAttachment): Promise<string> {
    if (!this.projectPath) {
      throw new Error('无法读取图片附件：缺少工作区路径。');
    }
    return (await fs.readFile(await this.resolveAttachmentPath(topicId, attachment))).toString('base64');
  }

  private async attachmentText(topicId: Id, attachment: MessageAttachment): Promise<string> {
    if (!this.projectPath) {
      throw new Error('无法读取文本附件：缺少工作区路径。');
    }
    return fs.readFile(await this.resolveAttachmentPath(topicId, attachment), 'utf8');
  }

  private async resolveAttachmentPath(topicId: Id, attachment: MessageAttachment): Promise<string> {
    if (!this.projectPath) {
      throw new Error('无法读取附件：缺少工作区路径。');
    }
    if (path.isAbsolute(attachment.path)) {
      return attachment.path;
    }

    const candidates = [
      path.join(this.projectPath, attachment.path),
      path.join(this.projectPath, 'topics', topicId, attachment.path),
      path.join(this.projectPath, 'phases', attachment.path),
      path.join(this.projectPath, 'topics', attachment.path)
    ];
    for (const candidate of candidates) {
      if (await exists(candidate)) {
        return candidate;
      }
    }

    if (attachment.path.split(/[\\/]+/)[0] === 'attachments') {
      for (const root of ['topics', 'phases']) {
        const rootPath = path.join(this.projectPath, root);
        if (!(await exists(rootPath))) {
          continue;
        }
        const resolved = await this.findAttachmentUnder(rootPath, attachment.path);
        if (resolved) {
          return resolved;
        }
      }
    }

    return candidates[0];
  }

  private async findAttachmentUnder(rootPath: string, relativeAttachmentPath: string): Promise<string | null> {
    const entries = await fs.readdir(rootPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const entryPath = path.join(rootPath, entry.name);
      if (!entry.isDirectory()) {
        continue;
      }
      const directPath = path.join(entryPath, relativeAttachmentPath);
      if (await exists(directPath)) {
        return directPath;
      }
      const nested = await this.findAttachmentUnder(entryPath, relativeAttachmentPath);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  private async toOpenAiMessages(messages: ChatMessage[]): Promise<Array<{ role: ChatRole; content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> }>> {
    const result: Array<{ role: ChatRole; content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> }> = [];
    for (const message of messages) {
      if (typeof message.content === 'string') {
        result.push({ role: message.role, content: message.content });
        continue;
      }
      const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
      for (const part of message.content) {
        if (part.type === 'text') {
          content.push({ type: 'text', text: part.text });
        } else {
          content.push({ type: 'image_url', image_url: { url: await this.attachmentDataUrl(part.topicId, part.attachment) } });
        }
      }
      result.push({ role: message.role, content });
    }
    return result;
  }

  private async toAnthropicMessages(messages: Array<{ role: 'user' | 'assistant'; content: string | ChatContentPart[] }>): Promise<Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> }>> {
    const result: Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> }> = [];
    for (const message of messages) {
      if (typeof message.content === 'string') {
        result.push({ role: message.role, content: message.content });
        continue;
      }
      const content: Array<{ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }> = [];
      for (const part of message.content) {
        if (part.type === 'text') {
          content.push({ type: 'text', text: part.text });
        } else {
          content.push({ type: 'image', source: { type: 'base64', media_type: part.attachment.mediaType, data: await this.attachmentBase64(part.topicId, part.attachment) } });
        }
      }
      result.push({ role: message.role, content });
    }
    return result;
  }

  private async postJsonForText(url: string, headers: Record<string, string>, body: unknown): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`模型调用失败 (${response.status})：${truncate(text) || response.statusText}`);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error(`模型响应不是有效 JSON：${truncate(text)}`);
      }
      return extractResponseContent(parsed);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('模型调用超时，请检查网络或模型供应商配置。');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async postJsonForStream(url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal | undefined, onChunk: (delta: string, content: string) => void): Promise<string> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`模型调用失败 (${response.status})：${truncate(text) || response.statusText}`);
      }
      if (!response.body) {
        const text = await response.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(`模型响应不是有效 JSON：${truncate(text)}`);
        }
        const content = extractResponseContent(parsed);
        onChunk(content, content);
        return content;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let content = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';
        for (const event of events) {
          for (const line of event.split(/\r?\n/)) {
            if (!line.startsWith('data:')) {
              continue;
            }
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') {
              continue;
            }
            let parsed: unknown;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue;
            }
            const delta = extractStreamDelta(parsed);
            if (!delta) {
              continue;
            }
            content += delta;
            onChunk(delta, content);
          }
        }
      }

      const trailing = buffer.trim();
      if (trailing) {
        for (const line of trailing.split(/\r?\n/)) {
          if (!line.startsWith('data:')) {
            continue;
          }
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') {
            continue;
          }
          try {
            const delta = extractStreamDelta(JSON.parse(data) as unknown);
            if (delta) {
              content += delta;
              onChunk(delta, content);
            }
          } catch {
            // 忽略不完整尾包，供应商通常会用 [DONE] 结束流。
          }
        }
      }

      if (!content.trim()) {
        throw new Error('模型响应中没有可读取的文本内容。');
      }
      return content.trim();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(timedOut ? '模型调用超时，请检查网络或模型供应商配置。' : '模型调用已取消。');
      }
      throw error;
    } finally {
      signal?.removeEventListener('abort', abortFromCaller);
      clearTimeout(timeout);
    }
  }

  private async completeWithLocalTool(prompt: string, signal?: AbortSignal): Promise<string> {
    const config = this.provider.config as LocalToolModelProviderConfig;
    const commandParts = splitArgs(config.command);
    const command = commandParts[0];
    if (!command) {
      throw new Error('当前本地工具缺少命令，请在设置中补充。');
    }

    const args = [...commandParts.slice(1), ...defaultLocalArgs(this.provider, prompt)];
    const env = {
      ...process.env,
      MINDLINE_CONFIG_PATH: config.configPath?.trim() || '',
      MINDLINE_PROJECT_PATH: this.projectPath ?? ''
    };
    const { stdout, stderr } = await execFileAsync(command, args, {
      env,
      cwd: this.projectPath,
      signal,
      timeout: REQUEST_TIMEOUT_MS,
      maxBuffer: 8 * 1024 * 1024
    });
    const content = stdout.trim();
    if (!content) {
      throw new Error(`本地工具没有返回内容。${stderr ? `stderr: ${truncate(stderr)}` : ''}`);
    }
    return content;
  }
}

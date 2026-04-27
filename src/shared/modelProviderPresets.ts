import type {
  CloudModelProviderConfig,
  CloudModelProviderKey,
  CloudModelProtocol,
  LocalToolModelProviderConfig,
  LocalToolProviderKey,
  ModelProviderKey,
  ModelProviderKind
} from './types.js';

export interface LocalToolPreset {
  key: LocalToolProviderKey;
  label: string;
  command: string;
}

export interface CloudModelPreset {
  key: CloudModelProviderKey;
  label: string;
  baseUrl: string;
  model: string;
  protocol: CloudModelProtocol;
  websiteUrl?: string;
  source?: string;
}

export interface ModelProviderDefault {
  name: string;
  kind: ModelProviderKind;
  websiteUrl?: string;
  config: LocalToolModelProviderConfig | CloudModelProviderConfig;
}

export const localToolPresets: LocalToolPreset[] = [
  { key: 'claude-code', label: 'Claude Code', command: 'claude' },
  { key: 'codex', label: 'Codex', command: 'codex' },
  { key: 'openclaw', label: 'OpenClaw', command: 'openclaw' },
  { key: 'custom-local', label: 'Custom Local Tool', command: '' }
];

// 来源参考：https://github.com/farion1231/cc-switch
// 这里只保留 Mindline 当前可直接调用的 OpenAI Chat 与 Anthropic Messages 兼容预设。
export const cloudModelPresets: CloudModelPreset[] = [
  {
    key: 'zhipu-coding',
    label: '智谱 GLM Coding Plan',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    model: 'glm-5',
    protocol: 'anthropic-messages',
    websiteUrl: 'https://open.bigmodel.cn',
    source: 'cc-switch claudeProviderPresets'
  },
  {
    key: 'zhipu',
    label: '智谱开放平台 API',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5',
    protocol: 'openai-chat',
    websiteUrl: 'https://open.bigmodel.cn',
    source: 'cc-switch openclawProviderPresets'
  },
  {
    key: 'z-ai-coding',
    label: 'Z.ai GLM Coding Plan',
    baseUrl: 'https://api.z.ai/api/anthropic',
    model: 'glm-5',
    protocol: 'anthropic-messages',
    websiteUrl: 'https://z.ai',
    source: 'cc-switch claudeProviderPresets'
  },
  {
    key: 'z-ai',
    label: 'Z.ai OpenAI Compatible',
    baseUrl: 'https://api.z.ai/v1',
    model: 'glm-5',
    protocol: 'openai-chat',
    websiteUrl: 'https://z.ai',
    source: 'cc-switch openclawProviderPresets'
  },
  {
    key: 'kimi-coding',
    label: 'Kimi For Coding',
    baseUrl: 'https://api.kimi.com/coding/',
    model: 'kimi-for-coding',
    protocol: 'anthropic-messages',
    websiteUrl: 'https://www.kimi.com/coding/docs/',
    source: 'cc-switch claudeProviderPresets'
  },
  {
    key: 'kimi',
    label: 'Kimi Open Platform',
    baseUrl: 'https://api.moonshot.cn/anthropic',
    model: 'kimi-k2.6',
    protocol: 'anthropic-messages',
    websiteUrl: 'https://platform.moonshot.cn',
    source: 'cc-switch claudeProviderPresets'
  },
  {
    key: 'minimax',
    label: 'MiniMax Coding Plan',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    model: 'MiniMax-M2.7',
    protocol: 'anthropic-messages',
    websiteUrl: 'https://platform.minimaxi.com',
    source: 'cc-switch claudeProviderPresets'
  },
  {
    key: 'minimax-global',
    label: 'MiniMax Global Coding Plan',
    baseUrl: 'https://api.minimax.io/anthropic',
    model: 'MiniMax-M2.7',
    protocol: 'anthropic-messages',
    websiteUrl: 'https://platform.minimax.io',
    source: 'cc-switch claudeProviderPresets'
  },
  {
    key: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    protocol: 'openai-chat',
    websiteUrl: 'https://platform.deepseek.com',
    source: 'cc-switch openclawProviderPresets'
  },
  { key: 'custom-cloud', label: 'Custom Cloud Model', baseUrl: '', model: '', protocol: 'openai-chat' }
];

export function isLocalToolProviderKey(providerKey: ModelProviderKey): providerKey is LocalToolProviderKey {
  return localToolPresets.some((preset) => preset.key === providerKey);
}

export function getCloudModelPreset(providerKey: ModelProviderKey): CloudModelPreset | undefined {
  return cloudModelPresets.find((preset) => preset.key === providerKey);
}

export function getModelProviderDefault(providerKey: ModelProviderKey): ModelProviderDefault | undefined {
  const localPreset = localToolPresets.find((preset) => preset.key === providerKey);
  if (localPreset) {
    return { name: localPreset.label, kind: 'local-tool', config: { command: localPreset.command } };
  }

  const cloudPreset = getCloudModelPreset(providerKey);
  if (cloudPreset) {
    return {
      name: cloudPreset.label,
      kind: 'cloud-model',
      websiteUrl: cloudPreset.websiteUrl,
      config: {
        baseUrl: cloudPreset.baseUrl,
        defaultModel: cloudPreset.model,
        protocol: cloudPreset.protocol
      }
    };
  }

  return undefined;
}

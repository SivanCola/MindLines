import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AddModelProviderInput,
  CloudModelProviderConfig,
  Id,
  LocalToolModelProviderConfig,
  ModelProvider,
  ModelProviderKey,
  ModelProviderKind,
  UpdateModelProviderInput
} from '../shared/types.js';
import { getCloudModelPreset, getModelProviderDefault, isLocalToolProviderKey } from '../shared/modelProviderPresets.js';
import { legacyModelProviderSecretsDir, legacyModelProvidersPath, modelProviderSecretPath, modelProviderSecretsDir, modelProvidersPath, splitSettingsModelProviderSecretsDir, splitSettingsModelProvidersPath } from './paths.js';

interface ModelProviderStore {
  version: 1;
  activeModelProviderId?: Id;
  providers: ModelProvider[];
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

function emptyStore(): ModelProviderStore {
  return { version: 1, providers: [] };
}

function assertProviderKindMatchesKey(kind: ModelProviderKind, providerKey: ModelProviderKey): void {
  if (kind === 'local-tool' && !isLocalToolProviderKey(providerKey)) {
    throw new Error('Local tool providers must use a local tool preset.');
  }
  if (kind === 'cloud-model' && isLocalToolProviderKey(providerKey)) {
    throw new Error('Cloud model providers must use a cloud model preset.');
  }
}

function validateProviderInput(input: AddModelProviderInput | UpdateModelProviderInput, existing?: ModelProvider): void {
  const name = 'name' in input && input.name !== undefined ? input.name : existing?.name;
  if (!name?.trim()) {
    throw new Error('Model provider name is required.');
  }

  const kind = 'kind' in input && input.kind ? input.kind : existing?.kind;
  const providerKey = 'providerKey' in input && input.providerKey ? input.providerKey : existing?.providerKey;
  if (kind && providerKey) {
    assertProviderKindMatchesKey(kind, providerKey);
  }

  const config = input.config ?? existing?.config;
  if (kind === 'local-tool') {
    const localConfig = config as LocalToolModelProviderConfig | undefined;
    if (!localConfig?.command?.trim()) {
      throw new Error('Local tool command is required.');
    }
  }

  if (kind === 'cloud-model') {
    const cloudConfig = config as CloudModelProviderConfig | undefined;
    if (cloudConfig?.baseUrl && !/^https?:\/\//i.test(cloudConfig.baseUrl)) {
      throw new Error('Cloud model base URL must start with http:// or https://.');
    }
  }
}

function sanitizeProvider(provider: ModelProvider, hasApiKey: boolean): ModelProvider {
  return { ...provider, hasApiKey };
}

export function getModelProviderDefaults(providerKey: ModelProviderKey) {
  return getModelProviderDefault(providerKey);
}

export class ModelProviderService {
  async ensureStore(appHomePath: string): Promise<void> {
    await this.migrateLegacySettingsIfNeeded(appHomePath);
    const filePath = modelProvidersPath(appHomePath);
    if (!(await exists(filePath))) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, `${JSON.stringify(emptyStore(), null, 2)}\n`, 'utf8');
    }
    await fs.mkdir(modelProviderSecretsDir(appHomePath), { recursive: true });
  }

  async list(workspacePath: string): Promise<{ providers: ModelProvider[]; activeModelProviderId?: Id }> {
    await this.ensureStore(workspacePath);
    const store = await this.readStore(workspacePath);
    const providers = await Promise.all(
      store.providers.map(async (provider) => sanitizeProvider(provider, await exists(modelProviderSecretPath(workspacePath, provider.id))))
    );
    return { providers, activeModelProviderId: store.activeModelProviderId };
  }

  async add(workspacePath: string, input: AddModelProviderInput): Promise<void> {
    validateProviderInput(input);
    const store = await this.readStore(workspacePath);
    const timestamp = now();
    const defaults = getModelProviderDefault(input.providerKey);
    const provider: ModelProvider = {
      id: randomUUID(),
      name: input.name.trim(),
      kind: input.kind,
      providerKey: input.providerKey,
      enabled: true,
      websiteUrl: input.websiteUrl?.trim() || defaults?.websiteUrl,
      notes: input.notes?.trim() || undefined,
      config: input.config,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    store.providers.push(provider);
    if (input.setActive || !store.activeModelProviderId) {
      store.activeModelProviderId = provider.id;
    }
    await this.writeStore(workspacePath, store);
    await this.writeSecretIfPresent(workspacePath, provider.id, input.apiKey);
  }

  async update(workspacePath: string, providerId: Id, input: UpdateModelProviderInput): Promise<void> {
    const store = await this.readStore(workspacePath);
    const provider = store.providers.find((entry) => entry.id === providerId);
    if (!provider) {
      throw new Error('Model provider not found.');
    }
    validateProviderInput(input, provider);

    provider.name = input.name?.trim() ?? provider.name;
    provider.websiteUrl = input.websiteUrl === undefined ? provider.websiteUrl : input.websiteUrl.trim() || undefined;
    provider.notes = input.notes === undefined ? provider.notes : input.notes.trim() || undefined;
    provider.enabled = input.enabled ?? provider.enabled;
    provider.config = input.config ?? provider.config;
    provider.updatedAt = now();

    if (input.setActive) {
      store.activeModelProviderId = provider.id;
    }
    if (store.activeModelProviderId === provider.id && provider.enabled === false) {
      store.activeModelProviderId = undefined;
    }

    await this.writeStore(workspacePath, store);

    if (input.clearApiKey) {
      await fs.rm(modelProviderSecretPath(workspacePath, provider.id), { force: true });
    } else {
      await this.writeSecretIfPresent(workspacePath, provider.id, input.apiKey);
    }
  }

  async delete(workspacePath: string, providerId: Id): Promise<void> {
    const store = await this.readStore(workspacePath);
    const nextProviders = store.providers.filter((provider) => provider.id !== providerId);
    if (nextProviders.length === store.providers.length) {
      throw new Error('Model provider not found.');
    }
    store.providers = nextProviders;
    if (store.activeModelProviderId === providerId) {
      store.activeModelProviderId = nextProviders[0]?.id;
    }
    await this.writeStore(workspacePath, store);
    await fs.rm(modelProviderSecretPath(workspacePath, providerId), { force: true });
  }

  async setActive(workspacePath: string, providerId: Id | null): Promise<void> {
    const store = await this.readStore(workspacePath);
    if (providerId && !store.providers.some((provider) => provider.id === providerId && provider.enabled)) {
      throw new Error('Active model provider must exist and be enabled.');
    }
    store.activeModelProviderId = providerId ?? undefined;
    await this.writeStore(workspacePath, store);
  }

  async getActiveProviderWithSecret(workspacePath: string): Promise<{ provider: ModelProvider; apiKey?: string } | null> {
    const store = await this.readStore(workspacePath);
    const provider = store.providers.find((entry) => entry.id === store.activeModelProviderId && entry.enabled);
    if (!provider) {
      return null;
    }
    return {
      provider,
      apiKey: await this.readSecret(workspacePath, provider.id)
    };
  }

  async getProviderWithSecret(workspacePath: string, providerId: Id): Promise<{ provider: ModelProvider; apiKey?: string } | null> {
    const store = await this.readStore(workspacePath);
    const provider = store.providers.find((entry) => entry.id === providerId && entry.enabled);
    if (!provider) {
      return null;
    }
    return {
      provider,
      apiKey: await this.readSecret(workspacePath, provider.id)
    };
  }

  private async readStore(workspacePath: string): Promise<ModelProviderStore> {
    await this.ensureStore(workspacePath);
    const parsed = JSON.parse(await fs.readFile(modelProvidersPath(workspacePath), 'utf8')) as ModelProviderStore;
    const store: ModelProviderStore = {
      version: 1,
      providers: Array.isArray(parsed.providers) ? parsed.providers : [],
      activeModelProviderId: parsed.activeModelProviderId
    };
    if (this.migrateStore(store)) {
      await this.writeStore(workspacePath, store);
    }
    return store;
  }

  private migrateStore(store: ModelProviderStore): boolean {
    let changed = false;
    for (const provider of store.providers) {
      if (provider.kind !== 'cloud-model') {
        continue;
      }
      const config = provider.config as CloudModelProviderConfig;
      if (!config.protocol) {
        config.protocol = getCloudModelPreset(provider.providerKey)?.protocol ?? 'openai-chat';
        changed = true;
      }

      const baseUrl = config.baseUrl ?? '';
      const createdFromOldZhipuPreset = provider.providerKey === 'zhipu' && /open\.bigmodel\.cn\/api\/paas\/v4\/?$/i.test(baseUrl);
      if (createdFromOldZhipuPreset && /智谱\s*GLM/i.test(provider.name)) {
        provider.providerKey = 'zhipu-coding';
        provider.name = '智谱 GLM Coding Plan';
        provider.websiteUrl = 'https://open.bigmodel.cn';
        provider.config = {
          baseUrl: 'https://open.bigmodel.cn/api/anthropic',
          defaultModel: 'glm-5',
          protocol: 'anthropic-messages'
        };
        provider.updatedAt = now();
        changed = true;
      }
    }
    return changed;
  }

  private async writeStore(workspacePath: string, store: ModelProviderStore): Promise<void> {
    await fs.mkdir(path.dirname(modelProvidersPath(workspacePath)), { recursive: true });
    await fs.writeFile(modelProvidersPath(workspacePath), `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }

  private async writeSecretIfPresent(workspacePath: string, providerId: Id, apiKey?: string): Promise<void> {
    if (apiKey === undefined) {
      return;
    }
    const trimmed = apiKey.trim();
    if (!trimmed) {
      return;
    }
    await fs.mkdir(modelProviderSecretsDir(workspacePath), { recursive: true });
    await fs.writeFile(modelProviderSecretPath(workspacePath, providerId), `${JSON.stringify({ apiKey: trimmed }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  }

  private async readSecret(workspacePath: string, providerId: Id): Promise<string | undefined> {
    const filePath = modelProviderSecretPath(workspacePath, providerId);
    if (!(await exists(filePath))) {
      return undefined;
    }
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as { apiKey?: unknown };
    return typeof parsed.apiKey === 'string' && parsed.apiKey.trim() ? parsed.apiKey.trim() : undefined;
  }

  private async migrateLegacySettingsIfNeeded(appHomePath: string): Promise<void> {
    const nextStorePath = modelProvidersPath(appHomePath);
    if (!(await exists(nextStorePath))) {
      const sourceStorePath = (await exists(splitSettingsModelProvidersPath(appHomePath))) ? splitSettingsModelProvidersPath(appHomePath) : legacyModelProvidersPath(appHomePath);
      if (await exists(sourceStorePath)) {
        await fs.mkdir(path.dirname(nextStorePath), { recursive: true });
        await fs.copyFile(sourceStorePath, nextStorePath);
      }
    }

    const nextSecretsDir = modelProviderSecretsDir(appHomePath);
    await fs.mkdir(nextSecretsDir, { recursive: true });
    for (const sourceSecretsDir of [splitSettingsModelProviderSecretsDir(appHomePath), legacyModelProviderSecretsDir(appHomePath)]) {
      if (!(await exists(sourceSecretsDir))) {
        continue;
      }
      for (const entry of await fs.readdir(sourceSecretsDir, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith('.json')) {
          continue;
        }
        const targetPath = path.join(nextSecretsDir, entry.name);
        if (!(await exists(targetPath))) {
          await fs.copyFile(path.join(sourceSecretsDir, entry.name), targetPath);
          await fs.chmod(targetPath, 0o600).catch(() => undefined);
        }
      }
    }
  }
}

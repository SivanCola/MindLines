import { Bot, Check, ChevronUp, Clipboard, FolderOpen, Globe2, HardDrive, Keyboard, KeyRound, Palette, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { cloudModelPresets, localToolPresets } from '../../shared/modelProviderPresets';
import type { AddModelProviderInput, CloudModelProtocol, Id, ModelProvider, ModelProviderKey, ModelProviderKind, WorkspaceSnapshot } from '../../shared/types';
import { Copy, KeyboardSettings, Language, ThemeId, themeOptions } from '../appModel';

export function SettingsPanel({
  snapshot,
  language,
  theme,
  keyboardSettings,
  t,
  onLanguageChange,
  onThemeChange,
  onKeyboardSettingsChange,
  onAddModelProvider,
  onDeleteModelProvider,
  onSetActiveModelProvider
}: {
  snapshot: WorkspaceSnapshot | null;
  language: Language;
  theme: ThemeId;
  keyboardSettings: KeyboardSettings;
  t: Copy;
  onLanguageChange: (language: Language) => void;
  onThemeChange: (theme: ThemeId) => void;
  onKeyboardSettingsChange: (settings: KeyboardSettings | ((current: KeyboardSettings) => KeyboardSettings)) => void;
  onAddModelProvider: (input: AddModelProviderInput) => void;
  onDeleteModelProvider: (providerId: Id) => void;
  onSetActiveModelProvider: (providerId: Id | null) => void;
}) {
  const activeProvider = snapshot?.modelProviders.find((provider) => provider.id === snapshot.activeModelProviderId);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const isZh = language === 'zh';
  const labels = {
    general: isZh ? '通用' : 'General',
    shortcuts: isZh ? '快捷键' : 'Shortcuts',
    workspace: isZh ? '工作区' : 'Workspace',
    models: isZh ? '模型' : 'Models',
    security: isZh ? '密钥' : 'Secrets',
    appearance: isZh ? '外观' : 'Appearance',
    copy: isZh ? '复制' : 'Copy',
    copied: isZh ? '已复制' : 'Copied',
    configured: isZh ? '已配置' : 'Configured',
    notConfigured: isZh ? '未配置' : 'Not configured',
    available: isZh ? '可用' : 'Available',
    unavailable: isZh ? '不可用' : 'Unavailable',
    globalSetting: isZh ? '全局设置' : 'Global setting',
    workspaceSetting: isZh ? '当前工作区' : 'Current workspace',
    providerCount: isZh ? `${snapshot?.modelProviders.length ?? 0} 个供应商` : `${snapshot?.modelProviders.length ?? 0} providers`,
    languageHelp: isZh ? '影响应用界面文本，不改变工作区数据。' : 'Changes application UI text without changing workspace data.',
    shortcutsHelp: isZh ? '配置高频键盘操作。输入行为只保存在本机，不影响工作区数据。' : 'Configure frequent keyboard actions. Input behavior is stored locally and does not affect workspace data.',
    chatInputBehavior: isZh ? '聊天输入' : 'Chat input',
    enterToSend: isZh ? '按 Enter 发送消息' : 'Press Enter to send',
    enterToSendHelp: isZh ? '开启后 Enter 发送，Shift + Enter 换行；关闭后 Enter 只换行。' : 'When enabled, Enter sends and Shift + Enter inserts a new line. When disabled, Enter only inserts a new line.',
    enabled: isZh ? '已开启' : 'Enabled',
    disabled: isZh ? '已关闭' : 'Disabled',
    globalShortcuts: isZh ? '全局快捷键' : 'Global shortcuts',
    globalShortcutsHelp: isZh ? '这些快捷键在主要工作区视图中可用。' : 'These shortcuts work in the main workspace views.',
    searchShortcut: isZh ? '搜索对话' : 'Search conversations',
    newTopicShortcut: isZh ? '新建话题' : 'New topic',
    sendShortcut: isZh ? '发送当前输入' : 'Send current prompt',
    newlineShortcut: isZh ? '输入换行' : 'Insert line break',
    cancelShortcut: isZh ? '停止生成 / 关闭面板' : 'Stop generation / close panel',
    switchTopicShortcut: isZh ? '切换话题' : 'Switch topic',
    workspaceHelp: isZh ? '项目知识数据跟随项目目录；本机模型设置和密钥保存在用户目录。' : 'Project knowledge data follows the project folder; local model settings and secrets live in your user directory.',
    modelHelp: isZh ? '选择默认模型适配器，并管理本地工具或云端 API 接入。' : 'Choose the default model adapter and manage local tools or cloud APIs.',
    securityHelp: isZh ? '密钥单独保存，真实调用时读取，不写入项目 Git。' : 'Secrets are stored separately, read at runtime, and never written to project Git.',
    appearanceHelp: isZh ? '主题会应用到侧边栏、对话、设置和上下文篮。' : 'Theme applies to the sidebar, conversations, settings, and context basket.',
    settingsPath: isZh ? '模型设置路径' : 'Model settings path',
    settingsPathHelp: isZh ? '本机模型供应商配置' : 'Local model provider config',
    secretPath: isZh ? '密钥目录' : 'Secrets directory',
    activeStatus: isZh ? '启用状态' : 'Active status',
    modelProviders: isZh ? '模型供应商' : 'Model providers'
  };
  const settingsPath = snapshot?.settingsPath;
  const secretPath = snapshot?.secretsPath;

  async function copyValue(key: string, value?: string) {
    if (!value) {
      return;
    }
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1200);
  }

  return (
    <article className="detail-view settings-view">
      <div className="settings-layout">
        <div className="settings-content">
          <SettingsSection id="settings-general" icon={<Globe2 size={17} />} title={labels.general} description={labels.languageHelp}>
            <SettingsRow title={t.language} description={labels.globalSetting}>
              <div className="language-toggle settings-segmented" role="group" aria-label={t.language}>
                <button type="button" className={language === 'zh' ? 'active' : ''} onClick={() => onLanguageChange('zh')}>
                  {t.chinese}
                </button>
                <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => onLanguageChange('en')}>
                  {t.english}
                </button>
              </div>
            </SettingsRow>
          </SettingsSection>

          <SettingsSection id="settings-shortcuts" icon={<Keyboard size={17} />} title={labels.shortcuts} description={labels.shortcutsHelp}>
            <SettingsRow title={labels.chatInputBehavior} description={labels.enterToSendHelp}>
              <ToggleSwitch
                checked={keyboardSettings.enterToSend}
                label={keyboardSettings.enterToSend ? labels.enabled : labels.disabled}
                onChange={(checked) => onKeyboardSettingsChange((current) => ({ ...current, enterToSend: checked }))}
              />
            </SettingsRow>
            <SettingsRow title={labels.globalShortcuts} description={labels.globalShortcutsHelp}>
              <div className="shortcut-list" aria-label={labels.globalShortcuts}>
                <ShortcutHint label={labels.searchShortcut} keys={['⌘/Ctrl', 'K']} />
                <ShortcutHint label={labels.newTopicShortcut} keys={['⌘/Ctrl', 'N']} />
                <ShortcutHint label={labels.sendShortcut} keys={keyboardSettings.enterToSend ? ['Enter'] : ['⌘/Ctrl', 'Enter']} />
                <ShortcutHint label={labels.newlineShortcut} keys={keyboardSettings.enterToSend ? ['Shift', 'Enter'] : ['Enter']} />
                <ShortcutHint label={labels.cancelShortcut} keys={['Esc']} />
                <ShortcutHint label={labels.switchTopicShortcut} keys={['⌘/Ctrl', 'Shift', '[ / ]']} />
              </div>
            </SettingsRow>
          </SettingsSection>

          <SettingsSection id="settings-workspace" icon={<HardDrive size={17} />} title={labels.workspace} description={labels.workspaceHelp}>
            <SettingsRow
              title={t.workspacePath}
              description={labels.workspaceSetting}
              value={snapshot?.workspacePath ?? t.noWorkspaceOpen}
              action={snapshot?.workspacePath ? <CopyButton label={labels.copy} copiedLabel={labels.copied} copied={copiedKey === 'workspace'} onClick={() => copyValue('workspace', snapshot.workspacePath)} /> : null}
            />
            <SettingsRow
              title={t.dataPath}
              description={labels.workspaceSetting}
              value={snapshot?.dataPath ?? snapshot?.workspacePath ?? t.noWorkspaceOpen}
              action={snapshot ? <CopyButton label={labels.copy} copiedLabel={labels.copied} copied={copiedKey === 'data'} onClick={() => copyValue('data', snapshot.dataPath ?? snapshot.workspacePath)} /> : null}
            />
            <SettingsRow
              title={labels.settingsPath}
              description={labels.settingsPathHelp}
              value={settingsPath ?? t.noWorkspaceOpen}
              action={settingsPath ? <CopyButton label={labels.copy} copiedLabel={labels.copied} copied={copiedKey === 'settings'} onClick={() => copyValue('settings', settingsPath)} /> : null}
            />
            <SettingsRow title={t.storage} description={labels.workspaceSetting} value={t.storageValue} />
          </SettingsSection>

          <SettingsSection id="settings-models" icon={<Bot size={17} />} title={labels.models} description={labels.modelHelp}>
            {!snapshot ? (
              <section className="empty-inline">
                <FolderOpen size={22} />
                <p>{t.workspaceSetupHelp}</p>
              </section>
            ) : (
              <ModelProviderPanel
                providers={snapshot.modelProviders}
                activeProviderId={snapshot.activeModelProviderId}
                t={t}
                onAdd={onAddModelProvider}
                onDelete={onDeleteModelProvider}
                onSetActive={onSetActiveModelProvider}
              />
            )}
          </SettingsSection>

          <SettingsSection id="settings-security" icon={<KeyRound size={17} />} title={labels.security} description={labels.securityHelp}>
            <SettingsRow title={t.apiKeys} description={activeProvider?.hasApiKey ? labels.configured : labels.notConfigured} value={t.apiKeysValue} />
            <SettingsRow
              title={labels.secretPath}
              description={labels.workspaceSetting}
              value={secretPath ?? t.noWorkspaceOpen}
              action={secretPath ? <CopyButton label={labels.copy} copiedLabel={labels.copied} copied={copiedKey === 'secrets'} onClick={() => copyValue('secrets', secretPath)} /> : null}
            />
          </SettingsSection>

          <SettingsSection id="settings-appearance" icon={<Palette size={17} />} title={labels.appearance} description={labels.appearanceHelp}>
            <div className="theme-grid" role="radiogroup" aria-label={t.theme}>
              {themeOptions.map((option) => (
                <button key={option.id} type="button" className={`theme-option ${theme === option.id ? 'active' : ''}`} role="radio" aria-checked={theme === option.id} onClick={() => onThemeChange(option.id)}>
                  <span className="theme-swatches" aria-hidden="true">
                    {option.swatches.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span className="theme-copy">
                    <strong>{option.label[language]}</strong>
                    <small>{option.description[language]}</small>
                  </span>
                </button>
              ))}
            </div>
          </SettingsSection>
        </div>
      </div>

    </article>
  );
}

function SettingsSection({ id, icon, title, description, children }: { id: string; icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="settings-section">
      <header className="settings-section-header">
        <span aria-hidden="true">{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </header>
      <div className="settings-list">{children}</div>
    </section>
  );
}

function SettingsRow({ title, description, value, action, children }: { title: string; description?: string; value?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </div>
      <div className="settings-row-control">
        {value ? (
          <span className="settings-value" tabIndex={0} aria-label={value}>
            <code>{value}</code>
            <span className="settings-value-popover" role="tooltip">
              {value}
            </span>
          </span>
        ) : null}
        {children}
        {action}
      </div>
    </div>
  );
}

function CopyButton({ label, copiedLabel, copied, onClick }: { label: string; copiedLabel: string; copied: boolean; onClick: () => void }) {
  return (
    <button className={`settings-inline-action ${copied ? 'copied' : ''}`} type="button" onClick={onClick} aria-label={copied ? copiedLabel : label} data-tooltip={copied ? copiedLabel : label}>
      {copied ? <Check size={14} /> : <Clipboard size={14} />}
      {label}
    </button>
  );
}

function ToggleSwitch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <button className={`settings-switch ${checked ? 'active' : ''}`} type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="settings-switch-track" aria-hidden="true">
        <span />
      </span>
      <span>{label}</span>
    </button>
  );
}

function ShortcutHint({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="shortcut-hint">
      <span className="shortcut-hint-label">{label}</span>
      <span className="shortcut-keys">
        {keys.map((key, index) => (
          <span className="shortcut-key-part" key={`${key}-${index}`}>
            {index > 0 ? <span className="shortcut-key-plus">+</span> : null}
            <kbd>{formatShortcutKey(key)}</kbd>
          </span>
        ))}
      </span>
    </div>
  );
}

function formatShortcutKey(key: string): string {
  if (key === '⌘/Ctrl') {
    return '⌘ / Ctrl';
  }
  if (key === 'Enter') {
    return '↵ Enter';
  }
  return key;
}

export function ModelProviderPanel({
  providers,
  activeProviderId,
  t,
  onAdd,
  onDelete,
  onSetActive
}: {
  providers: ModelProvider[];
  activeProviderId?: Id;
  t: Copy;
  onAdd: (input: AddModelProviderInput) => void;
  onDelete: (providerId: Id) => void;
  onSetActive: (providerId: Id | null) => void;
}) {
  const defaultCloudPreset = cloudModelPresets[0];
  const [kind, setKind] = useState<ModelProviderKind>('cloud-model');
  const [providerKey, setProviderKey] = useState<ModelProviderKey>(defaultCloudPreset.key);
  const [name, setName] = useState(defaultCloudPreset.label);
  const [command, setCommand] = useState('');
  const [configPath, setConfigPath] = useState('');
  const [baseUrl, setBaseUrl] = useState(defaultCloudPreset.baseUrl);
  const [defaultModel, setDefaultModel] = useState(defaultCloudPreset.model);
  const [protocol, setProtocol] = useState<CloudModelProtocol>(defaultCloudPreset.protocol);
  const [apiKey, setApiKey] = useState('');
  const [notes, setNotes] = useState('');
  const [addOpen, setAddOpen] = useState(providers.length === 0);
  const activeProvider = providers.find((provider) => provider.id === activeProviderId);
  const isZh = t.chinese === '中文';
  const labels = {
    providerList: isZh ? '供应商' : 'Providers',
    providerSummary: isZh ? '当前启用' : 'Active provider',
    status: isZh ? '状态' : 'Status',
    secret: isZh ? '密钥' : 'Secret',
    providerCount: isZh ? `${providers.length} 个供应商` : `${providers.length} providers`,
    noActive: isZh ? '未启用' : 'None active',
    available: isZh ? '可用' : 'Available',
    unavailable: isZh ? '不可用' : 'Unavailable',
    saved: isZh ? '已保存' : 'Saved',
    missing: isZh ? '未保存' : 'Missing',
    collapseAdd: isZh ? '收起' : 'Collapse',
    addProviderToggle: isZh ? '添加' : 'Add'
  };

  useEffect(() => {
    if (providers.length === 0) {
      setAddOpen(true);
    }
  }, [providers.length]);

  function applyPreset(nextKind: ModelProviderKind, nextKey: ModelProviderKey) {
    setKind(nextKind);
    setProviderKey(nextKey);
    if (nextKind === 'local-tool') {
      const preset = localToolPresets.find((entry) => entry.key === nextKey) ?? localToolPresets[0];
      setName(preset.label);
      setCommand(preset.command);
      setConfigPath('');
      setBaseUrl('');
      setDefaultModel('');
      setProtocol('openai-chat');
      setApiKey('');
      return;
    }

    const preset = cloudModelPresets.find((entry) => entry.key === nextKey) ?? cloudModelPresets[0];
    setName(preset.label);
    setCommand('');
    setConfigPath('');
    setBaseUrl(preset.baseUrl);
    setDefaultModel(preset.model);
    setProtocol(preset.protocol);
    setApiKey('');
  }

  function changeKind(nextKind: ModelProviderKind) {
    applyPreset(nextKind, nextKind === 'local-tool' ? 'claude-code' : 'zhipu-coding');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const input: AddModelProviderInput = {
      kind,
      providerKey,
      name,
      notes,
      config:
        kind === 'local-tool'
          ? { command, configPath: configPath || undefined }
          : { baseUrl: baseUrl || undefined, defaultModel: defaultModel || undefined, protocol },
      apiKey: kind === 'cloud-model' ? apiKey : undefined,
      setActive: providers.length === 0
    };
    onAdd(input);
    setApiKey('');
    if (providers.length > 0) {
      setAddOpen(false);
    }
  }

  const presets = kind === 'local-tool' ? localToolPresets : cloudModelPresets;
  const activeConfigLabel =
    activeProvider?.kind === 'local-tool'
      ? (activeProvider.config as { command?: string }).command
      : (activeProvider?.config as { defaultModel?: string; baseUrl?: string } | undefined)?.defaultModel || (activeProvider?.config as { baseUrl?: string } | undefined)?.baseUrl;

  return (
    <section className="model-provider-panel">
      <div className="provider-status-grid">
        <div className="provider-status-card primary">
          <span>{labels.providerSummary}</span>
          <strong>{activeProvider ? activeProvider.name : labels.noActive}</strong>
          {activeConfigLabel ? <small>{activeProvider?.kind === 'local-tool' ? t.localTool : t.cloudModel} · {activeConfigLabel}</small> : null}
        </div>
        <div className="provider-status-card">
          <span>{labels.status}</span>
          <strong>{activeProvider ? labels.available : labels.unavailable}</strong>
          <small>{labels.providerCount}</small>
        </div>
        <div className="provider-status-card">
          <span>{labels.secret}</span>
          <strong>{activeProvider?.hasApiKey ? labels.saved : labels.missing}</strong>
          <small>{activeProvider?.kind === 'cloud-model' ? t.cloudModel : t.localTool}</small>
        </div>
      </div>

      <div className="provider-management-header">
        <div>
          <h4>{labels.providerList}</h4>
          <p>{labels.providerCount}</p>
        </div>
        <button className="settings-inline-action settings-inline-action-auto provider-add-toggle" type="button" onClick={() => setAddOpen((current) => !current)} aria-expanded={addOpen}>
          {addOpen ? <ChevronUp size={15} /> : <Plus size={15} />}
          {addOpen ? labels.collapseAdd : labels.addProviderToggle}
        </button>
      </div>

      <div className="provider-list">
        {providers.length === 0 ? (
          <div className="empty-inline">
            <Bot size={22} />
            <p>{t.noModelProviders}</p>
          </div>
        ) : (
          providers.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              active={activeProviderId === provider.id}
              t={t}
              onDelete={() => onDelete(provider.id)}
              onSetActive={() => onSetActive(provider.id)}
            />
          ))
        )}
      </div>

      {addOpen ? (
        <div className="provider-add-panel">
          <header className="panel-header">
            <div>
              <p className="eyebrow">{t.modelAccess}</p>
              <h3>{t.addProvider}</h3>
            </div>
            <p className="provider-security-note">
              <KeyRound size={15} />
              <span>{t.modelAccessHelp}</span>
            </p>
          </header>

          <form className="provider-form" onSubmit={submit}>
            <label>
              <span>{t.providerKind}</span>
              <div className="settings-segmented provider-kind-toggle" role="group" aria-label={t.providerKind}>
                <button type="button" className={kind === 'cloud-model' ? 'active' : ''} onClick={() => changeKind('cloud-model')}>
                  {t.cloudModel}
                </button>
                <button type="button" className={kind === 'local-tool' ? 'active' : ''} onClick={() => changeKind('local-tool')}>
                  {t.localTool}
                </button>
              </div>
            </label>
            <label>
              <span>{t.providerPreset}</span>
              <select value={providerKey} onChange={(event) => applyPreset(kind, event.target.value as ModelProviderKey)}>
                {presets.map((preset) => (
                  <option key={preset.key} value={preset.key}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t.providerName}</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.providerNamePlaceholder} />
            </label>
            {kind === 'local-tool' ? (
              <>
                <label>
                  <span>{t.command}</span>
                  <input value={command} onChange={(event) => setCommand(event.target.value)} placeholder={t.commandPlaceholder} />
                </label>
                <label className="provider-form-wide">
                  <span>{t.configPath}</span>
                  <input value={configPath} onChange={(event) => setConfigPath(event.target.value)} placeholder={t.configPathPlaceholder} />
                </label>
              </>
            ) : (
              <>
                <label>
                  <span>{t.apiBaseUrl}</span>
                  <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder={t.apiBaseUrlPlaceholder} />
                </label>
                <label>
                  <span>{t.defaultModel}</span>
                  <input value={defaultModel} onChange={(event) => setDefaultModel(event.target.value)} placeholder={t.defaultModelPlaceholder} />
                </label>
                <label>
                  <span>{t.apiProtocol}</span>
                  <div className="settings-segmented provider-protocol-toggle" role="group" aria-label={t.apiProtocol}>
                    <button type="button" className={protocol === 'anthropic-messages' ? 'active' : ''} onClick={() => setProtocol('anthropic-messages')}>
                      {t.anthropicMessagesProtocol}
                    </button>
                    <button type="button" className={protocol === 'openai-chat' ? 'active' : ''} onClick={() => setProtocol('openai-chat')}>
                      {t.openAiChatProtocol}
                    </button>
                  </div>
                </label>
                <label className="provider-form-wide">
                  <span>{t.apiKey}</span>
                  <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" placeholder={t.apiKeyPlaceholder} />
                </label>
              </>
            )}
            <label className="provider-form-wide">
              <span>{t.notes}</span>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t.providerNotesPlaceholder} />
            </label>
            <button className="provider-submit">
              <Plus size={16} />
              {t.addProvider}
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export function ProviderRow({ provider, active, t, onDelete, onSetActive }: { provider: ModelProvider; active: boolean; t: Copy; onDelete: () => void; onSetActive: () => void }) {
  const configLabel =
    provider.kind === 'local-tool'
      ? (provider.config as { command?: string }).command
      : (provider.config as { baseUrl?: string; defaultModel?: string }).defaultModel || (provider.config as { baseUrl?: string }).baseUrl;
  const meta = `${provider.kind === 'local-tool' ? t.localTool : t.cloudModel} · ${configLabel || provider.providerKey} · ${provider.hasApiKey ? t.hasSecret : t.noSecret}`;
  const fullInfo = provider.notes ? `${provider.name}\n${meta}\n${provider.notes}` : `${provider.name}\n${meta}`;

  return (
    <div className="provider-row" title={fullInfo}>
      <div className="provider-row-main">
        <div className="provider-row-title">
          <strong>{provider.name}</strong>
        </div>
        <p>{meta}</p>
      </div>
      <div className="provider-row-actions">
        {active ? (
          <span className="provider-row-status">{t.activeProvider}</span>
        ) : (
          <button className="settings-inline-action settings-inline-action-primary set-active-button" type="button" onClick={onSetActive} disabled={!provider.enabled}>
            <Check size={15} />
            {t.setActive}
          </button>
        )}
        <button className="settings-inline-action settings-inline-action-danger" type="button" onClick={onDelete}>
          <Trash2 size={15} />
          {t.deleteProvider}
        </button>
      </div>
    </div>
  );
}

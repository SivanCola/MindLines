import { Bot, FileText, GitBranch, Globe2, HardDrive, History, Home, Keyboard, KeyRound, Palette, Plus, Settings, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { DEFAULT_PHASE_ID, type AddModelProviderInput, type Id, type ModelRunOptions, type SelectionCartItem, type WorkspaceSnapshot } from '../shared/types';
import { BackupView } from './components/BackupView';
import { CartPanel } from './components/CartPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalTooltip } from './components/GlobalTooltip';
import { NoWorkspace, NoWorkspaceSidebar } from './components/NoWorkspace';
import { PhaseOverview } from './components/PhaseOverview';
import { PhaseView, TrashView } from './components/PhaseView';
import { TopBar, type TopBarBreadcrumbItem } from './components/SearchPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SidebarNavigation } from './components/Sidebar';
import { TopicView } from './components/TopicView';
import { WorkspaceHome } from './components/WorkspaceHome';
import { WorkspaceControls } from './components/WorkspaceControls';
import { buildDefaultPhase, buildDiscussionProcessingSummary, buildPhaseSummaryProcessingSummary, buildProcessingSummary, buildTopicSummaryProcessingSummary, copy, defaultPhaseTitle, getApi, isVisiblePhase, isVisibleTopic, newRequestId, userFacingError, type Copy, type DiscussionGenerationState, type GenerationState, type Language, type SummaryGenerationState } from './appModel';
import { useSettings } from './hooks/useSettings';
import { useWorkspace } from './hooks/useWorkspace';
import mindlineIconUrl from './assets/mindline-icon.svg';

export function App() {
  const { language, setLanguage, theme, setTheme, composerSettings, setComposerSettings, keyboardSettings, setKeyboardSettings } = useSettings();
  const { snapshot, view, setView, setInitialView, applySnapshot } = useWorkspace();
  const [cartItems, setCartItems] = useState<SelectionCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [discussion, setDiscussion] = useState<string>('');
  const [generation, setGeneration] = useState<GenerationState | null>(null);
  const [summaryGeneration, setSummaryGeneration] = useState<SummaryGenerationState | null>(null);
  const [discussionGeneration, setDiscussionGeneration] = useState<DiscussionGenerationState | null>(null);
  const [clearTrashConfirmOpen, setClearTrashConfirmOpen] = useState(false);
  const [phaseDraftRequestId, setPhaseDraftRequestId] = useState(0);
  const [topicDraftRequest, setTopicDraftRequest] = useState<{ id: number; phaseId: Id | null }>({ id: 0, phaseId: null });
  const t = copy[language];

  useEffect(() => {
    if (cartItems.length > 0 || discussion || discussionGeneration) {
      setCartOpen(true);
    }
  }, [cartItems.length, discussion, discussionGeneration]);

  useEffect(() => {
    if (!snapshot || snapshot.modelProviders.length === 0) {
      return;
    }
    const selectedExists = snapshot.modelProviders.some((provider) => provider.id === composerSettings.providerId && provider.enabled);
    if (!selectedExists) {
      const nextProviderId =
        snapshot.modelProviders.find((provider) => provider.id === snapshot.activeModelProviderId && provider.enabled)?.id ??
        snapshot.modelProviders.find((provider) => provider.enabled)?.id ??
        '';
      setComposerSettings((current) => (current.providerId === nextProviderId ? current : { ...current, providerId: nextProviderId }));
    }
  }, [composerSettings.providerId, snapshot?.activeModelProviderId, snapshot?.modelProviders]);

  useEffect(() => {
    void run(t.loadingWorkspace, async () => {
      const current = await getApi().getSnapshot();
      if (current) {
        applySnapshot(current);
        setInitialView(current);
      }
    });
  }, []);

  useEffect(() => {
    if (!generation) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setGeneration((current) => {
        if (!current || current.startedAt !== generation.startedAt) {
          return current;
        }
        return { ...current, stageIndex: Math.min(current.stageIndex + 1, 2) };
      });
    }, 1300);

    return () => window.clearInterval(timer);
  }, [generation?.startedAt]);

  useEffect(() => {
    if (!summaryGeneration) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSummaryGeneration((current) => {
        if (!current || current.startedAt !== summaryGeneration.startedAt) {
          return current;
        }
        return { ...current, stageIndex: Math.min(current.stageIndex + 1, 1) };
      });
    }, 1200);

    return () => window.clearInterval(timer);
  }, [summaryGeneration?.startedAt]);

  useEffect(() => {
    if (!discussionGeneration) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setDiscussionGeneration((current) => {
        if (!current || current.startedAt !== discussionGeneration.startedAt) {
          return current;
        }
        return { ...current, stageIndex: Math.min(current.stageIndex + 1, 1) };
      });
    }, 1200);

    return () => window.clearInterval(timer);
  }, [discussionGeneration?.startedAt]);

  useEffect(() => {
    if (typeof window.groupAI === 'undefined') {
      return undefined;
    }
    return getApi().onMessageStream((event) => {
      if (event.type === 'chunk') {
        setGeneration((current) => {
          if (!current || current.requestId !== event.requestId) {
            return current;
          }
          return { ...current, streamedContent: event.content, stageIndex: Math.max(current.stageIndex, 2) };
        });
        return;
      }
      if (event.type === 'done') {
        setGeneration((current) => {
          if (!current || current.requestId !== event.requestId) {
            return current;
          }
          return { ...current, streamedContent: event.message.content, stageIndex: 3 };
        });
        applySnapshot(event.snapshot);
        window.setTimeout(() => {
          setGeneration((current) => (current?.requestId === event.requestId ? null : current));
        }, 280);
        return;
      }
      if (event.type === 'aborted') {
        setGeneration((current) => (current?.requestId === event.requestId ? null : current));
        return;
      }
      if (event.type === 'error') {
        setGeneration((current) => (current?.requestId === event.requestId ? null : current));
        setError(event.error);
      }
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const commandKey = event.metaKey || event.ctrlKey;
      if (event.key === 'Escape') {
        if (generation) {
          event.preventDefault();
          void handleCancelGeneration(generation.requestId);
          return;
        }
        if (cartOpen) {
          event.preventDefault();
          setCartOpen(false);
        }
        return;
      }
      if (!commandKey) {
        return;
      }
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('mindline:focus-search'));
        return;
      }
      if (event.key.toLowerCase() === 'n' && snapshot) {
        event.preventDefault();
        const phaseId = view.type === 'phase' ? (view.id === DEFAULT_PHASE_ID ? undefined : view.id) : view.type === 'topic' ? snapshot.topics.find((topic) => topic.id === view.id)?.phaseId : undefined;
        requestCreateTopicDraft(phaseId ?? null);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent('mindline:send-composer'));
        return;
      }
      if (event.shiftKey && snapshot && (event.key === '[' || event.key === ']')) {
        const visibleTopics = snapshot.topics.filter(isVisibleTopic);
        if (visibleTopics.length === 0) {
          return;
        }
        event.preventDefault();
        const currentIndex = view.type === 'topic' ? visibleTopics.findIndex((topic) => topic.id === view.id) : -1;
        const direction = event.key === ']' ? 1 : -1;
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + visibleTopics.length) % visibleTopics.length;
        setView({ type: 'topic', id: visibleTopics[nextIndex].id });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartOpen, generation, snapshot, view]);

  const activeTopic = view.type === 'topic' ? snapshot?.topics.find((topic) => topic.id === view.id && isVisibleTopic(topic)) : undefined;
  const activePhase = view.type === 'phase' && snapshot ? (view.id === DEFAULT_PHASE_ID ? buildDefaultPhase(snapshot, t) : snapshot.phases.find((phase) => phase.id === view.id && isVisiblePhase(phase))) : undefined;
  const activeTopicPhase = activeTopic?.phaseId ? snapshot?.phases.find((phase) => phase.id === activeTopic.phaseId && isVisiblePhase(phase)) : undefined;
  const topBarBreadcrumbs: TopBarBreadcrumbItem[] = activeTopic
    ? [
        activeTopicPhase
          ? { label: activeTopicPhase.title, onSelect: () => setView({ type: 'phase', id: activeTopicPhase.id }), trailingSeparator: true }
          : snapshot
            ? { label: defaultPhaseTitle(snapshot.manifest, t), onSelect: () => setView({ type: 'phase', id: DEFAULT_PHASE_ID }) }
            : { label: t.noPhase }
      ]
    : activePhase
      ? [{ label: t.phases, trailingSeparator: true }]
    : [{ label: view.type === 'settings' ? t.settings : view.type === 'trash' ? t.trash : view.type === 'backup' ? t.backup : view.type === 'welcome' ? t.createOrOpenWorkspace : view.type === 'workspace' ? t.workspaceOverview : view.type === 'phases' ? t.phases : t.workspaceAndModels }];

  async function run<T>(label: string, action: () => Promise<T>): Promise<T | undefined> {
    setBusyLabel(label);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(userFacingError(err, t));
      return undefined;
    } finally {
      setBusyLabel(null);
    }
  }

  function addToCart(item: SelectionCartItem) {
    setCartItems((current) => (current.some((entry) => entry.type === item.type && entry.id === item.id) ? current : [...current, item]));
  }

  async function handleOpenWorkspace(workspacePath: string) {
    const next = await run(t.openingWorkspace, () => getApi().openWorkspace(workspacePath));
    if (next) {
      applySnapshot(next);
      setInitialView(next);
    }
  }

  function openHomeView() {
    setView(snapshot ? { type: 'workspace' } : { type: 'welcome' });
  }

  async function handleCreateTopic(input: { title: string; phaseId?: string }) {
    const next = await run(t.creatingTopic, () => getApi().createTopic(input));
    if (next) {
      applySnapshot(next);
      const createdTopic = [...next.topics].reverse().find(isVisibleTopic);
      if (createdTopic) {
        setView({ type: 'topic', id: createdTopic.id });
      }
      return true;
    }
    return false;
  }

  function requestCreatePhaseDraft() {
    setView({ type: 'phases' });
    setPhaseDraftRequestId((current) => current + 1);
  }

  function requestCreateTopicDraft(phaseId?: Id | null) {
    const targetPhaseId = phaseId && phaseId !== DEFAULT_PHASE_ID && snapshot?.phases.some((phase) => phase.id === phaseId && isVisiblePhase(phase)) ? phaseId : null;
    setView({ type: 'phase', id: targetPhaseId ?? DEFAULT_PHASE_ID });
    setTopicDraftRequest((current) => ({ id: current.id + 1, phaseId: targetPhaseId }));
  }

  async function handleCreatePhase(input: { title: string; description?: string }) {
    const next = await run(t.creatingPhase, () => getApi().createPhase(input));
    if (next) {
      applySnapshot(next);
      const createdPhase = [...next.phases].reverse().find(isVisiblePhase);
      if (createdPhase) {
        setView({ type: 'phase', id: createdPhase.id });
      }
      return true;
    }
    return false;
  }

  async function handleClearTrash() {
    setClearTrashConfirmOpen(true);
  }

  async function confirmClearTrash() {
    const api = getApi() as typeof window.groupAI & { clearTrash?: () => Promise<WorkspaceSnapshot> };
    if (typeof api.clearTrash !== 'function') {
      setClearTrashConfirmOpen(false);
      setError(t.clearTrashUnavailable);
      return;
    }
    setClearTrashConfirmOpen(false);
    await refreshFrom(api.clearTrash());
  }

  async function refreshFrom(next: Promise<WorkspaceSnapshot>) {
    const resolved = await run(t.updatingWorkspace, () => next);
    if (resolved) {
      applySnapshot(resolved);
    }
    return resolved;
  }

  async function refreshCurrentWorkspace() {
    const next = await run(t.updatingWorkspace, () => getApi().getSnapshot());
    if (next) {
      applySnapshot(next);
    }
  }

  async function handleSendTopic(topicId: Id, prompt: string, runOptions: ModelRunOptions) {
    const provider = snapshot?.modelProviders.find((entry) => entry.id === runOptions.providerId) ?? snapshot?.modelProviders.find((entry) => entry.id === snapshot.activeModelProviderId);
    const effectiveOptions: ModelRunOptions = {
      ...runOptions,
      providerId: provider?.id
    };
    const startedAt = Date.now();
    const requestId = newRequestId();
    setGeneration({
      requestId,
      topicId,
      prompt,
      providerLabel: provider?.name ?? t.noActiveModelProvider,
      startedAt,
      stageIndex: 0,
      streamedContent: '',
      attachmentCount: runOptions.attachments?.length,
      contextCount: runOptions.contextItems?.length,
      processingSummary: buildProcessingSummary(snapshot, topicId, provider, t, {
        providerId: provider?.id ?? '',
        presetId: runOptions.presetId ?? 'balanced',
        roleInstruction: runOptions.roleInstruction ?? copy[language].roleAssistant,
        profileInstruction: runOptions.profileInstruction ?? '',
        profileInstructionsByRole: {},
        temperature: runOptions.temperature ?? 0.3,
        maxTokens: runOptions.maxTokens ?? 4096,
        attachments: runOptions.attachments,
        contextItems: runOptions.contextItems
      })
    });
    setError(null);

    try {
      await getApi().generateAssistantReplyStream(topicId, prompt, effectiveOptions, requestId);
    } catch (err) {
      setGeneration((current) => (current?.requestId === requestId ? null : current));
      setError(userFacingError(err, t));
    } finally {
      window.setTimeout(() => {
        setGeneration((current) => (current?.requestId === requestId && current.stageIndex >= 3 ? null : current));
      }, 280);
    }
  }

  async function handleCancelGeneration(requestId: Id) {
    await getApi().cancelAssistantReply(requestId);
  }

  async function handleSummarizeTopic(topicId: Id) {
    const provider = snapshot?.modelProviders.find((entry) => entry.id === snapshot.activeModelProviderId);
    const startedAt = Date.now();
    setSummaryGeneration({
      targetType: 'topic',
      targetId: topicId,
      providerLabel: provider?.name ?? t.noActiveModelProvider,
      startedAt,
      stageIndex: 0,
      processingSummary: buildTopicSummaryProcessingSummary(snapshot, topicId, provider, t)
    });
    setError(null);

    try {
      const next = await getApi().summarizeTopic(topicId);
      setSummaryGeneration((current) => (current?.startedAt === startedAt ? { ...current, stageIndex: 2 } : current));
      applySnapshot(next);
    } catch (err) {
      setError(userFacingError(err, t));
    } finally {
      window.setTimeout(() => {
        setSummaryGeneration((current) => (current?.startedAt === startedAt ? null : current));
      }, 700);
    }
  }

  async function handleSummarizePhase(phaseId: Id) {
    const provider = snapshot?.modelProviders.find((entry) => entry.id === snapshot.activeModelProviderId);
    const startedAt = Date.now();
    setSummaryGeneration({
      targetType: 'phase',
      targetId: phaseId,
      providerLabel: provider?.name ?? t.noActiveModelProvider,
      startedAt,
      stageIndex: 0,
      processingSummary: buildPhaseSummaryProcessingSummary(snapshot, phaseId, provider, t)
    });
    setError(null);

    try {
      const next = await getApi().summarizePhase(phaseId);
      setSummaryGeneration((current) => (current?.startedAt === startedAt ? { ...current, stageIndex: 2 } : current));
      applySnapshot(next);
    } catch (err) {
      setError(userFacingError(err, t));
    } finally {
      window.setTimeout(() => {
        setSummaryGeneration((current) => (current?.startedAt === startedAt ? null : current));
      }, 700);
    }
  }

  async function handleDiscussSelection(prompt: string) {
    const provider = snapshot?.modelProviders.find((entry) => entry.id === snapshot.activeModelProviderId);
    const startedAt = Date.now();
    const selectedItems = [...cartItems];
    setDiscussionGeneration({
      providerLabel: provider?.name ?? t.noActiveModelProvider,
      startedAt,
      stageIndex: 0,
      processingSummary: buildDiscussionProcessingSummary(selectedItems, prompt, provider, t)
    });
    setError(null);

    try {
      const result = await getApi().discussSelection(prompt, selectedItems);
      setDiscussionGeneration((current) => (current?.startedAt === startedAt ? { ...current, stageIndex: 2 } : current));
      setDiscussion(result.message.content);
    } catch (err) {
      setError(userFacingError(err, t));
    } finally {
      window.setTimeout(() => {
        setDiscussionGeneration((current) => (current?.startedAt === startedAt ? null : current));
      }, 700);
    }
  }

  async function handleExportSelectionMarkdown() {
    await run(t.exportMarkdown, async () => {
      const api = getApi() as typeof window.groupAI & { exportSelectionMarkdown?: (items: SelectionCartItem[], language?: 'zh' | 'en') => Promise<string | null> };
      if (typeof api.exportSelectionMarkdown !== 'function') {
        throw new Error('当前版本尚未加载资料篮导出能力，请重启应用后再试。');
      }
      return api.exportSelectionMarkdown(cartItems, t.chinese === '中文' ? 'zh' : 'en');
    });
  }

  async function handleAddModelProvider(input: AddModelProviderInput) {
    const next = await run(t.modelProviderAdded, () => getApi().addModelProvider(input));
    if (next) {
      applySnapshot(next);
    }
  }

  async function handleDeleteModelProvider(providerId: Id) {
    const next = await run(t.modelProviderDeleted, () => getApi().deleteModelProvider(providerId));
    if (next) {
      applySnapshot(next);
    }
  }

  async function handleSetActiveModelProvider(providerId: Id | null) {
    setError(null);
    try {
      const next = await getApi().setActiveModelProvider(providerId);
      applySnapshot(next);
    } catch (err) {
      setError(userFacingError(err, t));
    }
  }

  async function handleRestoreBackup(commitId: string) {
    const next = await run(t.backupRestored, () => getApi().restoreBackup(commitId));
    if (next) {
      applySnapshot(next);
      setView({ type: 'backup' });
    }
  }

  const apiUnavailable = typeof window.groupAI === 'undefined';

  if (apiUnavailable) {
    return (
      <main className="app-shell unavailable">
        <section className="empty-state">
          <Bot size={36} />
          <h1>{t.unavailableTitle}</h1>
          <p>{t.unavailableHelp}</p>
        </section>
      </main>
    );
  }

  const trashedPhases = snapshot?.phases.filter((phase) => phase.status === 'trashed') ?? [];
  const allPhaseById = new Map(snapshot?.phases.map((phase) => [phase.id, phase]) ?? []);
  const trashedTopics = snapshot?.topics.filter((topic) => topic.status === 'trashed' && (!topic.phaseId || allPhaseById.get(topic.phaseId)?.status !== 'trashed')) ?? [];
  const trashItemCount = trashedPhases.length + trashedTopics.length;

  return (
    <main className={`app-shell ${cartOpen ? 'cart-open' : 'cart-collapsed'}`}>
      <TopBar
        breadcrumbs={topBarBreadcrumbs}
        snapshot={snapshot}
        t={t}
        searchPlaceholder={view.type === 'settings' ? t.searchSettings : t.searchConversation}
        onOpenSearchResult={setView}
      />
      <aside className="sidebar">
        <nav className="activity-bar" aria-label={t.navigation}>
          <div className="activity-bar-top">
            <button className="activity-brand-button" type="button" onClick={openHomeView} aria-label={snapshot ? t.workspaceOverview : t.welcome} data-tooltip={snapshot ? t.workspaceOverview : t.welcome} data-tooltip-placement="right">
              <img className="activity-brand-icon" src={mindlineIconUrl} alt="" aria-hidden="true" />
            </button>
            {snapshot ? (
              <>
                <button className={`activity-button ${view.type === 'workspace' ? 'active' : ''}`} type="button" onClick={() => setView({ type: 'workspace' })} aria-label={t.workspaceOverview} data-tooltip={t.workspaceOverview}>
                  <Home size={20} />
                </button>
                <button className={`activity-button ${view.type === 'phases' || view.type === 'phase' || view.type === 'topic' ? 'active' : ''}`} type="button" onClick={() => setView({ type: 'phases' })} aria-label={t.phases} data-tooltip={t.phases}>
                  <GitBranch size={20} />
                </button>
                <button className={`activity-button ${view.type === 'backup' ? 'active' : ''}`} type="button" onClick={() => setView({ type: 'backup' })} aria-label={t.backup} data-tooltip={t.backup}>
                  <History size={20} />
                </button>
                <button className={`activity-button ${view.type === 'trash' ? 'active' : ''}`} type="button" onClick={() => setView({ type: 'trash' })} aria-label={t.trash} data-tooltip={t.trash}>
                  <Trash2 size={20} />
                </button>
              </>
            ) : null}
          </div>
          <div className="activity-bar-bottom">
            <button className={`activity-button ${view.type === 'settings' ? 'active' : ''}`} type="button" onClick={() => setView({ type: 'settings' })} aria-label={t.settings} data-tooltip={t.settings}>
              <Settings size={20} />
            </button>
          </div>
        </nav>

        <div className="sidebar-panel">
          <div className="sidebar-main">
            {!snapshot ? <NoWorkspaceSidebar t={t} onOpen={handleOpenWorkspace} /> : null}
            {snapshot ? <WorkspaceControls snapshot={snapshot} t={t} onOpen={handleOpenWorkspace} /> : null}

            {snapshot && view.type === 'workspace' ? (
              <WorkspaceOverviewContextSidebar
                snapshot={snapshot}
                t={t}
                onRequestCreateTopic={() => requestCreateTopicDraft(null)}
                onOpenTopic={(topicId) => setView({ type: 'topic', id: topicId })}
              />
            ) : null}

            {snapshot && (view.type === 'phases' || view.type === 'phase' || view.type === 'topic') ? (
              <SidebarNavigation
                snapshot={snapshot}
                view={view}
                t={t}
                phaseDraftRequestId={phaseDraftRequestId}
                topicDraftRequest={topicDraftRequest}
                onCreatePhase={handleCreatePhase}
                onCreateTopic={handleCreateTopic}
                onUpdatePhase={(phaseId, input) => refreshFrom(getApi().updatePhase(phaseId, input))}
                onReorderPhases={async (phaseIds) => Boolean(await refreshFrom(getApi().reorderPhases(phaseIds)))}
                onUpdateTopic={(topicId, input) => refreshFrom(getApi().updateTopic(topicId, input))}
                onOpenPhases={() => setView({ type: 'phases' })}
                onOpenPhase={(phaseId) => setView({ type: 'phase', id: phaseId })}
                onSelectTopic={(topicId) => setView({ type: 'topic', id: topicId })}
              />
            ) : null}

            {snapshot && view.type === 'backup' ? <BackupContextSidebar snapshot={snapshot} t={t} onOpenBackup={() => setView({ type: 'backup' })} /> : null}
            {snapshot && view.type === 'trash' ? <TrashContextSidebar t={t} itemCount={trashItemCount} onClearTrash={handleClearTrash} /> : null}
            {snapshot && view.type === 'settings' ? <SettingsContextSidebar language={language} t={t} /> : null}
          </div>
        </div>
      </aside>

      <section className={`workspace-panel ${view.type === 'topic' ? 'topic-workspace-panel' : ''} ${view.type === 'settings' ? 'settings-workspace-panel' : ''}`}>
        <ErrorBoundary key={view.type === 'topic' || view.type === 'phase' ? `${view.type}:${view.id}` : view.type} fallbackTitle={t.viewCrashed} retryLabel={t.retry}>
          {error ? <div className="error-banner">{error}</div> : null}
          {busyLabel ? <div className="busy-banner">{busyLabel}...</div> : null}
          {!snapshot && view.type === 'welcome' ? <NoWorkspace t={t} onOpen={handleOpenWorkspace} /> : null}
          {view.type === 'settings' ? (
            <SettingsPanel
              snapshot={snapshot}
              language={language}
              theme={theme}
              keyboardSettings={keyboardSettings}
              t={t}
              onLanguageChange={setLanguage}
              onThemeChange={setTheme}
              onKeyboardSettingsChange={setKeyboardSettings}
              onAddModelProvider={handleAddModelProvider}
              onDeleteModelProvider={handleDeleteModelProvider}
              onSetActiveModelProvider={handleSetActiveModelProvider}
            />
          ) : null}
          {snapshot && view.type === 'workspace' ? (
            <WorkspaceHome
              snapshot={snapshot}
              t={t}
              onRequestCreatePhase={requestCreatePhaseDraft}
              onRequestCreateTopic={() => requestCreateTopicDraft(null)}
              onOpenPhase={(phaseId) => setView({ type: 'phase', id: phaseId })}
            />
          ) : null}
          {snapshot && view.type === 'phases' ? (
            <PhaseOverview
              snapshot={snapshot}
              t={t}
              onRequestCreatePhase={requestCreatePhaseDraft}
              onRequestCreateTopic={(phaseId) => requestCreateTopicDraft(phaseId)}
              onOpenPhase={(phaseId) => setView({ type: 'phase', id: phaseId })}
            />
          ) : null}
          {snapshot && view.type === 'backup' ? <BackupView snapshot={snapshot} t={t} onRestore={handleRestoreBackup} onSnapshotChange={applySnapshot} /> : null}
          {snapshot && activeTopic ? (
            <TopicView
              snapshot={snapshot}
              topic={activeTopic}
              t={t}
              generation={generation?.topicId === activeTopic.id ? generation : null}
              summaryGeneration={summaryGeneration?.targetType === 'topic' && summaryGeneration.targetId === activeTopic.id ? summaryGeneration : null}
              composerSettings={composerSettings}
              keyboardSettings={keyboardSettings}
              cartItems={cartItems}
              onAddToCart={addToCart}
              onUpdateTopic={(topicId, input) => refreshFrom(getApi().updateTopic(topicId, input))}
              onComposerSettingsChange={setComposerSettings}
              onSend={handleSendTopic}
              onCancel={handleCancelGeneration}
              onSummarize={handleSummarizeTopic}
            />
          ) : null}
          {snapshot && activePhase ? (
            <PhaseView
              snapshot={snapshot}
              phase={activePhase}
              t={t}
              summaryGeneration={summaryGeneration?.targetType === 'phase' && summaryGeneration.targetId === activePhase.id ? summaryGeneration : null}
              onAddToCart={addToCart}
              onRequestCreateTopic={() => requestCreateTopicDraft(activePhase.id === DEFAULT_PHASE_ID ? null : activePhase.id)}
              onEnd={(phaseId) => refreshFrom(getApi().updatePhase(phaseId, { endedAt: new Date().toISOString() }))}
              onUpdatePhase={(phaseId, input) => refreshFrom(getApi().updatePhase(phaseId, input))}
              onSummarize={handleSummarizePhase}
              onOpenTopic={(topicId) => setView({ type: 'topic', id: topicId })}
            />
          ) : null}
          {snapshot && view.type === 'trash' ? (
            <TrashView
              snapshot={snapshot}
              t={t}
              onRestoreTopic={(topicId) => refreshFrom(getApi().updateTopic(topicId, { status: 'active' }))}
              onRestorePhase={(phaseId) => refreshFrom(getApi().updatePhase(phaseId, { status: 'active' }))}
              onClearTrash={handleClearTrash}
            />
          ) : null}
        </ErrorBoundary>
      </section>

      <CartPanel
        items={cartItems}
        discussion={discussion}
        discussionGeneration={discussionGeneration}
        isOpen={cartOpen}
        disabled={!snapshot}
        keyboardSettings={keyboardSettings}
        t={t}
        onToggle={() => setCartOpen((current) => !current)}
        onExportMarkdown={handleExportSelectionMarkdown}
        onRemove={(item) => {
          if (discussionGeneration) return;
          const nextItems = cartItems.filter((entry) => !(entry.type === item.type && entry.id === item.id));
          setCartItems(nextItems);
          if (nextItems.length === 0 && !discussion) {
            setCartOpen(false);
          }
        }}
        onClear={() => {
          if (discussionGeneration) return;
          setCartItems([]);
          setDiscussion('');
          setCartOpen(false);
        }}
        onDiscuss={handleDiscussSelection}
      />
      <GlobalTooltip />
      {clearTrashConfirmOpen ? (
        <div className="app-confirm-backdrop" role="presentation" onMouseDown={() => setClearTrashConfirmOpen(false)}>
          <section className="app-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-trash-title" aria-describedby="clear-trash-description" onMouseDown={(event) => event.stopPropagation()}>
            <h2 id="clear-trash-title">{t.clearTrashDialogTitle}</h2>
            <p id="clear-trash-description">{t.clearTrashConfirm}</p>
            <div className="app-confirm-actions">
              <button type="button" className="app-confirm-secondary" onClick={() => setClearTrashConfirmOpen(false)}>
                {t.cancel}
              </button>
              <button type="button" className="app-confirm-danger" onClick={() => void confirmClearTrash()} autoFocus>
                {t.confirmClearTrash}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function WorkspaceOverviewContextSidebar({
  snapshot,
  t,
  onRequestCreateTopic,
  onOpenTopic
}: {
  snapshot: WorkspaceSnapshot;
  t: Copy;
  onRequestCreateTopic: () => void;
  onOpenTopic: (topicId: Id) => void;
}) {
  const visiblePhases = snapshot.phases.filter(isVisiblePhase);
  const phaseById = new Map(visiblePhases.map((phase) => [phase.id, phase.title]));
  const recentTopics = snapshot.topics
    .filter(isVisibleTopic)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, 8);

  return (
    <nav className="context-sidebar-nav context-overview-nav" aria-label={t.workspaceOverview}>
      <ContextSidebarToolbar icon={<Home size={16} />} title={t.workspaceOverview} />
      <div className="context-sidebar-section-title">
        <span>{t.recentTopics}</span>
        <button type="button" aria-label={t.newTopic} data-tooltip={t.newTopic} onClick={onRequestCreateTopic}>
          <Plus size={15} />
        </button>
      </div>
      <div className="context-sidebar-list">
        {recentTopics.length > 0 ? (
          recentTopics.map((topic) => (
            <button key={topic.id} className="context-sidebar-row" type="button" onClick={() => onOpenTopic(topic.id)}>
              <FileText size={15} />
              <span>
                <strong>{topic.title}</strong>
                <small>{topic.phaseId ? phaseById.get(topic.phaseId) ?? t.noPhase : t.noPhase}</small>
              </span>
              <em>{snapshot.messagesByTopic[topic.id]?.length ?? 0}</em>
            </button>
          ))
        ) : (
          <p className="context-sidebar-empty">{t.workspaceOverviewEmpty}</p>
        )}
      </div>
    </nav>
  );
}

function BackupContextSidebar({ snapshot, t, onOpenBackup }: { snapshot: WorkspaceSnapshot; t: Copy; onOpenBackup: () => void }) {
  return (
    <nav className="context-sidebar-nav" aria-label={t.backup}>
      <ContextSidebarToolbar icon={<History size={16} />} title={t.backup} />
      <button className="context-nav-link active" type="button" onClick={onOpenBackup}>
        <History size={16} />
        <span>{t.backupTimeline}</span>
      </button>
      <div className="context-sidebar-card">
        <span>{t.backupPath}</span>
        <strong>{snapshot.dataPath ?? snapshot.workspacePath}</strong>
      </div>
    </nav>
  );
}

function TrashContextSidebar({ t, itemCount, onClearTrash }: { t: Copy; itemCount: number; onClearTrash: () => void }) {
  return (
    <nav className="context-sidebar-nav" aria-label={t.trash}>
      <ContextSidebarToolbar icon={<Trash2 size={16} />} title={t.trash} count={itemCount} />
      <button className="context-nav-link danger" type="button" onClick={onClearTrash} disabled={itemCount === 0}>
        <Trash2 size={16} />
        <span>{t.clearTrash}</span>
      </button>
    </nav>
  );
}

function SettingsContextSidebar({ language, t }: { language: Language; t: Copy }) {
  const labels = getSettingsContextLabels(language);
  return (
    <nav className="context-sidebar-nav" aria-label={t.settings}>
      <ContextSidebarToolbar icon={<Settings size={16} />} title={t.settings} />
      <a className="context-nav-link" href="#settings-general">
        <Globe2 size={16} />
        <span>{labels.general}</span>
      </a>
      <a className="context-nav-link" href="#settings-shortcuts">
        <Keyboard size={16} />
        <span>{labels.shortcuts}</span>
      </a>
      <a className="context-nav-link" href="#settings-workspace">
        <HardDrive size={16} />
        <span>{labels.workspace}</span>
      </a>
      <a className="context-nav-link" href="#settings-models">
        <Bot size={16} />
        <span>{labels.models}</span>
      </a>
      <a className="context-nav-link" href="#settings-security">
        <KeyRound size={16} />
        <span>{labels.security}</span>
      </a>
      <a className="context-nav-link" href="#settings-appearance">
        <Palette size={16} />
        <span>{labels.appearance}</span>
      </a>
    </nav>
  );
}

function ContextSidebarToolbar({ icon, title, count }: { icon: ReactNode; title: string; count?: number }) {
  return (
    <header className="context-sidebar-toolbar">
      <span className="context-sidebar-title">
        <span className="context-sidebar-icon" aria-hidden="true">{icon}</span>
        <span>{title}</span>
      </span>
      {typeof count === 'number' ? <span className="context-sidebar-count">{count}</span> : null}
    </header>
  );
}

function getSettingsContextLabels(language: Language) {
  if (language === 'zh') {
    return {
      general: '通用',
      shortcuts: '快捷键',
      workspace: '工作区',
      models: '模型',
      security: '密钥',
      appearance: '外观'
    };
  }
  return {
    general: 'General',
    shortcuts: 'Shortcuts',
    workspace: 'Workspace',
    models: 'Models',
    security: 'Secrets',
    appearance: 'Appearance'
  };
}

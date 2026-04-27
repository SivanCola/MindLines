import { ArrowUp, Check, ChevronDown, ChevronRight, FileImage, FileText, Gauge, GitBranch, Hash, ImagePlus, ListPlus, MessageSquarePlus, MoreHorizontal, PackagePlus, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, Square, Trash2, X } from 'lucide-react';
import { type DragEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ClipboardEvent as ReactClipboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TEXT_ATTACHMENT_ACCEPT, TEXT_ATTACHMENT_MAX_BYTES, TEXT_ATTACHMENT_MAX_COUNT, TEXT_ATTACHMENT_MAX_TOTAL_BYTES, isSupportedTextAttachment, looksLikeUtf8Text } from '../../shared/attachmentPolicy';
import { createMessageCartItem, createTopicCartItem, createTopicSummaryCartItem } from '../../shared/cart';
import type { Id, MessageAttachmentInput, ModelProvider, ModelRunOptions, SelectionCartItem, Topic, WorkspaceSnapshot } from '../../shared/types';
import { ComposerSettings, Copy, DEFAULT_PHASE_ID, GenerationState, KeyboardSettings, SummaryGenerationState, defaultPhaseTitle, fillTemplate, getApi, isVisiblePhase, isVisibleTopic, modelPresetOptions, readCustomRoles, rolePresetOptions, writeCustomRoles } from '../appModel';
import { GenerationActivity, MarkdownContent, MessageBubble, PendingUserBubble, StreamingAssistantBubble, SummaryActions, SummaryActivity } from './ConversationPrimitives';
import { InlineTitleEditor } from './InlineTitleEditor';

export function TopicView({
  snapshot,
  topic,
  t,
  generation,
  summaryGeneration,
  composerSettings,
  keyboardSettings,
  cartItems,
  onAddToCart,
  onUpdateTopic,
  onComposerSettingsChange,
  onSend,
  onCancel,
  onSummarize
}: {
  snapshot: WorkspaceSnapshot;
  topic: Topic;
  t: Copy;
  generation: GenerationState | null;
  summaryGeneration: SummaryGenerationState | null;
  composerSettings: ComposerSettings;
  keyboardSettings: KeyboardSettings;
  cartItems: SelectionCartItem[];
  onAddToCart: (item: SelectionCartItem) => void;
  onUpdateTopic: (topicId: Id, input: { title?: string; phaseId?: string | null }) => void;
  onComposerSettingsChange: (settings: ComposerSettings | ((current: ComposerSettings) => ComposerSettings)) => void;
  onSend: (topicId: Id, prompt: string, options: ModelRunOptions) => void;
  onCancel: (requestId: Id) => void;
  onSummarize: (topicId: Id) => void;
}) {
  const messages = snapshot.messagesByTopic[topic.id] ?? [];
  const summary = snapshot.topicSummaries[topic.id];
  const [summaryExpanded, setSummaryExpanded] = useState(Boolean(summary));
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [phasePanelOpen, setPhasePanelOpen] = useState(false);
  const [phaseSearch, setPhaseSearch] = useState('');
  const summaryActivityRef = useRef<HTMLDivElement | null>(null);
  const topicScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const moreActionsRef = useRef<HTMLDivElement | null>(null);
  const phaseSearchRef = useRef<HTMLInputElement | null>(null);
  const previousTopicIdRef = useRef(topic.id);
  const previousMessageCountRef = useRef(messages.length);
  const wasSummaryGeneratingRef = useRef(false);

  const phaseOptions = snapshot.phases.filter(isVisiblePhase);
  const fallbackDefaultPhaseTitle = defaultPhaseTitle(snapshot.manifest, t);
  const currentPhase = topic.phaseId ? phaseOptions.find((phase) => phase.id === topic.phaseId) : undefined;
  const currentPhaseId = topic.phaseId && currentPhase ? topic.phaseId : null;
  const visibleTopics = snapshot.topics.filter(isVisibleTopic);
  const phaseTopicCounts = new Map<Id, number>(phaseOptions.map((phase) => [phase.id, 0]));
  for (const visibleTopic of visibleTopics) {
    if (visibleTopic.phaseId && phaseTopicCounts.has(visibleTopic.phaseId)) {
      phaseTopicCounts.set(visibleTopic.phaseId, (phaseTopicCounts.get(visibleTopic.phaseId) ?? 0) + 1);
    }
  }
  const defaultPhaseTopicCount = visibleTopics.filter((visibleTopic) => !visibleTopic.phaseId || !phaseTopicCounts.has(visibleTopic.phaseId)).length;
  const phaseChoices = [
    { id: null, title: fallbackDefaultPhaseTitle, count: defaultPhaseTopicCount },
    ...phaseOptions.map((phase) => ({ id: phase.id, title: phase.title, count: phaseTopicCounts.get(phase.id) ?? 0 }))
  ];
  const normalizedPhaseSearch = phaseSearch.trim().toLowerCase();
  const filteredPhaseChoices = normalizedPhaseSearch
    ? phaseChoices.filter((phase) => phase.title.toLowerCase().includes(normalizedPhaseSearch))
    : phaseChoices;
  const showPhaseSearch = phaseChoices.length > 6;

  useEffect(() => {
    if (summaryGeneration) {
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      topicScrollAreaRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [topic.id]);

  useEffect(() => {
    setSummaryExpanded(Boolean(summary));
  }, [summary, topic.id]);

  useEffect(() => {
    const topicChanged = previousTopicIdRef.current !== topic.id;
    const messageAdded = messages.length > previousMessageCountRef.current;
    const shouldFollowConversation = Boolean(generation) || messageAdded;

    if (topicChanged) {
      previousTopicIdRef.current = topic.id;
      previousMessageCountRef.current = messages.length;
      return;
    }

    previousMessageCountRef.current = messages.length;
    if (!shouldFollowConversation) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      conversationEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [generation?.stageIndex, generation?.startedAt, messages.length, topic.id]);

  useEffect(() => {
    if (moreActionsOpen) {
      return;
    }
    setPhasePanelOpen(false);
    setPhaseSearch('');
  }, [moreActionsOpen]);

  useEffect(() => {
    if (!moreActionsOpen || !phasePanelOpen || !showPhaseSearch) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      phaseSearchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [moreActionsOpen, phasePanelOpen, showPhaseSearch]);

  useEffect(() => {
    if (!moreActionsOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (moreActionsRef.current?.contains(event.target as Node)) {
        return;
      }
      setMoreActionsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMoreActionsOpen(false);
        setPhasePanelOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreActionsOpen]);

  useEffect(() => {
    if (summaryGeneration) {
      wasSummaryGeneratingRef.current = true;
      const frame = window.requestAnimationFrame(() => {
        summaryActivityRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    if (wasSummaryGeneratingRef.current && summary) {
      wasSummaryGeneratingRef.current = false;
      setSummaryExpanded(true);
    } else {
      wasSummaryGeneratingRef.current = false;
    }
    return undefined;
  }, [summaryGeneration, summary]);

  function openPhasePanel() {
    setPhaseSearch('');
    setPhasePanelOpen(true);
  }

  function choosePhase(phaseId: string | null) {
    if (phaseId === currentPhaseId) {
      return;
    }
    onUpdateTopic(topic.id, { phaseId });
    setMoreActionsOpen(false);
    setPhasePanelOpen(false);
    setPhaseSearch('');
  }

  return (
    <article className="detail-view topic-detail-view">
      <header className="detail-header">
        <div className="topic-header-main">
          <InlineTitleEditor value={topic.title} ariaLabel={t.topicNameOptional} onSave={(title) => onUpdateTopic(topic.id, { title })} />
          <div className="detail-subtitle topic-meta-line">
            <span>
              {messages.length} {t.messages}
            </span>
            <span className="topic-meta-separator" aria-hidden="true">·</span>
            <time dateTime={topic.createdAt}>{t.created} {new Date(topic.createdAt).toLocaleString()}</time>
          </div>
        </div>
        <div className="header-actions">
          <button className="detail-action-button primary" type="button" onClick={() => onSummarize(topic.id)} disabled={Boolean(summaryGeneration)} aria-label={t.summarize} data-tooltip={t.summarize}>
            <Sparkles size={16} />
          </button>
          <button className="detail-action-button primary" type="button" onClick={() => onAddToCart(createTopicCartItem(topic))} aria-label={t.addTopic} data-tooltip={t.addTopic}>
            <ListPlus size={16} />
          </button>
          <div className="detail-more-actions" ref={moreActionsRef}>
            <button className="detail-action-button" type="button" onClick={() => setMoreActionsOpen((current) => !current)} aria-label={t.moreActions} data-tooltip={t.moreActions} aria-haspopup="menu" aria-expanded={moreActionsOpen}>
              <MoreHorizontal size={17} />
            </button>
            {moreActionsOpen ? (
              <div className="detail-action-menu" role="menu" aria-label={t.moreActions}>
                <button
                  type="button"
                  role="menuitem"
                  className={`detail-menu-action ${phasePanelOpen ? 'active' : ''}`}
                  onMouseEnter={openPhasePanel}
                  onFocus={openPhasePanel}
                  onClick={openPhasePanel}
                  aria-haspopup="menu"
                  aria-expanded={phasePanelOpen}
                >
                  <GitBranch size={15} />
                  <span>{t.moveTopicToPhase}</span>
                  <ChevronRight className="detail-menu-trailing-icon" size={15} />
                </button>
                {phasePanelOpen ? (
                  <div className="detail-phase-submenu" role="menu" aria-label={t.moveTopicToPhase}>
                    <div className="detail-phase-submenu-title">
                      <GitBranch size={15} />
                      <span>{t.moveTopicToPhase}</span>
                    </div>
                    {showPhaseSearch ? (
                      <label className="detail-phase-search">
                        <Search size={14} />
                        <input ref={phaseSearchRef} value={phaseSearch} onChange={(event) => setPhaseSearch(event.target.value)} placeholder={t.searchPhases} aria-label={t.searchPhases} />
                      </label>
                    ) : null}
                    <div className="detail-phase-choice-list" role="listbox" aria-label={t.moveTopicToPhase}>
                      {filteredPhaseChoices.length === 0 ? <p>{t.noMatchingPhases}</p> : null}
                      {filteredPhaseChoices.map((phase) => {
                        const selected = phase.id === currentPhaseId;
                        return (
                          <button
                            key={phase.id ?? DEFAULT_PHASE_ID}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            aria-disabled={selected}
                            className={`detail-phase-choice ${selected ? 'current' : ''}`}
                            onClick={() => choosePhase(phase.id)}
                          >
                            <span className="detail-phase-choice-check">{selected ? <Check size={15} /> : null}</span>
                            <span className="detail-phase-choice-title">{phase.title}</span>
                            <small>{fillTemplate(t.topicCountLabel, { count: phase.count })}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="detail-menu-action"
                  onClick={() => {
                    setMoreActionsOpen(false);
                    void getApi().exportTopicMarkdown(topic.id, t.chinese === '中文' ? 'zh' : 'en');
                  }}
                >
                  <FileText size={15} />
                  <span>{t.exportMarkdown}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div ref={topicScrollAreaRef} className="topic-scroll-area">
        <section className={`summary-block topic-summary-block ${summaryGeneration ? 'generating' : ''} ${summary && !summaryExpanded && !summaryGeneration ? 'collapsed' : 'expanded'}`} aria-live="polite">
          <div className="block-title">
            <h3 className="summary-title">
              <Sparkles size={16} style={{ color: 'var(--accent)', marginRight: '0.35rem', flexShrink: 0 }} />
              {t.topicSummary}
            </h3>
            <div className="summary-toolbar">
              {summary ? (
                <>
                  <button className="summary-toggle-button" type="button" onClick={() => setSummaryExpanded((current) => !current)}>
                    {summaryExpanded ? t.collapseSummary : t.expandSummary}
                  </button>
                  <SummaryActions content={summary.content} disabled={Boolean(summaryGeneration)} t={t} onAdd={() => onAddToCart(createTopicSummaryCartItem(topic, summary))} />
                </>
              ) : null}
            </div>
          </div>
          <div ref={summaryActivityRef}>
            {summaryGeneration ? <SummaryActivity summaryGeneration={summaryGeneration} t={t} /> : null}
          </div>
          <div className="summary-content-frame">
            {summary ? (
              <MarkdownContent content={summary.content} t={t} />
            ) : (
              <p>{t.noSummaryYet}</p>
            )}
          </div>
        </section>

        <section className="message-list" aria-label={t.topicMessages}>
        {messages.length === 0 ? (
          <div className="empty-inline">
            <MessageSquarePlus size={24} />
            <p>{t.startTopic}</p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} workspacePath={snapshot.dataPath ?? snapshot.workspacePath} t={t} onAdd={() => onAddToCart(createMessageCartItem(message))} />)
        )}
        {generation ? (
          <>
            <PendingUserBubble prompt={generation.prompt} t={t} attachmentCount={generation.attachmentCount} contextCount={generation.contextCount} />
            {generation.streamedContent ? (
              <StreamingAssistantBubble content={generation.streamedContent} t={t} />
            ) : (
              <GenerationActivity generation={generation} t={t} />
            )}
          </>
        ) : null}
        <div ref={conversationEndRef} className="conversation-end" aria-hidden="true" />
      </section>
      </div>

      <TopicComposer
        topicId={topic.id}
        providers={snapshot.modelProviders}
        settings={composerSettings}
        keyboardSettings={keyboardSettings}
        cartItems={cartItems}
        t={t}
        generation={generation}
        onSettingsChange={onComposerSettingsChange}
        onSend={onSend}
        onCancel={onCancel}
      />
    </article>
  );
}

type ComposerAttachmentDraft = MessageAttachmentInput & { id: string; previewUrl?: string };

function TopicComposer({
  topicId,
  providers,
  settings,
  keyboardSettings,
  cartItems,
  t,
  generation,
  onSettingsChange,
  onSend,
  onCancel
}: {
  topicId: Id;
  providers: ModelProvider[];
  settings: ComposerSettings;
  keyboardSettings: KeyboardSettings;
  cartItems: SelectionCartItem[];
  t: Copy;
  generation: GenerationState | null;
  onSettingsChange: (settings: ComposerSettings | ((current: ComposerSettings) => ComposerSettings)) => void;
  onSend: (topicId: Id, prompt: string, options: ModelRunOptions) => void;
  onCancel: (requestId: Id) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<ComposerAttachmentDraft[]>([]);
  const [insertedContextItems, setInsertedContextItems] = useState<SelectionCartItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [composerError, setComposerError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textFileInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentsRef = useRef<ComposerAttachmentDraft[]>([]);
  const selectedProvider = providers.find((provider) => provider.id === settings.providerId && provider.enabled) ?? providers.find((provider) => provider.enabled);
  const localToolImageBlocked = Boolean(attachments.some((attachment) => attachment.type === 'image') && selectedProvider?.kind === 'local-tool');
  const canSend = Boolean(prompt.trim() || attachments.length > 0);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => attachmentsRef.current.forEach((attachment) => {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }), []);

  function submit(event: FormEvent) {
    event.preventDefault();
    sendCurrentPrompt();
  }

  function sendCurrentPrompt() {
    if (!canSend || generation) return;
    if (localToolImageBlocked) {
      setComposerError(t.localToolImageUnsupported);
      return;
    }
    const nextAttachments = attachments.map(({ id: _id, previewUrl: _previewUrl, ...attachment }) => attachment);
    onSend(topicId, prompt, {
      ...settings,
      attachments: nextAttachments,
      contextItems: insertedContextItems
    });
    setPrompt('');
    attachments.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    });
    setAttachments([]);
    setInsertedContextItems([]);
    setComposerError('');
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.altKey || event.nativeEvent.isComposing) {
      return;
    }
    const commandKey = event.metaKey || event.ctrlKey;
    const shouldSend = !event.shiftKey && (commandKey || keyboardSettings.enterToSend);
    if (!shouldSend) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    sendCurrentPrompt();
  }

  useEffect(() => {
    function handleShortcut() {
      sendCurrentPrompt();
    }

    window.addEventListener('mindline:send-composer', handleShortcut);
    return () => window.removeEventListener('mindline:send-composer', handleShortcut);
  }, [attachments, canSend, generation, insertedContextItems, localToolImageBlocked, onSend, prompt, settings, topicId]);

  async function addImageFiles(files: Iterable<File>) {
    const imageFiles = [...files].filter((file) => /^image\/(png|jpeg|webp|gif)$/.test(file.type));
    if (imageFiles.length === 0) {
      return;
    }
    try {
      const nextAttachments = await Promise.all(imageFiles.map(readImageFile));
      setAttachments((current) => [...current, ...nextAttachments]);
      setComposerError('');
    } catch {
      setComposerError(t.imageReadFailed);
    }
  }

  async function addTextFiles(files: Iterable<File>) {
    const incomingFiles = [...files];
    const supportedFiles = incomingFiles.filter(isSupportedTextFile);
    if (supportedFiles.length === 0) {
      if (incomingFiles.length > 0) {
        setComposerError(t.textFileUnsupported);
      }
      return;
    }
    if (supportedFiles.some((file) => file.size > TEXT_ATTACHMENT_MAX_BYTES)) {
      setComposerError(t.textFileTooLarge);
      return;
    }
    const currentTextTotal = attachments.filter((attachment) => attachment.type === 'text').reduce((sum, attachment) => sum + attachment.size, 0);
    const nextTextTotal = supportedFiles.reduce((sum, file) => sum + file.size, currentTextTotal);
    if (attachments.filter((attachment) => attachment.type === 'text').length + supportedFiles.length > TEXT_ATTACHMENT_MAX_COUNT) {
      setComposerError(t.textFileCountLimit);
      return;
    }
    if (nextTextTotal > TEXT_ATTACHMENT_MAX_TOTAL_BYTES) {
      setComposerError(t.textFileTotalTooLarge);
      return;
    }
    try {
      const nextAttachments = await Promise.all(supportedFiles.map(readTextFile));
      setAttachments((current) => [...current, ...nextAttachments]);
      setComposerError('');
    } catch {
      setComposerError(t.textFileReadFailed);
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const removed = current.find((attachment) => attachment.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return current.filter((attachment) => attachment.id !== id);
    });
    setComposerError('');
  }

  function insertCartContext() {
    setInsertedContextItems((current) => {
      const existingKeys = new Set(current.map((item) => `${item.type}:${item.id}`));
      return [...current, ...cartItems.filter((item) => !existingKeys.has(`${item.type}:${item.id}`))];
    });
  }

  function removeContextItem(item: SelectionCartItem) {
    setInsertedContextItems((current) => current.filter((entry) => !(entry.type === item.type && entry.id === item.id)));
  }

  function handlePaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const files = [...event.clipboardData.files];
    if (files.some((file) => file.type.startsWith('image/'))) {
      void addImageFiles(files);
    }
    if (files.some(isSupportedTextFile)) {
      void addTextFiles(files);
    }
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDragOver(false);
    void addImageFiles(event.dataTransfer.files);
    void addTextFiles(event.dataTransfer.files);
  }

  return (
    <form
      className={`composer topic-composer ${dragOver ? 'drag-over' : ''}`}
      onSubmit={submit}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        className="composer-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        onChange={(event) => {
          void addImageFiles(event.target.files ?? []);
          event.currentTarget.value = '';
        }}
      />
      <input
        ref={textFileInputRef}
        className="composer-file-input"
        type="file"
        accept={TEXT_ATTACHMENT_ACCEPT}
        multiple
        onChange={(event) => {
          void addTextFiles(event.target.files ?? []);
          event.currentTarget.value = '';
        }}
      />
      {insertedContextItems.length > 0 ? (
        <div className="composer-context-strip" aria-label={t.insertedContext}>
          {insertedContextItems.map((item) => (
            <span className="composer-context-chip" key={`${item.type}:${item.id}`}>
              <PackagePlus size={13} />
              <span>{item.label}</span>
              <button type="button" onClick={() => removeContextItem(item)} aria-label={`${t.removeContext}: ${item.label}`} data-tooltip={t.removeContext}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {attachments.length > 0 ? (
        <div className="composer-attachment-strip" aria-label={t.attachments}>
          {attachments.map((attachment) => (
            <figure className="composer-attachment" key={attachment.id}>
              {attachment.type === 'image' ? <img src={attachment.previewUrl} alt={attachment.fileName} /> : <div className="composer-attachment-file"><FileText size={18} /></div>}
              <figcaption>{attachment.fileName}</figcaption>
              <button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`${t.removeAttachment}: ${attachment.fileName}`} data-tooltip={t.removeAttachment}>
                <X size={13} />
              </button>
            </figure>
          ))}
        </div>
      ) : null}
      <div className="composer-control-row">
        <div className="composer-action-cluster">
          <button className="composer-icon-action" type="button" onClick={() => fileInputRef.current?.click()} disabled={Boolean(generation)} aria-label={t.attachImage} data-tooltip={t.attachImage}>
            <ImagePlus size={16} />
          </button>
          <button className="composer-icon-action" type="button" onClick={() => textFileInputRef.current?.click()} disabled={Boolean(generation)} aria-label={t.attachText} data-tooltip={t.attachText}>
            <FileText size={16} />
          </button>
          <button className="composer-icon-action" type="button" onClick={insertCartContext} disabled={Boolean(generation) || cartItems.length === 0} aria-label={t.insertCartContext} data-tooltip={t.insertCartContext}>
            <PackagePlus size={16} />
          </button>
        </div>
        <ComposerToolbar providers={providers} settings={settings} t={t} disabled={Boolean(generation)} onChange={onSettingsChange} />
      </div>
      <div className="composer-input-shell">
        {dragOver ? (
          <div className="composer-drop-overlay">
            <FileImage size={18} />
            <span>{t.composerDropHint}</span>
          </div>
        ) : null}
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onPaste={handlePaste} onKeyDown={handleComposerKeyDown} placeholder={t.promptPlaceholder} disabled={Boolean(generation)} />
        <button
          className="composer-send-button"
          type={generation ? 'button' : 'submit'}
          onClick={generation ? () => onCancel(generation.requestId) : undefined}
          disabled={!generation && (!canSend || localToolImageBlocked)}
          aria-label={generation ? t.stopGeneration : t.send}
          title={generation ? t.stopGeneration : t.send}
        >
          {generation ? <Square size={17} strokeWidth={2.6} /> : <ArrowUp size={20} strokeWidth={2.6} />}
        </button>
      </div>
      {composerError || localToolImageBlocked ? <p className="composer-warning">{composerError || t.localToolImageUnsupported}</p> : null}
    </form>
  );
}

function readImageFile(file: File): Promise<ComposerAttachmentDraft> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('图片读取失败'));
        return;
      }
      resolve({
        id: crypto.randomUUID(),
        type: 'image',
        fileName: file.name || 'image.png',
        mediaType: file.type,
        size: file.size,
        dataUrl: reader.result,
        previewUrl: URL.createObjectURL(file)
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}

function isSupportedTextFile(file: File): boolean {
  return isSupportedTextAttachment(file.name, file.type);
}

async function readTextFile(file: File): Promise<ComposerAttachmentDraft> {
  const text = await file.text();
  if (!looksLikeUtf8Text(text)) {
    throw new Error('文本文件必须是 UTF-8 文本');
  }
  const mediaType = file.type || 'text/plain';
  return {
    id: crypto.randomUUID(),
    type: 'text',
    fileName: file.name || 'text.txt',
    mediaType,
    size: file.size,
    dataUrl: `data:${mediaType};base64,${bytesToBase64(new TextEncoder().encode(text))}`
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function ComposerToolbar({
  providers,
  settings,
  t,
  disabled,
  onChange
}: {
  providers: ModelProvider[];
  settings: ComposerSettings;
  t: Copy;
  disabled: boolean;
  onChange: (settings: ComposerSettings | ((current: ComposerSettings) => ComposerSettings)) => void;
}) {
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const selectedPreset = modelPresetOptions.find((preset) => preset.id === settings.presetId) ?? modelPresetOptions[0];
  const selectedProvider = enabledProviders.find((provider) => provider.id === settings.providerId) ?? enabledProviders[0];
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [customRole, setCustomRole] = useState('');
  const [editingCustomRole, setEditingCustomRole] = useState<string | null>(null);
  const [customRoleDraftInstruction, setCustomRoleDraftInstruction] = useState('');
  const [customRoles, setCustomRoles] = useState<string[]>(() => readCustomRoles());
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const profilePanelRef = useRef<HTMLDivElement | null>(null);
  const customRoleInputRef = useRef<HTMLInputElement | null>(null);
  const builtinRoleLabels = rolePresetOptions.map((rolePreset) => t[rolePreset.labelKey]);
  const activeRole = settings.roleInstruction || t.roleAssistant;
  const profileLabel = activeRole;
  const customRoleEditorOpen = editingCustomRole !== null;
  const creatingCustomRole = editingCustomRole === '';
  const visibleProfileInstruction = creatingCustomRole ? customRoleDraftInstruction : settings.profileInstruction;

  useEffect(() => {
    if (!settingsOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (settingsRef.current?.contains(event.target as Node)) {
        return;
      }
      setSettingsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen && profileOpen) {
      setProfileOpen(false);
    }
  }, [profileOpen, settingsOpen]);

  useLayoutEffect(() => {
    if (!profileOpen) {
      return;
    }
    if (profilePanelRef.current) {
      profilePanelRef.current.scrollTop = 0;
    }
  }, [profileOpen]);

  useEffect(() => {
    if (!profileOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (profileRef.current?.contains(event.target as Node)) {
        return;
      }
      setProfileOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!profileOpen) {
      return;
    }
    if (customRoles.includes(activeRole)) {
      setCustomRole(activeRole);
      setEditingCustomRole(activeRole);
      return;
    }
    setCustomRole('');
    setEditingCustomRole(null);
  }, [activeRole, customRoles, profileOpen]);

  function roleRunProfileFor(roleInstruction: string) {
    const roleName = roleInstruction.trim();
    const exactPreset = rolePresetOptions.find((rolePreset) => t[rolePreset.labelKey].toLowerCase() === roleName.toLowerCase());
    if (exactPreset) {
      return exactPreset;
    }
    if (/(程序开发者|开发者|工程师|developer|engineer)/i.test(roleName)) {
      return rolePresetOptions.find((rolePreset) => rolePreset.labelKey === 'roleDeveloper') ?? rolePresetOptions[0];
    }
    if (/(产品经理|product\s*manager|pm\b)/i.test(roleName)) {
      return rolePresetOptions.find((rolePreset) => rolePreset.labelKey === 'roleProductManager') ?? rolePresetOptions[0];
    }
    if (/(首席执行官|执行官|ceo|chief\s*executive\s*officer)/i.test(roleName)) {
      return rolePresetOptions.find((rolePreset) => rolePreset.labelKey === 'roleCEO') ?? rolePresetOptions[0];
    }
    if (/(首席技术官|技术官|cto|chief\s*technology\s*officer)/i.test(roleName)) {
      return rolePresetOptions.find((rolePreset) => rolePreset.labelKey === 'roleCTO') ?? rolePresetOptions[0];
    }
    if (/(首席运营官|运营官|coo|chief\s*operating\s*officer)/i.test(roleName)) {
      return rolePresetOptions.find((rolePreset) => rolePreset.labelKey === 'roleCOO') ?? rolePresetOptions[0];
    }
    if (/(首席财务官|财务官|cfo|chief\s*financial\s*officer)/i.test(roleName)) {
      return rolePresetOptions.find((rolePreset) => rolePreset.labelKey === 'roleCFO') ?? rolePresetOptions[0];
    }
    if (/(设计师|designer|ux|ui)/i.test(roleName)) {
      return rolePresetOptions.find((rolePreset) => rolePreset.labelKey === 'roleDesigner') ?? rolePresetOptions[0];
    }
    if (/(心理咨询师|咨询师|counselor|therapist)/i.test(roleName)) {
      return rolePresetOptions.find((rolePreset) => rolePreset.labelKey === 'roleCounselor') ?? rolePresetOptions[0];
    }
    if (/(数据分析师|数据分析|data\s*analyst|analyst)/i.test(roleName)) {
      return rolePresetOptions.find((rolePreset) => rolePreset.labelKey === 'roleDataAnalyst') ?? rolePresetOptions[0];
    }
    if (/(家庭教师|教师|家教|导师|tutor|teacher)/i.test(roleName)) {
      return rolePresetOptions.find((rolePreset) => rolePreset.labelKey === 'roleTutor') ?? rolePresetOptions[0];
    }
    return rolePresetOptions[0];
  }

  function defaultProfileInstructionFor(roleInstruction: string) {
    const roleName = roleInstruction.trim() || t.roleAssistant;
    const builtinRole = rolePresetOptions.find((rolePreset) => t[rolePreset.labelKey].toLowerCase() === roleName.toLowerCase());
    return builtinRole ? t[builtinRole.profileInstructionKey] : fillTemplate(t.customRoleDefaultInstruction, { role: roleName });
  }

  function applyRole(roleInstruction: string) {
    const nextRole = roleInstruction.trim() || t.roleAssistant;
    const roleProfile = roleRunProfileFor(nextRole);
    const preset = modelPresetOptions.find((entry) => entry.id === roleProfile.presetId) ?? modelPresetOptions[0];
    onChange((current) => ({
      ...current,
      roleInstruction: nextRole,
      presetId: preset.id,
      profileInstruction: current.profileInstructionsByRole[nextRole] ?? defaultProfileInstructionFor(nextRole),
      temperature: roleProfile.temperature,
      maxTokens: roleProfile.maxTokens
    }));
  }

  function selectBuiltinRole(roleInstruction: string) {
    setCustomRole('');
    setEditingCustomRole(null);
    setCustomRoleDraftInstruction('');
    applyRole(roleInstruction);
    setProfileOpen(false);
  }

  function selectCustomRole(roleInstruction: string) {
    setCustomRole(roleInstruction);
    setEditingCustomRole(roleInstruction);
    setCustomRoleDraftInstruction('');
    applyRole(roleInstruction);
    setProfileOpen(false);
  }

  function startCustomRoleCreate() {
    setCustomRole('');
    setEditingCustomRole('');
    setCustomRoleDraftInstruction('');
    window.requestAnimationFrame(() => customRoleInputRef.current?.focus());
  }

  function resetCurrentProfileInstruction() {
    const nextInstruction = defaultProfileInstructionFor(settings.roleInstruction || t.roleAssistant);
    onChange((current) => ({
      ...current,
      profileInstruction: nextInstruction,
      profileInstructionsByRole: {
        ...current.profileInstructionsByRole,
        [current.roleInstruction || t.roleAssistant]: nextInstruction
      }
    }));
  }

  function commitCustomRole() {
    const nextRole = customRole.trim();
    if (!nextRole) {
      return;
    }
    const builtinRole = builtinRoleLabels.find((role) => role.toLowerCase() === nextRole.toLowerCase());
    const roleProfile = roleRunProfileFor(nextRole);
    const preset = modelPresetOptions.find((entry) => entry.id === roleProfile.presetId) ?? modelPresetOptions[0];

    if (editingCustomRole && editingCustomRole !== nextRole) {
      const nextRoles = builtinRole
        ? customRoles.filter((role) => role !== editingCustomRole)
        : customRoles.map((role) => (role === editingCustomRole ? nextRole : role)).filter((role, index, roles) => roles.findIndex((item) => item.toLowerCase() === role.toLowerCase()) === index);
      setCustomRoles(nextRoles);
      writeCustomRoles(nextRoles);
      onChange((current) => {
        const movedInstruction = current.profileInstructionsByRole[editingCustomRole] ?? (current.profileInstruction || defaultProfileInstructionFor(editingCustomRole));
        const nextProfileInstructions = Object.fromEntries(Object.entries(current.profileInstructionsByRole).filter(([role]) => role !== editingCustomRole));
        if (!builtinRole) {
          nextProfileInstructions[nextRole] = movedInstruction;
        }
        return {
          ...current,
          roleInstruction: builtinRole ?? nextRole,
          presetId: preset.id,
          profileInstruction: builtinRole ? nextProfileInstructions[builtinRole] ?? defaultProfileInstructionFor(builtinRole) : movedInstruction,
          profileInstructionsByRole: nextProfileInstructions,
          temperature: roleProfile.temperature,
          maxTokens: roleProfile.maxTokens
        };
      });
      setEditingCustomRole(builtinRole ? null : nextRole);
      setCustomRole(builtinRole ? '' : nextRole);
      setCustomRoleDraftInstruction('');
      return;
    }

    if (!editingCustomRole) {
      if (!builtinRole && !customRoles.some((role) => role.toLowerCase() === nextRole.toLowerCase())) {
        const nextRoles = [...customRoles, nextRole];
        setCustomRoles(nextRoles);
        writeCustomRoles(nextRoles);
      }

      onChange((current) => {
        if (builtinRole) {
          return {
            ...current,
            roleInstruction: builtinRole,
            presetId: preset.id,
            profileInstruction: current.profileInstructionsByRole[builtinRole] ?? defaultProfileInstructionFor(builtinRole),
            temperature: roleProfile.temperature,
            maxTokens: roleProfile.maxTokens
          };
        }
        return {
          ...current,
          roleInstruction: nextRole,
          presetId: preset.id,
          profileInstruction: customRoleDraftInstruction,
          profileInstructionsByRole: {
            ...current.profileInstructionsByRole,
            [nextRole]: customRoleDraftInstruction
          },
          temperature: roleProfile.temperature,
          maxTokens: roleProfile.maxTokens
        };
      });
      setEditingCustomRole(builtinRole ? null : nextRole);
      setCustomRole(builtinRole ? '' : nextRole);
      setCustomRoleDraftInstruction('');
      return;
    }

    if (!builtinRole && !customRoles.some((role) => role.toLowerCase() === nextRole.toLowerCase())) {
      const nextRoles = [...customRoles, nextRole];
      setCustomRoles(nextRoles);
      writeCustomRoles(nextRoles);
    }

    applyRole(nextRole);
    setEditingCustomRole(builtinRole ? null : nextRole);
    setCustomRole(builtinRole ? '' : nextRole);
    setCustomRoleDraftInstruction('');
  }

  function deleteCustomRole(role: string) {
    const nextRoles = customRoles.filter((item) => item !== role);
    setCustomRoles(nextRoles);
    writeCustomRoles(nextRoles);
    if (editingCustomRole === role) {
      setCustomRole('');
      setEditingCustomRole(null);
    }
    if (settings.roleInstruction === role) {
      const nextProfileInstructions = Object.fromEntries(Object.entries(settings.profileInstructionsByRole).filter(([key]) => key !== role));
      onChange((current) => ({ ...current, roleInstruction: t.roleAssistant, profileInstruction: nextProfileInstructions[t.roleAssistant] ?? defaultProfileInstructionFor(t.roleAssistant), profileInstructionsByRole: nextProfileInstructions }));
      return;
    }
    onChange((current) => {
      const nextProfileInstructions = Object.fromEntries(Object.entries(current.profileInstructionsByRole).filter(([key]) => key !== role));
      return { ...current, profileInstructionsByRole: nextProfileInstructions };
    });
  }

  function handleCustomRoleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (!disabled && customRole.trim()) {
      commitCustomRole();
    }
  }

  useEffect(() => {
    const roleProfile = roleRunProfileFor(settings.roleInstruction || t.roleAssistant);
    if (settings.presetId === roleProfile.presetId) {
      return;
    }
    onChange((current) => ({
      ...current,
      presetId: roleProfile.presetId,
      profileInstruction: current.profileInstructionsByRole[current.roleInstruction || t.roleAssistant] ?? (current.profileInstruction || defaultProfileInstructionFor(current.roleInstruction || t.roleAssistant)),
      temperature: roleProfile.temperature,
      maxTokens: roleProfile.maxTokens
    }));
  }, [settings.presetId, settings.roleInstruction, t, onChange]);

  useEffect(() => {
    const roleName = settings.roleInstruction || t.roleAssistant;
    if (Object.prototype.hasOwnProperty.call(settings.profileInstructionsByRole, roleName) || settings.profileInstruction.trim()) {
      return;
    }
    const nextInstruction = defaultProfileInstructionFor(roleName);
    onChange((current) => ({
      ...current,
      profileInstruction: nextInstruction,
      profileInstructionsByRole: {
        ...current.profileInstructionsByRole,
        [roleName]: nextInstruction
      }
    }));
  }, [settings.profileInstruction, settings.profileInstructionsByRole, settings.roleInstruction, t, onChange]);

  return (
    <div className="composer-toolbar" aria-label={t.composerToolbar} ref={settingsRef}>
      <button
        className="composer-run-trigger"
        type="button"
        onClick={() => setSettingsOpen((current) => !current)}
        disabled={disabled}
        aria-label={t.composerToolbar}
        data-tooltip={settingsOpen ? undefined : t.composerToolbar}
        aria-haspopup="dialog"
        aria-expanded={settingsOpen}
      >
        <SlidersHorizontal size={15} />
        <span className="composer-run-summary">
          <span className="composer-run-model">{selectedProvider?.name ?? t.noConfiguredModels}</span>
          <span className="composer-run-profile">{profileLabel}</span>
        </span>
        <ChevronDown size={16} />
      </button>
      {settingsOpen ? (
        <div className="composer-run-popover" role="dialog" aria-label={t.composerToolbar}>
          <div className="composer-run-grid">
            <ComposerChoiceSelect
              className="model-field"
              label={t.model}
              value={settings.providerId}
              valueLabel={selectedProvider?.name ?? t.noConfiguredModels}
              disabled={disabled || enabledProviders.length === 0}
              options={enabledProviders.map((provider) => ({ value: provider.id, label: provider.name }))}
              onSelect={(providerId) => onChange((current) => ({ ...current, providerId }))}
            />
            <div className="toolbar-field profile-field composer-profile-select" data-tooltip={profileOpen ? undefined : t.runtimeProfileTooltip} ref={profileRef}>
              <button
                className="composer-profile-trigger"
                type="button"
                onClick={() => {
                  if (!profileOpen && profilePanelRef.current) {
                    profilePanelRef.current.scrollTop = 0;
                  }
                  setProfileOpen((current) => !current);
                }}
                disabled={disabled}
                aria-label={t.runtimeProfile}
                aria-haspopup="dialog"
                aria-expanded={profileOpen}
              >
                <span className="composer-profile-trigger-copy">
                  <span className="composer-profile-trigger-value">{profileLabel}</span>
                </span>
                <ChevronDown size={16} />
              </button>
              {profileOpen ? (
                <div className="composer-profile-panel" role="dialog" aria-label={t.runtimeProfile} ref={profilePanelRef}>
                  <section className="composer-profile-section">
                    <div className="composer-profile-choice-list" role="listbox" aria-label={t.role}>
                      {rolePresetOptions.map((rolePreset) => {
                        const roleLabel = t[rolePreset.labelKey];
                        const selected = !creatingCustomRole && settings.roleInstruction === roleLabel;
                        return (
                          <button key={rolePreset.labelKey} type="button" role="option" aria-selected={selected} className={`composer-profile-option ${selected ? 'active' : ''}`} onClick={() => selectBuiltinRole(roleLabel)}>
                            <span className="composer-profile-check">{selected ? <Check size={16} /> : null}</span>
                            <strong>{roleLabel}</strong>
                          </button>
                        );
                      })}
                      {customRoles.map((role) => {
                        const selected = !creatingCustomRole && settings.roleInstruction === role;
                        return (
                          <div key={role} className={`composer-profile-custom-row ${selected ? 'active' : ''}`} role="option" aria-selected={selected}>
                            <button type="button" className="composer-profile-option composer-profile-custom-option" onClick={() => selectCustomRole(role)}>
                              <span className="composer-profile-check">{selected ? <Check size={16} /> : null}</span>
                              <strong>{role}</strong>
                            </button>
                            <button type="button" className="composer-role-delete" onClick={() => deleteCustomRole(role)} aria-label={`${t.deleteRole}: ${role}`} title={t.deleteRole}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        role="option"
                        aria-selected={creatingCustomRole}
                        className={`composer-profile-option composer-profile-add-option ${creatingCustomRole ? 'active' : ''}`}
                        onClick={startCustomRoleCreate}
                        disabled={disabled}
                      >
                        <span className="composer-profile-check">
                          {creatingCustomRole ? <Check size={16} /> : <Plus size={16} />}
                        </span>
                        <strong>{t.addCustomRole}</strong>
                      </button>
                    </div>
                    {customRoleEditorOpen ? (
                      <div className="composer-profile-inline-create">
                        <input
                          id="composer-custom-role"
                          ref={customRoleInputRef}
                          value={customRole}
                          onChange={(event) => setCustomRole(event.target.value)}
                          onKeyDown={handleCustomRoleKeyDown}
                          placeholder={t.customRolePlaceholder}
                          disabled={disabled}
                        />
                        <button type="button" onClick={commitCustomRole} disabled={disabled || !customRole.trim()}>
                          {editingCustomRole ? t.saveCustomRole : t.addCustomRole}
                        </button>
                      </div>
                    ) : null}
                  </section>

                  <label className="composer-profile-section composer-profile-notes" htmlFor="composer-profile-instruction">
                    <span>
                      {t.runtimeProfileInstruction}
                      <button
                        type="button"
                        onClick={() => {
                          if (creatingCustomRole) {
                            setCustomRoleDraftInstruction('');
                            return;
                          }
                          resetCurrentProfileInstruction();
                        }}
                        disabled={disabled}
                      >
                        <RotateCcw size={13} />
                        {t.resetProfileInstruction}
                      </button>
                    </span>
                    <textarea
                      id="composer-profile-instruction"
                      value={visibleProfileInstruction}
                      onChange={(event) => {
                        const nextInstruction = event.target.value;
                        if (creatingCustomRole) {
                          setCustomRoleDraftInstruction(nextInstruction);
                          return;
                        }
                        onChange((current) => ({
                          ...current,
                          profileInstruction: nextInstruction,
                          profileInstructionsByRole: {
                            ...current.profileInstructionsByRole,
                            [current.roleInstruction || t.roleAssistant]: nextInstruction
                          }
                        }));
                      }}
                      placeholder={t.runtimeProfileInstructionPlaceholder}
                      disabled={disabled}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>

          <div className="composer-run-params">
            <label className="toolbar-range">
              <span>
                <Gauge size={14} />
                {t.temperature}
                <output>{settings.temperature.toFixed(1)}</output>
              </span>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={settings.temperature}
                onChange={(event) => onChange((current) => ({ ...current, temperature: Number(event.target.value) }))}
                disabled={disabled}
              />
            </label>
            <label className="toolbar-number">
              <span>
                <Hash size={14} />
                {t.maxOutput}
              </span>
              <input
                type="number"
                min="256"
                max="32000"
                step="256"
                value={settings.maxTokens}
                onChange={(event) => onChange((current) => ({ ...current, maxTokens: Number(event.target.value) || selectedPreset.maxTokens }))}
                disabled={disabled}
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ComposerChoiceSelect({
  className,
  label,
  value,
  valueLabel,
  disabled,
  options,
  onSelect
}: {
  className: string;
  label: string;
  value: string;
  valueLabel: string;
  disabled: boolean;
  options: Array<{ value: string; label: string }>;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (ref.current?.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function selectOption(nextValue: string) {
    onSelect(nextValue);
    setOpen(false);
  }

  return (
    <div className={`toolbar-field composer-choice-select ${className}`} data-tooltip={open ? undefined : label} ref={ref}>
      <button className="composer-choice-trigger" type="button" onClick={() => setOpen((current) => !current)} disabled={disabled} aria-label={label} aria-haspopup="listbox" aria-expanded={open}>
        <span>{valueLabel}</span>
        <ChevronDown size={16} />
      </button>
      {open ? (
        <div className="composer-choice-menu" role="listbox" aria-label={label}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button key={option.value} type="button" role="option" aria-selected={selected} className={`composer-choice-option ${selected ? 'active' : ''}`} onClick={() => selectOption(option.value)}>
                <span className="composer-choice-check">{selected ? <Check size={16} /> : null}</span>
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

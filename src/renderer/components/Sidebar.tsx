import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Archive, Check, ChevronRight, Ellipsis, FileText, GitBranch, PencilLine, Search, Plus, Trash2 } from 'lucide-react';
import { type CSSProperties, type HTMLAttributes, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_PHASE_ID, type Id, type Phase, type Topic, type WorkspaceSnapshot } from '../../shared/types';
import { Copy, DEFAULT_PHASE_ICON, PHASE_ICON_OPTIONS, View, buildDefaultPhase, defaultPhaseTitle, fillTemplate, isVisiblePhase, isVisibleTopic } from '../appModel';

export function SidebarNavigation({
  snapshot,
  view,
  t,
  phaseDraftRequestId,
  topicDraftRequest,
  onCreatePhase,
  onCreateTopic,
  onUpdatePhase,
  onReorderPhases,
  onUpdateTopic,
  onOpenPhases,
  onOpenPhase,
  onSelectTopic
}: {
  snapshot: WorkspaceSnapshot;
  view: View;
  t: Copy;
  phaseDraftRequestId: number;
  topicDraftRequest: { id: number; phaseId: Id | null };
  onCreatePhase: (input: { title: string; description?: string }) => Promise<boolean> | boolean;
  onCreateTopic: (input: { title: string; phaseId?: string }) => Promise<boolean> | boolean;
  onUpdatePhase: (phaseId: Id, input: { title?: string; icon?: string | null; description?: string; endedAt?: string | null; status?: Phase['status'] }) => void;
  onReorderPhases: (phaseIds: Id[]) => Promise<boolean>;
  onUpdateTopic: (topicId: Id, input: { title?: string; phaseId?: string | null; status?: Topic['status'] }) => void;
  onOpenPhases: () => void;
  onOpenPhase: (phaseId: Id) => void;
  onSelectTopic: (topicId: Id) => void;
}) {
  const [phaseRootMenuOpen, setPhaseRootMenuOpen] = useState(false);
  const [phaseListCollapsed, setPhaseListCollapsed] = useState(false);
  const [phaseDraftOpen, setPhaseDraftOpen] = useState(false);
  const [phaseDraftKey, setPhaseDraftKey] = useState(0);
  const [handledTopicDraftRequestId, setHandledTopicDraftRequestId] = useState(0);
  const [phaseDragSuppressClick, setPhaseDragSuppressClick] = useState(false);
  const phaseRootMenuRef = useRef<HTMLDivElement | null>(null);
  const lastPhaseDraftRequestRef = useRef(phaseDraftRequestId);
  const phaseDragSuppressClickTimerRef = useRef<number | null>(null);
  const activeTopicId = view.type === 'topic' ? view.id : null;
  const visiblePhases = snapshot.phases.filter(isVisiblePhase);
  const phaseById = new Map(visiblePhases.map((phase) => [phase.id, phase]));
  const visibleTopics = snapshot.topics.filter(isVisibleTopic);
  const visiblePhaseIds = visiblePhases.map((phase) => phase.id);
  const visiblePhaseOrderKey = visiblePhaseIds.join('|');
  const unassignedTopics = visibleTopics.filter((topic) => !topic.phaseId || !phaseById.has(topic.phaseId));
  const defaultPhase = buildDefaultPhase(snapshot, t);
  const defaultPhaseLabel = defaultPhaseTitle(snapshot.manifest, t);
  const topicCountByPhase = new Map<Id, number>(visiblePhases.map((phase) => [phase.id, 0]));
  for (const topic of visibleTopics) {
    if (topic.phaseId && topicCountByPhase.has(topic.phaseId)) {
      topicCountByPhase.set(topic.phaseId, (topicCountByPhase.get(topic.phaseId) ?? 0) + 1);
    }
  }
  const activeTopicInSidebar = view.type === 'topic' ? visibleTopics.find((topic) => topic.id === view.id) : undefined;
  const activePhaseId =
    view.type === 'phase'
      ? view.id
      : activeTopicInSidebar
        ? activeTopicInSidebar.phaseId && phaseById.has(activeTopicInSidebar.phaseId)
          ? activeTopicInSidebar.phaseId
          : DEFAULT_PHASE_ID
        : undefined;
  const [expandedPhaseIds, setExpandedPhaseIds] = useState<Id[]>(() => {
    if (activePhaseId) {
      return [activePhaseId];
    }
    return visiblePhases[0] ? [visiblePhases[0].id] : [];
  });
  const [orderedVisiblePhaseIds, setOrderedVisiblePhaseIds] = useState<Id[]>(visiblePhaseIds);
  const phaseDragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const orderedVisiblePhases = orderedVisiblePhaseIds.map((phaseId) => phaseById.get(phaseId)).filter((phase): phase is Phase => Boolean(phase));

  useEffect(() => {
    if (!activePhaseId) {
      return;
    }
    setPhaseListCollapsed(false);
    setExpandedPhaseIds((current) => (current.includes(activePhaseId) ? current : [...current, activePhaseId]));
  }, [activePhaseId]);

  useEffect(() => {
    setOrderedVisiblePhaseIds((current) => (current.length === visiblePhaseIds.length && current.every((phaseId, index) => phaseId === visiblePhaseIds[index]) ? current : visiblePhaseIds));
  }, [visiblePhaseOrderKey]);

  useEffect(() => {
    if (topicDraftRequest.id > 0) {
      setPhaseListCollapsed(false);
    }
  }, [topicDraftRequest.id]);

  useEffect(() => {
    return () => {
      if (phaseDragSuppressClickTimerRef.current) {
        window.clearTimeout(phaseDragSuppressClickTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (phaseDraftRequestId === lastPhaseDraftRequestRef.current) {
      return;
    }
    lastPhaseDraftRequestRef.current = phaseDraftRequestId;
    startPhaseDraft();
  }, [phaseDraftRequestId]);

  function togglePhase(phaseId: Id) {
    setExpandedPhaseIds((current) => (current.includes(phaseId) ? current.filter((id) => id !== phaseId) : [...current, phaseId]));
  }

  function openPhasesOverview() {
    setPhaseRootMenuOpen(false);
    setPhaseListCollapsed(false);
    setExpandedPhaseIds([]);
    onOpenPhases();
  }

  function openPhaseDetails(phaseId: Id) {
    setPhaseListCollapsed(false);
    onOpenPhase(phaseId);
  }

  async function handlePhaseDragEnd(event: DragEndEvent) {
    releasePhaseDragClickSuppression();
    const activePhaseId = String(event.active.id);
    const overPhaseId = event.over ? String(event.over.id) : null;
    if (!overPhaseId || activePhaseId === overPhaseId) {
      return;
    }

    const fromIndex = orderedVisiblePhaseIds.indexOf(activePhaseId);
    const toIndex = orderedVisiblePhaseIds.indexOf(overPhaseId);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    const nextVisiblePhaseIds = arrayMove(orderedVisiblePhaseIds, fromIndex, toIndex);
    setOrderedVisiblePhaseIds(nextVisiblePhaseIds);
    const didPersist = await onReorderPhases(buildManifestPhaseOrder(snapshot.manifest.phaseIds, visiblePhaseIds, nextVisiblePhaseIds));
    if (!didPersist) {
      setOrderedVisiblePhaseIds(visiblePhaseIds);
    }
  }

  function handlePhaseDragStart() {
    if (phaseDragSuppressClickTimerRef.current) {
      window.clearTimeout(phaseDragSuppressClickTimerRef.current);
    }
    setPhaseDragSuppressClick(true);
  }

  function releasePhaseDragClickSuppression() {
    if (phaseDragSuppressClickTimerRef.current) {
      window.clearTimeout(phaseDragSuppressClickTimerRef.current);
    }
    phaseDragSuppressClickTimerRef.current = window.setTimeout(() => {
      setPhaseDragSuppressClick(false);
      phaseDragSuppressClickTimerRef.current = null;
    }, 120);
  }

  useEffect(() => {
    if (!phaseRootMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (phaseRootMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setPhaseRootMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPhaseRootMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [phaseRootMenuOpen]);

  function startPhaseDraft() {
    setPhaseRootMenuOpen(false);
    setPhaseListCollapsed(false);
    onOpenPhases();
    setPhaseDraftKey((current) => current + 1);
    setPhaseDraftOpen(true);
  }

  async function commitPhaseDraft(title: string) {
    const created = await onCreatePhase({ title });
    if (created) {
      setPhaseDraftOpen(false);
    }
    return created;
  }

  function cancelPhaseDraft() {
    setPhaseDraftOpen(false);
  }

  return (
    <nav className="studio-sidebar-nav" aria-label={t.workspace}>
      <section className="studio-nav-block studio-primary-nav">
        <div
          ref={phaseRootMenuRef}
          className="studio-module-header"
          onContextMenu={(event) => {
            event.preventDefault();
            setPhaseRootMenuOpen(true);
          }}
        >
          <button type="button" className={`studio-module-title ${view.type === 'phases' ? 'active' : ''}`} onClick={openPhasesOverview}>
            <GitBranch size={18} />
            <span>{t.phases}</span>
          </button>
          <button type="button" className="studio-module-action" onClick={startPhaseDraft} aria-label={t.newPhase} data-tooltip={t.newPhase}>
            <Plus size={16} />
          </button>
          {phaseRootMenuOpen ? (
            <div
              className="studio-phase-menu studio-nav-section-menu"
              role="menu"
              aria-label={t.managePhase}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <button type="button" role="menuitem" onClick={startPhaseDraft}>
                <Plus size={15} />
                <span>{t.newPhase}</span>
              </button>
            </div>
          ) : null}
        </div>
        {!phaseListCollapsed ? (
          <div className="studio-phase-list">
            <DndContext sensors={phaseDragSensors} collisionDetection={closestCenter} onDragStart={handlePhaseDragStart} onDragEnd={handlePhaseDragEnd} onDragCancel={releasePhaseDragClickSuppression}>
              <SortableContext items={orderedVisiblePhaseIds} strategy={verticalListSortingStrategy}>
                {orderedVisiblePhases.map((phase) => {
                  const phaseTopics = visibleTopics.filter((topic) => topic.phaseId === phase.id);
                  const phaseIsActive = view.type === 'phase' && view.id === phase.id;
                  const containsActiveTopic = phaseTopics.some((topic) => topic.id === activeTopicId);
                  return (
                    <SortableSidebarPhaseGroup
                      key={phase.id}
                      phase={phase}
                      topics={phaseTopics}
                      messagesByTopic={snapshot.messagesByTopic}
                      active={phaseIsActive || containsActiveTopic}
                      expanded={expandedPhaseIds.includes(phase.id)}
                      activeTopicId={activeTopicId}
                      t={t}
                      topicDraftRequest={topicDraftRequest}
                      topicDraftRequestActive={topicDraftRequest.id > handledTopicDraftRequestId}
                      onTopicDraftRequestHandled={() => setHandledTopicDraftRequestId(topicDraftRequest.id)}
                      topicDraftGroupId={phase.id}
                      phaseOptions={visiblePhases}
                      onOpenPhase={() => openPhaseDetails(phase.id)}
                      onToggle={() => togglePhase(phase.id)}
                      onCreateTopic={(title) => onCreateTopic({ title, phaseId: phase.id })}
                      onUpdatePhase={(input) => onUpdatePhase(phase.id, input)}
                      onUpdateTopic={onUpdateTopic}
                      onSelectTopic={onSelectTopic}
                      phaseTopicCounts={topicCountByPhase}
                      defaultPhaseTopicCount={unassignedTopics.length}
                      defaultPhaseTitle={defaultPhaseLabel}
                      dragDisabled={visiblePhases.length <= 1}
                      suppressClickAfterDrag={phaseDragSuppressClick}
                    />
                  );
                })}
              </SortableContext>
            </DndContext>
            {phaseDraftOpen ? <SidebarPhaseDraft key={phaseDraftKey} t={t} onCommit={commitPhaseDraft} onCancel={cancelPhaseDraft} /> : null}
            <SidebarPhaseGroup
              phase={defaultPhase}
              topics={unassignedTopics}
              messagesByTopic={snapshot.messagesByTopic}
              active={activePhaseId === DEFAULT_PHASE_ID}
              expanded={expandedPhaseIds.includes(DEFAULT_PHASE_ID)}
              activeTopicId={activeTopicId}
              t={t}
              topicDraftRequest={topicDraftRequest}
              topicDraftRequestActive={topicDraftRequest.id > handledTopicDraftRequestId}
              onTopicDraftRequestHandled={() => setHandledTopicDraftRequestId(topicDraftRequest.id)}
              topicDraftGroupId={DEFAULT_PHASE_ID}
              phaseOptions={visiblePhases}
              onOpenPhase={() => openPhaseDetails(DEFAULT_PHASE_ID)}
              onToggle={() => togglePhase(DEFAULT_PHASE_ID)}
              onCreateTopic={(title) => onCreateTopic({ title })}
              onUpdatePhase={(input) => onUpdatePhase(DEFAULT_PHASE_ID, input)}
              onUpdateTopic={onUpdateTopic}
              onSelectTopic={onSelectTopic}
              phaseTopicCounts={topicCountByPhase}
              defaultPhaseTopicCount={unassignedTopics.length}
              defaultPhaseTitle={defaultPhaseLabel}
            />
          </div>
        ) : null}
      </section>

    </nav>
  );
}

function buildManifestPhaseOrder(currentPhaseIds: Id[], visiblePhaseIds: Id[], nextVisiblePhaseIds: Id[]): Id[] {
  const visiblePhaseIdSet = new Set(visiblePhaseIds);
  const reorderedVisiblePhaseIds = [...nextVisiblePhaseIds];
  return currentPhaseIds.map((phaseId) => (visiblePhaseIdSet.has(phaseId) ? reorderedVisiblePhaseIds.shift() ?? phaseId : phaseId));
}

function SidebarPhaseDraft({ t, onCommit, onCancel }: { t: Copy; onCommit: (title: string) => Promise<boolean> | boolean; onCancel: () => void }) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const committingRef = useRef(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      inputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function commitDraft() {
    if (committingRef.current) {
      return;
    }
    const title = draft.trim();
    if (!title) {
      onCancel();
      return;
    }
    committingRef.current = true;
    setSaving(true);
    const created = await onCommit(title);
    committingRef.current = false;
    if (!created) {
      setSaving(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="studio-phase-group studio-phase-draft">
      <div className="studio-phase-row">
        <form
          className="studio-phase-rename-form"
          onSubmit={(event) => {
            event.preventDefault();
            void commitDraft();
          }}
        >
          <PhaseIconGlyph icon={null} />
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void commitDraft()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
              }
            }}
            placeholder={t.phaseNameOptional}
            aria-label={t.phaseNameOptional}
            disabled={saving}
          />
        </form>
      </div>
    </div>
  );
}

function PhaseIconGlyph({ icon }: { icon?: string | null }) {
  return icon ? <span className="studio-phase-emoji" aria-hidden="true">{icon}</span> : <span className="studio-phase-fallback-icon" aria-hidden="true">{DEFAULT_PHASE_ICON}</span>;
}

function PhaseIconPicker({ icon, t, onChange }: { icon?: string | null; t: Copy; onChange: (icon: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (pickerRef.current?.contains(event.target as Node)) {
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

  function chooseIcon(nextIcon: string | null) {
    onChange(nextIcon);
    setOpen(false);
  }

  return (
    <span className="studio-phase-icon-picker" ref={pickerRef} onPointerDown={(event) => event.stopPropagation()}>
      <button
        className="studio-phase-icon-button"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        aria-label={t.changePhaseIcon}
        title={t.changePhaseIcon}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <PhaseIconGlyph icon={icon} />
      </button>
      {open ? (
        <div className="studio-phase-icon-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => chooseIcon(null)} title={t.defaultPhaseIcon} aria-label={t.defaultPhaseIcon}>
            <PhaseIconGlyph icon={null} />
          </button>
          {PHASE_ICON_OPTIONS.map((option) => (
            <button key={option} type="button" role="menuitem" onClick={() => chooseIcon(option)} aria-label={option} className={icon === option ? 'active' : ''}>
              <span aria-hidden="true">{option}</span>
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

function SortableSidebarPhaseGroup({
  phase,
  dragDisabled = false,
  ...props
}: Omit<Parameters<typeof SidebarPhaseGroup>[0], 'dragActivatorRef' | 'dragRowProps' | 'dragging' | 'sorting'> & { dragDisabled?: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isSorting } = useSortable({
    id: phase.id,
    disabled: dragDisabled,
    attributes: {
      role: 'listitem',
      roleDescription: props.t.reorderPhase
    },
    transition: { duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div ref={setNodeRef} style={style} className="studio-phase-sortable">
      <SidebarPhaseGroup
        {...props}
        phase={phase}
        dragActivatorRef={dragDisabled ? undefined : setActivatorNodeRef}
        dragRowProps={dragDisabled ? undefined : { ...attributes, ...listeners }}
        dragging={isDragging}
        sorting={isSorting}
      />
    </div>
  );
}

function SidebarPhaseGroup({
  phase,
  topics,
  messagesByTopic,
  active,
  expanded,
  activeTopicId,
  t,
  topicDraftRequest,
  topicDraftRequestActive,
  onTopicDraftRequestHandled,
  topicDraftGroupId,
  phaseOptions,
  onOpenPhase,
  onToggle,
  onCreateTopic,
  onUpdatePhase,
  onUpdateTopic,
  onSelectTopic,
  phaseTopicCounts,
  defaultPhaseTopicCount,
  defaultPhaseTitle,
  dragActivatorRef,
  dragRowProps,
  dragging = false,
  sorting = false,
  suppressClickAfterDrag = false
}: {
  phase: Phase;
  topics: Topic[];
  messagesByTopic: WorkspaceSnapshot['messagesByTopic'];
  active: boolean;
  expanded: boolean;
  activeTopicId: Id | null;
  t: Copy;
  topicDraftRequest: { id: number; phaseId: Id | null };
  topicDraftRequestActive: boolean;
  onTopicDraftRequestHandled: () => void;
  topicDraftGroupId: Id;
  phaseOptions: Phase[];
  onOpenPhase: () => void;
  onToggle: () => void;
  onCreateTopic: (title: string) => Promise<boolean> | boolean;
  onUpdatePhase: (input: { title?: string; icon?: string | null; endedAt?: string | null; status?: Phase['status'] }) => void;
  onUpdateTopic: (topicId: Id, input: { title?: string; phaseId?: string | null; status?: Topic['status'] }) => void;
  onSelectTopic: (topicId: Id) => void;
  phaseTopicCounts: Map<Id, number>;
  defaultPhaseTopicCount: number;
  defaultPhaseTitle: string;
  dragActivatorRef?: (element: HTMLDivElement | null) => void;
  dragRowProps?: HTMLAttributes<HTMLDivElement>;
  dragging?: boolean;
  sorting?: boolean;
  suppressClickAfterDrag?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [topicDraftOpen, setTopicDraftOpen] = useState(false);
  const [topicDraftKey, setTopicDraftKey] = useState(0);
  const [draft, setDraft] = useState(phase.title);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!renaming) {
      setDraft(phase.title);
    }
  }, [phase.title, renaming]);

  useEffect(() => {
    if (!topicDraftRequestActive) {
      return;
    }
    const targetGroupId = topicDraftRequest.phaseId ?? DEFAULT_PHASE_ID;
    if (targetGroupId === topicDraftGroupId) {
      startTopicDraft();
      onTopicDraftRequestHandled();
    }
  }, [topicDraftRequestActive, topicDraftRequest.phaseId, topicDraftGroupId, onTopicDraftRequestHandled]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!renaming) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [renaming]);

  function startRename() {
    setMenuOpen(false);
    setDraft(phase.title);
    setRenaming(true);
  }

  function commitRename() {
    const nextTitle = draft.trim();
    setRenaming(false);
    if (!nextTitle) {
      setDraft(phase.title);
      return;
    }
    if (nextTitle !== phase.title) {
      onUpdatePhase({ title: nextTitle });
      return;
    }
    setDraft(phase.title);
  }

  function cancelRename() {
    setDraft(phase.title);
    setRenaming(false);
  }

  function openPhaseDetails() {
    setMenuOpen(false);
    onOpenPhase();
  }

  function deletePhase() {
    setMenuOpen(false);
    onUpdatePhase({ status: 'trashed' });
  }

  function reactivatePhase() {
    setMenuOpen(false);
    onUpdatePhase({ endedAt: null, status: 'active' });
  }

  function createTopicInPhase() {
    setMenuOpen(false);
    startTopicDraft();
  }

  function startTopicDraft() {
    onOpenPhase();
    if (!expanded) {
      onToggle();
    }
    setTopicDraftKey((current) => current + 1);
    setTopicDraftOpen(true);
  }

  async function commitTopicDraft(title: string) {
    const created = await onCreateTopic(title);
    if (created) {
      setTopicDraftOpen(false);
    }
    return created;
  }

  function cancelTopicDraft() {
    setTopicDraftOpen(false);
  }

  const rowDragEnabled = Boolean(dragRowProps) && !renaming;

  return (
    <div className={`studio-phase-group ${active ? 'active' : ''} ${expanded ? 'expanded' : 'collapsed'} ${dragging ? 'dragging' : ''} ${sorting ? 'sorting' : ''}`}>
      <div
        ref={rowDragEnabled ? dragActivatorRef : undefined}
        className={`studio-phase-row ${rowDragEnabled ? 'draggable' : ''}`}
        aria-label={rowDragEnabled ? `${t.reorderPhase}: ${phase.title}` : undefined}
        onClickCapture={(event) => {
          if (!suppressClickAfterDrag) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenuOpen(true);
        }}
        {...(rowDragEnabled ? dragRowProps : undefined)}
      >
        {renaming ? (
          <form
            className="studio-phase-rename-form"
            onPointerDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              commitRename();
            }}
          >
            <PhaseIconGlyph icon={phase.icon} />
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelRename();
                }
              }}
              aria-label={t.phaseNameOptional}
            />
          </form>
        ) : (
          <>
            <PhaseIconPicker icon={phase.icon} t={t} onChange={(icon) => onUpdatePhase({ icon })} />
            <div className="studio-phase-main">
              <button
                className="studio-phase-title-button"
                type="button"
                onClick={() => {
                  onToggle();
                  onOpenPhase();
                }}
                aria-label={expanded ? t.collapsePhase : t.expandPhase}
                aria-expanded={expanded}
              >
                <span className="studio-phase-title-text">{phase.title}</span>
              </button>
            </div>
          </>
        )}
        <span className="studio-phase-trailing" ref={menuRef} onPointerDown={(event) => event.stopPropagation()}>
          {phase.endedAt ? <Archive className="studio-phase-archived" size={14} aria-label={t.phaseArchived} /> : null}
          {topics.length > 0 ? <span className="studio-count">{fillTemplate(t.topicCountLabel, { count: topics.length })}</span> : null}
          <button className="studio-phase-menu-button" type="button" onClick={() => setMenuOpen((current) => !current)} aria-label={t.managePhase} title={t.managePhase} aria-haspopup="menu" aria-expanded={menuOpen}>
            <Ellipsis size={16} />
          </button>
          {menuOpen ? (
            <div className="studio-phase-menu" role="menu">
              <button type="button" role="menuitem" onClick={createTopicInPhase}>
                <Plus size={15} />
                <span>{t.newTopic}</span>
              </button>
              <button type="button" role="menuitem" onClick={openPhaseDetails}>
                <FileText size={15} />
                <span>{t.phaseDetails}</span>
              </button>
              <button type="button" role="menuitem" onClick={startRename}>
                <PencilLine size={15} />
                <span>{t.rename}</span>
              </button>
              {phase.endedAt ? (
                <button type="button" role="menuitem" onClick={reactivatePhase}>
                  <Check size={15} />
                  <span>{t.reactivatePhase}</span>
                </button>
              ) : null}
              <button type="button" role="menuitem" onClick={deletePhase}>
                <Trash2 size={15} />
                <span>{t.deletePhase}</span>
              </button>
            </div>
          ) : null}
        </span>
      </div>
      <div className="studio-phase-children" aria-hidden={!expanded}>
        <div className="studio-phase-children-inner">
          <div className="studio-phase-branch">
            {topics.length > 0 || topicDraftOpen ? (
              <div className="studio-topic-list">
                {topics.map((topic) => (
                  <SidebarTopicRow
                    key={topic.id}
                    topic={topic}
                    count={messagesByTopic[topic.id]?.length ?? 0}
                    active={activeTopicId === topic.id}
                    onSelect={() => onSelectTopic(topic.id)}
                    onRename={(title) => onUpdateTopic(topic.id, { title })}
                    onMoveToPhase={(phaseId) => onUpdateTopic(topic.id, { phaseId })}
                    onMoveToTrash={() => onUpdateTopic(topic.id, { status: 'trashed' })}
                    phaseOptions={phaseOptions}
                    phaseTopicCounts={phaseTopicCounts}
                    defaultPhaseTopicCount={defaultPhaseTopicCount}
                    defaultPhaseTitle={defaultPhaseTitle}
                    t={t}
                  />
                ))}
                {topicDraftOpen ? <SidebarTopicDraft key={topicDraftKey} t={t} onCommit={commitTopicDraft} onCancel={cancelTopicDraft} /> : null}
              </div>
            ) : (
              <div className="studio-topic-track-empty">
                <p className="studio-empty-line">{t.noTopicsAssigned}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarTopicRow({
  topic,
  count,
  active,
  t,
  onSelect,
  onRename,
  onMoveToPhase,
  onMoveToTrash,
  phaseOptions,
  phaseTopicCounts,
  defaultPhaseTopicCount,
  defaultPhaseTitle
}: {
  topic: Topic;
  count: number;
  active: boolean;
  t: Copy;
  onSelect: () => void;
  onRename: (title: string) => void;
  onMoveToPhase: (phaseId: string | null) => void;
  onMoveToTrash: () => void;
  phaseOptions: Phase[];
  phaseTopicCounts: Map<Id, number>;
  defaultPhaseTopicCount: number;
  defaultPhaseTitle: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [movePanelOpen, setMovePanelOpen] = useState(false);
  const [phaseSearch, setPhaseSearch] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(topic.title);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [movePanelPosition, setMovePanelPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const movePanelRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLButtonElement | null>(null);
  const moveButtonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const phaseSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!renaming) {
      setDraft(topic.title);
    }
  }, [topic.title, renaming]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current?.contains(event.target as Node) || popoverRef.current?.contains(event.target as Node) || movePanelRef.current?.contains(event.target as Node)) {
        return;
      }
      setMenuOpen(false);
      setMovePanelOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setMovePanelOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!renaming) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [renaming]);

  useEffect(() => {
    if (!menuOpen || !movePanelOpen) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      phaseSearchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [menuOpen, movePanelOpen]);

  function clampMenuPosition(next: { x: number; y: number }, menuHeight = 176, menuWidth = 168) {
    const viewportGap = 8;
    return {
      x: Math.min(Math.max(viewportGap, next.x), window.innerWidth - menuWidth - viewportGap),
      y: Math.min(Math.max(viewportGap, next.y), window.innerHeight - menuHeight - viewportGap)
    };
  }

  function positionMovePanel(basePosition = menuPosition) {
    const menuWidth = 168;
    const panelWidth = 360;
    const panelHeight = 360;
    const gap = 6;
    const viewportGap = 8;
    const triggerRect = moveButtonRef.current?.getBoundingClientRect();
    const opensRight = basePosition.x + menuWidth + gap + panelWidth <= window.innerWidth - viewportGap;
    const x = opensRight ? basePosition.x + menuWidth + gap : basePosition.x - panelWidth - gap;
    const y = triggerRect ? triggerRect.top - 8 : basePosition.y;
    setMovePanelPosition(clampMenuPosition({ x, y }, panelHeight, panelWidth));
  }

  function openMenu(position?: { x: number; y: number }) {
    setMovePanelOpen(false);
    setPhaseSearch('');

    const rect = rowRef.current?.getBoundingClientRect();
    const nextPosition = clampMenuPosition(
      rect
        ? {
            x: rect.right - 168,
            y: rect.bottom + 6
          }
        : (position ?? { x: 8, y: 8 })
    );
    setMenuPosition(nextPosition);
    setMenuOpen(true);
  }

  function startRename() {
    setMenuOpen(false);
    setDraft(topic.title);
    setRenaming(true);
  }

  function commitRename() {
    const nextTitle = draft.trim();
    setRenaming(false);
    if (!nextTitle) {
      setDraft(topic.title);
      return;
    }
    if (nextTitle !== topic.title) {
      onRename(nextTitle);
      return;
    }
    setDraft(topic.title);
  }

  function cancelRename() {
    setDraft(topic.title);
    setRenaming(false);
  }

  function moveToTrash() {
    setMenuOpen(false);
    setMovePanelOpen(false);
    onMoveToTrash();
  }

  function openMovePanel() {
    setPhaseSearch('');
    positionMovePanel();
    setMovePanelOpen(true);
  }

  function choosePhase(phaseId: string | null) {
    setMenuOpen(false);
    setMovePanelOpen(false);
    onMoveToPhase(phaseId);
  }

  const currentPhaseId = topic.phaseId && phaseOptions.some((phase) => phase.id === topic.phaseId) ? topic.phaseId : null;
  const phaseChoices = [
    { id: null, title: defaultPhaseTitle, count: defaultPhaseTopicCount },
    ...phaseOptions.map((phase) => ({ id: phase.id, title: phase.title, count: phaseTopicCounts.get(phase.id) ?? 0 }))
  ];
  const normalizedPhaseSearch = phaseSearch.trim().toLowerCase();
  const filteredPhaseChoices = normalizedPhaseSearch
    ? phaseChoices.filter((phase) => phase.title.toLowerCase().includes(normalizedPhaseSearch))
    : phaseChoices;
  const showPhaseSearch = phaseChoices.length > 6;
  const messageCountLabel = `${count} ${t.messages}`;
  const visibleMessageCount = count > 0 ? String(count) : '';

  const topicMenu = menuOpen
    ? createPortal(
        <>
          <div ref={popoverRef} className="studio-topic-menu" role="menu" style={{ left: menuPosition.x, top: menuPosition.y }}>
            <button type="button" role="menuitem" onClick={startRename}>
              <PencilLine size={15} />
              <span>{t.rename}</span>
            </button>
            <button
              ref={moveButtonRef}
              type="button"
              role="menuitem"
              className={movePanelOpen ? 'active' : ''}
              onMouseEnter={openMovePanel}
              onFocus={openMovePanel}
              onClick={openMovePanel}
              aria-haspopup="menu"
              aria-expanded={movePanelOpen}
            >
              <GitBranch size={15} />
              <span>{t.moveTopicToPhase}</span>
              <ChevronRight className="studio-menu-trailing-icon" size={15} />
            </button>
            <button type="button" role="menuitem" className="danger" onClick={moveToTrash}>
              <Trash2 size={15} />
              <span>{t.moveTopicToTrash}</span>
            </button>
          </div>
          {movePanelOpen ? (
            <div ref={movePanelRef} className="studio-topic-menu studio-topic-submenu" role="menu" style={{ left: movePanelPosition.x, top: movePanelPosition.y }}>
              <div className="studio-topic-submenu-title">
                <GitBranch size={15} />
                <span>{t.moveTopicToPhase}</span>
              </div>
              {showPhaseSearch ? (
                <label className="studio-phase-search">
                  <Search size={14} />
                  <input ref={phaseSearchRef} value={phaseSearch} onChange={(event) => setPhaseSearch(event.target.value)} placeholder={t.searchPhases} aria-label={t.searchPhases} />
                </label>
              ) : null}
              <div className="studio-phase-choice-list" role="listbox" aria-label={t.moveTopicToPhase}>
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
                      className={`studio-phase-choice ${selected ? 'current' : ''}`}
                      onClick={() => choosePhase(phase.id)}
                    >
                      <span className="studio-phase-choice-check">{selected ? <Check size={15} /> : null}</span>
                      <span className="studio-phase-choice-title">{phase.title}</span>
                      <small>{fillTemplate(t.topicCountLabel, { count: phase.count })}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>,
        document.body
      )
    : null;

  return (
    <div className="studio-topic-item" ref={menuRef}>
      {renaming ? (
        <form
          className={`studio-topic-row studio-topic-rename-form ${active ? 'active' : ''}`}
          onSubmit={(event) => {
            event.preventDefault();
            commitRename();
          }}
        >
          <FileText className="studio-topic-icon" size={16} />
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelRename();
              }
            }}
            aria-label={t.topicNameOptional}
          />
          <span className={`studio-message-count ${count === 0 ? 'empty' : ''}`} title={messageCountLabel} aria-label={messageCountLabel}>
            {visibleMessageCount}
          </span>
        </form>
      ) : (
        <button
          ref={rowRef}
          className={`studio-topic-row ${active ? 'active' : ''}`}
          type="button"
          onClick={onSelect}
          onContextMenu={(event) => {
            event.preventDefault();
            openMenu({ x: event.clientX, y: event.clientY });
          }}
          onKeyDown={(event) => {
            if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
              event.preventDefault();
              openMenu();
            }
          }}
        >
          <FileText className="studio-topic-icon" size={16} />
          <span className="studio-topic-title">{topic.title}</span>
          <span className={`studio-message-count ${count === 0 ? 'empty' : ''}`} title={messageCountLabel} aria-label={messageCountLabel}>
            {visibleMessageCount}
          </span>
        </button>
      )}
      {topicMenu}
    </div>
  );
}

function SidebarTopicDraft({ t, onCommit, onCancel }: { t: Copy; onCommit: (title: string) => Promise<boolean> | boolean; onCancel: () => void }) {
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const committingRef = useRef(false);

  useEffect(() => {
    function revealDraftInput() {
      inputRef.current?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      inputRef.current?.focus({ preventScroll: true });
    }

    const frame = window.requestAnimationFrame(revealDraftInput);
    const timeout = window.setTimeout(revealDraftInput, 190);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, []);

  async function commitDraft() {
    if (committingRef.current) {
      return;
    }
    const title = draft.trim();
    if (!title) {
      onCancel();
      return;
    }
    committingRef.current = true;
    setSaving(true);
    const created = await onCommit(title);
    committingRef.current = false;
    if (!created) {
      setSaving(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="studio-topic-item studio-topic-draft">
      <form
        className="studio-topic-row studio-topic-rename-form active"
        onSubmit={(event) => {
          event.preventDefault();
          void commitDraft();
        }}
      >
        <FileText className="studio-topic-icon" size={16} />
        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void commitDraft()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
          placeholder={t.topicNamePlaceholder}
          aria-label={t.topicNamePlaceholder}
          disabled={saving}
        />
        <span className="studio-message-count empty" aria-hidden="true" />
      </form>
    </div>
  );
}

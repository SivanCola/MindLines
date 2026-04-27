import { Check, FileText, ListPlus, MoreHorizontal, Plus, Sparkles, Square, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPhaseCartItem, createPhaseSummaryCartItem } from '../../shared/cart';
import type { Id, Phase, SelectionCartItem, Topic, WorkspaceSnapshot } from '../../shared/types';
import { Copy, SummaryGenerationState, defaultPhaseTitle, fillTemplate, getApi, isVisibleTopic } from '../appModel';
import { MarkdownContent, SummaryActions, SummaryActivity } from './ConversationPrimitives';
import { InlineTitleEditor } from './InlineTitleEditor';

export function PhaseView({
  snapshot,
  phase,
  t,
  summaryGeneration,
  onAddToCart,
  onRequestCreateTopic,
  onEnd,
  onUpdatePhase,
  onSummarize,
  onOpenTopic
}: {
  snapshot: WorkspaceSnapshot;
  phase: Phase;
  t: Copy;
  summaryGeneration: SummaryGenerationState | null;
  onAddToCart: (item: SelectionCartItem) => void;
  onRequestCreateTopic: () => void;
  onEnd: (phaseId: Id) => void;
  onUpdatePhase: (phaseId: Id, input: { title?: string; icon?: string | null; description?: string; endedAt?: string | null; status?: Phase['status'] }) => void;
  onSummarize: (phaseId: Id) => void;
  onOpenTopic: (topicId: Id) => void;
}) {
  const topics = useMemo(() => phase.topicIds.map((topicId) => snapshot.topics.find((topic) => topic.id === topicId && isVisibleTopic(topic))).filter((topic): topic is Topic => Boolean(topic)), [phase.topicIds, snapshot.topics]);
  const summary = snapshot.phaseSummaries[phase.id];
  const phaseViewRef = useRef<HTMLElement | null>(null);
  const summaryActivityRef = useRef<HTMLDivElement | null>(null);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement | null>(null);

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
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      phaseViewRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase.id]);

  useEffect(() => {
    if (summaryGeneration) {
      const frame = window.requestAnimationFrame(() => {
        summaryActivityRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [summaryGeneration]);

  return (
    <article ref={phaseViewRef} className="detail-view phase-detail-view">
      <header className="detail-header">
        <div className="phase-header-main">
          <InlineTitleEditor value={phase.title} ariaLabel={t.phaseNameOptional} onSave={(title) => onUpdatePhase(phase.id, { title })} />
          <p className="detail-subtitle topic-meta-line">
            <span>{fillTemplate(t.topicCountLabel, { count: topics.length })}</span>
            <span aria-hidden="true">·</span>
            <span>{phase.endedAt ? `${t.ended} ${new Date(phase.endedAt).toLocaleString()}` : `${t.started} ${new Date(phase.startedAt).toLocaleString()}`}</span>
          </p>
        </div>
        <div className="header-actions">
          <button className="detail-action-button primary" type="button" onClick={onRequestCreateTopic} aria-label={t.newTopic} data-tooltip={t.newTopic}>
            <Plus size={17} />
          </button>
          <button className="detail-action-button primary" type="button" onClick={() => onSummarize(phase.id)} disabled={Boolean(summaryGeneration)} aria-label={t.summarize} data-tooltip={t.summarize}>
            <Sparkles size={16} />
          </button>
          {!phase.endedAt ? (
            <button className="detail-action-button" type="button" onClick={() => onEnd(phase.id)} aria-label={t.end} data-tooltip={t.end}>
              <Check size={16} />
            </button>
          ) : null}
          <button className="detail-action-button primary" type="button" onClick={() => onAddToCart(createPhaseCartItem(phase))} aria-label={t.addPhase} data-tooltip={t.addPhase}>
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
                  className="detail-menu-action"
                  onClick={() => {
                    setMoreActionsOpen(false);
                    void getApi().exportPhaseMarkdown(phase.id, t.chinese === '中文' ? 'zh' : 'en');
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

      <section className={`summary-block phase-summary-block ${summaryGeneration ? 'generating' : ''}`} aria-live="polite">
        <div className="block-title">
          <h3 className="summary-title">
            <Sparkles size={16} style={{ color: 'var(--accent)', marginRight: '0.35rem', flexShrink: 0 }} />
            {t.phaseSummary}
          </h3>
          {summary ? (
            <SummaryActions content={summary.content} disabled={Boolean(summaryGeneration)} t={t} onAdd={() => onAddToCart(createPhaseSummaryCartItem(phase, summary))} />
          ) : null}
        </div>
        <div ref={summaryActivityRef}>
          {summaryGeneration ? <SummaryActivity summaryGeneration={summaryGeneration} t={t} /> : null}
        </div>
        {summary ? <MarkdownContent content={summary.content} t={t} /> : <p>{t.noPhaseSummaryYet}</p>}
      </section>

      <section className="topic-grid">
        {topics.length === 0 ? (
          <div className="empty-inline">
            <Square size={22} />
            <p>{t.noTopicsAssigned}</p>
          </div>
        ) : (
          topics.map((topic) => (
            <button key={topic.id} className="topic-tile" onClick={() => onOpenTopic(topic.id)}>
              <span>{topic.title}</span>
              <small>{snapshot.messagesByTopic[topic.id]?.length ?? 0} {t.messages}</small>
            </button>
          ))
        )}
      </section>
    </article>
  );
}

export function TrashView({
  snapshot,
  t,
  onRestoreTopic,
  onRestorePhase,
  onClearTrash
}: {
  snapshot: WorkspaceSnapshot;
  t: Copy;
  onRestoreTopic: (topicId: Id) => void;
  onRestorePhase: (phaseId: Id) => void;
  onClearTrash: () => void;
}) {
  const phaseById = new Map(snapshot.phases.map((phase) => [phase.id, phase]));
  const fallbackDefaultPhaseTitle = defaultPhaseTitle(snapshot.manifest, t);
  const trashedTopics = snapshot.topics.filter((topic) => topic.status === 'trashed');
  const trashedPhases = snapshot.phases.filter((phase) => phase.status === 'trashed');
  const standaloneTrashedTopics = trashedTopics.filter((topic) => !topic.phaseId || phaseById.get(topic.phaseId)?.status !== 'trashed');
  const isEmpty = trashedPhases.length === 0 && standaloneTrashedTopics.length === 0;

  return (
    <article className="detail-view trash-view">
      <header className="detail-header top-level-entry-header workspace-home-header">
        <div className="workspace-home-title">
          <p className="eyebrow">{t.trash}</p>
          <h2>{t.trash}</h2>
          <p className="detail-subtitle">{t.trashHelp}</p>
        </div>
        {!isEmpty ? (
          <div className="header-actions">
            <button className="trash-clear-button" type="button" onClick={onClearTrash}>
              <Trash2 size={15} />
              <span>{t.clearTrash}</span>
            </button>
          </div>
        ) : null}
      </header>

      {isEmpty ? (
        <section className="empty-inline trash-empty">
          <Trash2 size={24} />
          <p>{t.trashEmpty}</p>
        </section>
      ) : (
        <section className="trash-list" aria-label={t.trash}>
          {trashedPhases.map((phase) => {
            const topicCount = phase.topicIds.filter((topicId) => snapshot.topics.some((topic) => topic.id === topicId)).length;
            return (
              <article className="trash-item" key={phase.id}>
                <div>
                  <h3>{phase.title}</h3>
                  <p className="muted">
                    {t.phase} · {fillTemplate(t.topicCountLabel, { count: topicCount })}
                  </p>
                </div>
                <button type="button" onClick={() => onRestorePhase(phase.id)}>
                  <Check size={16} />
                  {t.restorePhase}
                </button>
              </article>
            );
          })}
          {standaloneTrashedTopics.map((topic) => {
            const phaseName = topic.phaseId ? phaseById.get(topic.phaseId)?.title : undefined;
            const messageCount = snapshot.messagesByTopic[topic.id]?.length ?? 0;
            return (
              <article className="trash-item" key={topic.id}>
                <div>
                  <h3>{topic.title}</h3>
                  <p className="muted">
                    {phaseName ?? fallbackDefaultPhaseTitle} · {messageCount} {t.messages}
                  </p>
                </div>
                <button type="button" onClick={() => onRestoreTopic(topic.id)}>
                  <Check size={16} />
                  {t.restoreTopic}
                </button>
              </article>
            );
          })}
        </section>
      )}
    </article>
  );
}

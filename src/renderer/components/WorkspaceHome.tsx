import { Clock3, FileText, GitBranch, MessageSquareText, Plus, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type { Id, Phase, WorkspaceSnapshot } from '../../shared/types';
import { Copy, defaultPhaseTitle, fillTemplate, isVisiblePhase, isVisibleTopic } from '../appModel';

export function WorkspaceHome({
  snapshot,
  t,
  onRequestCreatePhase,
  onRequestCreateTopic,
  onOpenPhase
}: {
  snapshot: WorkspaceSnapshot;
  t: Copy;
  onRequestCreatePhase: () => void;
  onRequestCreateTopic: () => void;
  onOpenPhase: (phaseId: Id) => void;
}) {
  const visiblePhases = useMemo(() => snapshot.phases.filter(isVisiblePhase), [snapshot.phases]);
  const visibleTopics = useMemo(() => snapshot.topics.filter(isVisibleTopic), [snapshot.topics]);
  const phaseById = useMemo(() => new Map(visiblePhases.map((phase) => [phase.id, phase])), [visiblePhases]);
  const fallbackDefaultPhaseTitle = defaultPhaseTitle(snapshot.manifest, t);
  const messageCount = visibleTopics.reduce((total, topic) => total + (snapshot.messagesByTopic[topic.id]?.length ?? 0), 0);
  const summarizedPhaseCount = visiblePhases.filter((phase) => Boolean(snapshot.phaseSummaries[phase.id])).length;
  const unassignedTopicCount = visibleTopics.filter((topic) => !topic.phaseId || !phaseById.has(topic.phaseId)).length;
  const recentPhases = [...visiblePhases]
    .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())
    .slice(0, 6);
  const isEmpty = visiblePhases.length === 0 && visibleTopics.length === 0;

  function phaseTopicCount(phase: Phase) {
    return phase.topicIds.filter((topicId) => visibleTopics.some((topic) => topic.id === topicId)).length;
  }

  return (
    <article className="detail-view workspace-home-view">
      <header className="detail-header top-level-entry-header workspace-home-header">
        <div className="workspace-home-title">
          <p className="eyebrow">{t.workspaceOverview}</p>
          <h2>{t.workspaceOverview}</h2>
          <p className="detail-subtitle">{t.workspaceOverviewHelp}</p>
        </div>
        <div className="header-actions">
          <button className="detail-action-button primary" type="button" onClick={onRequestCreatePhase} aria-label={t.newPhase} data-tooltip={t.newPhase}>
            <GitBranch size={16} />
          </button>
          <button className="detail-action-button" type="button" onClick={onRequestCreateTopic} aria-label={t.newTopic} data-tooltip={t.newTopic}>
            <Plus size={17} />
          </button>
        </div>
      </header>

      <section className="workspace-home-stats" aria-label={t.workspaceStats}>
        <WorkspaceStat icon={<GitBranch size={18} />} label={t.phases} value={visiblePhases.length} />
        <WorkspaceStat icon={<FileText size={18} />} label={t.topics} value={visibleTopics.length} />
        <WorkspaceStat icon={<MessageSquareText size={18} />} label={t.totalMessages} value={messageCount} />
        <WorkspaceStat icon={<Sparkles size={18} />} label={t.summarizedPhases} value={`${summarizedPhaseCount}/${visiblePhases.length}`} />
      </section>

      {isEmpty ? (
        <section className="workspace-home-empty">
          <div className="workspace-home-empty-icon">
            <GitBranch size={24} />
          </div>
          <div>
            <h3>{t.quickStart}</h3>
            <p>{t.workspaceOverviewEmpty}</p>
          </div>
          <div className="workspace-home-empty-actions">
            <button type="button" className="workspace-home-primary-action" onClick={onRequestCreatePhase}>
              <GitBranch size={16} />
              {t.newPhase}
            </button>
            <button type="button" onClick={onRequestCreateTopic}>
              <Plus size={16} />
              {t.newTopic}
            </button>
          </div>
        </section>
      ) : (
        <div className="workspace-home-content">
          <section className="workspace-home-section" aria-label={t.phaseDirectory}>
            <div className="workspace-home-section-title">
              <h3>{t.phaseDirectory}</h3>
              <small>{unassignedTopicCount > 0 ? `${fallbackDefaultPhaseTitle} · ${fillTemplate(t.topicCountLabel, { count: unassignedTopicCount })}` : fillTemplate(t.topicCountLabel, { count: visibleTopics.length })}</small>
            </div>
            <div className="workspace-home-list">
              {recentPhases.length > 0 ? (
                recentPhases.map((phase) => (
                  <button key={phase.id} type="button" className="workspace-home-row" onClick={() => onOpenPhase(phase.id)} aria-label={`${t.openPhase}: ${phase.title}`}>
                    <span className="workspace-home-row-icon phase">
                      <GitBranch size={16} />
                    </span>
                    <span className="workspace-home-row-main">
                      <strong>{phase.title}</strong>
                      <small>
                        <Clock3 size={13} />
                        {new Date(phase.startedAt).toLocaleDateString()}
                      </small>
                    </span>
                    <span className="workspace-home-row-meta">{fillTemplate(t.topicCountLabel, { count: phaseTopicCount(phase) })}</span>
                  </button>
                ))
              ) : (
                <p className="workspace-home-muted-line">{t.noPhases}</p>
              )}
            </div>
          </section>
        </div>
      )}
    </article>
  );
}

function WorkspaceStat({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="workspace-stat-card">
      <span className="workspace-stat-icon">{icon}</span>
      <span className="workspace-stat-value">{value}</span>
      <span className="workspace-stat-label">{label}</span>
    </div>
  );
}

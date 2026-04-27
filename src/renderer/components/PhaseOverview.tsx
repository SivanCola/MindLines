import { Archive, Clock3, GitBranch, Plus, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import type { Id, Phase, WorkspaceSnapshot } from '../../shared/types';
import { Copy, fillTemplate, isVisiblePhase, isVisibleTopic } from '../appModel';

export function PhaseOverview({
  snapshot,
  t,
  onRequestCreatePhase,
  onRequestCreateTopic,
  onOpenPhase
}: {
  snapshot: WorkspaceSnapshot;
  t: Copy;
  onRequestCreatePhase: () => void;
  onRequestCreateTopic: (phaseId: Id) => void;
  onOpenPhase: (phaseId: Id) => void;
}) {
  const visiblePhases = useMemo(() => snapshot.phases.filter(isVisiblePhase), [snapshot.phases]);
  const visibleTopics = useMemo(() => snapshot.topics.filter(isVisibleTopic), [snapshot.topics]);
  const activePhases = visiblePhases.filter((phase) => !phase.endedAt);
  const endedPhases = visiblePhases.filter((phase) => Boolean(phase.endedAt));
  const emptyPhaseCount = visiblePhases.filter((phase) => topicCountForPhase(phase, visibleTopics.map((topic) => topic.id)) === 0).length;
  const summarizedPhaseCount = visiblePhases.filter((phase) => Boolean(snapshot.phaseSummaries[phase.id])).length;
  const sortedPhases = [...visiblePhases].sort((left, right) => {
    const leftTime = new Date(left.endedAt ?? left.startedAt).getTime();
    const rightTime = new Date(right.endedAt ?? right.startedAt).getTime();
    return rightTime - leftTime;
  });

  function phaseTopicCount(phase: Phase) {
    return topicCountForPhase(phase, visibleTopics.map((topic) => topic.id));
  }

  return (
    <article className="detail-view workspace-home-view phases-overview-view">
      <header className="detail-header top-level-entry-header workspace-home-header">
        <div className="workspace-home-title">
          <p className="eyebrow">{t.phases}</p>
          <h2>{t.phasesOverview}</h2>
          <p className="detail-subtitle">{t.phasesOverviewHelp}</p>
        </div>
        <div className="header-actions">
          <button className="detail-action-button primary" type="button" onClick={onRequestCreatePhase} aria-label={t.newPhase} data-tooltip={t.newPhase}>
            <GitBranch size={16} />
          </button>
        </div>
      </header>

      <section className="workspace-home-stats" aria-label={t.workspaceStats}>
        <div className="workspace-stat-card">
          <span className="workspace-stat-icon"><GitBranch size={18} /></span>
          <span className="workspace-stat-value">{visiblePhases.length}</span>
          <span className="workspace-stat-label">{t.phases}</span>
        </div>
        <div className="workspace-stat-card">
          <span className="workspace-stat-icon"><Clock3 size={18} /></span>
          <span className="workspace-stat-value">{activePhases.length}</span>
          <span className="workspace-stat-label">{t.activePhases}</span>
        </div>
        <div className="workspace-stat-card">
          <span className="workspace-stat-icon"><Archive size={18} /></span>
          <span className="workspace-stat-value">{endedPhases.length}</span>
          <span className="workspace-stat-label">{t.endedPhases}</span>
        </div>
        <div className="workspace-stat-card">
          <span className="workspace-stat-icon"><Sparkles size={18} /></span>
          <span className="workspace-stat-value">{summarizedPhaseCount}/{visiblePhases.length}</span>
          <span className="workspace-stat-label">{t.summarizedPhases}</span>
        </div>
      </section>

      {visiblePhases.length === 0 ? (
        <section className="workspace-home-empty">
          <div className="workspace-home-empty-icon">
            <GitBranch size={24} />
          </div>
          <div>
            <h3>{t.phasesOverview}</h3>
            <p>{t.phasesOverviewEmpty}</p>
          </div>
          <div className="workspace-home-empty-actions">
            <button type="button" className="workspace-home-primary-action" onClick={onRequestCreatePhase}>
              <GitBranch size={16} />
              {t.newPhase}
            </button>
          </div>
        </section>
      ) : (
        <section className="workspace-home-section" aria-label={t.phaseDirectory}>
          <div className="workspace-home-section-title">
            <h3>{t.phaseDirectory}</h3>
            <small>{emptyPhaseCount > 0 ? `${t.phasesWithoutTopics} ${emptyPhaseCount}` : fillTemplate(t.topicCountLabel, { count: visibleTopics.length })}</small>
          </div>
          <div className="workspace-home-list phases-overview-list">
            {sortedPhases.map((phase) => {
              const topicCount = phaseTopicCount(phase);
              return (
                <div className="workspace-home-row phases-overview-row" key={phase.id}>
                  <button type="button" className="phases-overview-open" onClick={() => onOpenPhase(phase.id)} aria-label={`${t.openPhase}: ${phase.title}`}>
                    <span className="workspace-home-row-icon phase">
                      <GitBranch size={16} />
                    </span>
                    <span className="workspace-home-row-main">
                      <strong>{phase.title}</strong>
                      <small>
                        {phase.endedAt ? <Archive size={13} /> : <Clock3 size={13} />}
                        {phase.endedAt ? `${t.ended} ${new Date(phase.endedAt).toLocaleDateString()}` : `${t.started} ${new Date(phase.startedAt).toLocaleDateString()}`}
                      </small>
                    </span>
                    <span className="workspace-home-row-meta">{topicCount}</span>
                  </button>
                  <button type="button" className="phases-overview-row-action" onClick={() => onRequestCreateTopic(phase.id)} aria-label={t.newTopic} title={t.newTopic}>
                    <Plus size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}

function topicCountForPhase(phase: Phase, visibleTopicIds: Id[]) {
  return phase.topicIds.filter((topicId) => visibleTopicIds.includes(topicId)).length;
}

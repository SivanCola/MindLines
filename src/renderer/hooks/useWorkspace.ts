import { useState } from 'react';
import { DEFAULT_PHASE_ID, type WorkspaceSnapshot } from '../../shared/types';
import { View, isVisiblePhase, isVisibleTopic } from '../appModel';

function initialViewFor(): View {
  return { type: 'workspace' };
}

export function useWorkspace() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [view, setView] = useState<View>({ type: 'welcome' });

  function setInitialView(next: WorkspaceSnapshot) {
    setSnapshot(next);
    setView(initialViewFor());
  }

  function applySnapshot(next: WorkspaceSnapshot) {
    setSnapshot(next);
    setView((current) => {
      if (current.type === 'phase' && current.id === DEFAULT_PHASE_ID) {
        return current;
      }
      if (current.type === 'topic' && !next.topics.some((topic) => topic.id === current.id && isVisibleTopic(topic))) {
        return initialViewFor();
      }
      if (current.type === 'phase' && !next.phases.some((phase) => phase.id === current.id && isVisiblePhase(phase))) {
        return initialViewFor();
      }
      return current;
    });
  }

  return {
    snapshot,
    view,
    setSnapshot,
    setView,
    setInitialView,
    applySnapshot
  };
}

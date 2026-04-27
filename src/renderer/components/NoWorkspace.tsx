import { FolderOpen, HardDrive, History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Copy, getApi } from '../appModel';

async function pickWorkspace(onOpen: (path: string) => void, onCancel: () => void) {
  const picked = await getApi().pickDirectory();
  if (picked) {
    onOpen(picked);
    return;
  }
  onCancel();
}

export function NoWorkspace({ t }: { t: Copy; onOpen: (path: string) => void }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const locale = document.documentElement.lang || undefined;
  const timeText = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(now);
  const dateText = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(now);

  return (
    <section className="welcome-view" aria-labelledby="welcome-title">
      <div className="welcome-main">
        <div className="welcome-hero">
          <h2 id="welcome-title" className="welcome-time">{timeText}</h2>
          <div className="welcome-hero-context">
            <p className="welcome-date">{dateText}</p>
            <p className="welcome-note">{t.welcomeThoughtPrompt}</p>
            <p className="welcome-status">{t.noWorkspaceSidebarTitle}</p>
          </div>
        </div>
        <div className="welcome-sections">
          <section className="welcome-section" aria-label={t.recentWorkspaces}>
            <h3>
              <History size={16} />
              <span>{t.recentWorkspaces}</span>
            </h3>
            <p>{t.noRecentWorkspaces}</p>
          </section>
          <section className="welcome-section" aria-label={t.workspaceDataLocation}>
            <h3>
              <HardDrive size={16} />
              <span>{t.workspaceDataLocation}</span>
            </h3>
            <p>{t.workspaceEmptyHelp}</p>
          </section>
        </div>
      </div>
    </section>
  );
}

export function NoWorkspaceSidebar({ t, onOpen }: { t: Copy; onOpen: (path: string) => void }) {
  const [hint, setHint] = useState<string | null>(null);

  async function chooseWorkspaceFromPicker() {
    await pickWorkspace(onOpen, () => setHint(t.noFolderSelected));
  }

  return (
    <section className="empty-explorer" aria-label={t.workspace}>
      <div className="empty-explorer-state">
        <p className="empty-explorer-title">{t.noWorkspaceSidebarTitle}</p>
        <p>{t.noWorkspaceSidebarHelp}</p>
        <button className="empty-explorer-action" type="button" onClick={() => void chooseWorkspaceFromPicker()}>
          <FolderOpen size={16} />
          <span>{t.openFolder}</span>
        </button>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="empty-explorer-recent">
        <h2>{t.recentWorkspaces}</h2>
        <p>{t.noRecentWorkspaces}</p>
      </div>
    </section>
  );
}

import { ChevronDown, FolderOpen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { WorkspaceSnapshot } from '../../shared/types';
import { Copy, getApi, workspaceFolderName } from '../appModel';

export function WorkspaceControls({ snapshot, t, onOpen }: { snapshot: WorkspaceSnapshot | null; t: Copy; onOpen: (path: string) => void }) {
  const [pathValue, setPathValue] = useState('');
  const [hint, setHint] = useState<string>(t.workspaceHint);
  const [menuOpen, setMenuOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!snapshot && !pathValue.trim()) {
      setHint(t.workspaceHint);
    }
  }, [pathValue, snapshot, t.workspaceHint]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      if (switcherRef.current?.contains(event.target as Node)) {
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

  async function pickPath(): Promise<string | null> {
    const picked = await getApi().pickDirectory();
    if (picked) {
      setPathValue(picked);
      setHint(picked);
      return picked;
    }
    setHint(t.noFolderSelected);
    return null;
  }

  async function enterWorkspace() {
    const typedPath = pathValue.trim();
    if (typedPath) {
      setHint(typedPath);
      onOpen(typedPath);
      return;
    }
    await chooseWorkspaceFromPicker();
  }

  async function chooseWorkspaceFromPicker() {
    const workspacePath = await pickPath();
    if (workspacePath) {
      onOpen(workspacePath);
    }
  }

  async function openOrCreateWorkspaceFromPicker() {
    setMenuOpen(false);
    const picked = await pickPath();
    if (picked) {
      onOpen(picked);
    }
  }

  if (snapshot) {
    return (
      <div className="workspace-switcher" ref={switcherRef}>
        <button className="workspace-switcher-button" type="button" onClick={() => setMenuOpen((current) => !current)} aria-label={t.switchWorkspace} aria-haspopup="menu" aria-expanded={menuOpen} data-tooltip={menuOpen ? undefined : snapshot.workspacePath}>
          <span className="workspace-switcher-icon">
            <FolderOpen size={18} />
          </span>
          <span className="workspace-switcher-copy">
            <span className="workspace-switcher-label">{t.currentWorkspace}</span>
            <span className="workspace-switcher-name">{workspaceFolderName(snapshot.workspacePath)}</span>
          </span>
          <ChevronDown className="workspace-switcher-chevron" size={16} aria-hidden="true" />
        </button>
        {menuOpen ? (
          <div className="workspace-switcher-menu" role="menu">
            <div className="workspace-switcher-menu-summary">
              <span>{t.workspace}</span>
              <strong>{workspaceFolderName(snapshot.workspacePath)}</strong>
              <small data-tooltip={snapshot.workspacePath}>{snapshot.workspacePath}</small>
            </div>
            <button type="button" role="menuitem" onClick={() => void openOrCreateWorkspaceFromPicker()}>
              <FolderOpen size={15} />
              <span>{t.openOrCreateWorkspace}</span>
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="workspace-controls"
      onSubmit={(event) => {
        event.preventDefault();
        void enterWorkspace();
      }}
    >
      <label htmlFor="workspace-path">{t.workspace}</label>
      <div className="path-row">
        <input id="workspace-path" value={pathValue} onChange={(event) => setPathValue(event.target.value)} placeholder={t.workspacePlaceholder} />
        <button type="button" aria-label={t.selectWorkspace} data-tooltip={t.selectWorkspace} onClick={() => void chooseWorkspaceFromPicker()}>
          <FolderOpen size={18} />
        </button>
      </div>
      <small>{hint}</small>
    </form>
  );
}

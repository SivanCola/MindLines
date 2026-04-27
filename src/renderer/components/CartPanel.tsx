import { Bot, Check, Copy as CopyIcon, FileText, PackageCheck, PanelRightClose, PanelRightOpen, Trash2, X } from 'lucide-react';
import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
import type { SelectionCartItem } from '../../shared/types';
import { Copy, DiscussionGenerationState, KeyboardSettings, fillTemplate } from '../appModel';
import { copyTextToClipboard, DiscussionActivity, MarkdownContent } from './ConversationPrimitives';

export function CartPanel({
  items,
  discussion,
  discussionGeneration,
  isOpen,
  disabled,
  keyboardSettings,
  t,
  onToggle,
  onRemove,
  onClear,
  onExportMarkdown,
  onDiscuss
}: {
  items: SelectionCartItem[];
  discussion: string;
  discussionGeneration: DiscussionGenerationState | null;
  isOpen: boolean;
  disabled: boolean;
  keyboardSettings: KeyboardSettings;
  t: Copy;
  onToggle: () => void;
  onRemove: (item: SelectionCartItem) => void;
  onClear: () => void;
  onExportMarkdown: () => Promise<void>;
  onDiscuss: (prompt: string) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [copiedDiscussion, setCopiedDiscussion] = useState(false);
  const copiedDiscussionTimerRef = useRef<number | null>(null);
  const isDiscussing = Boolean(discussionGeneration);
  const collapsedCartLabel = items.length > 0 ? fillTemplate(t.openCartWithCount, { count: items.length }) : t.openCart;
  const cartToggleIcon = isOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />;
  const cartToggleLabel = isOpen ? t.closeCart : collapsedCartLabel;

  useEffect(() => {
    return () => {
      if (copiedDiscussionTimerRef.current) {
        window.clearTimeout(copiedDiscussionTimerRef.current);
      }
    };
  }, []);

  function discussCurrentPrompt() {
    if (!prompt.trim() || items.length === 0 || isDiscussing) return;
    onDiscuss(prompt);
    setPrompt('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    discussCurrentPrompt();
  }

  function handlePromptKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.altKey || event.nativeEvent.isComposing) {
      return;
    }
    const commandKey = event.metaKey || event.ctrlKey;
    const shouldDiscuss = !event.shiftKey && (commandKey || keyboardSettings.enterToSend);
    if (!shouldDiscuss) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    discussCurrentPrompt();
  }

  async function handleCopyDiscussion() {
    try {
      await copyTextToClipboard(discussion);
      setCopiedDiscussion(true);
      if (copiedDiscussionTimerRef.current) {
        window.clearTimeout(copiedDiscussionTimerRef.current);
      }
      copiedDiscussionTimerRef.current = window.setTimeout(() => setCopiedDiscussion(false), 1200);
    } catch {
      setCopiedDiscussion(false);
    }
  }

  if (!isOpen) {
    return (
      <aside className="cart-panel cart-panel-collapsed" aria-label={t.cart}>
        <button className="cart-toggle-button cart-header-icon-button" type="button" onClick={onToggle} aria-label={cartToggleLabel} data-tooltip={cartToggleLabel}>
          {cartToggleIcon}
          {items.length > 0 ? <span className="cart-count">{items.length}</span> : null}
        </button>
      </aside>
    );
  }

  return (
    <aside className="cart-panel">
      <button className="cart-toggle-button cart-header-icon-button" type="button" onClick={onToggle} aria-label={cartToggleLabel} data-tooltip={cartToggleLabel}>
        {cartToggleIcon}
      </button>
      <div className="cart-panel-shell">
        <div className="cart-header">
          <div>
            <h2>{t.cart}</h2>
          </div>
          <div className="cart-header-actions">
            <button
              className="cart-header-icon-button"
              type="button"
              onClick={() => void onExportMarkdown()}
              disabled={disabled || items.length === 0}
              aria-label={t.exportMarkdown}
              data-tooltip={t.exportMarkdown}
            >
              <FileText size={16} />
            </button>
            <button
              className="cart-header-icon-button"
              type="button"
              onClick={onClear}
              disabled={items.length === 0 || isDiscussing}
              aria-label={t.clearCart}
              data-tooltip={t.clearCart}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className="cart-panel-scroll">
          <div className="cart-list">
            {items.length === 0 ? (
              <div className="empty-inline">
                <PackageCheck size={22} />
                <p>{t.cartEmpty}</p>
              </div>
            ) : (
              items.map((item) => (
                <div className="cart-item" key={`${item.type}:${item.id}`}>
                  <span>{item.label}</span>
                  <button className="cart-item-remove" onClick={() => onRemove(item)} disabled={isDiscussing} aria-label={t.removeSelectedItem} title={t.removeSelectedItem}>
                    <X size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <form className={`cart-discuss ${isDiscussing ? 'generating' : ''}`} onSubmit={submit}>
            <label htmlFor="selection-prompt">{t.discussSelection}</label>
            {discussionGeneration ? <DiscussionActivity discussionGeneration={discussionGeneration} t={t} /> : null}
            <textarea id="selection-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={handlePromptKeyDown} disabled={disabled || isDiscussing} placeholder={t.selectionPrompt} />
            <button disabled={disabled || isDiscussing || items.length === 0 || !prompt.trim()}>
              <Bot size={16} />
              {t.discuss}
            </button>
          </form>

          {discussion ? (
            <section className="discussion-result">
              <div className="discussion-result-header">
                <h3>{t.result}</h3>
                <button className={`message-action-button discussion-copy-button ${copiedDiscussion ? 'copied' : ''}`} type="button" onClick={() => void handleCopyDiscussion()} aria-label={copiedDiscussion ? t.copiedDiscussionResult : t.copyDiscussionResult} data-tooltip={copiedDiscussion ? t.copiedDiscussionResult : t.copyDiscussionResult}>
                  {copiedDiscussion ? <Check size={14} /> : <CopyIcon size={14} />}
                </button>
              </div>
              <MarkdownContent content={discussion} t={t} />
            </section>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

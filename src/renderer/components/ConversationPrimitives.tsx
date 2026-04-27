import { Check, Copy as CopyIcon, FileText, ListPlus } from 'lucide-react';
import { Children, isValidElement, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../shared/types';
import { Copy, DiscussionGenerationState, GenerationState, SummaryGenerationState, fillTemplate } from '../appModel';

export function PendingUserBubble({ prompt, t, attachmentCount = 0, contextCount = 0 }: { prompt: string; t: Copy; attachmentCount?: number; contextCount?: number }) {
  return (
    <div className="message-bubble user pending">
      <div className="message-meta">
        <span>{t.pendingUser}</span>
        <time>{new Date().toLocaleTimeString()}</time>
      </div>
      {prompt ? <p>{prompt}</p> : null}
      {attachmentCount || contextCount ? (
        <div className="message-context-chips">
          {attachmentCount ? <span>{fillTemplate(t.attachmentCountLabel, { count: attachmentCount })}</span> : null}
          {contextCount ? <span>{fillTemplate(t.insertedContextCountLabel, { count: contextCount })}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function StreamingAssistantBubble({ content, t }: { content: string; t: Copy }) {
  return (
    <div className="message-bubble assistant streaming">
      <div className="message-meta">
        <span>{t.streamingReply}</span>
        <time>{new Date().toLocaleTimeString()}</time>
      </div>
      <MarkdownContent content={content} t={t} />
    </div>
  );
}

export function GenerationActivity({ generation, t }: { generation: GenerationState; t: Copy }) {
  const steps = [t.generationContext, t.generationProvider, t.generationThinking, t.generationSaving];

  return (
    <section className="generation-card" aria-live="polite" aria-label={t.generationTitle}>
      <div className="generation-header">
        <div className="thinking-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <h3>{t.generationTitle}</h3>
          <p>{generation.providerLabel}</p>
        </div>
      </div>
      <div className="generation-steps">
        {steps.map((step, index) => (
          <div key={step} className={`generation-step ${index < generation.stageIndex ? 'done' : ''} ${index === generation.stageIndex ? 'active' : ''}`}>
            <span className="step-dot" />
            <span>{step}</span>
          </div>
        ))}
      </div>
      <div className="processing-summary">
        <h4>{t.processingSummary}</h4>
        <ul>
          {generation.processingSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <p className="generation-note">{t.generationNote}</p>
    </section>
  );
}

export function SummaryActivity({ summaryGeneration, t }: { summaryGeneration: SummaryGenerationState; t: Copy }) {
  const steps = [t.summaryCollecting, t.summaryGenerating, t.summarySaving];

  return (
    <section className="summary-activity" aria-label={t.summarizingTitle}>
      <div className="generation-header">
        <div className="thinking-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <h3>{summaryGeneration.stageIndex >= 2 ? t.summaryUpdated : t.summarizingTitle}</h3>
          <p>{summaryGeneration.providerLabel}</p>
        </div>
      </div>
      <div className="generation-steps">
        {steps.map((step, index) => (
          <div key={step} className={`generation-step ${index < summaryGeneration.stageIndex ? 'done' : ''} ${index === summaryGeneration.stageIndex ? 'active' : ''}`}>
            <span className="step-dot" />
            <span>{step}</span>
          </div>
        ))}
      </div>
      <div className="processing-summary">
        <h4>{t.processingSummary}</h4>
        <ul>
          {summaryGeneration.processingSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <p className="generation-note">{t.generationNote}</p>
    </section>
  );
}

export function DiscussionActivity({ discussionGeneration, t }: { discussionGeneration: DiscussionGenerationState; t: Copy }) {
  const steps = [t.discussionCollecting, t.discussionGenerating, t.discussionPresenting];

  return (
    <section className="discussion-activity" aria-live="polite" aria-label={t.discussionWorkingTitle}>
      <div className="generation-header">
        <div className="thinking-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <h3>{discussionGeneration.stageIndex >= 2 ? t.discussionUpdated : t.discussionWorkingTitle}</h3>
          <p>{discussionGeneration.providerLabel}</p>
        </div>
      </div>
      <div className="generation-steps">
        {steps.map((step, index) => (
          <div key={step} className={`generation-step ${index < discussionGeneration.stageIndex ? 'done' : ''} ${index === discussionGeneration.stageIndex ? 'active' : ''}`}>
            <span className="step-dot" />
            <span>{step}</span>
          </div>
        ))}
      </div>
      <div className="processing-summary">
        <h4>{t.processingSummary}</h4>
        <ul>
          {discussionGeneration.processingSummary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <p className="generation-note">{t.generationNote}</p>
    </section>
  );
}

export function SummaryActions({ content, disabled, t, onAdd }: { content: string; disabled: boolean; t: Copy; onAdd: () => void }) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await copyTextToClipboard(content);
      setCopied(true);
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="summary-actions">
      <button className={`message-action-button summary-action-button ${copied ? 'copied' : ''}`} type="button" onClick={() => void handleCopy()} disabled={disabled} aria-label={copied ? t.copiedSummary : t.copySummary} data-tooltip={copied ? t.copiedSummary : t.copySummary}>
        {copied ? <Check size={14} /> : <CopyIcon size={14} />}
      </button>
      <button className="message-action-button summary-action-button" type="button" onClick={onAdd} disabled={disabled} aria-label={t.addSummaryToCart} data-tooltip={t.addSummaryToCart}>
        <ListPlus size={14} />
      </button>
    </div>
  );
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.top = '-1000px';
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

export function MessageBubble({ message, workspacePath, t, onAdd }: { message: Message; workspacePath?: string; t: Copy; onAdd: () => void }) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await copyTextToClipboard(message.content);
      setCopied(true);
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`message-bubble ${message.role}`}>
      <div className="message-meta">
        <span>{message.role === 'user' ? t.userRole : message.role === 'assistant' ? t.assistantRole : message.role}</span>
        <time>{new Date(message.createdAt).toLocaleString()}</time>
      </div>
      <div className="message-actions">
        <button className={`message-action-button ${copied ? 'copied' : ''}`} onClick={() => void handleCopy()} aria-label={copied ? t.copiedMessage : t.copyMessage} data-tooltip={copied ? t.copiedMessage : t.copyMessage}>
          {copied ? <Check size={14} /> : <CopyIcon size={14} />}
        </button>
        <button className="message-action-button" onClick={onAdd} aria-label={t.addMessageToCart} data-tooltip={t.addMessageToCart}>
          <ListPlus size={14} />
        </button>
      </div>
      {message.contextItems?.length ? (
        <div className="message-context-chips" aria-label={t.insertedContext}>
          {message.contextItems.map((item) => (
            <span key={`${item.type}:${item.id}`}>{item.label}</span>
          ))}
        </div>
      ) : null}
      <MarkdownContent content={message.content} t={t} />
      {message.attachments?.length ? (
        <div className="message-attachments" aria-label={t.attachments}>
          {message.attachments.map((attachment) => (
            <figure key={attachment.id}>
              {attachment.type === 'image' ? <img src={attachmentImageSrc(workspacePath, message.topicId, attachment.path)} alt={attachment.fileName} /> : <div className="message-attachment-file"><FileText size={18} /></div>}
              <figcaption>{attachment.fileName}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function attachmentImageSrc(workspacePath: string | undefined, topicId: string, attachmentPath: string): string {
  if (!workspacePath) {
    return attachmentPath;
  }
  const root = workspacePath.replace(/\/+$/, '').split('/').map(encodeURIComponent).join('/');
  const relativePath = attachmentPath.startsWith('phases/') || attachmentPath.startsWith('topics/') ? attachmentPath : `topics/${topicId}/${attachmentPath}`;
  const relative = relativePath.split('/').map(encodeURIComponent).join('/');
  return `file://${root}/${relative}`;
}

export function MarkdownCodeBlock({ code, className, t }: { code: string; className?: string; t: Copy }) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await copyTextToClipboard(code);
      setCopied(true);
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="markdown-code-block">
      <button className={`markdown-code-copy ${copied ? 'copied' : ''}`} type="button" onClick={() => void handleCopy()} aria-label={copied ? t.copiedCode : t.copyCode} title={copied ? t.copiedCode : t.copyCode}>
        {copied ? <Check size={14} /> : <CopyIcon size={14} />}
      </button>
      <pre>
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownContent({ content, t }: { content: string; t: Copy }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a({ children, href }) {
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          pre({ children }) {
            const [codeElement] = Children.toArray(children);
            if (isValidElement<{ children?: unknown; className?: string }>(codeElement)) {
              const code = String(codeElement.props.children ?? '').replace(/\n$/, '');
              return <MarkdownCodeBlock code={code} className={codeElement.props.className} t={t} />;
            }
            return <pre>{children}</pre>;
          },
          code({ children, className }) {
            return <code className={className}>{children}</code>;
          },
          li({ children, className, ...props }) {
            const childNodes = Children.toArray(children);
            if (typeof className === 'string' && className.includes('task-list-item') && childNodes.length > 0) {
              const [checkbox, ...content] = childNodes;
              return (
                <li className={className} {...props}>
                  {checkbox}
                  <div className="task-list-item-content">{content}</div>
                </li>
              );
            }
            return (
              <li className={className} {...props}>
                {children}
              </li>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

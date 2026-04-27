import { Bell, ChevronRight, Clock3, FileText, GitBranch, HelpCircle, MessageSquarePlus, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { WorkspaceSnapshot } from '../../shared/types';
import { Copy, SearchResult, SearchResultKind, View, buildSearchResults, defaultPhaseTitle, isVisiblePhase, isVisibleTopic, searchResultKindLabel } from '../appModel';

function SearchResultIcon({ kind }: { kind: SearchResultKind }) {
  if (kind === 'phase' || kind === 'phase-summary') {
    return <GitBranch size={15} />;
  }
  if (kind === 'message') {
    return <MessageSquarePlus size={15} />;
  }
  if (kind === 'topic-summary') {
    return <Sparkles size={15} />;
  }
  return <FileText size={15} />;
}

type SearchFilter = 'all' | 'topic' | 'message' | 'phase' | 'summary';

function resultMatchesFilter(result: SearchResult, filter: SearchFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'summary') {
    return result.kind === 'topic-summary' || result.kind === 'phase-summary';
  }
  if (filter === 'phase') {
    return result.kind === 'phase';
  }
  if (filter === 'topic') {
    return result.kind === 'topic';
  }
  return result.kind === 'message';
}

export type TopBarBreadcrumbItem = {
  label: string;
  onSelect?: () => void;
  trailingSeparator?: boolean;
};

export function TopBar({
  breadcrumbs,
  snapshot,
  t,
  searchPlaceholder,
  onOpenSearchResult
}: {
  breadcrumbs: TopBarBreadcrumbItem[];
  snapshot: WorkspaceSnapshot | null;
  t: Copy;
  searchPlaceholder: string;
  onOpenSearchResult: (view: View) => void;
}) {
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const results = useMemo(() => buildSearchResults(snapshot, query, t), [snapshot, query, t]);
  const recentResults = useMemo<SearchResult[]>(() => {
    if (!snapshot) {
      return [];
    }

    const visiblePhases = snapshot.phases.filter(isVisiblePhase);
    const phaseById = new Map(visiblePhases.map((phase) => [phase.id, phase]));
    const fallbackDefaultPhaseTitle = defaultPhaseTitle(snapshot.manifest, t);
    return snapshot.topics
      .filter(isVisibleTopic)
      .slice()
      .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))
      .slice(0, 6)
      .map((topic) => {
        const phase = topic.phaseId ? phaseById.get(topic.phaseId) : undefined;
        const messages = snapshot.messagesByTopic[topic.id] ?? [];
        const summary = snapshot.topicSummaries[topic.id];
        return {
          id: `recent-topic:${topic.id}`,
          kind: 'topic',
          title: topic.title,
          subtitle: `${phase?.title ?? fallbackDefaultPhaseTitle} · ${messages.length} ${t.messages}`,
          excerpt: summary?.content ?? messages[messages.length - 1]?.content ?? '',
          target: { type: 'topic', id: topic.id }
        };
      });
  }, [snapshot, t]);
  const trimmedQuery = query.trim();
  const filteredResults = useMemo(() => results.filter((result) => resultMatchesFilter(result, searchFilter)), [results, searchFilter]);
  const visibleResults = trimmedQuery ? filteredResults : recentResults;
  const filterOptions = useMemo(
    () =>
      [
        { id: 'all', label: t.searchFilterAll },
        { id: 'topic', label: t.searchResultTopic },
        { id: 'message', label: t.searchResultMessage },
        { id: 'phase', label: t.searchResultPhase },
        { id: 'summary', label: t.searchFilterSummary }
      ].map((option) => ({
        ...option,
        count: results.filter((result) => resultMatchesFilter(result, option.id as SearchFilter)).length
      })),
    [results, t]
  );

  useEffect(() => {
    if (!searchOpen) {
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [searchOpen]);

  useEffect(() => {
    function openSearch() {
      if (snapshot) {
        setSearchOpen(true);
      }
    }

    window.addEventListener('mindline:focus-search', openSearch);
    return () => window.removeEventListener('mindline:focus-search', openSearch);
  }, [snapshot]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, searchFilter, visibleResults.length]);

  function openResult(result: SearchResult) {
    onOpenSearchResult(result.target);
    setSearchOpen(false);
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery('');
    setSearchFilter('all');
  }

  const breadcrumbTitle = breadcrumbs.map((item) => item.label).join(' / ');

  return (
    <header className="topbar">
      <nav className="topbar-title" aria-label={breadcrumbTitle}>
        <ol className="topbar-breadcrumb">
          {breadcrumbs.map((item, index) => {
            const isCurrent = index === breadcrumbs.length - 1;
            const key = `${item.label}-${index}`;
            return (
              <li key={key} className={isCurrent ? 'current' : undefined}>
                {index > 0 ? <ChevronRight className="topbar-breadcrumb-separator" size={15} aria-hidden="true" /> : null}
                {item.onSelect ? (
                  <button type="button" className="topbar-breadcrumb-link" onClick={item.onSelect} title={item.label}>
                    {item.label}
                  </button>
                ) : isCurrent ? (
                  <h1 title={item.label}>{item.label}</h1>
                ) : (
                  <span title={item.label}>{item.label}</span>
                )}
                {item.trailingSeparator ? <ChevronRight className="topbar-breadcrumb-separator" size={15} aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="topbar-actions">
        <button className="topbar-search-trigger" type="button" onClick={() => setSearchOpen(true)} disabled={!snapshot} aria-label={t.searchOpen} data-tooltip={snapshot ? t.searchOpen : undefined}>
          <Search size={15} />
          <span className="topbar-search-trigger-label">{searchPlaceholder}</span>
          <span className="topbar-search-shortcut" aria-hidden="true">
            <span className="shortcut-key-part">
              <kbd>⌘</kbd>
            </span>
            <span className="shortcut-key-part">
              <span className="shortcut-key-plus">+</span>
              <kbd>K</kbd>
            </span>
          </span>
        </button>
        <button type="button" aria-label="Help">
          <HelpCircle size={18} />
        </button>
        <button type="button" aria-label="Notifications">
          <Bell size={18} />
        </button>
        <button type="button" aria-label="Preferences">
          <SlidersHorizontal size={18} />
        </button>
      </div>
      {searchOpen
        ? createPortal(
            <div className="search-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeSearch()}>
              <section className="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-dialog-title">
                <div className="search-dialog-input-row">
                  <Search size={18} aria-hidden="true" />
                  <input
                    ref={searchInputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        closeSearch();
                        return;
                      }
                      if (event.key === 'ArrowDown') {
                        event.preventDefault();
                        setActiveIndex((current) => Math.min(current + 1, Math.max(visibleResults.length - 1, 0)));
                        return;
                      }
                      if (event.key === 'ArrowUp') {
                        event.preventDefault();
                        setActiveIndex((current) => Math.max(current - 1, 0));
                        return;
                      }
                      if (event.key === 'Enter' && visibleResults[activeIndex]) {
                        event.preventDefault();
                        openResult(visibleResults[activeIndex]);
                      }
                    }}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                  />
                  <button type="button" onClick={closeSearch} aria-label={t.cancel} data-tooltip={t.cancel}>
                    <X size={17} />
                  </button>
                </div>

                <div className="search-dialog-header">
                  <div>
                    <p>{t.searchScope}</p>
                    <h2 id="search-dialog-title">{t.searchDialogTitle}</h2>
                    <span>{t.searchDialogHelp}</span>
                  </div>
                </div>

                <div className="search-dialog-body">
                  {trimmedQuery ? (
                    <>
                      <div className="search-section-label">
                        <span>{t.searchResults}</span>
                        <em>{visibleResults.length}</em>
                      </div>
                      <div className="search-filter-tabs" role="tablist" aria-label={t.searchScope}>
                        {filterOptions.map((option) => (
                          <button
                            key={option.id}
                            className={searchFilter === option.id ? 'active' : undefined}
                            type="button"
                            role="tab"
                            aria-selected={searchFilter === option.id}
                            onClick={() => setSearchFilter(option.id as SearchFilter)}
                          >
                            <span>{option.label}</span>
                            <em>{option.count}</em>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="search-empty-intro">
                      <Clock3 size={16} />
                      <div>
                        <strong>{recentResults.length > 0 ? t.searchRecent : t.searchStartTitle}</strong>
                        <span>{t.searchStartHelp}</span>
                      </div>
                    </div>
                  )}

                  {visibleResults.length > 0 ? (
                    <div className="search-result-list" role="listbox" aria-label={trimmedQuery ? t.searchResults : t.searchRecent}>
                      {visibleResults.map((result, index) => (
                        <button key={result.id} className={index === activeIndex ? 'active' : undefined} type="button" role="option" aria-selected={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onClick={() => openResult(result)}>
                          <span className="search-result-icon">
                            <SearchResultIcon kind={result.kind} />
                          </span>
                          <span className="search-result-text">
                            <strong>{result.title}</strong>
                            <span>{result.subtitle}</span>
                            {result.excerpt ? <small>{result.excerpt}</small> : null}
                          </span>
                          <em>{searchResultKindLabel(result.kind, t)}</em>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="search-no-results">{trimmedQuery ? t.searchNoResults : t.searchStartHelp}</p>
                  )}
                </div>
              </section>
            </div>,
            document.body
          )
        : null}
    </header>
  );
}

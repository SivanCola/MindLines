import { useEffect, useState } from 'react';

export function InlineTitleEditor({ value, ariaLabel, onSave }: { value: string; ariaLabel: string; onSave: (title: string) => void }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    const nextTitle = draft.trim();
    if (!nextTitle) {
      setDraft(value);
      return;
    }
    if (nextTitle !== value) {
      onSave(nextTitle);
      return;
    }
    setDraft(value);
  }

  return (
    <input
      className="title-inline-input"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
      aria-label={ariaLabel}
      title={ariaLabel}
    />
  );
}

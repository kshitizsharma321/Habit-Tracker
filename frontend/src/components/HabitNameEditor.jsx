import { useState, useRef, useEffect } from 'react';

/**
 * Inline editable habit name displayed in the site header.
 * Click the name (or the pencil icon) to edit inline — press Enter or blur to save.
 */
export default function HabitNameEditor({ name, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef(null);

  // Sync draft when name changes externally
  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  const startEditing = () => {
    setDraft(name);
    setEditing(true);
    // Focus after render
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const commit = () => {
    onSave(draft);
    setEditing(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        maxLength={60}
        className="text-lg font-bold bg-transparent border-b-2 border-ht-accent text-text-primary outline-none w-52"
        aria-label="Habit name"
      />
    );
  }

  return (
    <button
      onClick={startEditing}
      title="Click to rename your habit"
      className="flex items-center gap-1.5 text-lg font-bold text-text-primary hover:text-ht-accent transition-colors group"
    >
      <span>{name}</span>
      <span className="text-sm opacity-0 group-hover:opacity-60 transition-opacity" aria-hidden>
        ✏️
      </span>
    </button>
  );
}

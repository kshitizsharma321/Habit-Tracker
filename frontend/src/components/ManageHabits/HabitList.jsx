import { useEffect, useRef, useState } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { TYPE_LABELS } from '../../constants/habits';

export default function HabitList({ definitions, startEdit, setDeleteTarget, loading, reorderHabits, isReordering }) {
  const [items, setItems] = useState(definitions);
  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  // Keep local order in sync with the source list (optimistic cache update / refetch).
  useEffect(() => { setItems(definitions); }, [definitions]);

  if (loading) {
    return (
      <div className="space-y-2 mt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4 flex items-center gap-3">
            <Skeleton className="w-7 h-7 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8 mt-4">No habits yet.</p>;
  }

  const commit = (next) => {
    setItems(next);
    reorderHabits?.(next.map((d) => d._id));
  };

  const handleDrop = (dropIndex) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from == null || from === dropIndex) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    commit(next);
  };

  // Touch fallback — HTML5 drag-and-drop doesn't fire on touch devices.
  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  return (
    <div className="space-y-2 mt-4">
      {items.map((def, i) => (
        <Card
          key={def._id}
          draggable={!isReordering}
          onDragStart={() => { dragIndex.current = i; }}
          onDragOver={(e) => { e.preventDefault(); if (overIndex !== i) setOverIndex(i); }}
          onDrop={() => handleDrop(i)}
          onDragEnd={() => { dragIndex.current = null; setOverIndex(null); }}
          className={`p-3 flex items-center justify-between gap-2 transition-colors ${overIndex === i ? 'border-primary' : ''}`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="cursor-grab active:cursor-grabbing text-muted-foreground select-none text-lg leading-none"
              title="Drag to reorder"
              aria-hidden="true"
            >
              ⠿
            </span>
            <button
              type="button"
              className="flex items-center gap-3 min-w-0 flex-1 text-left"
              onClick={() => startEdit(def)}
            >
              <span className="text-xl shrink-0">{def.icon}</span>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{def.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {TYPE_LABELS[def.trackingType]}{def.unit ? ` · ${def.unit}` : ''}
                  {def.goal?.enabled ? ` · Goal: ${def.goal.value}${def.unit ? ` ${def.unit}` : ''}` : ''}
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
              disabled={i === 0 || isReordering}
              onClick={() => move(i, -1)} aria-label="Move up"
            >↑</Button>
            <Button
              size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
              disabled={i === items.length - 1 || isReordering}
              onClick={() => move(i, 1)} aria-label="Move down"
            >↓</Button>
            <Button
              size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteTarget(def)} aria-label="Delete habit"
            >✕</Button>
          </div>
        </Card>
      ))}
      <p className="text-xs text-center text-muted-foreground pt-1">
        Drag the ⠿ handle (or use ↑ ↓) to reorder — changes save automatically.
      </p>
    </div>
  );
}

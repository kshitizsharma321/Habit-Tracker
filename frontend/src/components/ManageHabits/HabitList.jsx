import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { TYPE_LABELS } from '../../constants/habits';

export default function HabitList({ definitions, startEdit, setDeleteTarget }) {
  if (definitions.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8 mt-4">No habits yet.</p>;
  }

  return (
    <div className="space-y-2 mt-4">
      {definitions.map((def) => (
        <Card key={def._id} className="p-4 flex items-center justify-between cursor-pointer hover:border-primary transition-colors"
          onClick={() => startEdit(def)}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{def.icon}</span>
            <div>
              <p className="font-medium text-foreground">{def.name}</p>
              <p className="text-xs text-muted-foreground">
                {TYPE_LABELS[def.trackingType]}{def.unit ? ` · ${def.unit}` : ''}
                {def.goal?.enabled ? ` · Goal: ${def.goal.value}/${def.goal.period}` : ''}
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(def); }}>
            ✕
          </Button>
        </Card>
      ))}
    </div>
  );
}
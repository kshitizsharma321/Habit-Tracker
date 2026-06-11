import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { COLORS } from '../../constants/habits';

export default function HabitForm({ form, setForm, handleSave, isSaving, editingId, resetForm }) {
  return (
    <div className="max-w-md space-y-4 mt-4">
      <div>
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Exercise" />
      </div>

      <div>
        <Label>Tracking Type</Label>
        <Select
          value={form.trackingType}
          onValueChange={(v) =>
            setForm({
              ...form,
              trackingType: v,
              goalEnabled: v === 'quantity',
              unit: v === 'quantity' ? form.unit : '',
            })
          }
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="completion">Done / Not Done</SelectItem>
            <SelectItem value="quantity">How much?</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.trackingType === 'quantity' && (
        <div>
          <Label>Unit (optional)</Label>
          <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="hours, pages..." />
        </div>
      )}

      {form.trackingType === 'quantity' && (
        <div className="space-y-2">
          <Label>
            Goal{' '}
            <span className="text-xs font-normal" style={{ color: 'var(--text-secondary)' }}>
              (required — determines your streak)
            </span>
          </Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number" min="1" value={form.goalValue}
              onChange={(e) => setForm({ ...form, goalValue: parseInt(e.target.value) || 1 })}
              className="w-28"
            />
            {form.unit && (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{form.unit} per entry</span>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Log ≥ this value each time to count as a streak day.
          </p>
        </div>
      )}

      <div>
        <Label>Color</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {COLORS.map((c) => (
            <button key={c} onClick={() => setForm({ ...form, color: c })}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'scale-125 border-foreground' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={!form.name.trim() || isSaving} className="w-full">
        {isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Habit'}
      </Button>

      {editingId && (
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={resetForm}>
          Cancel Editing
        </Button>
      )}
    </div>
  );
}
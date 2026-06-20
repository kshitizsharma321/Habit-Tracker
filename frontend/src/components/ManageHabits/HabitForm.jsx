import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { COLORS } from '../../constants/habits';

const EMOJI_GRID = [
  '🏋️','🏃','🚴','🤸','🧘','🚶','🏊','⛹️',
  '💧','😴','🥗','💊','🦷','☀️','🥦','⏰',
  '📚','📖','✍️','💻','🎯','🌍','📝','🎓',
  '🧠','🙏','📵','📺','💰','📱','🌳','🚿',
  '💪','👟','❤️','⭐','🔥','🌿','✅','🎵',
];

function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const select = (emoji) => {
    onChange(emoji);
    setOpen(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mt-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-11 h-11 text-2xl flex items-center justify-center rounded-lg border-2 transition-colors"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: open ? 'var(--accent-color)' : 'var(--border-color)',
          }}
        >
          {value || '⭐'}
        </button>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Click to pick, or type below
        </span>
      </div>

      {open && (
        <div
          className="mt-2 p-2 rounded-xl grid grid-cols-8 gap-1"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
        >
          {EMOJI_GRID.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => select(e)}
              className="w-9 h-9 text-xl flex items-center justify-center rounded-lg transition-colors hover:scale-110"
              style={{
                background: value === e ? 'color-mix(in srgb, var(--accent-color) 18%, transparent)' : 'transparent',
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <Input
        className="mt-2 w-24"
        maxLength={2}
        placeholder="Type emoji"
        value={custom}
        onChange={(e) => {
          setCustom(e.target.value);
          if (e.target.value) onChange(e.target.value);
        }}
      />
    </div>
  );
}

export default function HabitForm({ form, setForm, handleSave, isSaving, editingId, resetForm }) {
  const goalNum = parseFloat(form.goalValue);
  const isGoalValid = form.trackingType !== 'quantity' || (Number.isFinite(goalNum) && goalNum > 0);

  return (
    <div className="max-w-md space-y-4 mt-4">
      <div>
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter habit name" />
      </div>

      <div>
        <Label>Icon</Label>
        <IconPicker value={form.icon} onChange={(icon) => setForm({ ...form, icon })} />
      </div>

      <div>
        <Label>Tracking Type</Label>
        {editingId ? (
          <div
            className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
          >
            {form.trackingType === 'completion' ? 'Done / Not Done' : 'How much?'}
            <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
              locked after creation
            </span>
          </div>
        ) : (
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
        )}
      </div>

      {form.trackingType === 'quantity' && (
        <div>
          <Label>Unit (optional)</Label>
          <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. hours, km, pages" />
        </div>
      )}

      {form.trackingType === 'quantity' && (
        <div className="space-y-2">
          <Label>Daily target</Label>
          <div className="flex gap-2 items-center">
            <Input
              type="number" min="0.01" step="0.01"
              value={form.goalValue}
              onChange={(e) => setForm({ ...form, goalValue: e.target.value })}
              placeholder="Enter target (e.g. 8)"
              className="w-44"
            />
            {form.unit && (
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{form.unit}</span>
            )}
          </div>

          <Label className="pt-1">How to count a streak day</Label>
          <Select
            value={form.goalDirection || 'at_least'}
            onValueChange={(v) => setForm({ ...form, goalDirection: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="at_least">Reach at least the target (build up)</SelectItem>
              <SelectItem value="at_most">Stay under the target (cut down)</SelectItem>
            </SelectContent>
          </Select>

          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {(form.goalDirection || 'at_least') === 'at_most'
              ? 'Log ≤ this value each day to count as a streak day — good for cutting down screen time, spending, etc.'
              : 'Log ≥ this value each day to count as a streak day.'}
          </p>

          {!isGoalValid && (
            <p className="text-xs" style={{ color: 'var(--danger-color)' }}>
              Enter a target greater than 0.
            </p>
          )}
        </div>
      )}

      <div>
        <Label>Color</Label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'scale-125 border-foreground' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={!form.name.trim() || !isGoalValid || isSaving} className="w-full">
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

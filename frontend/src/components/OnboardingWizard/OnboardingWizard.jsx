import { useState } from 'react';
import { useHabitDefinitions } from '../../hooks/useHabitDefinitions';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';

import { TEMPLATES, TYPE_LABELS } from '../../constants/habits';

export default function OnboardingWizard({ onComplete }) {
  const [selected, setSelected] = useState([]);
  const { bulkCreateHabitsAsync } = useHabitDefinitions();

  const toggle = (tpl) => {
    setSelected((prev) => {
      const exists = prev.find((t) => t.name === tpl.name);
      if (exists) return prev.filter((t) => t.name !== tpl.name);
      return [...prev, tpl];
    });
  };

  const handleStart = async () => {
    if (selected.length > 0) {
      await bulkCreateHabitsAsync(selected.map((t) => ({
        name: t.name, trackingType: t.type, options: t.options,
        unit: t.unit, color: t.color, icon: t.icon,
      })));
    }
    await onComplete();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <p className="text-5xl mb-4">🌱</p>
          <h1 className="text-2xl font-bold text-foreground">Welcome!</h1>
          <p className="text-muted-foreground mt-2">Pick a few habits to get started, or skip to begin empty.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto mb-6">
          {TEMPLATES.map((tpl) => {
            const isSel = selected.some((t) => t.name === tpl.name);
            return (
              <Card key={tpl.name}
                className={`p-4 cursor-pointer transition-all border-2 ${isSel ? 'border-primary' : 'border-transparent'}`}
                onClick={() => toggle(tpl)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{tpl.icon}</span>
                  <span className="font-medium text-sm text-foreground">{tpl.name}</span>
                  {isSel && <span className="ml-auto text-primary">✓</span>}
                </div>
                <Badge variant="outline" className="text-xs">{TYPE_LABELS[tpl.type]}</Badge>
              </Card>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button className="flex-1" size="lg" onClick={handleStart}>
            🚀 Start Tracking
          </Button>
          <Button variant="outline" size="lg" onClick={onComplete}>
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}

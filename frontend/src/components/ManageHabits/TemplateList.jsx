import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { TEMPLATES, TYPE_LABELS } from '../../constants/habits';

export default function TemplateList({ applyTemplate }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
      {TEMPLATES.map((tpl) => (
        <Card key={tpl.name} className="p-4 cursor-pointer hover:border-primary transition-colors"
          onClick={() => applyTemplate(tpl)}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{tpl.icon}</span>
            <span className="font-medium text-sm text-foreground">{tpl.name}</span>
          </div>
          <Badge variant="outline" className="text-xs">{TYPE_LABELS[tpl.type]}</Badge>
        </Card>
      ))}
    </div>
  );
}
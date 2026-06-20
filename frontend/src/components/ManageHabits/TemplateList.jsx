import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { TEMPLATES, TYPE_LABELS } from '../../constants/habits';

export default function TemplateList({ applyTemplate, existingNames = new Set(), onAddCustom }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
      {TEMPLATES.map((tpl) => {
        const added = existingNames.has(tpl.name.trim().toLowerCase());
        return (
          <Card
            key={tpl.name}
            aria-disabled={added}
            className={`p-4 transition-colors ${added ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'}`}
            onClick={() => { if (!added) applyTemplate(tpl); }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{tpl.icon}</span>
              <span className="font-medium text-sm text-foreground">{tpl.name}</span>
            </div>
            <Badge variant="outline" className="text-xs">{added ? '✓ Added' : TYPE_LABELS[tpl.type]}</Badge>
          </Card>
        );
      })}

      {/* "Add your own" card — jumps to the custom habit create form */}
      {onAddCustom && (
        <Card
          onClick={onAddCustom}
          className="p-4 cursor-pointer border-dashed flex flex-col items-center justify-center text-center hover:border-primary transition-colors"
        >
          <span className="text-xl mb-1">➕</span>
          <span className="font-medium text-sm text-foreground">Add your own</span>
        </Card>
      )}
    </div>
  );
}

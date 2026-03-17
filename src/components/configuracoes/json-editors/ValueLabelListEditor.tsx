import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ValueLabelItem {
  value: string;
  label: string;
}

interface Props {
  items: ValueLabelItem[];
  onChange: (items: ValueLabelItem[]) => void;
  valuePlaceholder?: string;
  labelPlaceholder?: string;
}

export function ValueLabelListEditor({ items, onChange, valuePlaceholder = 'Código', labelPlaceholder = 'Descrição' }: Props) {
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    if (!newValue.trim() || !newLabel.trim()) return;
    if (items.some(i => i.value === newValue.trim())) return;
    onChange([...items, { value: newValue.trim().toLowerCase(), label: newLabel.trim() }]);
    setNewValue('');
    setNewLabel('');
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleEdit = (index: number, field: 'value' | 'label', val: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: val };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/50 divide-y divide-border/50">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            <Badge variant="outline" className="font-mono text-xs shrink-0">{item.value}</Badge>
            <Input
              value={item.label}
              onChange={(e) => handleEdit(i, 'label', e.target.value)}
              className="h-8 text-sm flex-1"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive/60 hover:text-destructive" onClick={() => handleRemove(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={valuePlaceholder}
          className="h-8 text-sm max-w-[140px] font-mono"
        />
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={labelPlaceholder}
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newValue.trim() || !newLabel.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}

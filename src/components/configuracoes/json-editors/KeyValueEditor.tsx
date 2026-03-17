import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Props {
  data: Record<string, string | number>;
  onChange: (data: Record<string, string | number>) => void;
  keyLabel?: string;
  valueLabel?: string;
  valueType?: 'text' | 'number';
}

export function KeyValueEditor({ data, onChange, keyLabel = 'Chave', valueLabel = 'Valor', valueType = 'text' }: Props) {
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const entries = Object.entries(data);

  const handleEdit = (oldKey: string, newValue: string | number) => {
    onChange({ ...data, [oldKey]: newValue });
  };

  const handleRemove = (key: string) => {
    const updated = { ...data };
    delete updated[key];
    onChange(updated);
  };

  const handleAdd = () => {
    if (!newKey.trim()) return;
    const val = valueType === 'number' ? parseFloat(newVal) || 0 : newVal;
    onChange({ ...data, [newKey.trim()]: val });
    setNewKey('');
    setNewVal('');
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/50 divide-y divide-border/50">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
          <span className="text-xs font-semibold text-muted-foreground flex-1">{keyLabel}</span>
          <span className="text-xs font-semibold text-muted-foreground w-[140px]">{valueLabel}</span>
          <div className="w-8" />
        </div>
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 px-3 py-2">
            <span className="text-sm flex-1 font-medium">{key}</span>
            <Input
              type={valueType}
              step={valueType === 'number' ? '0.01' : undefined}
              value={value}
              onChange={(e) => handleEdit(key, valueType === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
              className="h-8 text-sm w-[140px]"
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive/60 hover:text-destructive" onClick={() => handleRemove(key)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder={keyLabel} className="h-8 text-sm flex-1" />
        <Input
          type={valueType}
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          placeholder={valueLabel}
          className="h-8 text-sm w-[140px]"
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newKey.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}

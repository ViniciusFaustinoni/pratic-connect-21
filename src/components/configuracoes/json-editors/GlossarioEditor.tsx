import { useState } from 'react';
import { Plus, Trash2, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface GlossarioItem {
  termo: string;
  definicao: string;
}

interface Props {
  items: GlossarioItem[];
  onChange: (items: GlossarioItem[]) => void;
}

export function GlossarioEditor({ items, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [newTermo, setNewTermo] = useState('');
  const [newDef, setNewDef] = useState('');

  const handleEdit = (index: number, field: 'termo' | 'definicao', value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (!newTermo.trim() || !newDef.trim()) return;
    onChange([...items, { termo: newTermo.trim().toUpperCase(), definicao: newDef.trim() }]);
    setNewTermo('');
    setNewDef('');
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/50 divide-y divide-border/50">
        {items.map((item, i) => (
          <div key={i} className="flex gap-3 px-3 py-3">
            <BookOpen className="h-4 w-4 text-muted-foreground mt-2.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <Input
                value={item.termo}
                onChange={(e) => handleEdit(i, 'termo', e.target.value)}
                className="h-8 text-sm font-semibold uppercase"
              />
              <Textarea
                value={item.definicao}
                onChange={(e) => handleEdit(i, 'definicao', e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive/60 hover:text-destructive mt-1" onClick={() => handleRemove(i)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <Input value={newTermo} onChange={(e) => setNewTermo(e.target.value)} placeholder="TERMO" className="h-8 text-sm font-semibold uppercase" autoFocus />
          <Textarea value={newDef} onChange={(e) => setNewDef(e.target.value)} placeholder="Definição do termo..." rows={2} className="text-sm resize-none" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!newTermo.trim() || !newDef.trim()}>Adicionar</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar termo
        </Button>
      )}
    </div>
  );
}

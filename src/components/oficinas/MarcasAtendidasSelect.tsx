import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MARCAS_VEICULOS } from '@/lib/fornecedores-constants';

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
}

export function MarcasAtendidasSelect({ value, onChange }: Props) {
  const [search, setSearch] = useState('');
  const isGlobal = value.includes('GLOBAL');

  const filtered = MARCAS_VEICULOS.filter(m =>
    m.toLowerCase().includes(search.toLowerCase())
  );

  const toggleGlobal = () => {
    onChange(isGlobal ? [] : ['GLOBAL']);
  };

  const toggleMarca = (marca: string) => {
    if (isGlobal) return;
    onChange(
      value.includes(marca)
        ? value.filter(v => v !== marca)
        : [...value, marca]
    );
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Marcas Atendidas</Label>

      {/* Selected badges */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {isGlobal ? (
            <Badge className="bg-primary text-primary-foreground">GLOBAL — Todas as marcas</Badge>
          ) : (
            value.map(m => (
              <Badge key={m} variant="secondary" className="text-xs">
                {m}
              </Badge>
            ))
          )}
        </div>
      )}

      {/* Global checkbox */}
      <div className="flex items-center gap-2 rounded-md border p-3 bg-muted/50">
        <Checkbox
          id="global"
          checked={isGlobal}
          onCheckedChange={toggleGlobal}
        />
        <Label htmlFor="global" className="cursor-pointer font-medium text-sm">
          GLOBAL — Atende todas as marcas
        </Label>
      </div>

      {/* Search + list */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar marca..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          disabled={isGlobal}
        />
      </div>
      <ScrollArea className="h-48 rounded-md border p-3">
        <div className="grid grid-cols-2 gap-2">
          {filtered.map(marca => (
            <div key={marca} className="flex items-center gap-2">
              <Checkbox
                id={`marca-${marca}`}
                checked={value.includes(marca)}
                onCheckedChange={() => toggleMarca(marca)}
                disabled={isGlobal}
              />
              <Label
                htmlFor={`marca-${marca}`}
                className={`cursor-pointer text-sm ${isGlobal ? 'text-muted-foreground' : ''}`}
              >
                {marca}
              </Label>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

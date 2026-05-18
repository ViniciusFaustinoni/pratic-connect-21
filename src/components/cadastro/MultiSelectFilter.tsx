import { useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  placeholderAll: string;
  selected: string[];
  options: Option[];
  onToggle: (value: string) => void;
  onClear: () => void;
  width?: string;
  searchable?: boolean;
}

/**
 * Filtro multi-seleção compacto: trigger no padrão dos Selects existentes,
 * popover com checkboxes e busca opcional.
 */
export function MultiSelectFilter({
  label,
  placeholderAll,
  selected,
  options,
  onToggle,
  onClear,
  width = 'w-[160px]',
  searchable = false,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const triggerLabel = useMemo(() => {
    if (selected.length === 0) return placeholderAll;
    if (selected.length === 1) {
      const found = options.find((o) => o.value === selected[0]);
      return found?.label ?? selected[0];
    }
    return `${selected.length} selecionados`;
  }, [selected, options, placeholderAll]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-9 text-xs bg-card justify-between font-normal',
            width,
            selected.length > 0 && 'border-primary/40 text-foreground'
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          {selected.length > 1 ? (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {selected.length}
            </Badge>
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0 ml-1" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <div className="flex items-center justify-between px-2 py-1.5 border-b">
          <span className="text-xs font-medium text-muted-foreground capitalize">
            Filtrar por {label}
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => { onClear(); setQuery(''); }}
              className="text-[11px] text-destructive hover:underline flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>
        {searchable && (
          <div className="relative border-b">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-8 pl-7 border-0 focus-visible:ring-0 text-xs"
            />
          </div>
        )}
        <div className="max-h-[260px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Nenhuma opção encontrada
            </p>
          ) : (
            filtered.map((opt) => {
              const checked = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onToggle(opt.value)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted text-left"
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

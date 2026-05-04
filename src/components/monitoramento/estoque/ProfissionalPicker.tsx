import { useMemo, useState } from 'react';
import { Check, Search, User, UserMinus, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export interface ProfissionalOption {
  id: string;
  nome: string;
  rastreadores_atribuidos?: number;
}

interface ProfissionalPickerProps {
  profissionais: ProfissionalOption[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  currentPortadorId?: string | null;
  allowRemove?: boolean;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

export function ProfissionalPicker({
  profissionais,
  value,
  onChange,
  loading,
  currentPortadorId,
  allowRemove,
}: ProfissionalPickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profissionais;
    return profissionais.filter((p) => p.nome.toLowerCase().includes(q));
  }, [profissionais, query]);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="relative border-b bg-muted/30">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar profissional pelo nome..."
          className="border-0 bg-transparent pl-9 focus-visible:ring-0 focus-visible:ring-offset-0 h-11"
        />
      </div>

      <ScrollArea className="h-[340px]">
        <div className="p-2 space-y-1">
          {allowRemove && currentPortadorId && (
            <button
              type="button"
              onClick={() => onChange('remover')}
              className={cn(
                'w-full flex items-center gap-3 rounded-md p-3 text-left transition-colors',
                'hover:bg-destructive/10 border border-transparent',
                value === 'remover' &&
                  'bg-destructive/10 border-destructive/40',
              )}
            >
              <div className="h-9 w-9 rounded-full bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                <UserMinus className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-destructive">
                  Remover atribuição
                </div>
                <div className="text-xs text-muted-foreground">
                  Devolver o rastreador ao estoque
                </div>
              </div>
              {value === 'remover' && (
                <Check className="h-4 w-4 text-destructive shrink-0" />
              )}
            </button>
          )}

          {loading ? (
            <div className="text-sm text-muted-foreground p-6 text-center">
              Carregando profissionais...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground p-6 text-center">
              Nenhum profissional encontrado
            </div>
          ) : (
            filtered.map((p) => {
              const isCurrent = p.id === currentPortadorId;
              const isSelected = value === p.id;
              const count = p.rastreadores_atribuidos ?? 0;
              return (
                <button
                  type="button"
                  key={p.id}
                  disabled={isCurrent}
                  onClick={() => onChange(p.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-md p-3 text-left transition-colors border border-transparent',
                    'hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent',
                    isSelected && 'bg-primary/10 border-primary/40',
                  )}
                >
                  <div
                    className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {getInitials(p.nome) || <User className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      <span className="truncate">{p.nome}</span>
                      {isCurrent && (
                        <Badge variant="secondary" className="text-[10px] py-0 h-4">
                          Atual
                        </Badge>
                      )}
                    </div>
                    {count > 0 && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Package className="h-3 w-3" />
                        {count} rastreador{count > 1 ? 'es' : ''} em posse
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

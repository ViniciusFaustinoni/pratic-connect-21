import { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ListToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  children?: ReactNode;
}

/**
 * Toolbar padrão para listas paginadas: busca + slot de filtros + limpar.
 */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  hasActiveFilters,
  onClearFilters,
  children,
}: ListToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[260px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            aria-label="Limpar busca"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
      {hasActiveFilters && onClearFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-destructive">
          <X className="mr-1 h-3.5 w-3.5" /> Limpar filtros
        </Button>
      )}
    </div>
  );
}

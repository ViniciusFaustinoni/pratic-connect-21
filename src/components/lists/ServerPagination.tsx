import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface ServerPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  range: { from: number; to: number };
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: 25 | 50 | 100) => void;
  isFetching?: boolean;
}

/**
 * Paginação server-side padronizada: usa em conjunto com `useServerList`.
 */
export function ServerPagination({
  page,
  totalPages,
  pageSize,
  total,
  range,
  onPageChange,
  onPageSizeChange,
  isFetching,
}: ServerPaginationProps) {
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <div className="text-muted-foreground">
        Mostrando <strong>{range.from.toLocaleString('pt-BR')}</strong>–
        <strong>{range.to.toLocaleString('pt-BR')}</strong> de{' '}
        <strong>{total.toLocaleString('pt-BR')}</strong>
        {isFetching && <span className="ml-2 opacity-60">(atualizando…)</span>}
      </div>

      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v) as 25 | 50 | 100)}>
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          aria-label="Primeira página"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="px-2 font-mono">
          {page} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Última página"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

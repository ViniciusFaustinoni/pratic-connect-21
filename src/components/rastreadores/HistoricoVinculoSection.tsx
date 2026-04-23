import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { ArrowRight, ChevronDown, ChevronRight, History, Loader2, Search, User, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { useDebounce } from '@/hooks/useDebounce';
import { useHistoricoVinculoFiltrado } from '@/hooks/useHistoricoVinculoFiltrado';

interface HistoricoVinculoSectionProps {
  rastreadorId?: string | null;
  veiculoId?: string | null;
  titulo?: string;
  defaultOpen?: boolean;
}

export function HistoricoVinculoSection({
  rastreadorId,
  veiculoId,
  titulo = 'Histórico de Vínculo',
  defaultOpen = true,
}: HistoricoVinculoSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [placaFiltro, setPlacaFiltro] = useState('');
  const [periodo, setPeriodo] = useState<DateRange | undefined>();

  const placaDebounced = useDebounce(placaFiltro, 250);

  const { items, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useHistoricoVinculoFiltrado({
    rastreadorId,
    veiculoId,
    placa: placaDebounced,
    dataInicio: periodo?.from,
    dataFim: periodo?.to,
  });

  const temFiltros = useMemo(
    () => Boolean(placaFiltro.trim()) || Boolean(periodo?.from) || Boolean(periodo?.to),
    [placaFiltro, periodo],
  );

  const limparFiltros = () => {
    setPlacaFiltro('');
    setPeriodo(undefined);
  };

  // Auto-load via IntersectionObserver — botão "Carregar mais" continua como fallback acessível.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          fetchNextPage();
        }
      },
      { rootMargin: '120px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-3">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <History className="h-4 w-4" />
            {titulo}
            <Badge variant="secondary" className="ml-1">
              {items.length}
              {hasNextPage ? '+' : ''}
            </Badge>
          </h3>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3">
        {/* Filtros */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={placaFiltro}
              onChange={(e) => setPlacaFiltro(e.target.value.toUpperCase())}
              placeholder="Buscar por placa…"
              className="pl-9 uppercase"
              maxLength={10}
            />
          </div>
          <div className="sm:w-[280px]">
            <DatePickerWithRange date={periodo} onDateChange={setPeriodo} />
          </div>
          {temFiltros && (
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="shrink-0">
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            {temFiltros ? 'Nenhum registro encontrado para os filtros aplicados.' : 'Nenhum vínculo registrado.'}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((h) => {
              const mudouVinculo = h.veiculo_id_anterior !== h.veiculo_id_novo;
              const mudouStatus = h.status_anterior !== h.status_novo;
              const placaDe = h.placa_anterior || (h.veiculo_id_anterior ? '(veículo)' : '—');
              const placaPara = h.placa_nova || (h.veiculo_id_novo ? '(veículo)' : '—');

              return (
                <div key={h.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        <History className="h-4 w-4 text-slate-600" />
                        <span>{mudouVinculo ? 'Alteração de Vínculo' : mudouStatus ? 'Alteração de Status' : 'Atualização'}</span>
                      </div>
                      {mudouVinculo && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono">{placaDe}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono">{placaPara}</span>
                        </div>
                      )}
                      {mudouStatus && h.status_anterior && h.status_novo && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{h.status_anterior}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span>{h.status_novo}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {h.alterado_por_nome && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {h.alterado_por_nome}
                          </span>
                        )}
                        {h.origem && (
                          <Badge variant="outline" className="text-xs bg-slate-500/10 text-slate-600 border-slate-500/30">
                            {h.origem}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {format(new Date(h.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              );
            })}

            {hasNextPage && (
              <>
                <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Carregando…
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      Carregar mais
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Plus, CalendarIcon, Wrench, ClipboardCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAddInstalacaoToRota } from '@/hooks/useRotas';
import { useServicosDisponiveis, useVincularServicosRota } from '@/hooks/useServicosRota';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { TIPO_SERVICO_LABELS, TIPO_SERVICO_COLORS } from '@/types/servicos-rota';
import type { ServicoRota, TipoServico } from '@/types/servicos-rota';

interface AddInstalacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rotaId: string;
  rotaData?: string;
}

export function AddInstalacaoDialog({ 
  open, 
  onOpenChange, 
  rotaId,
  rotaData 
}: AddInstalacaoDialogProps) {
  const [dataFiltro, setDataFiltro] = useState<Date | undefined>(
    rotaData ? parseISO(rotaData) : undefined
  );
  const { data: servicos, isLoading } = useServicosDisponiveis(dataFiltro);
  
  // Query para verificar total de serviços agendados (com ou sem rota)
  const { data: totalServicos = 0 } = useQuery({
    queryKey: ['total-servicos-agendados', dataFiltro ? format(dataFiltro, 'yyyy-MM-dd') : 'todas'],
    queryFn: async () => {
      let query = supabase
        .from('servicos_pendentes_rota')
        .select('*', { count: 'exact', head: true });
      
      if (dataFiltro) {
        query = query.eq('data_agendada', format(dataFiltro, 'yyyy-MM-dd'));
      }
      
      const { count } = await query;
      return count || 0;
    },
    enabled: open
  });
  
  const addInstalacao = useAddInstalacaoToRota();
  const vincularServicos = useVincularServicosRota();

  const handleAdd = async (servico: ServicoRota) => {
    try {
      if (servico.tipo_servico === 'instalacao') {
        await addInstalacao.mutateAsync({ instalacaoId: servico.id, rotaId });
      } else {
        await vincularServicos.mutateAsync({ 
          rotaId, 
          servicos: [{ id: servico.id, tipo_servico: servico.tipo_servico }] 
        });
      }
      toast.success('Serviço adicionado à rota');
    } catch {
      toast.error('Erro ao adicionar serviço');
    }
  };

  const getTipoIcon = (tipo: TipoServico) => {
    if (tipo === 'instalacao') return <Wrench className="h-3 w-3" />;
    return <ClipboardCheck className="h-3 w-3" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Serviços à Rota</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filtro de data */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtrar por data:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'justify-start text-left font-normal',
                    !dataFiltro && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFiltro ? (
                    format(dataFiltro, "dd 'de' MMMM", { locale: ptBR })
                  ) : (
                    <span>Todas as datas</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataFiltro}
                  onSelect={setDataFiltro}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {dataFiltro && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setDataFiltro(undefined)}
              >
                Limpar
              </Button>
            )}
          </div>

          {/* Lista de serviços */}
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : servicos?.length ? (
              <div className="space-y-2">
                {servicos.map((servico) => (
                  <div 
                    key={`${servico.tipo_servico}-${servico.id}`} 
                    className="relative rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="secondary" 
                            className={cn("text-xs", TIPO_SERVICO_COLORS[servico.tipo_servico as TipoServico])}
                          >
                            {getTipoIcon(servico.tipo_servico as TipoServico)}
                            <span className="ml-1">
                              {TIPO_SERVICO_LABELS[servico.tipo_servico as TipoServico] || servico.tipo_servico}
                            </span>
                          </Badge>
                          {servico.data_agendada && (
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(servico.data_agendada), 'dd/MM')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">
                          {servico.associado_nome || 'Sem associado'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {servico.placa && `${servico.placa} - `}
                          {servico.marca} {servico.modelo}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {servico.endereco_bairro}, {servico.endereco_cidade}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAdd(servico)}
                        disabled={addInstalacao.isPending || vincularServicos.isPending}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center text-center">
                {totalServicos === 0 ? (
                  <>
                    <p className="text-muted-foreground">
                      Nenhum serviço agendado{dataFiltro ? ' para esta data' : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Agende instalações ou vistorias para adicioná-las às rotas
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      Nenhum serviço disponível
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Todos os serviços já estão atribuídos a rotas
                    </p>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Plus, CalendarIcon } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useInstalacoesDisponiveis, useAddInstalacaoToRota } from '@/hooks/useRotas';
import { InstalacaoMiniCard } from './InstalacaoMiniCard';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const { data: instalacoes, isLoading } = useInstalacoesDisponiveis(dataFiltro);
  
  // Query para verificar total de instalações agendadas (com ou sem rota)
  const { data: totalInstalacoes = 0 } = useQuery({
    queryKey: ['total-instalacoes-agendadas', dataFiltro ? format(dataFiltro, 'yyyy-MM-dd') : 'todas'],
    queryFn: async () => {
      let query = supabase
        .from('instalacoes')
        .select('*', { count: 'exact', head: true })
        .in('status', ['agendada', 'reagendada']);
      
      if (dataFiltro) {
        query = query.eq('data_agendada', format(dataFiltro, 'yyyy-MM-dd'));
      }
      
      const { count } = await query;
      return count || 0;
    },
    enabled: open
  });
  const addToRota = useAddInstalacaoToRota();

  const handleAdd = async (instalacaoId: string) => {
    try {
      await addToRota.mutateAsync({ instalacaoId, rotaId });
      toast.success('Instalação adicionada à rota');
    } catch {
      toast.error('Erro ao adicionar instalação');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adicionar Instalações à Rota</DialogTitle>
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

          {/* Lista de instalações */}
          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : instalacoes?.length ? (
              <div className="space-y-2">
                {instalacoes.map((instalacao) => (
                  <div key={instalacao.id} className="relative">
                    <InstalacaoMiniCard 
                      instalacao={instalacao as any}
                    />
                    <Button
                      size="sm"
                      className="absolute right-2 top-2"
                      onClick={() => handleAdd(instalacao.id)}
                      disabled={addToRota.isPending}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center text-center">
                {totalInstalacoes === 0 ? (
                  <>
                    <p className="text-muted-foreground">
                      Nenhuma instalação agendada{dataFiltro ? ' para esta data' : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Agende instalações para poder adicioná-las às rotas
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      Nenhuma instalação disponível
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Todas as instalações já estão atribuídas a rotas
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

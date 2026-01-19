import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useInstaladores, type Rota } from '@/hooks/useRotas';
import { useBairrosDisponiveis, useInstalacoesPorBairros } from '@/hooks/useBairrosDisponiveis';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { InstaladorMultiSelect } from './InstaladorMultiSelect';
import { BairroSelector } from './BairroSelector';
import { DistribuicaoPreview, distribuirInstalacoes, type DistribuicaoItem } from './DistribuicaoPreview';

interface RotaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rota?: Rota | null;
}

export function RotaFormDialog({ open, onOpenChange, rota }: RotaFormDialogProps) {
  const queryClient = useQueryClient();
  const { data: instaladores } = useInstaladores();
  const isEditing = !!rota;

  // Form state
  const [dataRota, setDataRota] = useState<Date>(new Date());
  const [selectedInstaladores, setSelectedInstaladores] = useState<string[]>([]);
  const [selectedBairros, setSelectedBairros] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [distribuicao, setDistribuicao] = useState<DistribuicaoItem[]>([]);

  // Data hooks
  const { data: bairrosDisponiveis, isLoading: loadingBairros } = useBairrosDisponiveis(dataRota);
  const { data: instalacoesSelecionadas } = useInstalacoesPorBairros(selectedBairros, dataRota);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (rota) {
        setDataRota(rota.data_rota ? parseISO(rota.data_rota) : new Date());
        setSelectedInstaladores(rota.instalador_id ? [rota.instalador_id] : []);
        setSelectedBairros([]);
      } else {
        setDataRota(new Date());
        setSelectedInstaladores([]);
        setSelectedBairros([]);
      }
      setDistribuicao([]);
    }
  }, [open, rota]);

  // Calculate distribution when instaladores or instalacoes change
  useEffect(() => {
    if (selectedInstaladores.length && instalacoesSelecionadas?.length && instaladores) {
      const instaladoresInfo = instaladores
        .filter((i) => selectedInstaladores.includes(i.id))
        .map((i) => ({ id: i.id, nome: i.nome }));
      
      const dist = distribuirInstalacoes(instalacoesSelecionadas, instaladoresInfo);
      setDistribuicao(dist);
    } else {
      setDistribuicao([]);
    }
  }, [selectedInstaladores, instalacoesSelecionadas, instaladores]);

  const handleRedistribuir = () => {
    if (selectedInstaladores.length && instalacoesSelecionadas?.length && instaladores) {
      const instaladoresInfo = instaladores
        .filter((i) => selectedInstaladores.includes(i.id))
        .map((i) => ({ id: i.id, nome: i.nome }));
      
      // Shuffle instalacoes for different distribution
      const shuffled = [...instalacoesSelecionadas].sort(() => Math.random() - 0.5);
      const dist = distribuirInstalacoes(shuffled, instaladoresInfo);
      setDistribuicao(dist);
    }
  };

  const handleSubmit = async () => {
    if (!selectedInstaladores.length) {
      toast.error('Selecione pelo menos um instalador');
      return;
    }

    setIsSubmitting(true);
    try {
      const dataFormatada = format(dataRota, 'yyyy-MM-dd');
      const codigo = `ROT-${format(dataRota, 'yyyyMMdd')}-TMP`;

      // Create rota with first instalador as primary (for backward compatibility)
      const { data: novaRota, error: rotaError } = await supabase
        .from('rotas')
        .insert({
          data_rota: dataFormatada,
          instalador_id: selectedInstaladores[0],
          codigo,
          cidade: selectedBairros.length ? instalacoesSelecionadas?.[0]?.cidade : null,
          regiao: selectedBairros.join(', ').substring(0, 100),
        })
        .select()
        .single();

      if (rotaError) throw rotaError;

      // Add all instaladores to rota_instaladores
      if (selectedInstaladores.length > 0) {
        const rotaInstaladores = selectedInstaladores.map((instaladorId) => ({
          rota_id: novaRota.id,
          instalador_id: instaladorId,
        }));

        const { error: instError } = await supabase
          .from('rota_instaladores')
          .insert(rotaInstaladores);

        if (instError) console.error('Error adding rota_instaladores:', instError);
      }

      // Assign instalacoes to rota with their responsible instalador
      if (distribuicao.length) {
        for (const item of distribuicao) {
          const instalacaoIds = item.instalacoes.map((i) => i.id);
          if (instalacaoIds.length) {
            await supabase
              .from('instalacoes')
              .update({
                rota_id: novaRota.id,
                instalador_responsavel_id: item.instaladorId,
              })
              .in('id', instalacaoIds);
          }
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-semana'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['bairros-disponiveis'] });

      toast.success(`Rota criada com ${distribuicao.reduce((acc, d) => acc + d.instalacoes.length, 0)} instalações!`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating rota:', error);
      toast.error('Erro ao criar rota');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalInstalacoes = instalacoesSelecionadas?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Rota' : 'Nova Rota'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Data da Rota */}
          <div className="space-y-2">
            <Label>Data da Rota</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full pl-3 text-left font-normal',
                    !dataRota && 'text-muted-foreground'
                  )}
                >
                  {dataRota ? (
                    format(dataRota, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione a data</span>
                  )}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataRota}
                  onSelect={(date) => date && setDataRota(date)}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Instaladores */}
          <div className="space-y-2">
            <Label>Instaladores</Label>
            <InstaladorMultiSelect
              selectedIds={selectedInstaladores}
              onSelectionChange={setSelectedInstaladores}
              placeholder="Selecione os instaladores"
            />
          </div>

          {/* Bairros */}
          <div className="space-y-2">
            <Label>Bairros com Instalações Pendentes</Label>
            <BairroSelector
              bairros={bairrosDisponiveis || []}
              selectedBairros={selectedBairros}
              onSelectionChange={setSelectedBairros}
              isLoading={loadingBairros}
              placeholder="Selecione os bairros"
            />
            {totalInstalacoes > 0 && (
              <p className="text-xs text-muted-foreground">
                {totalInstalacoes} instalação(ões) serão vinculadas à rota
              </p>
            )}
          </div>

          {/* Preview da Distribuição */}
          {distribuicao.length > 0 && (
            <DistribuicaoPreview
              instaladores={(instaladores || [])
                .filter((i) => selectedInstaladores.includes(i.id))
                .map((i) => ({ id: i.id, nome: i.nome }))}
              instalacoes={instalacoesSelecionadas || []}
              distribuicao={distribuicao}
              onRedistribuir={handleRedistribuir}
            />
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedInstaladores.length}
            >
              {isSubmitting ? 'Criando...' : 'Criar Rota'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

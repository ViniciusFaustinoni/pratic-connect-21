import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Check } from 'lucide-react';
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

// Cores predefinidas para rotas
const ROTA_COLORS = [
  '#3B82F6', // Azul
  '#10B981', // Verde
  '#8B5CF6', // Roxo
  '#F59E0B', // Laranja
  '#EF4444', // Vermelho
  '#EC4899', // Rosa
  '#06B6D4', // Ciano
  '#84CC16', // Lima
];

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
  const [corSelecionada, setCorSelecionada] = useState(ROTA_COLORS[0]);
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
        setCorSelecionada(ROTA_COLORS[Math.floor(Math.random() * ROTA_COLORS.length)]);
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
          cor: corSelecionada,
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
                instalador_id: item.instaladorId,
                instalador_responsavel_id: item.instaladorId,
              })
              .in('id', instalacaoIds);
          }
        }
      }

      // Vincular cotações do(s) bairro(s) selecionado(s) à rota
      let cotacoesVinculadas = 0;
      let contratosVinculados = 0;
      
      if (selectedBairros.length > 0) {
        // Buscar cotações pendentes nos bairros selecionados (vistoria não concluída)
        const { data: cotacoesParaVincular, error: cotacoesError } = await supabase
          .from('cotacoes')
          .select('id')
          .in('vistoria_endereco_bairro', selectedBairros)
          .is('vistoria_rota_id', null)
          .is('vistoria_concluida_em', null)
          .lte('vistoria_data_agendada', dataFormatada);
        
        if (cotacoesError) {
          console.error('Erro ao buscar cotações:', cotacoesError);
        } else if (cotacoesParaVincular?.length) {
          const cotacoesIds = cotacoesParaVincular.map(c => c.id);
          // Buscar nome do instalador responsável
          const instaladorResponsavel = instaladores?.find(i => i.id === selectedInstaladores[0]);
          const { error: updateCotError } = await supabase
            .from('cotacoes')
            .update({ 
              vistoria_rota_id: novaRota.id,
              vistoria_responsavel_nome: instaladorResponsavel?.nome || null,
            })
            .in('id', cotacoesIds);
          
          if (updateCotError) {
            console.error('Erro ao vincular cotações:', updateCotError);
            toast.error(`Erro ao vincular ${cotacoesIds.length} cotações à rota`);
          } else {
            cotacoesVinculadas = cotacoesIds.length;
            
            // IMPORTANTE: Atualizar também a tabela vistorias (sistema unificado)
            const { error: vistCotError } = await supabase
              .from('vistorias')
              .update({ 
                rota_id: novaRota.id,
                vistoriador_id: selectedInstaladores[0],
              })
              .in('cotacao_id', cotacoesIds);
            
            if (vistCotError) {
              console.error('Erro ao vincular vistorias de cotações:', vistCotError);
            }
          }
        }

        // Vincular contratos pendentes nos bairros selecionados (vistoria completa não concluída)
        const { data: contratosParaVincular, error: contratosError } = await supabase
          .from('contratos')
          .select('id')
          .in('vistoria_completa_endereco_bairro', selectedBairros)
          .is('vistoria_rota_id', null)
          .is('vistoria_concluida_em', null)
          .lte('vistoria_completa_data_agendada', dataFormatada);
        
        if (contratosError) {
          console.error('Erro ao buscar contratos:', contratosError);
        } else if (contratosParaVincular?.length) {
          const contratosIds = contratosParaVincular.map(c => c.id);
          const { error: updateContError } = await supabase
            .from('contratos')
            .update({ 
              vistoria_rota_id: novaRota.id,
            })
            .in('id', contratosIds);
          
          if (updateContError) {
            console.error('Erro ao vincular contratos:', updateContError);
          } else {
            contratosVinculados = contratosIds.length;
            
            // IMPORTANTE: Atualizar também a tabela vistorias (sistema unificado)
            const { error: vistContError } = await supabase
              .from('vistorias')
              .update({ 
                rota_id: novaRota.id,
                vistoriador_id: selectedInstaladores[0],
              })
              .in('contrato_id', contratosIds);
            
            if (vistContError) {
              console.error('Erro ao vincular vistorias de contratos:', vistContError);
            }
          }
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-semana'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['bairros-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });

      const totalInstalacoes = distribuicao.reduce((acc, d) => acc + d.instalacoes.length, 0);
      const vinculosMensagem = [
        totalInstalacoes > 0 ? `${totalInstalacoes} instalações` : null,
        cotacoesVinculadas > 0 ? `${cotacoesVinculadas} cotações` : null,
        contratosVinculados > 0 ? `${contratosVinculados} contratos` : null,
      ].filter(Boolean).join(', ');
      
      toast.success(`Rota criada com sucesso!${vinculosMensagem ? ` Vinculados: ${vinculosMensagem}.` : ''}`);
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

          {/* Cor da Rota */}
          <div className="space-y-2">
            <Label>Cor da Rota</Label>
            <div className="flex gap-2 flex-wrap">
              {ROTA_COLORS.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setCorSelecionada(cor)}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center",
                    corSelecionada === cor 
                      ? "border-foreground scale-110 shadow-md" 
                      : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: cor }}
                >
                  {corSelecionada === cor && (
                    <Check className="h-4 w-4 text-white drop-shadow-md" />
                  )}
                </button>
              ))}
            </div>
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

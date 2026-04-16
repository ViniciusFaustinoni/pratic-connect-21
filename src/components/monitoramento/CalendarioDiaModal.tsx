import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isAfter, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Building2, Clock, User, Car, CalendarClock, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfissionaisEquipe } from '@/hooks/useEquipe';
import { toast } from 'sonner';
import { STATUS_INSTALACAO_COLORS } from '@/types/monitoramento';

interface CalendarioDiaModalProps {
  open: boolean;
  onClose: () => void;
  data: string; // yyyy-MM-dd
}

const STATUS_VISTORIA_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  agendada: 'Agendada',
  em_rota: 'Em Rota',
  em_andamento: 'Em Andamento',
  em_analise: 'Em Análise',
  aprovada: 'Aprovada',
  concluida: 'Concluída',
  confirmado: 'Confirmado',
  agendado: 'Agendado',
  cancelado: 'Cancelado',
  cancelada: 'Cancelada',
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  pendente: 'bg-muted text-muted-foreground',
  agendada: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  agendado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  confirmado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  em_rota: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  em_andamento: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  em_analise: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  aprovada: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  concluida: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  cancelado: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
  cancelada: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

export function CalendarioDiaModal({ open, onClose, data }: CalendarioDiaModalProps) {
  const queryClient = useQueryClient();
  const [anteciparId, setAnteciparId] = useState<string | null>(null);
  const [atribuirId, setAtribuirId] = useState<string | null>(null);
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState<string>('');

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const parsedData = data ? parseISO(data) : new Date();
  const dataFutura = data ? isAfter(parsedData, startOfDay(new Date())) : false;
  const dataFormatada = data ? format(parsedData, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '';

  // --- Queries ---

  // Instalações do dia
  const { data: instalacoes = [], isLoading: loadingInst } = useQuery({
    queryKey: ['calendario-dia-instalacoes', data],
    enabled: open,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('instalacoes')
        .select('id, status, data_agendada, periodo, associados(nome), veiculos(placa), instalador:profiles!instalacoes_instalador_responsavel_id_fkey(nome)')
        .eq('data_agendada', data);
      if (error) throw error;
      return rows || [];
    },
  });

  // Vistorias de campo do dia
  const { data: vistoriasCampo = [], isLoading: loadingVist } = useQuery({
    queryKey: ['calendario-dia-vistorias-campo', data],
    enabled: open,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('vistorias')
        .select('id, status, data_agendada, local_vistoria, modalidade, associado:associados(nome), veiculo:veiculos(placa), tecnico:profiles!vistorias_tecnico_id_fkey(nome)')
        .gte('data_agendada', data)
        .lte('data_agendada', data + 'T23:59:59')
        .neq('local_vistoria', 'base')
        .in('status', ['pendente', 'agendada', 'em_rota', 'em_andamento', 'em_analise', 'aprovada', 'concluida']);
      if (error) throw error;
      return rows || [];
    },
  });

  // Agendamentos base do dia
  const { data: agendamentosBase = [], isLoading: loadingBase } = useQuery({
    queryKey: ['calendario-dia-base', data],
    enabled: open,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('agendamentos_base')
        .select('id, status, data_agendada, horario, cliente_nome, veiculo_placa, veiculo_descricao, atendido_por, tecnico:profiles!agendamentos_base_atendido_por_fkey(nome)')
        .eq('data_agendada', data)
        .order('horario');
      if (error) throw error;
      return rows || [];
    },
  });

  // Técnicos base ativos
  const { data: profissionais = [] } = useProfissionaisEquipe();
  const tecnicosBaseAtivos = useMemo(
    () => (profissionais || []).filter((p: any) => p.ativo && p.status !== 'ferias' && p.status !== 'afastado'),
    [profissionais]
  );

  // --- Mutation: Antecipar tarefa ---
  const anteciparMutation = useMutation({
    mutationFn: async ({ id, tecnicoId }: { id: string; tecnicoId: string }) => {
      const { error } = await supabase
        .from('agendamentos_base')
        .update({
          data_agendada: hoje,
          atendido_por: tecnicoId,
          status: 'confirmado',
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Tarefa antecipada para hoje com sucesso!');
      setAnteciparId(null);
      setTecnicoSelecionado('');
      queryClient.invalidateQueries({ queryKey: ['calendario-dia-base'] });
      queryClient.invalidateQueries({ queryKey: ['agendamentos-base-calendario'] });
      queryClient.invalidateQueries({ queryKey: ['calendario-dia-instalacoes'] });
    },
    onError: () => {
      toast.error('Erro ao antecipar tarefa');
    },
  });

  // --- Mutation: Atribuir técnico ---
  const atribuirMutation = useMutation({
    mutationFn: async ({ id, tecnicoId }: { id: string; tecnicoId: string }) => {
      const { error } = await supabase
        .from('agendamentos_base')
        .update({
          atendido_por: tecnicoId,
          status: 'confirmado',
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Técnico atribuído com sucesso!');
      setAtribuirId(null);
      setTecnicoSelecionado('');
      queryClient.invalidateQueries({ queryKey: ['calendario-dia-base'] });
      queryClient.invalidateQueries({ queryKey: ['agendamentos-base-calendario'] });
    },
    onError: () => {
      toast.error('Erro ao atribuir técnico');
    },
  });

  // --- Rota items: instalações + vistorias campo ---
  const rotaItems = useMemo(() => {
    const items: Array<{
      id: string;
      tipo: 'instalacao' | 'vistoria';
      status: string;
      placa: string;
      associado: string;
      tecnico: string;
      periodo: string;
    }> = [];

    (instalacoes as any[]).forEach((inst) => {
      items.push({
        id: inst.id,
        tipo: 'instalacao',
        status: inst.status,
        placa: inst.veiculos?.placa || '—',
        associado: inst.associados?.nome || '—',
        tecnico: inst.instalador?.nome || 'Não atribuído',
        periodo: inst.periodo || 'manha',
      });
    });

    (vistoriasCampo as any[]).forEach((v) => {
      items.push({
        id: v.id,
        tipo: 'vistoria',
        status: v.status,
        placa: v.veiculo?.placa || '—',
        associado: v.associado?.nome || '—',
        tecnico: v.tecnico?.nome || 'Não atribuído',
        periodo: 'manha', // vistorias campo don't have periodo
      });
    });

    return items;
  }, [instalacoes, vistoriasCampo]);

  // Group rota by period
  const rotaPorPeriodo = useMemo(() => {
    const groups: Record<string, typeof rotaItems> = { manha: [], tarde: [], noite: [] };
    rotaItems.forEach((item) => {
      const p = item.periodo in groups ? item.periodo : 'manha';
      groups[p].push(item);
    });
    return groups;
  }, [rotaItems]);

  const periodoLabels: Record<string, { label: string; emoji: string }> = {
    manha: { label: 'Manhã', emoji: '☀️' },
    tarde: { label: 'Tarde', emoji: '🌅' },
    noite: { label: 'Noite', emoji: '🌙' },
  };

  const isLoading = loadingInst || loadingVist || loadingBase;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            📅 Tarefas do dia {dataFormatada}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="rota" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="rota" className="flex-1 gap-1.5">
                <MapPin className="h-4 w-4" />
                Rota ({rotaItems.length})
              </TabsTrigger>
              <TabsTrigger value="base" className="flex-1 gap-1.5">
                <Building2 className="h-4 w-4" />
                Base ({agendamentosBase.length})
              </TabsTrigger>
            </TabsList>

            {/* ===== ABA ROTA ===== */}
            <TabsContent value="rota" className="space-y-4 mt-4">
              {rotaItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma tarefa de rota neste dia.</p>
              ) : (
                Object.entries(rotaPorPeriodo).map(([periodo, items]) => {
                  if (items.length === 0) return null;
                  const { label, emoji } = periodoLabels[periodo];
                  return (
                    <div key={periodo}>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        {emoji} {label} ({items.length})
                      </h4>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <Card key={item.id} className="border">
                            <CardContent className="p-3 flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={cn('text-xs', STATUS_BADGE_CLASSES[item.status] || 'bg-muted')}>
                                    {STATUS_VISTORIA_LABEL[item.status] || item.status}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {item.tipo === 'instalacao' ? 'Instalação' : 'Vistoria Campo'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                  <span className="flex items-center gap-1">
                                    <Car className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="font-medium">{item.placa}</span>
                                  </span>
                                  <span className="truncate text-muted-foreground">{item.associado}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                <User className="h-3.5 w-3.5" />
                                <span className="max-w-[120px] truncate">{item.tecnico}</span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* ===== ABA BASE ===== */}
            <TabsContent value="base" className="space-y-2 mt-4">
              {agendamentosBase.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum agendamento na base neste dia.</p>
              ) : (
                (agendamentosBase as any[]).map((ag) => {
                  const isAntecipar = anteciparId === ag.id;
                  return (
                    <Card key={ag.id} className="border">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={cn('text-xs', STATUS_BADGE_CLASSES[ag.status] || 'bg-muted')}>
                                {STATUS_VISTORIA_LABEL[ag.status] || ag.status}
                              </Badge>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {ag.horario}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="font-medium truncate">{ag.cliente_nome}</span>
                              {ag.veiculo_placa && (
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <Car className="h-3.5 w-3.5" />
                                  {ag.veiculo_placa}
                                </span>
                              )}
                            </div>
                            {ag.tecnico?.nome && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <User className="h-3 w-3" />
                                {ag.tecnico.nome}
                              </div>
                            )}
                          </div>

                          {/* Botão Antecipar: só para tarefas futuras */}
                          {dataFutura && ag.status !== 'cancelado' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 gap-1"
                              onClick={() => {
                                setAnteciparId(isAntecipar ? null : ag.id);
                                setTecnicoSelecionado('');
                              }}
                            >
                              <CalendarClock className="h-3.5 w-3.5" />
                              Antecipar
                            </Button>
                          )}
                        </div>

                        {/* Select de técnico ao antecipar */}
                        {isAntecipar && (
                          <div className="mt-3 flex items-center gap-2 pt-3 border-t">
                            <Select value={tecnicoSelecionado} onValueChange={setTecnicoSelecionado}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Selecione o técnico base..." />
                              </SelectTrigger>
                              <SelectContent position="popper" className="z-[1300]" sideOffset={4}>
                                {tecnicosBaseAtivos.map((t: any) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              disabled={!tecnicoSelecionado || anteciparMutation.isPending}
                              onClick={() =>
                                anteciparMutation.mutate({ id: ag.id, tecnicoId: tecnicoSelecionado })
                              }
                            >
                              {anteciparMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  Confirmar
                                  <ChevronRight className="h-4 w-4" />
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

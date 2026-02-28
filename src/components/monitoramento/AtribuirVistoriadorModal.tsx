import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  User, Car, MapPin, Clock, Star, AlertTriangle,
  XCircle, Loader2, Check
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// TIPOS
// ============================================

type StatusVistoriador = 'disponivel' | 'lotado' | 'indisponivel';

export interface VistoriaParaAtribuir {
  id: string;
  protocolo: string;
  cliente: string;
  veiculo: string;
  placa: string;
  endereco?: string;
  regiao?: string;
  dataAgendada: string;
  periodo: 'manha' | 'tarde';
  vistoriadorAtualId?: string | null;
  vistoriadorAtualNome?: string | null;
}

interface VistoriadorDisponivel {
  id: string;
  nome: string;
  telefone?: string;
  regioes: string[];
  tarefasDia: number;
  capacidadeDia: number;
  distanciaKm?: number;
  ultimaVistoria?: string;
  status: StatusVistoriador;
  motivoIndisponivel?: string;
  sugerido?: boolean;
}

export interface AtribuirVistoriadorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vistoria: VistoriaParaAtribuir | null;
  onSave: (vistoriadorId: string) => void;
}

// ============================================
// CONFIGURAÇÕES
// ============================================

const STATUS_CONFIG: Record<StatusVistoriador, {
  badge?: { label: string; className: string };
  cardClass: string;
  disabled: boolean;
}> = {
  disponivel: {
    cardClass: 'border-border hover:border-primary hover:bg-accent/50 cursor-pointer',
    disabled: false,
  },
  lotado: {
    badge: { label: 'Lotado', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    cardClass: 'border-amber-200 hover:border-amber-400 cursor-pointer',
    disabled: false,
  },
  indisponivel: {
    badge: { label: 'Indisponível', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    cardClass: 'border-red-200 opacity-60 cursor-not-allowed',
    disabled: true,
  },
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function AtribuirVistoriadorModal({
  open,
  onOpenChange,
  vistoria,
  onSave,
}: AtribuirVistoriadorModalProps) {
  const [selectedVistoriadorId, setSelectedVistoriadorId] = useState<string | null>(null);
  const [mostrarApenasDisponiveis, setMostrarApenasDisponiveis] = useState(true);
  const [mostrarOutrasRegioes, setMostrarOutrasRegioes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset ao abrir o modal
  useEffect(() => {
    if (open) {
      setSelectedVistoriadorId(null);
      setMostrarApenasDisponiveis(true);
      setMostrarOutrasRegioes(false);
    }
  }, [open]);

  // Buscar vistoriadores com role de instalador_vistoriador ou vistoriador_base
  const { data: vistoriadores = [], isLoading } = useQuery({
    queryKey: ['vistoriadores-para-atribuir', vistoria?.dataAgendada, vistoria?.regiao],
    queryFn: async (): Promise<VistoriadorDisponivel[]> => {
      // 1. Buscar user_ids que são vistoriadores
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'instalador_vistoriador');

      if (rolesError) throw rolesError;
      if (!roles?.length) return [];

      const userIds = roles.map(r => r.user_id);

      // 2. Buscar profiles apenas desses user_ids
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, nome, telefone, ativo, regioes_atendimento, capacidade_diaria')
        .in('user_id', userIds)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      // 3. Buscar contagem de tarefas para o dia selecionado
      let tarefasContagem: Record<string, number> = {};
      if (vistoria?.dataAgendada) {
        const { data: servicos } = await supabase
          .from('servicos')
          .select('profissional_id')
          .eq('data_agendada', vistoria.dataAgendada)
          .not('status', 'eq', 'cancelada');

        if (servicos) {
          servicos.forEach(s => {
            if (s.profissional_id) {
              tarefasContagem[s.profissional_id] = (tarefasContagem[s.profissional_id] || 0) + 1;
            }
          });
        }
      }

      // 4. Mapear para o formato esperado
      const enriched: VistoriadorDisponivel[] = (data || []).map((p, index) => {
        const tarefasDia = tarefasContagem[p.id] || 0;
        const capacidadeDia = p.capacidade_diaria || 5;
        const isLotado = tarefasDia >= capacidadeDia;
        const regioes = (p.regioes_atendimento as string[]) || [];

        let status: StatusVistoriador = 'disponivel';
        if (isLotado) status = 'lotado';

        return {
          id: p.id,
          nome: p.nome || 'Sem nome',
          telefone: p.telefone || undefined,
          regioes,
          tarefasDia,
          capacidadeDia,
          distanciaKm: undefined,
          ultimaVistoria: undefined,
          status,
          motivoIndisponivel: undefined,
          sugerido: index === 0 && status === 'disponivel' && regioes.length > 0,
        };
      });

      return enriched;
    },
    enabled: open && !!vistoria,
  });

  // Filtrar vistoriadores
  const vistoriadoresFiltrados = useMemo(() => {
    let result = [...vistoriadores];

    // Filtrar apenas disponíveis
    if (mostrarApenasDisponiveis) {
      result = result.filter(v => v.status !== 'indisponivel');
    }

    // Filtrar por região
    if (!mostrarOutrasRegioes && vistoria?.regiao) {
      result = result.filter(v =>
        v.regioes.some(r => r.toLowerCase().includes(vistoria.regiao!.toLowerCase()))
      );
    }

    // Ordenar: sugerido primeiro, depois disponíveis, depois por tarefas
    return result.sort((a, b) => {
      if (a.sugerido && !b.sugerido) return -1;
      if (b.sugerido && !a.sugerido) return 1;
      if (a.status === 'indisponivel' && b.status !== 'indisponivel') return 1;
      if (b.status === 'indisponivel' && a.status !== 'indisponivel') return -1;
      return a.tarefasDia - b.tarefasDia;
    });
  }, [vistoriadores, mostrarApenasDisponiveis, mostrarOutrasRegioes, vistoria?.regiao]);

  // Handler de submissão
  const handleConfirmar = async () => {
    if (!selectedVistoriadorId) return;

    setIsSubmitting(true);
    try {
      await onSave(selectedVistoriadorId);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Formatar data e período
  const dataFormatada = vistoria?.dataAgendada
    ? format(new Date(vistoria.dataAgendada), "dd/MM/yyyy", { locale: ptBR })
    : '';
  const periodoLabel = vistoria?.periodo === 'manha' ? 'Manhã' : 'Tarde';

  if (!vistoria) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Atribuir Vistoriador
          </DialogTitle>
          <DialogDescription>
            {vistoria.protocolo} | {dataFormatada} - {periodoLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Card Resumo */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium">{vistoria.cliente}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Veículo:</span>
                  <span className="font-medium">{vistoria.veiculo} - {vistoria.placa}</span>
                </div>
                {vistoria.endereco && (
                  <div className="flex items-center gap-2 col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Endereço:</span>
                    <span className="font-medium">{vistoria.endereco}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 col-span-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Vistoriador atual:</span>
                  <span className="font-medium">
                    {vistoria.vistoriadorAtualNome || 'Nenhum'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filtros Rápidos */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mostrar-disponiveis"
                checked={mostrarApenasDisponiveis}
                onCheckedChange={(checked) => setMostrarApenasDisponiveis(!!checked)}
              />
              <Label htmlFor="mostrar-disponiveis" className="text-sm cursor-pointer">
                Mostrar apenas disponíveis
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mostrar-outras-regioes"
                checked={mostrarOutrasRegioes}
                onCheckedChange={(checked) => setMostrarOutrasRegioes(!!checked)}
              />
              <Label htmlFor="mostrar-outras-regioes" className="text-sm cursor-pointer">
                Mostrar outras regiões
              </Label>
            </div>
          </div>

          {/* Título da Lista */}
          <div className="text-sm text-muted-foreground">
            Vistoriadores disponíveis para {dataFormatada} - {periodoLabel}
            {vistoria.regiao && ` - ${vistoria.regiao}`}
          </div>

          {/* Lista de Vistoriadores */}
          <ScrollArea className="flex-1 h-[300px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : vistoriadoresFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum vistoriador encontrado com os filtros selecionados
              </div>
            ) : (
              <RadioGroup
                value={selectedVistoriadorId || ''}
                onValueChange={setSelectedVistoriadorId}
                className="space-y-3"
              >
                {vistoriadoresFiltrados.map((vistoriador) => {
                  const config = STATUS_CONFIG[vistoriador.status];
                  const isSelected = selectedVistoriadorId === vistoriador.id;

                  return (
                    <Card
                      key={vistoriador.id}
                      className={cn(
                        'transition-all',
                        config.cardClass,
                        isSelected && 'ring-2 ring-primary border-primary',
                        config.disabled && 'pointer-events-none'
                      )}
                      onClick={() => !config.disabled && setSelectedVistoriadorId(vistoriador.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <RadioGroupItem
                            value={vistoriador.id}
                            id={vistoriador.id}
                            disabled={config.disabled}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            {/* Nome e badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Label
                                htmlFor={vistoriador.id}
                                className={cn(
                                  'font-medium cursor-pointer',
                                  config.disabled && 'cursor-not-allowed'
                                )}
                              >
                                {vistoriador.nome}
                              </Label>
                              {vistoriador.sugerido && (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                  <Star className="h-3 w-3 mr-1 fill-current" />
                                  Sugerido
                                </Badge>
                              )}
                              {config.badge && (
                                <Badge variant="outline" className={config.badge.className}>
                                  {vistoriador.status === 'lotado' && (
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                  )}
                                  {vistoriador.status === 'indisponivel' && (
                                    <XCircle className="h-3 w-3 mr-1" />
                                  )}
                                  {config.badge.label}
                                </Badge>
                              )}
                            </div>

                            {/* Detalhes */}
                            {vistoriador.status !== 'indisponivel' ? (
                              <>
                                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {vistoriador.distanciaKm} km do local
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {vistoriador.tarefasDia}/{vistoriador.capacidadeDia} tarefas no dia
                                    {vistoriador.status === 'lotado' && (
                                      <AlertTriangle className="h-3 w-3 text-amber-500 ml-1" />
                                    )}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Regiões: {vistoriador.regioes.join(', ')}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Última vistoria: {vistoriador.ultimaVistoria}
                                </div>
                              </>
                            ) : (
                              <div className="mt-2 text-sm text-muted-foreground">
                                {vistoriador.motivoIndisponivel}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </RadioGroup>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!selectedVistoriadorId || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Atribuindo...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Confirmar Atribuição
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

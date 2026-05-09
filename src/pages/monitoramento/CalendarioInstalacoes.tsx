import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarioDiaModal } from '@/components/monitoramento/CalendarioDiaModal';
import { useInstalacoes } from '@/hooks/useInstalacoes';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Calendar, Building2, MapPin, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_INSTALACAO_COLORS } from '@/types/monitoramento';
import { useDatasBloqueadasSet } from '@/hooks/useDatasBloqueadas';
import { usePermissions } from '@/hooks/usePermissions';
import { BloquearDataDialog } from '@/components/monitoramento/BloquearDataDialog';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface DiaCalendario {
  data: Date;
  diaAtual: boolean;
  mesAtual: boolean;
}

interface VistoriaCalendario {
  id: string;
  status: string;
  data_agendada: string;
  local_vistoria: string | null;
  modalidade: string | null;
  associado_nome: string | null;
  veiculo_placa: string | null;
}

export default function CalendarioInstalacoesPage() {
  const navigate = useNavigate();
  const [mesAtual, setMesAtual] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [bloqueioDialog, setBloqueioDialog] = useState<{ data: string; bloqueada: boolean; motivo?: string } | null>(null);

  const { set: datasBloqueadasSet, motivosMap } = useDatasBloqueadasSet();
  const { isDiretor, isCoordenadorMonitoramento, isAdminMaster, isDesenvolvedor } = usePermissions();
  const podeBloquear = isDiretor || isCoordenadorMonitoramento || isAdminMaster || isDesenvolvedor;

  // Calcular primeiro e último dia do mês para filtrar
  const primeiroDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
  const ultimoDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0);
  const primeiroDiaStr = primeiroDia.toISOString().split('T')[0];
  const ultimoDiaStr = ultimoDia.toISOString().split('T')[0];

  const { data, isLoading } = useInstalacoes({
    data_inicio: primeiroDiaStr,
    data_fim: ultimoDiaStr,
  });

  // Query de vistorias do mês
  const mesKey = `${mesAtual.getFullYear()}-${mesAtual.getMonth()}`;
  const { data: vistoriasRaw, isLoading: isLoadingVistorias } = useQuery({
    queryKey: ['vistorias-calendario', mesKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vistorias')
        .select('id, status, data_agendada, local_vistoria, modalidade, associado:associados(nome), veiculo:veiculos(placa)')
        .gte('data_agendada', primeiroDiaStr)
        .lte('data_agendada', ultimoDiaStr + 'T23:59:59')
        .in('status', ['pendente', 'agendada', 'em_rota', 'em_andamento', 'em_analise', 'aprovada']);
      if (error) throw error;
      return data || [];
    }
  });

  // Query de agendamentos_base do mês
  const { data: agendamentosBaseRaw, isLoading: isLoadingAgBase } = useQuery({
    queryKey: ['agendamentos-base-calendario', mesKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agendamentos_base')
        .select('id, status, data_agendada, horario, cliente_nome, veiculo_placa, vistoria_id')
        .gte('data_agendada', primeiroDiaStr)
        .lte('data_agendada', ultimoDiaStr);
      if (error) throw error;
      return data || [];
    }
  });

  // Normalizar dados: hook retorna array diretamente quando sem paginação
  const instalacoes = Array.isArray(data) ? data : (data?.instalacoes || []);

  // Normalizar vistorias
  const vistorias: VistoriaCalendario[] = useMemo(() => {
    if (!vistoriasRaw) return [];
    return vistoriasRaw.map((v: any) => ({
      id: v.id,
      status: v.status,
      data_agendada: v.data_agendada ? v.data_agendada.split('T')[0] : '',
      local_vistoria: v.local_vistoria,
      modalidade: v.modalidade,
      associado_nome: v.associado?.nome || null,
      veiculo_placa: v.veiculo?.placa || null,
    }));
  }, [vistoriasRaw]);

  // Normalizar agendamentos base como vistorias "base"
  const vistoriasBase: VistoriaCalendario[] = useMemo(() => {
    if (!agendamentosBaseRaw) return [];
    return agendamentosBaseRaw.map((ab: any) => ({
      id: ab.id,
      status: ab.status || 'agendado',
      data_agendada: ab.data_agendada,
      local_vistoria: 'base',
      modalidade: 'presencial',
      associado_nome: ab.cliente_nome,
      veiculo_placa: ab.veiculo_placa,
    }));
  }, [agendamentosBaseRaw]);

  // Combinar vistorias + agendamentos_base
  const todasVistorias = useMemo(() => [...vistorias, ...vistoriasBase], [vistorias, vistoriasBase]);

  // Agrupar vistorias por data e tipo (base vs campo)
  const vistoriasPorData = useMemo(() => {
    const map = new Map<string, { base: VistoriaCalendario[]; campo: VistoriaCalendario[] }>();
    todasVistorias.forEach((v) => {
      if (!v.data_agendada) return;
      const dataStr = v.data_agendada.split('T')[0];
      if (!map.has(dataStr)) {
        map.set(dataStr, { base: [], campo: [] });
      }
      const grupo = map.get(dataStr)!;
      if (v.local_vistoria === 'base') {
        grupo.base.push(v);
      } else {
        grupo.campo.push(v);
      }
    });
    return map;
  }, [todasVistorias]);

  // Agrupar instalações por data E período
  const instalacoesPorData = useMemo(() => {
    const map = new Map<string, { manha: typeof instalacoes; tarde: typeof instalacoes }>();
    
    instalacoes.forEach((inst) => {
      const dataStr = inst.data_agendada;
      if (!dataStr) return;
      
      if (!map.has(dataStr)) {
        map.set(dataStr, { manha: [], tarde: [] });
      }
      
      const grupo = map.get(dataStr)!;
      // Legacy: registros 'noite' caem em 'tarde'
      const rawPeriodo = (inst.periodo || 'manha') as string;
      const periodo: 'manha' | 'tarde' = rawPeriodo === 'manha' ? 'manha' : 'tarde';
      grupo[periodo].push(inst);
    });
    
    return map;
  }, [instalacoes]);

  // Gerar dias do calendário
  const diasCalendario = useMemo(() => {
    const dias: DiaCalendario[] = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const primeiroDiaSemana = primeiroDia.getDay();

    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const data = new Date(primeiroDia);
      data.setDate(data.getDate() - i - 1);
      dias.push({
        data,
        diaAtual: data.getTime() === hoje.getTime(),
        mesAtual: false,
      });
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const data = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), dia);
      dias.push({
        data,
        diaAtual: data.getTime() === hoje.getTime(),
        mesAtual: true,
      });
    }

    const diasRestantes = 42 - dias.length;
    for (let i = 1; i <= diasRestantes; i++) {
      const data = new Date(ultimoDia);
      data.setDate(data.getDate() + i);
      dias.push({
        data,
        diaAtual: false,
        mesAtual: false,
      });
    }

    return dias;
  }, [mesAtual, primeiroDia, ultimoDia]);

  const navegarMes = (delta: number) => {
    setMesAtual(new Date(mesAtual.getFullYear(), mesAtual.getMonth() + delta, 1));
  };

  const irParaHoje = () => {
    setMesAtual(new Date());
  };

  if (isLoading || isLoadingVistorias || isLoadingAgBase) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* BREADCRUMB */}
      <nav className="flex items-center text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/monitoramento/instalacoes" className="hover:text-foreground">Monitoramento</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Calendário</span>
      </nav>

      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendário de Serviços</h1>
          <p className="text-muted-foreground">Instalações e vistorias agendadas por dia</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/monitoramento/instalacoes')}>
          Ver Lista
        </Button>
      </div>

      {/* NAVEGAÇÃO DO MÊS */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navegarMes(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}
          </h2>
          <Button variant="outline" size="sm" onClick={irParaHoje}>
            Hoje
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => navegarMes(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* CALENDÁRIO */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
         <div className="min-w-[720px]">
          {/* Header dias da semana */}
          <div className="grid grid-cols-7 border-b">
            {DIAS_SEMANA.map((dia) => (
              <div
                key={dia}
                className="p-3 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
              >
                {dia}
              </div>
            ))}
          </div>

          {/* Grid de dias */}
          <div className="grid grid-cols-7">
            {diasCalendario.map((dia, index) => {
              const dataStr = dia.data.toISOString().split('T')[0];
              const instalacoesDia = instalacoesPorData.get(dataStr) || { manha: [], tarde: [] };
              const temInstalacoes = instalacoesDia.manha.length > 0 || instalacoesDia.tarde.length > 0;
              
              const vistoriasDia = vistoriasPorData.get(dataStr) || { base: [], campo: [] };
              const temVistorias = vistoriasDia.base.length > 0 || vistoriasDia.campo.length > 0;

              const renderPeriodo = (items: typeof instalacoes, label: string, emoji: string) => {
                if (items.length === 0) return null;
                return (
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-medium">{emoji} {label}</span>
                    {items.slice(0, 2).map((inst) => (
                      <Badge
                        key={inst.id}
                        variant="secondary"
                        className={cn(
                          'w-full justify-start truncate text-xs font-normal',
                          STATUS_INSTALACAO_COLORS[inst.status as keyof typeof STATUS_INSTALACAO_COLORS]
                        )}
                      >
                        {inst.veiculos?.placa || inst.associados?.nome?.split(' ')[0] || 'Instalação'}
                      </Badge>
                    ))}
                    {items.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{items.length - 2}</span>
                    )}
                  </div>
                );
              };

              const renderVistoriasGrupo = (items: VistoriaCalendario[], label: string, isBase: boolean) => {
                if (items.length === 0) return null;
                return (
                  <div className="space-y-0.5">
                    <span className={cn(
                      'text-[10px] font-medium flex items-center gap-0.5',
                      isBase ? 'text-indigo-600 dark:text-indigo-400' : 'text-teal-600 dark:text-teal-400'
                    )}>
                      {isBase ? <Building2 className="h-2.5 w-2.5" /> : <MapPin className="h-2.5 w-2.5" />}
                      {label} ({items.length})
                    </span>
                    {items.slice(0, 2).map((v) => (
                      <Badge
                        key={v.id}
                        variant="secondary"
                        className={cn(
                          'w-full justify-start truncate text-xs font-normal',
                          isBase
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'
                            : 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
                        )}
                      >
                        {v.veiculo_placa || v.associado_nome?.split(' ')[0] || 'Vistoria'}
                      </Badge>
                    ))}
                    {items.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{items.length - 2}</span>
                    )}
                  </div>
                );
              };

              const bloqueada = datasBloqueadasSet.has(dataStr);
              const motivoBloqueio = motivosMap.get(dataStr);

              return (
                <div
                  key={index}
                  onClick={() => setDiaSelecionado(dataStr)}
                  className={cn(
                    'relative min-h-[100px] p-2 border-b border-r cursor-pointer transition-colors hover:bg-muted/50',
                    !dia.mesAtual && 'bg-muted/30 text-muted-foreground',
                    dia.diaAtual && 'ring-2 ring-inset ring-primary',
                    bloqueada && 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50',
                    index % 7 === 6 && 'border-r-0'
                  )}
                  style={
                    bloqueada
                      ? {
                          backgroundImage:
                            'repeating-linear-gradient(45deg, transparent, transparent 6px, hsl(var(--destructive) / 0.08) 6px, hsl(var(--destructive) / 0.08) 12px)',
                        }
                      : undefined
                  }
                >
                  {/* Número do dia + badges de contagem */}
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm',
                        dia.diaAtual && 'bg-primary text-primary-foreground font-medium'
                      )}
                    >
                      {dia.data.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {vistoriasDia.base.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                          <Building2 className="h-2.5 w-2.5" />
                          {vistoriasDia.base.length}
                        </span>
                      )}
                      {podeBloquear && (() => {
                        const hojeRef = new Date();
                        hojeRef.setHours(0, 0, 0, 0);
                        const hojeStr = `${hojeRef.getFullYear()}-${String(hojeRef.getMonth() + 1).padStart(2, '0')}-${String(hojeRef.getDate()).padStart(2, '0')}`;
                        return dataStr >= hojeStr;
                      })() && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBloqueioDialog({ data: dataStr, bloqueada, motivo: motivoBloqueio });
                          }}
                          className={cn(
                            'inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted',
                            bloqueada ? 'text-destructive' : 'text-muted-foreground opacity-60 hover:opacity-100'
                          )}
                          title={bloqueada ? `Bloqueado: ${motivoBloqueio}` : 'Bloquear data'}
                          aria-label={bloqueada ? 'Desbloquear data' : 'Bloquear data'}
                        >
                          {bloqueada ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {bloqueada && (
                    <div className="mt-1 rounded-sm bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive line-clamp-2">
                      🔒 {motivoBloqueio || 'Bloqueado'}
                    </div>
                  )}

                  {/* Instalações do dia - agrupadas por período */}
                  {(temInstalacoes || temVistorias) && (
                    <div className="mt-1 space-y-1.5">
                      {renderPeriodo(instalacoesDia.manha, 'Manhã', '☀️')}
                      {renderPeriodo(instalacoesDia.tarde, 'Tarde', '🌅')}
                      {renderVistoriasGrupo(vistoriasDia.base, 'Base', true)}
                      {renderVistoriasGrupo(vistoriasDia.campo, 'Campo', false)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
         </div>
        </CardContent>
      </Card>

      {/* LEGENDA */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium">Legenda:</span>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-muted" />
              <span>Pendente</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              <span>Agendada</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-orange-500" />
              <span>Em Andamento</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span>Concluída</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-3 w-3 rounded-full bg-destructive" />
              <span>Cancelada</span>
            </div>
            <span className="mx-2 text-muted-foreground">|</span>
            <div className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Vistoria Base</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              <span>Vistoria Campo</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <CalendarioDiaModal
        open={!!diaSelecionado}
        onClose={() => setDiaSelecionado(null)}
        data={diaSelecionado || ''}
      />

      {bloqueioDialog && (
        <BloquearDataDialog
          open={!!bloqueioDialog}
          onOpenChange={(v) => !v && setBloqueioDialog(null)}
          data={bloqueioDialog.data}
          bloqueada={bloqueioDialog.bloqueada}
          motivoAtual={bloqueioDialog.motivo}
        />
      )}
    </div>
  );
}

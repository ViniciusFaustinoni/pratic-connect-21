import { useState, useMemo } from 'react';
import { Calendar, Clock, TrendingUp, TrendingDown, ChevronDown, Loader2, Briefcase, Coffee, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getHojeBrasilia } from '@/lib/date-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format, subDays, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatarMinutos(minutos: number): string {
  const horas = Math.floor(Math.abs(minutos) / 60);
  const mins = Math.abs(minutos) % 60;
  if (horas === 0) return `${mins}min`;
  return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
}

interface HistoricoJornadasProps {
  exibirSaldo: boolean;
}

export function HistoricoJornadas({ exibirSaldo }: HistoricoJornadasProps) {
  const { profile } = useAuth();
  const [limit, setLimit] = useState(30);

  // Config duração turno
  const { data: duracaoTurno } = useQuery({
    queryKey: ['config-duracao-turno-historico'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'jornada_duracao_turno_horas')
        .maybeSingle();
      return parseFloat(data?.valor || '8');
    },
    staleTime: 1000 * 60 * 10,
  });

  const hoje = getHojeBrasilia();
  const dataLimite = format(subDays(hoje, 90), 'yyyy-MM-dd');
  const inicioMes = format(startOfMonth(hoje), 'yyyy-MM-dd');

  // Turnos encerrados
  const { data: turnos, isLoading } = useQuery({
    queryKey: ['historico-turnos', profile?.id, limit],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from('turnos_profissionais')
        .select('*')
        .eq('profissional_id', profile.id)
        .eq('status', 'encerrado')
        .gte('data', dataLimite)
        .order('data', { ascending: false })
        .limit(limit);
      return data || [];
    },
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Serviços concluídos no período
  const { data: servicosPorDia } = useQuery({
    queryKey: ['historico-servicos', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return {};
      const { data } = await supabase
        .from('servicos')
        .select('id, created_at')
        .eq('profissional_id', profile.id)
        .eq('status', 'concluida')
        .gte('created_at', dataLimite + 'T00:00:00');
      const map: Record<string, number> = {};
      (data || []).forEach(s => {
        const d = s.created_at?.substring(0, 10);
        if (d) map[d] = (map[d] || 0) + 1;
      });
      return map;
    },
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Recusas no período
  const { data: recusasPorDia } = useQuery({
    queryKey: ['historico-recusas', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return {};
      const { data } = await supabase
        .from('registros_recusa_tarefa')
        .select('id, created_at')
        .eq('profissional_id', profile.id)
        .gte('created_at', dataLimite + 'T00:00:00');
      const map: Record<string, number> = {};
      (data || []).forEach(r => {
        const d = r.created_at?.substring(0, 10);
        if (d) map[d] = (map[d] || 0) + 1;
      });
      return map;
    },
    enabled: !!profile?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Resumo do mês
  const resumoMes = useMemo(() => {
    if (!turnos) return { dias: 0, totalMinutos: 0, saldoMes: 0, servicosMes: 0 };
    const turnosMes = turnos.filter(t => t.data >= inicioMes);
    const dias = turnosMes.length;
    const totalMinutos = turnosMes.reduce((a, t) => a + (t.minutos_trabalhados || 0), 0);
    const saldoMes = turnosMes.reduce((a, t) => a + ((t.minutos_extras || 0) - (t.minutos_faltantes || 0)), 0);
    const servicosMes = turnosMes.reduce((a, t) => a + (servicosPorDia?.[t.data] || 0), 0);
    return { dias, totalMinutos, saldoMes, servicosMes };
  }, [turnos, servicosPorDia, inicioMes]);

  const duracaoMinutos = (duracaoTurno || 8) * 60;

  function getStatus(turno: any, servicos: number) {
    if (servicos === 0) return { label: 'Improdutivo', variant: 'destructive' as const };
    if ((turno.minutos_trabalhados || 0) >= duracaoMinutos - 10) return { label: 'Concluído', variant: 'default' as const };
    return { label: 'Incompleto', variant: 'secondary' as const };
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo do mês */}
      <Card className="border-slate-700 bg-slate-800">
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-400" />
            Resumo do Mês
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-slate-700/50 p-3 text-center">
              <p className="text-xs text-slate-400">Dias</p>
              <p className="text-lg font-bold text-white">{resumoMes.dias}</p>
            </div>
            <div className="rounded-lg bg-slate-700/50 p-3 text-center">
              <p className="text-xs text-slate-400">Horas</p>
              <p className="text-lg font-bold text-white">{formatarMinutos(resumoMes.totalMinutos)}</p>
            </div>
            <div className="rounded-lg bg-slate-700/50 p-3 text-center">
              <p className="text-xs text-slate-400">Serviços</p>
              <p className="text-lg font-bold text-white">{resumoMes.servicosMes}</p>
            </div>
            {exibirSaldo && (
              <div className="rounded-lg bg-slate-700/50 p-3 text-center">
                <p className="text-xs text-slate-400">Saldo mês</p>
                <p className={`text-lg font-bold ${resumoMes.saldoMes >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {resumoMes.saldoMes >= 0 ? '+' : '-'}{formatarMinutos(Math.abs(resumoMes.saldoMes))}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista de turnos */}
      {(!turnos || turnos.length === 0) ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          Nenhum turno registrado nos últimos dias.
        </div>
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {turnos.map((turno) => {
            const servicos = servicosPorDia?.[turno.data] || 0;
            const recusas = recusasPorDia?.[turno.data] || 0;
            const status = getStatus(turno, servicos);
            const saldoDia = (turno.minutos_extras || 0) - (turno.minutos_faltantes || 0);

            let dataFormatada = turno.data;
            try {
              dataFormatada = format(parseISO(turno.data), "EEEE, dd MMM", { locale: ptBR });
              dataFormatada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);
            } catch { /* keep raw */ }

            return (
              <AccordionItem key={turno.id} value={turno.id} className="border-slate-700 bg-slate-800 rounded-lg overflow-hidden border">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex flex-col items-start gap-1 text-left flex-1 mr-2">
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-sm font-medium text-white">{dataFormatada}</span>
                      <Badge variant={status.variant} className="text-[10px] px-1.5 py-0">
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatarMinutos(turno.minutos_trabalhados || 0)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {servicos} serviço{servicos !== 1 ? 's' : ''}
                      </span>
                      {exibirSaldo && (
                        <span className={saldoDia >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {saldoDia >= 0 ? '+' : '-'}{formatarMinutos(Math.abs(saldoDia))}
                        </span>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-300">
                      <span>Entrada</span>
                      <span>{turno.inicio_turno ? format(parseISO(turno.inicio_turno), 'HH:mm') : '—'}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Saída</span>
                      <span>{turno.fim_turno ? format(parseISO(turno.fim_turno), 'HH:mm') : '—'}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span className="flex items-center gap-1"><Coffee className="h-3 w-3" /> Almoço</span>
                      <span>{turno.minutos_almoco ? formatarMinutos(turno.minutos_almoco) : '0min'}</span>
                    </div>
                    {(turno.minutos_extras || 0) > 0 && (
                      <div className="flex justify-between text-green-400">
                        <span>Horas extras</span>
                        <span>+{formatarMinutos(turno.minutos_extras)}</span>
                      </div>
                    )}
                    {(turno.minutos_faltantes || 0) > 0 && (
                      <div className="flex justify-between text-red-400">
                        <span>Horas faltantes</span>
                        <span>-{formatarMinutos(turno.minutos_faltantes)}</span>
                      </div>
                    )}
                    {recusas > 0 && (
                      <div className="flex justify-between text-amber-400">
                        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Recusas</span>
                        <span>{recusas}</span>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Carregar mais */}
      {turnos && turnos.length >= limit && (
        <Button
          variant="outline"
          className="w-full border-slate-700 text-slate-300"
          onClick={() => setLimit(prev => prev + 30)}
        >
          Carregar mais
        </Button>
      )}
    </div>
  );
}

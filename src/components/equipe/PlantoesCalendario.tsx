import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, Building2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlantaoDiaModal } from './PlantaoDiaModal';
import { cn } from '@/lib/utils';
import { getHojeBrasilia } from '@/lib/date-utils';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface Alocacao {
  id: string;
  profissional_id: string;
  data: string;
  tipo_alocacao: 'rota' | 'base';
  profissional_nome?: string;
}

interface Profissional {
  id: string;
  nome: string;
}

export function PlantoesCalendario() {
  const hoje = getHojeBrasilia();
  const [mesAtual, setMesAtual] = useState<Date>(startOfMonth(hoje));
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null);

  const inicio = startOfMonth(mesAtual);
  const fim = endOfMonth(mesAtual);
  const diasDoMes = eachDayOfInterval({ start: inicio, end: fim });

  const inicioStr = format(inicio, 'yyyy-MM-dd');
  const fimStr = format(fim, 'yyyy-MM-dd');

  // Buscar profissionais
  const { data: profissionais = [] } = useQuery({
    queryKey: ['plantoes-profissionais'],
    queryFn: async (): Promise<Profissional[]> => {
      // Buscar instaladores/vistoriadores dinamicamente
      const { data: configs } = await supabase
        .from('app_roles_config')
        .select('role')
        .eq('is_operational', true)
        .eq('is_active', true);
      const opRoles = (configs || [])
        .map((c: any) => c.role)
        .filter((r: string) => r.includes('instalador') || r.includes('vistoriador'));
      if (opRoles.length === 0) opRoles.push('instalador_vistoriador');

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', opRoles);
      if (!roles?.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nome, ativo')
        .in('user_id', roles.map(r => r.user_id))
        .eq('ativo', true)
        .order('nome');

      return (profiles || []).map(p => ({ id: p.id, nome: p.nome || 'Sem nome' }));
    },
  });

  // Buscar alocações do mês
  const { data: alocacoes = [], isLoading } = useQuery({
    queryKey: ['plantoes-mes', inicioStr, fimStr],
    queryFn: async (): Promise<Alocacao[]> => {
      if (!profissionais.length) return [];

      const { data, error } = await supabase
        .from('alocacoes_diarias')
        .select('*')
        .gte('data', inicioStr)
        .lte('data', fimStr);

      if (error) throw error;
      return (data || []).map((a: any) => ({
        ...a,
        profissional_nome: profissionais.find(p => p.id === a.profissional_id)?.nome || '?',
      }));
    },
    enabled: profissionais.length > 0,
  });

  // Agrupar alocações por dia
  const alocacoesPorDia = useMemo(() => {
    const map: Record<string, Alocacao[]> = {};
    alocacoes.forEach(a => {
      if (!map[a.data]) map[a.data] = [];
      map[a.data].push(a);
    });
    return map;
  }, [alocacoes]);

  // Resumo por profissional
  const resumoPorProfissional = useMemo(() => {
    const map: Record<string, { nome: string; rota: number; base: number }> = {};
    profissionais.forEach(p => {
      map[p.id] = { nome: p.nome, rota: 0, base: 0 };
    });
    alocacoes.forEach(a => {
      if (map[a.profissional_id]) {
        if (a.tipo_alocacao === 'rota') map[a.profissional_id].rota++;
        else map[a.profissional_id].base++;
      }
    });
    return Object.values(map).filter(r => r.rota > 0 || r.base > 0);
  }, [profissionais, alocacoes]);

  // Calcular dias vazios antes do primeiro dia do mês
  const offsetInicio = getDay(inicio);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5 text-primary" />
            Plantões Mensal
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMesAtual(subMonths(mesAtual, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center capitalize">
              {format(mesAtual, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setMesAtual(addMonths(mesAtual, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Grade do calendário */}
            <div className="grid grid-cols-7 gap-1">
              {/* Header dias da semana */}
              {DIAS_SEMANA.map(dia => (
                <div key={dia} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {dia}
                </div>
              ))}

              {/* Espaços vazios */}
              {Array.from({ length: offsetInicio }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px]" />
              ))}

              {/* Dias do mês */}
              {diasDoMes.map(dia => {
                const diaStr = format(dia, 'yyyy-MM-dd');
                const alocsDia = alocacoesPorDia[diaStr] || [];
                const countRota = alocsDia.filter(a => a.tipo_alocacao === 'rota').length;
                const countBase = alocsDia.filter(a => a.tipo_alocacao === 'base').length;
                const isHoje = isSameDay(dia, hoje);
                const isFimDeSemana = isWeekend(dia);

                // Dia útil: visual desabilitado
                if (!isFimDeSemana) {
                  return (
                    <div
                      key={diaStr}
                      className={cn(
                        "min-h-[80px] rounded-md border border-dashed border-border/30 p-1 flex flex-col bg-muted/30 opacity-60",
                        isHoje && "border-primary/30 bg-primary/5"
                      )}
                    >
                      <span className={cn(
                        "text-xs font-medium",
                        isHoje ? "text-primary/70" : "text-muted-foreground"
                      )}>
                        {format(dia, 'd')}
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-auto">Todos disponíveis</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={diaStr}
                    onClick={() => setDiaSelecionado(dia)}
                    className={cn(
                      "min-h-[80px] rounded-md border p-1 text-left transition-colors hover:bg-accent/50 flex flex-col",
                      isHoje && "border-primary bg-primary/5",
                      alocsDia.length === 0 && "border-dashed border-border/50"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium",
                      isHoje ? "text-primary" : "text-foreground"
                    )}>
                      {format(dia, 'd')}
                    </span>
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {countRota > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
                          <MapPin className="h-2.5 w-2.5" />
                          {countRota}
                        </Badge>
                      )}
                      {countBase > 0 && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5 text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                          <Building2 className="h-2.5 w-2.5" />
                          {countBase}
                        </Badge>
                      )}
                    </div>
                    {alocsDia.slice(0, 2).map(a => (
                      <span key={a.id} className="text-[9px] text-muted-foreground truncate block">
                        {a.profissional_nome?.split(' ')[0]}
                      </span>
                    ))}
                    {alocsDia.length > 2 && (
                      <span className="text-[9px] text-muted-foreground">+{alocsDia.length - 2}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Resumo lateral */}
            {resumoPorProfissional.length > 0 && (
              <div className="border rounded-lg p-3">
                <h4 className="text-sm font-medium mb-2">Resumo do Mês</h4>
                <div className="space-y-1.5">
                  {resumoPorProfissional.map(r => (
                    <div key={r.nome} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{r.nome}</span>
                      <div className="flex items-center gap-2">
                        {r.rota > 0 && (
                          <span className="text-blue-600 dark:text-blue-400">{r.rota}d rota</span>
                        )}
                        {r.base > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">{r.base}d base</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal de edição do dia */}
        <PlantaoDiaModal
          open={!!diaSelecionado}
          onOpenChange={(open) => !open && setDiaSelecionado(null)}
          data={diaSelecionado || new Date()}
          profissionais={profissionais}
          alocacoesExistentes={
            diaSelecionado
              ? alocacoesPorDia[format(diaSelecionado, 'yyyy-MM-dd')] || []
              : []
          }
        />
      </CardContent>
    </Card>
  );
}

import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useInstalacoes } from '@/hooks/useInstalacoes';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Calendar, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_INSTALACAO_COLORS } from '@/types/monitoramento';

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

export default function CalendarioInstalacoesPage() {
  const navigate = useNavigate();
  const [mesAtual, setMesAtual] = useState(new Date());

  // Calcular primeiro e último dia do mês para filtrar
  const primeiroDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1);
  const ultimoDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0);

  const { data, isLoading } = useInstalacoes({
    data_inicio: primeiroDia.toISOString().split('T')[0],
    data_fim: ultimoDia.toISOString().split('T')[0],
  });

  // Normalizar dados: hook retorna array diretamente quando sem paginação
  const instalacoes = Array.isArray(data) ? data : (data?.instalacoes || []);

  // Agrupar instalações por data
  const instalacoesPorData = useMemo(() => {
    const map = new Map<string, typeof instalacoes>();
    instalacoes.forEach((inst) => {
      const dataStr = inst.data_agendada;
      if (!dataStr) return;
      if (!map.has(dataStr)) map.set(dataStr, []);
      map.get(dataStr)!.push(inst);
    });
    return map;
  }, [instalacoes]);

  // Gerar dias do calendário
  const diasCalendario = useMemo(() => {
    const dias: DiaCalendario[] = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Primeiro dia da semana do mês
    const primeiroDiaSemana = primeiroDia.getDay();

    // Adicionar dias do mês anterior para completar a semana
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const data = new Date(primeiroDia);
      data.setDate(data.getDate() - i - 1);
      dias.push({
        data,
        diaAtual: data.getTime() === hoje.getTime(),
        mesAtual: false,
      });
    }

    // Adicionar dias do mês atual
    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
      const data = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), dia);
      dias.push({
        data,
        diaAtual: data.getTime() === hoje.getTime(),
        mesAtual: true,
      });
    }

    // Completar última semana com dias do próximo mês
    const diasRestantes = 42 - dias.length; // 6 semanas * 7 dias
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

  if (isLoading) {
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
          <h1 className="text-2xl font-bold tracking-tight">Calendário de Instalações</h1>
          <p className="text-muted-foreground">Visualize as instalações agendadas por dia</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/monitoramento/instalacoes')}>
            Ver Lista
          </Button>
          <Button onClick={() => navigate('/monitoramento/instalacoes/agendar')}>
            <Plus className="mr-2 h-4 w-4" />
            Agendar
          </Button>
        </div>
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
        <CardContent className="p-0">
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
              const instalacoesDia = instalacoesPorData.get(dataStr) || [];
              const temInstalacoes = instalacoesDia.length > 0;

              return (
                <div
                  key={index}
                  onClick={() => navigate(`/monitoramento/instalacoes?data=${dataStr}`)}
                  className={cn(
                    'min-h-[100px] p-2 border-b border-r cursor-pointer transition-colors hover:bg-muted/50',
                    !dia.mesAtual && 'bg-muted/30 text-muted-foreground',
                    dia.diaAtual && 'ring-2 ring-inset ring-primary',
                    index % 7 === 6 && 'border-r-0'
                  )}
                >
                  {/* Número do dia */}
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm',
                      dia.diaAtual && 'bg-primary text-primary-foreground font-medium'
                    )}
                  >
                    {dia.data.getDate()}
                  </span>

                  {/* Instalações do dia */}
                  {temInstalacoes && (
                    <div className="mt-1 space-y-1">
                      {instalacoesDia.slice(0, 3).map((inst) => (
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
                      {instalacoesDia.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{instalacoesDia.length - 3} mais
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

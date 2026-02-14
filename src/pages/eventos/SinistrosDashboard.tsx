import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EventosKPICards from '@/components/eventos/dashboard/EventosKPICards';
import EventosFunilOperacional from '@/components/eventos/dashboard/EventosFunilOperacional';
import EventosGraficosTipo from '@/components/eventos/dashboard/EventosGraficosTipo';
import EventosGraficosAnalise from '@/components/eventos/dashboard/EventosGraficosAnalise';
import EventosAlertasUrgentes from '@/components/eventos/dashboard/EventosAlertasUrgentes';
import EventosTabelaRecentes from '@/components/eventos/dashboard/EventosTabelaRecentes';
import { FiltrosGlobais, PeriodoFiltro, TipoFiltro, StatusFiltro } from '@/hooks/useEventosDashboard';

const PERIODOS: { value: PeriodoFiltro; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Esta Semana' },
  { value: 'mes', label: 'Este Mês' },
  { value: 'trimestre', label: 'Último Trimestre' },
  { value: 'ano', label: 'Este Ano' },
];

export default function SinistrosDashboard() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [tipo, setTipo] = useState<TipoFiltro>('todos');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('abertos');
  const [faseFilter, setFaseFilter] = useState<string[]>([]);

  const filtros: FiltrosGlobais = { periodo, tipo, statusFiltro };

  return (
    <div className="space-y-4">
      {/* Header + Filtros Globais */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Eventos</h1>
          <p className="text-sm text-muted-foreground">Visão operacional completa dos sinistros</p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* Período */}
          <div className="flex gap-1">
            {PERIODOS.map(p => (
              <Button
                key={p.value}
                variant={periodo === p.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriodo(p.value)}
                className="text-xs"
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Tipo */}
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoFiltro)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Tipos</SelectItem>
              <SelectItem value="colisao">Colisão</SelectItem>
              <SelectItem value="roubo">Roubo</SelectItem>
              <SelectItem value="furto">Furto</SelectItem>
              <SelectItem value="incendio">Incêndio</SelectItem>
              <SelectItem value="fenomeno_natural">Alagamento</SelectItem>
              <SelectItem value="vidros">Vidros</SelectItem>
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="abertos">Apenas Abertos</SelectItem>
              <SelectItem value="finalizados">Finalizados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Área 1 — KPI Cards */}
      <EventosKPICards filtros={filtros} />

      {/* Área 2 — Funil Operacional */}
      <EventosFunilOperacional filtros={filtros} onFaseClick={setFaseFilter} faseAtiva={faseFilter} />

      {/* Área 3 — Gráficos por Tipo */}
      <EventosGraficosTipo filtros={filtros} />

      {/* Área 4 — Gráficos de Análise */}
      <EventosGraficosAnalise filtros={filtros} />

      {/* Área 5 — Alertas */}
      <EventosAlertasUrgentes />

      {/* Área 6 — Tabela Recentes */}
      <EventosTabelaRecentes filtros={filtros} faseFilter={faseFilter.length > 0 ? faseFilter : undefined} />
    </div>
  );
}

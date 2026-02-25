import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, LayoutDashboard } from 'lucide-react';
import EventosKPICards from '@/components/eventos/dashboard/EventosKPICards';
import EventosFunilOperacional from '@/components/eventos/dashboard/EventosFunilOperacional';
import EventosGraficosTipo from '@/components/eventos/dashboard/EventosGraficosTipo';
import EventosGraficosAnalise from '@/components/eventos/dashboard/EventosGraficosAnalise';
import EventosAlertasUrgentes from '@/components/eventos/dashboard/EventosAlertasUrgentes';
import EventosTabelaRecentes from '@/components/eventos/dashboard/EventosTabelaRecentes';
import { FiltrosGlobais, PeriodoFiltro, TipoFiltro, StatusFiltro } from '@/hooks/useEventosDashboard';

const PERIODOS: { value: PeriodoFiltro; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'ano', label: 'Ano' },
];

export default function SinistrosDashboard() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [tipo, setTipo] = useState<TipoFiltro>('todos');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('abertos');
  const [faseFilter, setFaseFilter] = useState<string[]>([]);

  const filtros: FiltrosGlobais = { periodo, tipo, statusFiltro };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Painel de Eventos</h1>
            <p className="text-sm text-muted-foreground">Visão operacional dos sinistros em tempo real</p>
          </div>
        </div>

        {/* ── Filtros ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border">
            {PERIODOS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  periodo === p.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoFiltro)}>
            <SelectTrigger className="w-[130px] h-8 text-xs border-border bg-background">
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

          <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}>
            <SelectTrigger className="w-[130px] h-8 text-xs border-border bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="abertos">Abertos</SelectItem>
              <SelectItem value="finalizados">Finalizados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Alertas (destaque no topo quando existem) ── */}
      <EventosAlertasUrgentes />

      {/* ── KPIs ── */}
      <EventosKPICards filtros={filtros} />

      {/* ── Funil Operacional ── */}
      <EventosFunilOperacional filtros={filtros} onFaseClick={setFaseFilter} faseAtiva={faseFilter} />

      {/* ── Gráficos Distribuição + Tendência ── */}
      <EventosGraficosTipo filtros={filtros} />

      {/* ── Análise de Performance ── */}
      <EventosGraficosAnalise filtros={filtros} />

      {/* ── Tabela Recentes ── */}
      <EventosTabelaRecentes filtros={filtros} faseFilter={faseFilter.length > 0 ? faseFilter : undefined} />
    </div>
  );
}

import { useState } from 'react';
import { useEventosSLA } from '@/hooks/useEventosSLA';
import { SLAKpiCards } from '@/components/eventos/sla/SLAKpiCards';
import { SLATabelaSinistros } from '@/components/eventos/sla/SLATabelaSinistros';
import { SLADistribuicaoChart } from '@/components/eventos/sla/SLADistribuicaoChart';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Clock } from 'lucide-react';
import { STATUS_SINISTRO_LABELS, TIPO_SINISTRO_LABELS } from '@/types/sinistros';

// Status ativos (não finais) para filtro
const STATUS_FILTRO = [
  'comunicado', 'em_analise', 'documentacao_pendente', 'aguardando_vistoria',
  'em_vistoria', 'aguardando_parecer', 'em_sindicancia', 'em_pericia',
  'analise_interna', 'suspenso', 'aguardando_diretoria', 'aguardando_juridico',
  'aprovado', 'em_regulacao', 'aguardando_termo', 'aguardando_cota',
  'em_reparo', 'em_oficina', 'em_recuperacao', 'aguardando_pagamento',
  'aguardando_indenizacao', 'aguardando_analise',
] as const;

export default function EventosSLADashboard() {
  const [status, setStatus] = useState('todos');
  const [tipo, setTipo] = useState('todos');
  const [busca, setBusca] = useState('');
  const [apenasVencidos, setApenasVencidos] = useState(false);

  const { data, isLoading } = useEventosSLA({ status, tipo, busca, apenasVencidos });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Clock className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Acompanhamento de SLA</h1>
          <p className="text-sm text-muted-foreground">
            Monitore prazos e alertas de todos os sinistros abertos
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Buscar protocolo..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-[200px]"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_FILTRO.map(s => (
              <SelectItem key={s} value={s}>
                {STATUS_SINISTRO_LABELS[s] || s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {Object.entries(TIPO_SINISTRO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="vencidos"
            checked={apenasVencidos}
            onCheckedChange={(v) => setApenasVencidos(v === true)}
          />
          <label htmlFor="vencidos" className="text-sm cursor-pointer">
            Apenas vencidos
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          <SLAKpiCards kpis={data.kpis} />
          <SLATabelaSinistros sinistros={data.sinistros} />
          <SLADistribuicaoChart distribuicao={data.distribuicao} />
        </div>
      ) : null}
    </div>
  );
}

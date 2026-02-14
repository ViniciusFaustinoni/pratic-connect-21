import { useState, useMemo } from 'react';
import { useVeiculosOficina, useOficinasDisponiveis, type VeiculoOficina } from '@/hooks/useVeiculosOficina';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Car, Search, Clock, AlertTriangle, AlertCircle, Phone,
  CheckCircle2, CircleDot, Circle, Wrench, Building2, Store
} from 'lucide-react';
import { differenceInDays, differenceInHours, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  aguardando_entrada: { label: 'Aguardando Entrada', color: 'bg-yellow-100 text-yellow-800' },
  aguardando_orcamento: { label: 'Aguardando Orçamento', color: 'bg-orange-100 text-orange-800' },
  aguardando_aprovacao: { label: 'Aguardando Aprovação', color: 'bg-blue-100 text-blue-800' },
  em_execucao: { label: 'Em Execução', color: 'bg-emerald-100 text-emerald-800' },
  aguardando_peca: { label: 'Aguardando Peça', color: 'bg-purple-100 text-purple-800' },
  pendente_assinatura: { label: 'Pendente Assinatura', color: 'bg-amber-100 text-amber-800' },
  finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-800' },
};

function getTempoEmOficina(entrada: string | null, created: string): string {
  const ref = entrada || created;
  const dias = differenceInDays(new Date(), new Date(ref));
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Há 1 dia';
  return `Há ${dias} dias`;
}

function getAlertaAtualizacao(updated: string): 'ok' | 'warning' | 'urgent' {
  const horas = differenceInHours(new Date(), new Date(updated));
  if (horas > 48) return 'urgent';
  if (horas > 24) return 'warning';
  return 'ok';
}

function EtapasProgress({ etapas }: { etapas: any[] }) {
  if (!etapas || etapas.length === 0) return <span className="text-xs text-muted-foreground">Sem etapas definidas</span>;

  const concluidas = etapas.filter((e) => e.status === 'concluida').length;
  const pct = Math.round((concluidas / etapas.length) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Progresso</span>
        <span>{concluidas}/{etapas.length} etapas</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="flex flex-wrap gap-1">
        {etapas.map((etapa, i) => {
          const Icon = etapa.status === 'concluida' ? CheckCircle2 : etapa.status === 'em_andamento' ? CircleDot : Circle;
          const color = etapa.status === 'concluida' ? 'text-emerald-500' : etapa.status === 'em_andamento' ? 'text-blue-500' : 'text-muted-foreground';
          return (
            <div key={i} className="flex items-center gap-0.5">
              <Icon className={`h-3 w-3 ${color}`} />
              <span className={`text-[10px] ${color}`}>{etapa.nome}</span>
              {i < etapas.length - 1 && <span className="text-muted-foreground text-[10px] mx-0.5">→</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReguladorOficina() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [oficinaFilter, setOficinaFilter] = useState('todas');
  const [tempoFilter, setTempoFilter] = useState('todos');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const filters = useMemo(() => ({
    search: search || undefined,
    status: statusFilter !== 'todos' ? statusFilter : undefined,
    oficina_id: oficinaFilter !== 'todas' ? oficinaFilter : undefined,
    tempo: tempoFilter !== 'todos' ? tempoFilter : undefined,
  }), [search, statusFilter, oficinaFilter, tempoFilter]);

  const { data: veiculos = [], isLoading } = useVeiculosOficina(filters);
  const { data: oficinas = [] } = useOficinasDisponiveis();

  // Contadores (sem filtro para mostrar totais reais)
  const { data: todosVeiculos = [] } = useVeiculosOficina();
  const contadores = useMemo(() => ({
    total: todosVeiculos.length,
    aguardando_entrada: todosVeiculos.filter((v) => v.status === 'aguardando_entrada').length,
    aguardando_peca: todosVeiculos.filter((v) => v.status === 'aguardando_peca').length,
    em_execucao: todosVeiculos.filter((v) => v.status === 'em_execucao').length,
    pendente_assinatura: todosVeiculos.filter((v) => v.status === 'pendente_assinatura').length,
  }), [todosVeiculos]);

  // Métricas de oficinas
  const metricasOficinas = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; totalDias: number }>();
    todosVeiculos.forEach((v) => {
      const id = v.oficina?.id;
      if (!id) return;
      const nome = v.oficina?.nome_fantasia || v.oficina?.razao_social || 'Sem nome';
      const entry = map.get(id) || { nome, qtd: 0, totalDias: 0 };
      entry.qtd++;
      const dias = differenceInDays(new Date(), new Date(v.data_entrada || v.created_at));
      entry.totalDias += dias;
      map.set(id, entry);
    });
    return Array.from(map.values())
      .map((m) => ({ ...m, mediaDias: Math.round(m.totalDias / m.qtd) }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [todosVeiculos]);

  const handleRegistrarEntrada = async (os: VeiculoOficina) => {
    try {
      const { error } = await supabase
        .from('ordens_servico')
        .update({
          status: 'em_execucao' as any,
          data_entrada: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', os.id);
      if (error) throw error;

      await supabase.from('ordens_servico_historico').insert({
        ordem_servico_id: os.id,
        status_novo: 'em_execucao',
        observacao: 'Veículo deu entrada na oficina',
      });

      toast.success('Entrada registrada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['veiculos-oficina'] });
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  return (
    <div className="p-4 space-y-4 pb-20">
      <h1 className="text-lg font-bold flex items-center gap-2">
        <Wrench className="h-5 w-5" /> Veículos em Oficina
      </h1>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Total', value: contadores.total, color: 'bg-blue-50 text-blue-700' },
          { label: 'Aguard. Entrada', value: contadores.aguardando_entrada, color: 'bg-yellow-50 text-yellow-700' },
          { label: 'Aguard. Peça', value: contadores.aguardando_peca, color: 'bg-purple-50 text-purple-700' },
          { label: 'Em Execução', value: contadores.em_execucao, color: 'bg-emerald-50 text-emerald-700' },
        ].map((c) => (
          <div key={c.label} className={`rounded-lg p-3 ${c.color}`}>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-xs">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar placa ou nome..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aguardando_entrada">Aguard. Entrada</SelectItem>
              <SelectItem value="em_execucao">Em Execução</SelectItem>
              <SelectItem value="aguardando_peca">Aguard. Peça</SelectItem>
              <SelectItem value="pendente_assinatura">Pendente Assin.</SelectItem>
            </SelectContent>
          </Select>
          <Select value={oficinaFilter} onValueChange={setOficinaFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Oficina" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {oficinas.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.nome_fantasia || o.razao_social}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tempoFilter} onValueChange={setTempoFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tempo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="0-7">Até 7 dias</SelectItem>
              <SelectItem value="8-15">8-15 dias</SelectItem>
              <SelectItem value="16-30">16-30 dias</SelectItem>
              <SelectItem value="30+">+30 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : veiculos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Nenhum veículo em oficina</div>
      ) : (
        <div className="space-y-3">
          {veiculos.map((v) => {
            const alerta = getAlertaAtualizacao(v.updated_at);
            const statusInfo = STATUS_MAP[v.status] || { label: v.status, color: 'bg-gray-100 text-gray-800' };
            return (
              <Card key={v.id} className={`overflow-hidden ${alerta === 'urgent' ? 'border-red-400' : alerta === 'warning' ? 'border-yellow-400' : ''}`}>
                <CardContent className="p-3 space-y-2">
                  {/* Header: placa + status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold text-base tracking-wider">{v.veiculo?.placa || '---'}</span>
                    </div>
                    <Badge className={`${statusInfo.color} text-[10px] px-1.5`}>{statusInfo.label}</Badge>
                  </div>

                  {/* Veículo info */}
                  <p className="text-xs text-muted-foreground">
                    {[v.veiculo?.marca, v.veiculo?.modelo, v.veiculo?.ano, v.veiculo?.cor].filter(Boolean).join(' • ')}
                  </p>

                  {/* Associado */}
                  <div className="flex items-center justify-between text-xs">
                    <span>{v.associado?.nome || '---'}</span>
                    {(v.associado?.whatsapp || v.associado?.telefone) && (
                      <a href={`https://wa.me/55${(v.associado.whatsapp || v.associado.telefone).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                        <Phone className="h-3.5 w-3.5 text-emerald-500" />
                      </a>
                    )}
                  </div>

                  {/* OS + Oficina + Auto Center */}
                  <div className="grid grid-cols-1 gap-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">OS:</span> {v.numero || '---'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {v.oficina?.nome_fantasia || v.oficina?.razao_social || '---'}
                    </div>
                    {v.auto_center && (
                      <div className="flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        {v.auto_center.nome_fantasia || v.auto_center.nome}
                      </div>
                    )}
                  </div>

                  {/* Tempo + Alerta */}
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {getTempoEmOficina(v.data_entrada, v.created_at)}
                    </div>
                    {alerta === 'urgent' && (
                      <div className="flex items-center gap-1 text-red-600 font-medium">
                        <AlertCircle className="h-3 w-3" /> URGENTE — +48h sem atualização
                      </div>
                    )}
                    {alerta === 'warning' && (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <AlertTriangle className="h-3 w-3" /> +24h sem atualização
                      </div>
                    )}
                  </div>

                  {/* Etapas */}
                  <EtapasProgress etapas={v.etapas_reparo || []} />

                  {/* Ações */}
                  <div className="flex gap-2 pt-1">
                    {v.status === 'aguardando_entrada' && (
                      <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => handleRegistrarEntrada(v)}>
                        Registrar Entrada
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => navigate(`/oficinas/ordens/${v.id}`)}>
                      Ver Detalhes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Métricas de Oficinas */}
      {metricasOficinas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ranking de Oficinas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {metricasOficinas.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-xs border-b last:border-0 pb-1">
                  <span className="font-medium">{m.nome}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{m.qtd} veíc.</span>
                    <span>~{m.mediaDias}d média</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

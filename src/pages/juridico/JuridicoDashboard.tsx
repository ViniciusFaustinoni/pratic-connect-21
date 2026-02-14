import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Scale, Clock, Calendar, HelpCircle, Plus, AlertTriangle, 
  ChevronRight, FileText, Users, CheckCircle, Gavel, DollarSign,
  Briefcase, AlertCircle, ShieldAlert, Building2, CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays, isPast, isToday, startOfMonth, endOfMonth, startOfYear, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useProcessosPrazos } from '@/hooks/useProcessosPrazos';
import { NovaConsultaModal } from '@/components/juridico/NovaConsultaModal';
import { 
  GraficoProcessosPorTipo, 
  GraficoProcessosPorStatus,
  ValorEmDisputaCard 
} from '@/components/juridico/GraficosJuridico';
import { 
  PRIORIDADE_COLORS, 
  PRIORIDADE_LABELS,
  TIPO_AUDIENCIA_LABELS,
  TIPO_ANDAMENTO_LABELS
} from '@/types/juridico';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

// Helper: badge de urgência por dias restantes (para prazos horizontais)
function getPrazoBadge(dataFim: string) {
  const dias = differenceInDays(new Date(dataFim), new Date());
  if (dias < 0) return <Badge className="bg-red-700 text-white hover:bg-red-800">Vencido</Badge>;
  if (dias < 3) return <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-0">Urgente</Badge>;
  if (dias < 7) return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-0">{dias}d</Badge>;
  if (dias <= 15) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-0">{dias}d</Badge>;
  return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-0">{dias}d</Badge>;
}

export default function JuridicoDashboard() {
  const navigate = useNavigate();
  const [novaConsultaOpen, setNovaConsultaOpen] = useState(false);
  const { cumprirPrazo, isCumprindo } = useProcessosPrazos();

  // ==========================================
  // SEÇÃO 1: KPIs DE CASOS (EVENTOS)
  // ==========================================

  const { data: casosStats, isLoading: loadingCasosStats } = useQuery({
    queryKey: ['juridico-casos-stats'],
    queryFn: async () => {
      const agora = new Date();
      const inicioMes = startOfMonth(agora).toISOString();
      const fimMes = endOfMonth(agora).toISOString();
      const inicioAno = startOfYear(agora).toISOString();

      const [
        consultasAbertas, consultasPendentes, processosAbertos,
        fraudesAno, aguardandoDiretoria, consultasFinalizadasMes, processosFinalizadosMes
      ] = await Promise.all([
        supabase.from('consultas_juridicas').select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null).in('status', ['pendente', 'em_analise']),
        supabase.from('consultas_juridicas').select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null).eq('status', 'pendente'),
        supabase.from('processos').select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null).eq('status', 'ativo'),
        supabase.from('processos').select('*', { count: 'exact', head: true })
          .eq('tipo', 'sindicancia_fraude').gte('created_at', inicioAno),
        supabase.from('sinistros').select('*', { count: 'exact', head: true })
          .eq('status', 'suspenso').eq('resultado_sindicancia', 'inconclusivo'),
        supabase.from('consultas_juridicas').select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null).eq('status', 'respondida')
          .gte('respondido_em', inicioMes).lte('respondido_em', fimMes),
        supabase.from('processos').select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null).in('status', ['encerrado', 'arquivado', 'acordo', 'ganho', 'perdido'])
          .gte('updated_at', inicioMes).lte('updated_at', fimMes),
      ]);

      return {
        casosAbertos: (consultasAbertas.count || 0) + (processosAbertos.count || 0),
        aguardandoParecer: consultasPendentes.count || 0,
        fraudesAno: fraudesAno.count || 0,
        aguardandoDiretoria: aguardandoDiretoria.count || 0,
        finalizadosMes: (consultasFinalizadasMes.count || 0) + (processosFinalizadosMes.count || 0),
      };
    },
  });

  // Dados para gráfico de rosca (tipos de casos abertos)
  const { data: casosPorTipo = [] } = useQuery({
    queryKey: ['juridico-casos-tipo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('consultas_juridicas')
        .select('assunto')
        .not('sinistro_id', 'is', null)
        .in('status', ['pendente', 'em_analise']);
      
      const { data: procs } = await supabase
        .from('processos')
        .select('tipo')
        .not('sinistro_id', 'is', null)
        .eq('status', 'ativo');

      const counts: Record<string, number> = {};
      const classify = (assunto: string, tipo?: string) => {
        if (tipo === 'sindicancia_fraude' || /fraude/i.test(assunto)) return 'Fraude';
        if (/carta de cancelamento/i.test(assunto)) return 'Carta Cancel.';
        if (/encaminhamento jur/i.test(assunto)) return 'Questão Legal';
        if (/indeniza/i.test(assunto)) return 'Indenização';
        if (/alagamento|inc[êe]ndio/i.test(assunto)) return 'Análise Técnica';
        return 'Outro';
      };

      (data || []).forEach(c => {
        const tipo = classify(c.assunto);
        counts[tipo] = (counts[tipo] || 0) + 1;
      });
      (procs || []).forEach(p => {
        const tipo = classify(p.tipo || '', p.tipo);
        counts[tipo] = (counts[tipo] || 0) + 1;
      });

      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  // Dados para gráfico de barras (evolução mensal 6 meses)
  const { data: evolucaoMensal = [] } = useQuery({
    queryKey: ['juridico-casos-evolucao'],
    queryFn: async () => {
      const meses: { label: string; inicio: string; fim: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const inicio = startOfMonth(d).toISOString();
        const fim = endOfMonth(d).toISOString();
        meses.push({ label: format(d, 'MMM', { locale: ptBR }), inicio, fim });
      }

      const results = await Promise.all(meses.map(async m => {
        const { count: c1 } = await supabase.from('consultas_juridicas')
          .select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null)
          .gte('created_at', m.inicio).lte('created_at', m.fim);
        const { count: c2 } = await supabase.from('processos')
          .select('*', { count: 'exact', head: true })
          .not('sinistro_id', 'is', null)
          .gte('created_at', m.inicio).lte('created_at', m.fim);
        return { mes: m.label, total: (c1 || 0) + (c2 || 0) };
      }));
      return results;
    },
  });

  // Casos urgentes
  const { data: casosUrgentes = [] } = useQuery({
    queryKey: ['juridico-casos-urgentes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('consultas_juridicas')
        .select('id, assunto, prioridade, status, created_at')
        .not('sinistro_id', 'is', null)
        .in('prioridade', ['alta', 'urgente'])
        .in('status', ['pendente', 'em_analise'])
        .order('created_at', { ascending: false })
        .limit(6);
      return data || [];
    },
  });

  // ==========================================
  // SEÇÃO 2: DASHBOARD EXISTENTE (PROCESSOS)
  // ==========================================

  const { data: todosProcessos = [] } = useQuery({
    queryKey: ['processos-graficos'],
    queryFn: async () => {
      const { data } = await supabase.from('processos').select('id, tipo, status, natureza, valor_causa, sinistro_id, advogado_id');
      return data || [];
    },
  });

  const valoresDisputa = {
    valorRisco: todosProcessos.filter(p => p.natureza === 'reu' && p.status === 'ativo').reduce((sum, p) => sum + (p.valor_causa || 0), 0),
    valorAReceber: todosProcessos.filter(p => p.natureza === 'autor' && p.status === 'ativo').reduce((sum, p) => sum + (p.valor_causa || 0), 0),
    processosPassivos: todosProcessos.filter(p => p.natureza === 'reu' && p.status === 'ativo').length,
    processosAtivos: todosProcessos.filter(p => p.natureza === 'autor' && p.status === 'ativo').length,
  };

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['juridico-stats'],
    queryFn: async () => {
      const dataLimite = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const hoje = new Date().toISOString().split('T')[0];
      const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const fimMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      const [processosRes, prazosRes, prazosHoje, prazosAmanha, prazosVencidos, audienciasRes, consultasRes] = await Promise.all([
        supabase.from('processos').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('processos_prazos').select('*', { count: 'exact', head: true }).eq('status', 'pendente').lte('data_fim', dataLimite),
        supabase.from('processos_prazos').select('*', { count: 'exact', head: true }).eq('status', 'pendente').eq('data_fim', hoje),
        supabase.from('processos_prazos').select('*', { count: 'exact', head: true }).eq('status', 'pendente').eq('data_fim', amanha),
        supabase.from('processos_prazos').select('*', { count: 'exact', head: true }).eq('status', 'pendente').lt('data_fim', hoje),
        supabase.from('processos_audiencias').select('*', { count: 'exact', head: true }).gte('data_hora', inicioMes.toISOString()).lte('data_hora', fimMes.toISOString()),
        supabase.from('consultas_juridicas').select('*', { count: 'exact', head: true }).in('status', ['pendente', 'em_analise']),
      ]);

      return {
        processosAtivos: processosRes.count || 0,
        prazosProximos: prazosRes.count || 0,
        prazosHoje: prazosHoje.count || 0,
        prazosAmanha: prazosAmanha.count || 0,
        prazosVencidos: prazosVencidos.count || 0,
        audienciasMes: audienciasRes.count || 0,
        consultasPendentes: consultasRes.count || 0,
      };
    },
  });

  const { data: prazosUrgentes = [] } = useQuery({
    queryKey: ['prazos-urgentes'],
    queryFn: async () => {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() + 3);
      const { data } = await supabase.from('processos_prazos')
        .select(`*, processo:processos(numero, numero_processo, parte_contraria_nome)`)
        .eq('status', 'pendente').lte('data_fim', dataLimite.toISOString().split('T')[0]).order('data_fim');
      return data || [];
    },
  });

  const { data: proximasAudiencias = [] } = useQuery({
    queryKey: ['proximas-audiencias'],
    queryFn: async () => {
      const { data } = await supabase.from('processos_audiencias')
        .select(`*, processo:processos(id, numero, parte_contraria_nome)`)
        .eq('status', 'agendada').gte('data_hora', new Date().toISOString()).order('data_hora').limit(5);
      return data || [];
    },
  });

  const { data: consultasPendentes = [] } = useQuery({
    queryKey: ['consultas-pendentes-lista'],
    queryFn: async () => {
      const { data } = await supabase.from('consultas_juridicas').select('*')
        .in('status', ['pendente', 'em_analise']).order('created_at', { ascending: false }).limit(5);
      return data || [];
    },
  });

  const { data: ultimosAndamentos = [] } = useQuery({
    queryKey: ['ultimos-andamentos'],
    queryFn: async () => {
      const { data } = await supabase.from('processos_andamentos')
        .select(`*, processo:processos(numero, parte_contraria_nome)`)
        .order('created_at', { ascending: false }).limit(5);
      return data || [];
    },
  });

  // ==========================================
  // NOVAS QUERIES — Expansão do Dashboard
  // ==========================================

  // Prazos vencendo em 7 dias (KPI)
  const { data: prazos7dStats } = useQuery({
    queryKey: ['juridico-prazos-7d-stats'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const em7dias = addDays(new Date(), 7).toISOString().split('T')[0];

      const [totalRes, vencidosRes, hojeRes] = await Promise.all([
        supabase.from('processos_prazos').select('*', { count: 'exact', head: true })
          .eq('status', 'pendente').lte('data_fim', em7dias),
        supabase.from('processos_prazos').select('*', { count: 'exact', head: true })
          .eq('status', 'pendente').lt('data_fim', hoje),
        supabase.from('processos_prazos').select('*', { count: 'exact', head: true })
          .eq('status', 'pendente').eq('data_fim', hoje),
      ]);

      return {
        total: totalRes.count || 0,
        vencidos: vencidosRes.count || 0,
        hoje: hojeRes.count || 0,
      };
    },
  });

  // Audiências esta semana (KPI)
  const { data: audienciasSemanaStats } = useQuery({
    queryKey: ['juridico-audiencias-semana-stats'],
    queryFn: async () => {
      const agora = new Date();
      const em7dias = addDays(agora, 7).toISOString();
      const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).toISOString();
      const fimHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59).toISOString();

      const [totalRes, hojeRes] = await Promise.all([
        supabase.from('processos_audiencias').select('*', { count: 'exact', head: true })
          .eq('status', 'agendada').gte('data_hora', inicioHoje).lte('data_hora', em7dias),
        supabase.from('processos_audiencias').select('*', { count: 'exact', head: true })
          .eq('status', 'agendada').gte('data_hora', inicioHoje).lte('data_hora', fimHoje),
      ]);

      return {
        total: totalRes.count || 0,
        hoje: hojeRes.count || 0,
      };
    },
  });

  // Carga por advogado (KPI)
  const { data: cargaAdvogado } = useQuery({
    queryKey: ['juridico-carga-advogado'],
    queryFn: async () => {
      const processosAtivos = todosProcessos.filter(p => p.status === 'ativo' && p.advogado_id);
      const porAdvogado: Record<string, number> = {};
      processosAtivos.forEach(p => {
        if (p.advogado_id) porAdvogado[p.advogado_id] = (porAdvogado[p.advogado_id] || 0) + 1;
      });

      const entries = Object.entries(porAdvogado);
      if (entries.length === 0) return null;

      entries.sort((a, b) => b[1] - a[1]);
      const [topId, topCount] = entries[0];
      const media = Math.round(entries.reduce((s, e) => s + e[1], 0) / entries.length);

      const { data: adv } = await supabase.from('advogados').select('nome').eq('id', topId).single();
      return {
        nome: adv?.nome || 'Desconhecido',
        count: topCount,
        media,
        totalAdvogados: entries.length,
      };
    },
    enabled: todosProcessos.length > 0,
  });

  // Próximos 10 prazos (cards horizontais)
  const { data: proximos10Prazos = [] } = useQuery({
    queryKey: ['juridico-proximos-10-prazos'],
    queryFn: async () => {
      const { data } = await supabase.from('processos_prazos')
        .select(`*, processo:processos(id, numero), responsavel:profiles!processos_prazos_responsavel_id_fkey(nome)`)
        .eq('status', 'pendente')
        .order('data_fim', { ascending: true })
        .limit(10);
      return data || [];
    },
  });

  // Advogados para audiências expandidas
  const { data: advogadosMap = {} } = useQuery({
    queryKey: ['juridico-advogados-map'],
    queryFn: async () => {
      const { data } = await supabase.from('advogados').select('id, nome, oab, oab_estado').eq('ativo', true);
      const map: Record<string, any> = {};
      (data || []).forEach(a => { map[a.id] = a; });
      return map;
    },
  });

  // Processos por origem (gráfico)
  const processosOrigem = useMemo(() => {
    const sindicancia = todosProcessos.filter(p => p.sinistro_id).length;
    const manual = todosProcessos.filter(p => !p.sinistro_id).length;
    return [
      { name: 'De Sinistro', value: sindicancia },
      { name: 'Manual', value: manual },
    ].filter(d => d.value > 0);
  }, [todosProcessos]);

  // Resumo por advogado
  const { data: resumoAdvogados = [] } = useQuery({
    queryKey: ['juridico-resumo-advogados'],
    queryFn: async () => {
      const { data: advogados } = await supabase.from('advogados')
        .select('id, nome, oab, oab_estado')
        .eq('ativo', true)
        .order('nome');
      if (!advogados || advogados.length === 0) return [];

      const inicioMes = startOfMonth(new Date()).toISOString();
      const fimMes = endOfMonth(new Date()).toISOString();

      const [processosRes, prazosRes, audienciasRes, pareceresRes] = await Promise.all([
        supabase.from('processos').select('id, advogado_id').eq('status', 'ativo'),
        supabase.from('processos_prazos').select('id, processo_id').eq('status', 'pendente'),
        supabase.from('processos_audiencias').select('id, processo_id, data_hora')
          .eq('status', 'agendada').gte('data_hora', new Date().toISOString()).order('data_hora'),
        supabase.from('consultas_juridicas').select('id, respondido_por')
          .eq('status', 'respondida').gte('respondido_em', inicioMes).lte('respondido_em', fimMes),
      ]);

      const processosData = processosRes.data || [];
      const prazosData = prazosRes.data || [];
      const audienciasData = audienciasRes.data || [];
      const pareceresData = pareceresRes.data || [];

      // Map processos by advogado
      const procByAdv: Record<string, string[]> = {};
      processosData.forEach(p => {
        if (p.advogado_id) {
          if (!procByAdv[p.advogado_id]) procByAdv[p.advogado_id] = [];
          procByAdv[p.advogado_id].push(p.id);
        }
      });

      // Map processos to advogado for prazos/audiencias
      const processoAdvMap: Record<string, string> = {};
      processosData.forEach(p => { if (p.advogado_id) processoAdvMap[p.id] = p.advogado_id; });

      return advogados.map(adv => {
        const processosIds = procByAdv[adv.id] || [];
        const processosAtivos = processosIds.length;

        const prazosPendentes = prazosData.filter(pr => processosIds.includes(pr.processo_id)).length;

        const proxAudiencia = audienciasData.find(a => processosIds.includes(a.processo_id));

        const pareceresMes = pareceresData.filter(p => p.respondido_por === adv.id).length;

        return {
          ...adv,
          processosAtivos,
          prazosPendentes,
          pareceresMes,
          proximaAudiencia: proxAudiencia?.data_hora || null,
        };
      });
    },
  });

  const getUrgenciaBadge = (dataFim: string) => {
    const dias = differenceInDays(new Date(dataFim), new Date());
    if (dias < 0) return <Badge variant="destructive">Vencido</Badge>;
    if (dias === 0) return <Badge variant="destructive">Hoje</Badge>;
    if (dias === 1) return <Badge className="bg-orange-500 hover:bg-orange-600">Amanhã</Badge>;
    if (dias <= 3) return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-black">Próximo</Badge>;
    return <Badge variant="secondary">{dias} dias</Badge>;
  };

  const prazosVencidos = prazosUrgentes.filter(p => isPast(new Date(p.data_fim)) && !isToday(new Date(p.data_fim)));
  const prazosHoje = prazosUrgentes.filter(p => isToday(new Date(p.data_fim)));

  const handleCumprirPrazo = (prazoId: string) => {
    cumprirPrazo({ id: prazoId, observacao: 'Cumprido via dashboard' });
  };

  const PIE_COLORS = ['#ef4444', '#f97316', '#8b5cf6', '#3b82f6', '#eab308', '#6b7280'];
  const ORIGEM_COLORS = ['#3b82f6', '#10b981'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jurídico</h1>
          <p className="text-muted-foreground">Gestão de casos, processos, prazos e consultas jurídicas</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/juridico/processos/novo')}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Processo
          </Button>
          <Button variant="outline" onClick={() => setNovaConsultaOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Consulta
          </Button>
        </div>
      </div>

      {/* Alerta de prazos vencidos */}
      {(prazosVencidos.length > 0 || prazosHoje.length > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {prazosVencidos.length > 0 && `${prazosVencidos.length} prazo(s) vencido(s). `}
              {prazosHoje.length > 0 && `${prazosHoje.length} prazo(s) vencendo hoje!`}
            </span>
            <Link to="/juridico/prazos" className="underline hover:no-underline">Ver todos</Link>
          </AlertDescription>
        </Alert>
      )}

      {/* ==========================================
          CASOS DE EVENTOS — KPIs
          ========================================== */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Casos Abertos</CardTitle>
            <Briefcase className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {loadingCasosStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{casosStats?.casosAbertos || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">consultas + processos de eventos</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${(casosStats?.aguardandoParecer || 0) > 0 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Parecer</CardTitle>
            <AlertCircle className={`h-4 w-4 ${(casosStats?.aguardandoParecer || 0) > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            {loadingCasosStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{casosStats?.aguardandoParecer || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">advogado ainda não analisou</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraudes este Ano</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {loadingCasosStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{casosStats?.fraudesAno || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">sindicâncias com fraude comprovada</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguardando Diretoria</CardTitle>
            <Building2 className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {loadingCasosStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{casosStats?.aguardandoDiretoria || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">inconclusivos pendentes</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalizados (mês)</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loadingCasosStats ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{casosStats?.finalizadosMes || 0}</div>
            )}
            <p className="text-xs text-muted-foreground">encerrados este mês</p>
          </CardContent>
        </Card>
      </div>

      {/* === NOVOS 3 KPI CARDS === */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={`border-l-4 ${(prazos7dStats?.total || 0) > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazos Vencendo (7d)</CardTitle>
            <Clock className={`h-4 w-4 ${(prazos7dStats?.total || 0) > 0 ? 'text-red-500' : 'text-green-500'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{prazos7dStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {(prazos7dStats?.vencidos || 0) > 0 && (
                <span className="text-destructive font-medium">{prazos7dStats?.vencidos} vencido(s)</span>
              )}
              {(prazos7dStats?.vencidos || 0) > 0 && (prazos7dStats?.hoje || 0) > 0 && ' | '}
              {(prazos7dStats?.hoje || 0) > 0 && (
                <span className="text-destructive font-medium">{prazos7dStats?.hoje} hoje</span>
              )}
              {(prazos7dStats?.vencidos || 0) === 0 && (prazos7dStats?.hoje || 0) === 0 && 'nenhum vencido ou hoje'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audiências esta Semana</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{audienciasSemanaStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {(audienciasSemanaStats?.hoje || 0) > 0 ? (
                <span className="text-amber-600 font-semibold">{audienciasSemanaStats?.hoje} hoje!</span>
              ) : 'nenhuma hoje'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Carga por Advogado</CardTitle>
            <Users className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            {cargaAdvogado ? (
              <>
                <div className="text-lg font-bold truncate">{cargaAdvogado.nome} — {cargaAdvogado.count}</div>
                <p className="text-xs text-muted-foreground">
                  Média: {cargaAdvogado.media} processos ({cargaAdvogado.totalAdvogados} advogados)
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">nenhum advogado com processos</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos de Casos */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {casosPorTipo.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={casosPorTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {casosPorTipo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {casosPorTipo.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-1 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span>{entry.name} ({entry.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução Mensal (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            {evolucaoMensal.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={evolucaoMensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Casos Urgentes */}
      {casosUrgentes.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Casos Urgentes
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/juridico/casos">Ver todos <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {casosUrgentes.map((caso: any) => (
                <Link key={caso.id} to={`/juridico/consultas/${caso.id}`} className="block">
                  <div className="rounded-lg border p-3 hover:bg-muted/50 transition-colors space-y-2">
                    <p className="text-sm font-medium line-clamp-1">{caso.assunto}</p>
                    <div className="flex items-center justify-between">
                      <Badge className={caso.prioridade === 'urgente' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}>
                        {caso.prioridade}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {differenceInDays(new Date(), new Date(caso.created_at))}d aberto
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Separador */}
      <div className="flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Processos Judiciais</span>
        <Separator className="flex-1" />
      </div>

      {/* Cards KPI Existentes */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processos Ativos</CardTitle>
            <Scale className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{stats?.processosAtivos || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Passivos: {valoresDisputa.processosPassivos} | Ativos: {valoresDisputa.processosAtivos}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${(stats?.prazosProximos || 0) > 0 ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prazos (7 dias)</CardTitle>
            <Clock className={`h-4 w-4 ${(stats?.prazosProximos || 0) > 0 ? 'text-red-500' : 'text-yellow-500'}`} />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{stats?.prazosProximos || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Hoje: {stats?.prazosHoje || 0} | Amanhã: {stats?.prazosAmanha || 0}
                  {(stats?.prazosVencidos || 0) > 0 && (
                    <span className="text-destructive font-medium"> | {stats?.prazosVencidos} vencido(s)!</span>
                  )}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audiências (mês)</CardTitle>
            <Calendar className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{stats?.audienciasMes || 0}</div>
                <p className="text-xs text-muted-foreground">audiências agendadas</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consultas Pendentes</CardTitle>
            <HelpCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-8 w-16" /> : (
              <>
                <div className="text-2xl font-bold">{stats?.consultasPendentes || 0}</div>
                <p className="text-xs text-muted-foreground">aguardando parecer</p>
              </>
            )}
          </CardContent>
        </Card>

        <ValorEmDisputaCard {...valoresDisputa} />
      </div>

      {/* Gráficos de Processos — agora 3 colunas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <GraficoProcessosPorTipo processos={todosProcessos} />
        <GraficoProcessosPorStatus processos={todosProcessos} />

        {/* Novo: Processos por Origem */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Processos por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            {processosOrigem.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={processosOrigem} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" allowDecimals={false} className="text-xs" />
                  <YAxis type="category" dataKey="name" className="text-xs" width={100} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {processosOrigem.map((_, i) => <Cell key={i} fill={ORIGEM_COLORS[i % ORIGEM_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grid principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* === PRÓXIMOS PRAZOS — Cards Horizontais === */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Próximos Prazos</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/juridico/prazos">Ver todos <ChevronRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {proximos10Prazos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum prazo pendente</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {proximos10Prazos.map((prazo: any) => (
                    <Link key={prazo.id} to={`/juridico/processos/${prazo.processo_id}`}>
                      <div className="min-w-[220px] rounded-lg border p-3 space-y-2 hover:bg-muted/50 transition-colors">
                        <p className="text-sm font-medium line-clamp-1">{prazo.descricao}</p>
                        <p className="text-xs text-muted-foreground">{prazo.processo?.numero || 'Sem processo'}</p>
                        <p className="text-xs text-muted-foreground">{prazo.responsavel?.nome || 'Sem responsável'}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs">{format(new Date(prazo.data_fim), 'dd/MM/yyyy', { locale: ptBR })}</span>
                          {getPrazoBadge(prazo.data_fim)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimos andamentos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Últimos Andamentos</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/juridico/processos">Ver todos <ChevronRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {ultimosAndamentos.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum andamento registrado</p>
              ) : (
                <div className="space-y-4">
                  {ultimosAndamentos.map((andamento: any) => (
                    <div key={andamento.id} className="flex items-start gap-4 border-b pb-4 last:border-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <Gavel className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{andamento.processo?.numero || 'Processo'}</p>
                          <span className="text-xs text-muted-foreground">{format(new Date(andamento.data), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{andamento.descricao}</p>
                        {andamento.tipo && (
                          <Badge variant="outline" className="text-xs">
                            {TIPO_ANDAMENTO_LABELS[andamento.tipo as keyof typeof TIPO_ANDAMENTO_LABELS] || andamento.tipo}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3 */}
        <div className="space-y-6">
          {/* === PRÓXIMAS AUDIÊNCIAS — Expandida === */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-5 w-5" />Próximas Audiências</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/juridico/audiencias">Ver todas <ChevronRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              {proximasAudiencias.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma audiência agendada</p>
              ) : (
                <div className="space-y-3">
                  {proximasAudiencias.map((audiencia: any) => {
                    const ehHoje = isToday(new Date(audiencia.data_hora));
                    // Try to find advogado from process
                    const proc = todosProcessos.find(p => p.id === audiencia.processo?.id);
                    const advogado = proc?.advogado_id ? advogadosMap[proc.advogado_id] : null;

                    return (
                      <Link key={audiencia.id} to={`/juridico/processos/${audiencia.processo_id}`}>
                        <div className={`rounded-lg border p-3 space-y-2 hover:bg-muted/50 transition-colors ${ehHoje ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-medium ${ehHoje ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                              {format(new Date(audiencia.data_hora), 'dd/MM', { locale: ptBR })}
                              {ehHoje && ' (HOJE)'}
                            </span>
                            <span className="text-sm text-muted-foreground">{format(new Date(audiencia.data_hora), 'HH:mm', { locale: ptBR })}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {TIPO_AUDIENCIA_LABELS[audiencia.tipo as keyof typeof TIPO_AUDIENCIA_LABELS] || audiencia.tipo}
                          </Badge>
                          <p className="text-sm text-muted-foreground">{audiencia.processo?.numero}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {audiencia.link_videoconferencia ? '💻 Virtual' : (audiencia.local || 'Local não informado')}
                          </p>
                          {advogado && (
                            <p className="text-xs text-muted-foreground">👤 {advogado.nome}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Ações Rápidas</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" className="justify-start" onClick={() => navigate('/juridico/casos')}>
                <Briefcase className="mr-2 h-4 w-4" />Ver Casos
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate('/juridico/processos/novo')}>
                <Plus className="mr-2 h-4 w-4" />Novo Processo
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => setNovaConsultaOpen(true)}>
                <HelpCircle className="mr-2 h-4 w-4" />Nova Consulta
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => navigate('/juridico/prazos')}>
                <Clock className="mr-2 h-4 w-4" />Ver Prazos
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><HelpCircle className="h-5 w-5" />Consultas Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              {consultasPendentes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma consulta pendente</p>
              ) : (
                <div className="space-y-3">
                  {consultasPendentes.map((consulta: any) => (
                    <div key={consulta.id} className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium line-clamp-1">{consulta.assunto}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{format(new Date(consulta.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                        <Button size="sm" variant="link" className="h-auto p-0 text-xs" asChild>
                          <Link to={`/juridico/consultas/${consulta.id}`}>Responder</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* === RESUMO POR ADVOGADO === */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Resumo por Advogado
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/juridico/advogados">Ver todos <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {resumoAdvogados.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum advogado cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>OAB</TableHead>
                  <TableHead className="text-center">Processos Ativos</TableHead>
                  <TableHead className="text-center">Pareceres (mês)</TableHead>
                  <TableHead className="text-center">Prazos Pendentes</TableHead>
                  <TableHead>Próxima Audiência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumoAdvogados.map((adv: any) => (
                  <TableRow key={adv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate('/juridico/advogados')}>
                    <TableCell className="font-medium">{adv.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{adv.oab ? `${adv.oab}/${adv.oab_estado || ''}` : '-'}</TableCell>
                    <TableCell className="text-center">{adv.processosAtivos}</TableCell>
                    <TableCell className="text-center">{adv.pareceresMes}</TableCell>
                    <TableCell className="text-center">
                      {adv.prazosPendentes > 0 ? (
                        <Badge variant="destructive" className="text-xs">{adv.prazosPendentes}</Badge>
                      ) : '0'}
                    </TableCell>
                    <TableCell>
                      {adv.proximaAudiencia
                        ? format(new Date(adv.proximaAudiencia), 'dd/MM HH:mm', { locale: ptBR })
                        : <span className="text-muted-foreground">—</span>
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NovaConsultaModal open={novaConsultaOpen} onClose={() => setNovaConsultaOpen(false)} />
    </div>
  );
}

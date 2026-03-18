import { useState, useMemo, useCallback } from 'react';
import { useConfiguracaoNumero } from '@/hooks/useConteudosSistema';
import { CardOrcamentoReparo } from '@/components/orcamento/CardOrcamentoReparo';
import { useVeiculosOficina, useOficinasDisponiveis, type VeiculoOficina } from '@/hooks/useVeiculosOficina';
import { OrcamentoPDFImport, type DadosExtraidos } from '@/components/regulador/OrcamentoPDFImport';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Car, Search, Clock, AlertTriangle, AlertCircle, Phone,
  CheckCircle2, CircleDot, Circle, Wrench, Building2, Store,
  ClipboardEdit, Video, Shield, Users, RefreshCw, RotateCcw, XCircle,
  FileUp, ArrowRight, Plus, Trash2, Loader2
} from 'lucide-react';
import { differenceInDays, differenceInHours, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RegistrarAtualizacaoDialog } from '@/components/sinistros/RegistrarAtualizacaoDialog';
import { VistoriaPresencialDialog } from '@/components/sinistros/VistoriaPresencialDialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const ETAPAS_REPARO = [
  { id: 'lanternagem', nome: 'Lanternagem' },
  { id: 'pintura', nome: 'Pintura' },
  { id: 'mecanica', nome: 'Mecânica' },
  { id: 'eletrica', nome: 'Elétrica' },
  { id: 'vidros_farois', nome: 'Vidros e Faróis' },
  { id: 'polimento', nome: 'Polimento' },
  { id: 'lavagem', nome: 'Lavagem' },
] as const;

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  aguardando_entrada: { label: 'Aguardando Entrada', color: 'bg-yellow-100 text-yellow-800' },
  aguardando_orcamento: { label: 'Aguardando Orçamento', color: 'bg-orange-100 text-orange-800' },
  aguardando_aprovacao: { label: 'Aguardando Aprovação', color: 'bg-blue-100 text-blue-800' },
  em_execucao: { label: 'Em Execução', color: 'bg-emerald-100 text-emerald-800' },
  aguardando_peca: { label: 'Aguardando Peça', color: 'bg-purple-100 text-purple-800' },
  pendente_assinatura: { label: 'Pendente Assinatura', color: 'bg-amber-100 text-amber-800' },
  concluido: { label: 'Concluído', color: 'bg-green-100 text-green-800' },
  entregue: { label: 'Entregue', color: 'bg-blue-100 text-blue-800' },
  finalizado: { label: 'Finalizado', color: 'bg-green-100 text-green-800' },
};

function getTempoEmOficina(entrada: string | null, created: string): string {
  const ref = entrada || created;
  const dias = differenceInDays(new Date(), new Date(ref));
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Há 1 dia';
  return `Há ${dias} dias`;
}

function getAlertaAtualizacao(updated: string, prazoManutencao = 48): 'ok' | 'warning' | 'urgent' {
  const horas = differenceInHours(new Date(), new Date(updated));
  if (horas > prazoManutencao) return 'urgent';
  if (horas > prazoManutencao / 2) return 'warning';
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
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const { data: prazoManutencao = 48 } = useConfiguracaoNumero('prazo_manutencao_rastreador_horas', 48);
  const [statusFilter, setStatusFilter] = useState('todos');
  const [oficinaFilter, setOficinaFilter] = useState('todas');
  const [tempoFilter, setTempoFilter] = useState('todos');
  const [atualizacaoDialog, setAtualizacaoDialog] = useState<VeiculoOficina | null>(null);
  const [vistoriaDialog, setVistoriaDialog] = useState<VeiculoOficina | null>(null);
  const [alterarOficinaOS, setAlterarOficinaOS] = useState<VeiculoOficina | null>(null);
  const [novaOficinaId, setNovaOficinaId] = useState('');
  const [retornoGarantiaOS, setRetornoGarantiaOS] = useState<any | null>(null);
  const [retornoTipo, setRetornoTipo] = useState<'pertinente' | 'nao_pertinente'>('pertinente');
  const [retornoObservacao, setRetornoObservacao] = useState('');
  const [retornoSalvando, setRetornoSalvando] = useState(false);
  // PDF Orçamento Dialog
  const [pdfOrcamentoOS, setPdfOrcamentoOS] = useState<VeiculoOficina | null>(null);
  const [pdfEtapasReparo, setPdfEtapasReparo] = useState<string[]>([]);
  const [pdfItensExtraidos, setPdfItensExtraidos] = useState<any[]>([]);
  const [pdfSalvando, setPdfSalvando] = useState(false);
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

  const { data: todosVeiculos = [] } = useVeiculosOficina();

  const hoje = format(new Date(), 'yyyy-MM-dd');
  const { data: atualizacoesHoje = [] } = useQuery({
    queryKey: ['atualizacoes-hoje', hoje],
    queryFn: async () => {
      const { data } = await supabase
        .from('os_atualizacoes_diarias')
        .select('ordem_servico_id')
        .gte('created_at', `${hoje}T00:00:00`)
        .lte('created_at', `${hoje}T23:59:59`);
      return (data || []).map((d: any) => d.ordem_servico_id);
    },
  });

  // Query para histórico de atualizações recentes
  const osIds = useMemo(() => veiculos.map(v => v.id), [veiculos]);
  const { data: atualizacoesRecentes = [] } = useQuery({
    queryKey: ['atualizacoes-recentes', osIds.join(',')],
    queryFn: async () => {
      if (osIds.length === 0) return [];
      const { data } = await supabase
        .from('os_atualizacoes_diarias')
        .select('id, ordem_servico_id, created_at, descricao, etapa_concluida, tem_problema, tipo_problema, fotos_urls')
        .in('ordem_servico_id', osIds)
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: osIds.length > 0,
  });

  const atualizacoesPorOS = useMemo(() => {
    const map: Record<string, any[]> = {};
    (atualizacoesRecentes || []).forEach((a: any) => {
      if (!map[a.ordem_servico_id]) map[a.ordem_servico_id] = [];
      if (map[a.ordem_servico_id].length < 3) map[a.ordem_servico_id].push(a);
    });
    return map;
  }, [atualizacoesRecentes]);

  const { data: garantias = [] } = useQuery({
    queryKey: ['garantias-ativas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ordens_servico')
        .select(`
          id, numero, garantia_ate, data_retirada, oficina_id, sinistro_id,
          veiculo:veiculos(placa, marca, modelo),
          associado:associados(id, nome, telefone, whatsapp),
          oficina:oficinas(id, nome_fantasia, razao_social)
        `)
        .eq('status', 'entregue' as any)
        .gte('garantia_ate', format(new Date(), 'yyyy-MM-dd'))
        .order('garantia_ate');
      return (data || []) as any[];
    },
  });

  const contadores = useMemo(() => ({
    total: todosVeiculos.length,
    aguardando_entrada: todosVeiculos.filter((v) => v.status === 'aguardando_entrada').length,
    aguardando_peca: todosVeiculos.filter((v) => v.status === 'aguardando_peca').length,
    em_execucao: todosVeiculos.filter((v) => v.status === 'em_execucao').length,
    concluido: todosVeiculos.filter((v) => v.status === 'concluido').length,
  }), [todosVeiculos]);

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

      if (os.associado && (os.associado.whatsapp || os.associado.telefone) && os.veiculo) {
        const telefone = os.associado.whatsapp || os.associado.telefone;
        const nome = os.associado.nome?.split(' ')[0] || 'Associado';
        const oficinaNome = os.oficina?.nome_fantasia || os.oficina?.razao_social || 'a oficina';
        const mensagem = `Olá ${nome}! Seu veículo ${os.veiculo.placa} deu entrada em ${oficinaNome} e o reparo já vai começar. Vamos te manter atualizado sobre cada etapa! 🔧`;

        try {
          await supabase.functions.invoke('whatsapp-send-text', {
            body: { telefone, mensagem },
          });
        } catch (e) {
          console.error('Erro ao enviar WhatsApp:', e);
        }
      }

      toast.success('Entrada registrada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['veiculos-oficina'] });
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleAlterarOficina = async () => {
    if (!alterarOficinaOS || !novaOficinaId) return;
    try {
      const { error } = await supabase
        .from('ordens_servico')
        .update({ oficina_id: novaOficinaId, updated_at: new Date().toISOString() } as any)
        .eq('id', alterarOficinaOS.id);
      if (error) throw error;

      const novaOficina = oficinas.find(o => o.id === novaOficinaId);
      await supabase.from('ordens_servico_historico').insert({
        ordem_servico_id: alterarOficinaOS.id,
        status_novo: alterarOficinaOS.status,
        observacao: `Oficina alterada para: ${novaOficina?.nome_fantasia || novaOficina?.razao_social || novaOficinaId}`,
      });

      toast.success('Oficina alterada com sucesso!');
      setAlterarOficinaOS(null);
      setNovaOficinaId('');
      queryClient.invalidateQueries({ queryKey: ['veiculos-oficina'] });
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleRetornoGarantia = async () => {
    if (!retornoGarantiaOS || !profile?.id) return;
    setRetornoSalvando(true);

    try {
      if (retornoTipo === 'pertinente') {
        // Criar nova OS vinculada à original
        const { data: novaOS, error: createErr } = await supabase
          .from('ordens_servico')
          .insert({
            numero: '',
            oficina_id: retornoGarantiaOS.oficina_id || retornoGarantiaOS.oficina?.id,
            veiculo_id: (retornoGarantiaOS.veiculo as any)?.id || null,
            associado_id: (retornoGarantiaOS.associado as any)?.id || null,
            sinistro_id: retornoGarantiaOS.sinistro_id || null,
            status: 'aguardando_entrada',
            retorno_garantia_os_id: retornoGarantiaOS.id,
            observacoes: `Retorno de garantia da OS ${retornoGarantiaOS.numero}. ${retornoObservacao}`,
            criado_por: profile.id,
          } as any)
          .select()
          .single();

        if (createErr) throw createErr;

        await supabase.from('ordens_servico_historico').insert({
          ordem_servico_id: retornoGarantiaOS.id,
          status_novo: 'entregue',
          observacao: `Retorno de garantia aberto (dano pertinente). Nova OS: ${novaOS?.numero || novaOS?.id}. ${retornoObservacao}`,
        });

        toast.success('Retorno de garantia criado com sucesso! Nova OS gerada.');
      } else {
        // Registrar negativa no histórico
        await supabase.from('ordens_servico_historico').insert({
          ordem_servico_id: retornoGarantiaOS.id,
          status_novo: 'entregue',
          observacao: `Retorno de garantia NEGADO (dano não pertinente). ${retornoObservacao}`,
        });

        toast.success('Retorno de garantia registrado como negado.');
      }

      setRetornoGarantiaOS(null);
      setRetornoTipo('pertinente');
      setRetornoObservacao('');
      queryClient.invalidateQueries({ queryKey: ['garantias-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos-oficina'] });
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setRetornoSalvando(false);
    }
  };

  const handlePdfDadosExtraidos = useCallback((dados: DadosExtraidos) => {
    const novosItens: any[] = [];
    if (dados.pecas?.length) {
      for (const p of dados.pecas) {
        novosItens.push({
          tipo: 'peca',
          descricao: p.descricao || '',
          quantidade: p.quantidade || 1,
          valor_unitario: p.valor_unitario || 0,
          valor_total: (p.quantidade || 1) * (p.valor_unitario || 0),
          origem: p.origem || '',
          operacao: p.operacao || '',
        });
      }
    }
    if (dados.servicos?.length) {
      for (const s of dados.servicos) {
        novosItens.push({
          tipo: 'servico',
          descricao: s.descricao || '',
          quantidade: 1,
          valor_unitario: s.valor_total || 0,
          valor_total: s.valor_total || 0,
          tipo_servico: s.tipo_servico || '',
        });
      }
    }
    setPdfItensExtraidos(novosItens);
  }, []);

  const handleSalvarOrcamentoPDF = async () => {
    if (!pdfOrcamentoOS?.sinistro_id) return;
    if (pdfItensExtraidos.length === 0) {
      toast.error('Nenhum item extraído. Envie o PDF primeiro.');
      return;
    }
    if (pdfEtapasReparo.length === 0) {
      toast.error('Selecione pelo menos uma etapa de reparo.');
      return;
    }

    setPdfSalvando(true);
    try {
      // Find or create orcamento_reparo
      let { data: orcamento } = await supabase
        .from('orcamento_reparo')
        .select('id')
        .eq('sinistro_id', pdfOrcamentoOS.sinistro_id)
        .maybeSingle();

      if (!orcamento) {
        const { data: novoOrc, error: createErr } = await supabase
          .from('orcamento_reparo')
          .insert({
            sinistro_id: pdfOrcamentoOS.sinistro_id,
            oficina_id: pdfOrcamentoOS.oficina?.id || null,
            tipo_orcamento: 'cotacao_separada',
          } as any)
          .select('id')
          .single();
        if (createErr) throw createErr;
        orcamento = novoOrc;
      }

      // Insert items
      const itensParaInserir = pdfItensExtraidos.map(i => ({
        orcamento_id: orcamento!.id,
        tipo: i.tipo === 'peca' ? 'peca' : 'mao_de_obra',
        descricao: i.descricao,
        origem: i.origem || null,
        quantidade: i.quantidade || 1,
        valor_unitario: i.valor_unitario || 0,
        status: 'pendente',
        observacao: i.operacao || i.tipo_servico || null,
        created_by: profile?.id || null,
      }));

      const { error: insertErr } = await supabase
        .from('orcamento_reparo_itens')
        .insert(itensParaInserir);
      if (insertErr) throw insertErr;

      // Update OS etapas_reparo
      const etapasData = ETAPAS_REPARO
        .filter(e => pdfEtapasReparo.includes(e.id))
        .map(e => ({ id: e.id, nome: e.nome, selecionada: true, status: 'pendente' as const }));

      await supabase
        .from('ordens_servico')
        .update({
          etapas_reparo: etapasData as any,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', pdfOrcamentoOS.id);

      toast.success('Orçamento salvo com sucesso!');
      setPdfOrcamentoOS(null);
      setPdfEtapasReparo([]);
      setPdfItensExtraidos([]);
      queryClient.invalidateQueries({ queryKey: ['veiculos-oficina'] });
      queryClient.invalidateQueries({ queryKey: ['orcamento-reparo'] });
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setPdfSalvando(false);
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
          { label: 'Concluídos', value: contadores.concluido, color: 'bg-green-50 text-green-700' },
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aguardando_entrada">Aguard. Entrada</SelectItem>
              <SelectItem value="em_execucao">Em Execução</SelectItem>
              <SelectItem value="aguardando_peca">Aguard. Peça</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
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
            const alerta = getAlertaAtualizacao(v.updated_at, prazoManutencao);
            const statusInfo = STATUS_MAP[v.status] || { label: v.status, color: 'bg-gray-100 text-gray-800' };
            const atualizadoHoje = atualizacoesHoje.includes(v.id);
            return (
              <Card key={v.id} className={`overflow-hidden ${alerta === 'urgent' ? 'border-red-400' : alerta === 'warning' ? 'border-yellow-400' : ''}`}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold text-base tracking-wider">{v.veiculo?.placa || '---'}</span>
                      {atualizadoHoje ? (
                        <Badge className="bg-emerald-100 text-emerald-700 text-[9px] px-1">✓ Atualizado</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 text-[9px] px-1">Pendente!</Badge>
                      )}
                    </div>
                    <Badge className={`${statusInfo.color} text-[10px] px-1.5`}>{statusInfo.label}</Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {[v.veiculo?.marca, v.veiculo?.modelo, v.veiculo?.ano, v.veiculo?.cor].filter(Boolean).join(' • ')}
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <span>{v.associado?.nome || '---'}</span>
                    {(v.associado?.whatsapp || v.associado?.telefone) && (
                      <a href={`https://wa.me/55${(v.associado.whatsapp || v.associado.telefone).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                        <Phone className="h-3.5 w-3.5 text-emerald-500" />
                      </a>
                    )}
                  </div>

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
                    {v.prestadores && v.prestadores.length > 0 && (
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {v.prestadores.map((p: any) => p.nome).join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {getTempoEmOficina(v.data_entrada, v.created_at)}
                    </div>
                    {alerta === 'urgent' && (
                      <div className="flex items-center gap-1 text-red-600 font-medium">
                        <AlertCircle className="h-3 w-3" /> URGENTE — +48h
                      </div>
                    )}
                    {alerta === 'warning' && (
                      <div className="flex items-center gap-1 text-yellow-600">
                        <AlertTriangle className="h-3 w-3" /> +24h sem atualização
                      </div>
                    )}
                  </div>

                  <EtapasProgress etapas={v.etapas_reparo || []} />

                  {atualizacoesPorOS[v.id]?.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full h-7 text-[11px] text-muted-foreground">
                          Ver histórico ({atualizacoesPorOS[v.id].length} atualizações)
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-2 border-t pt-2 mt-1">
                          {atualizacoesPorOS[v.id].map((a: any) => (
                            <div key={a.id} className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{format(new Date(a.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
                                <div className="flex gap-1">
                                  {a.etapa_concluida && <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">✓ {a.etapa_concluida}</Badge>}
                                  {a.tem_problema && <Badge className="bg-red-100 text-red-700 text-[9px]">⚠ Problema</Badge>}
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2">{a.descricao}</p>
                              {a.fotos_urls?.length > 0 && (
                                <div className="flex gap-1">
                                  {(a.fotos_urls as string[]).slice(0, 4).map((url: string, i: number) => (
                                    <img key={i} src={url} className="w-10 h-10 rounded object-cover" alt="" />
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {v.status === 'aguardando_entrada' && (
                      <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => handleRegistrarEntrada(v)}>
                        Registrar Entrada
                      </Button>
                    )}
                    {v.status === 'em_execucao' && (
                      <>
                        <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => setAtualizacaoDialog(v)}>
                          <ClipboardEdit className="h-3 w-3 mr-1" /> Atualizar
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setVistoriaDialog(v)}>
                          <Video className="h-3 w-3 mr-1" /> Vistoria
                        </Button>
                      </>
                    )}
                    {v.sinistro_id && ['aguardando_orcamento', 'em_execucao', 'aguardando_entrada'].includes(v.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        onClick={() => {
                          setPdfOrcamentoOS(v);
                          setPdfEtapasReparo([]);
                          setPdfItensExtraidos([]);
                        }}
                      >
                        <FileUp className="h-3 w-3 mr-1" /> Orçamento PDF
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setAlterarOficinaOS(v); setNovaOficinaId(v.oficina?.id || ''); }}>
                      <RefreshCw className="h-3 w-3 mr-1" /> Oficina
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => navigate(`/oficinas/ordens/${v.id}`)}>
                      Ver Detalhes
                    </Button>
                  </div>

                  {/* Orçamento do Reparo */}
                  {v.sinistro_id && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full h-7 text-[11px] text-muted-foreground">
                          💰 Orçamento do Reparo
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="border-t pt-2 mt-1">
                          <CardOrcamentoReparo
                            sinistroId={v.sinistro_id}
                            canEdit={true}
                            oficinaNome={v.oficina?.nome_fantasia || v.oficina?.razao_social}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
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

      {/* Garantias Ativas */}
      {garantias.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1"><Shield className="h-4 w-4" /> Garantias Ativas</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="space-y-2">
              {garantias.map((g: any) => {
                const diasRestantes = g.garantia_ate ? differenceInDays(new Date(g.garantia_ate), new Date()) : 0;
                return (
                  <div key={g.id} className="flex items-center justify-between text-xs border-b last:border-0 pb-1">
                    <div>
                      <span className="font-medium">{(g.veiculo as any)?.placa}</span>
                      <span className="text-muted-foreground ml-2">{(g.associado as any)?.nome}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={diasRestantes <= 7 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'} variant="outline">
                        {diasRestantes}d restantes
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px] px-2"
                        onClick={() => {
                          setRetornoGarantiaOS(g);
                          setRetornoTipo('pertinente');
                          setRetornoObservacao('');
                        }}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Retorno
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {atualizacaoDialog && (
        <RegistrarAtualizacaoDialog
          open={!!atualizacaoDialog}
          onOpenChange={(open) => !open && setAtualizacaoDialog(null)}
          ordemServico={{
            id: atualizacaoDialog.id,
            numero: atualizacaoDialog.numero,
            etapas_reparo: atualizacaoDialog.etapas_reparo || [],
            sinistro_id: atualizacaoDialog.sinistro?.id,
          }}
        />
      )}
      {vistoriaDialog && (
        <VistoriaPresencialDialog
          open={!!vistoriaDialog}
          onOpenChange={(open) => !open && setVistoriaDialog(null)}
          ordemServico={{ id: vistoriaDialog.id, numero: vistoriaDialog.numero }}
        />
      )}

      {/* Dialog Alterar Oficina */}
      <Dialog open={!!alterarOficinaOS} onOpenChange={(open) => !open && setAlterarOficinaOS(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Oficina — OS {alterarOficinaOS?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Veículo: <strong>{alterarOficinaOS?.veiculo?.placa}</strong> — {alterarOficinaOS?.veiculo?.marca} {alterarOficinaOS?.veiculo?.modelo}
            </p>
            <Select value={novaOficinaId} onValueChange={setNovaOficinaId}>
              <SelectTrigger><SelectValue placeholder="Selecione a oficina" /></SelectTrigger>
              <SelectContent>
                {oficinas.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.nome_fantasia || o.razao_social}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlterarOficinaOS(null)}>Cancelar</Button>
            <Button onClick={handleAlterarOficina} disabled={!novaOficinaId}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Retorno de Garantia */}
      <Dialog open={!!retornoGarantiaOS} onOpenChange={(open) => !open && setRetornoGarantiaOS(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retorno de Garantia — OS {retornoGarantiaOS?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Veículo: <strong>{(retornoGarantiaOS?.veiculo as any)?.placa}</strong> — {(retornoGarantiaOS?.veiculo as any)?.marca} {(retornoGarantiaOS?.veiculo as any)?.modelo}
            </p>
            <p className="text-sm text-muted-foreground">
              Associado: <strong>{(retornoGarantiaOS?.associado as any)?.nome}</strong>
            </p>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo de retorno</Label>
              <RadioGroup value={retornoTipo} onValueChange={(v) => setRetornoTipo(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pertinente" id="pertinente" />
                  <Label htmlFor="pertinente" className="text-sm flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Dano pertinente — volta à oficina sem custo
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao_pertinente" id="nao_pertinente" />
                  <Label htmlFor="nao_pertinente" className="text-sm flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                    Dano não pertinente — negado
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm font-medium">Observações</Label>
              <Textarea
                value={retornoObservacao}
                onChange={(e) => setRetornoObservacao(e.target.value)}
                placeholder="Descreva o motivo do retorno..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetornoGarantiaOS(null)}>Cancelar</Button>
            <Button onClick={handleRetornoGarantia} disabled={retornoSalvando}>
              {retornoSalvando ? 'Salvando...' : retornoTipo === 'pertinente' ? 'Criar Nova OS' : 'Registrar Negativa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Orçamento via PDF */}
      <Dialog open={!!pdfOrcamentoOS} onOpenChange={(open) => { if (!open) { setPdfOrcamentoOS(null); setPdfEtapasReparo([]); setPdfItensExtraidos([]); } }}>
        <DialogContent className="max-w-full h-full max-h-full sm:max-w-2xl sm:max-h-[90vh] sm:h-auto p-0 gap-0 rounded-none sm:rounded-lg">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <DialogTitle>Orçamento via PDF — OS {pdfOrcamentoOS?.numero}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto p-4 space-y-4 flex-1">
            <p className="text-xs text-muted-foreground">
              Veículo: <strong>{pdfOrcamentoOS?.veiculo?.placa}</strong> — {pdfOrcamentoOS?.veiculo?.marca} {pdfOrcamentoOS?.veiculo?.modelo}
            </p>

            {/* Etapas de Reparo */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Etapas necessárias *</Label>
              <div className="grid grid-cols-2 gap-2">
                {ETAPAS_REPARO.map((etapa) => (
                  <label key={etapa.id} className="flex items-center gap-2 rounded-lg border p-2 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox
                      checked={pdfEtapasReparo.includes(etapa.id)}
                      onCheckedChange={(checked) => {
                        setPdfEtapasReparo(prev => checked ? [...prev, etapa.id] : prev.filter(id => id !== etapa.id));
                      }}
                    />
                    <span className="text-xs">{etapa.nome}</span>
                  </label>
                ))}
              </div>
              {pdfEtapasReparo.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  {ETAPAS_REPARO.filter(e => pdfEtapasReparo.includes(e.id)).map((etapa, i, arr) => (
                    <span key={etapa.id} className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px]">{etapa.nome}</Badge>
                      {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* PDF Upload */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Enviar PDF do orçamento</Label>
              <OrcamentoPDFImport onDadosExtraidos={handlePdfDadosExtraidos} />
            </div>

            {/* Itens Extraídos */}
            {pdfItensExtraidos.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Itens extraídos ({pdfItensExtraidos.length})</Label>
                {pdfItensExtraidos.map((item, i) => (
                  <div key={i} className="rounded-lg border p-2 space-y-1">
                    <div className="flex justify-between items-center">
                      <Badge variant={item.tipo === 'peca' ? 'default' : 'secondary'} className="text-[10px]">
                        {item.tipo === 'peca' ? '🔧 Peça' : '🛠️ Serviço'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setPdfItensExtraidos(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <p className="text-xs font-medium">{item.descricao}</p>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Qtd: {item.quantidade}</span>
                      <span>Unit: R$ {(item.valor_unitario || 0).toFixed(2)}</span>
                      <span className="font-medium text-foreground">Total: R$ {(item.valor_total || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ))}

                {/* Resumo */}
                <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                  <div className="flex justify-between text-xs">
                    <span>Peças ({pdfItensExtraidos.filter(i => i.tipo === 'peca').length}):</span>
                    <span>R$ {pdfItensExtraidos.filter(i => i.tipo === 'peca').reduce((s: number, i: any) => s + (i.valor_total || 0), 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Serviços ({pdfItensExtraidos.filter(i => i.tipo === 'servico').length}):</span>
                    <span>R$ {pdfItensExtraidos.filter(i => i.tipo === 'servico').reduce((s: number, i: any) => s + (i.valor_total || 0), 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>TOTAL:</span>
                    <span>R$ {pdfItensExtraidos.reduce((s: number, i: any) => s + (i.valor_total || 0), 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setPdfOrcamentoOS(null); setPdfEtapasReparo([]); setPdfItensExtraidos([]); }}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSalvarOrcamentoPDF}
                disabled={pdfSalvando || pdfItensExtraidos.length === 0 || pdfEtapasReparo.length === 0}
              >
                {pdfSalvando ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : 'Salvar Orçamento'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

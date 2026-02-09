import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Package,
  Car,
  Wrench,
  XCircle,
  User,
  Cpu,
  Calendar,
  ArrowRight,
  History,
  Server,
  Settings,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { usePlataformasLabels } from '@/hooks/usePlataformasCRUD';

interface DetalhesRastreadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreadorId: string | null;
}

type StatusRastreador = 'estoque' | 'instalado' | 'manutencao' | 'baixado' | 'retorno_base' | 'triagem' | 'em_analise_plataforma' | 'em_garantia';

const statusConfig: Record<StatusRastreador, { label: string; icon: React.ElementType; color: string }> = {
  estoque: { label: 'Em Estoque', icon: Package, color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  instalado: { label: 'Instalado', icon: Car, color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  manutencao: { label: 'Em Manutenção', icon: Wrench, color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  baixado: { label: 'Baixado', icon: XCircle, color: 'bg-red-500/10 text-red-600 border-red-500/30' },
  retorno_base: { label: 'Retorno Base', icon: Package, color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  triagem: { label: 'Em Triagem', icon: Settings, color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  em_analise_plataforma: { label: 'Análise Plataforma', icon: Server, color: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30' },
  em_garantia: { label: 'Em Garantia', icon: FileText, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30' },
};

const tipoMovimentacaoLabels: Record<string, string> = {
  entrada_estoque: 'Entrada no Estoque',
  saida_instalacao: 'Saída para Instalação',
  retorno_estoque: 'Retorno ao Estoque',
  envio_manutencao: 'Envio para Manutenção',
  baixa: 'Baixa',
  transferencia: 'Transferência',
  alteracao_status: 'Alteração de Status',
  atribuicao_portador: 'Atribuição de Portador',
  remocao_portador: 'Remoção de Portador',
  troca_portador: 'Troca de Portador',
  retorno_base: 'Retorno à Base (Triagem)',
  baixa_substituicao: 'Baixa por Substituição',
  instalacao_substituicao: 'Instalação (Substituição)',
  baixa_manutencao: 'Baixa por Manutenção',
  inicio_triagem: 'Início da Triagem',
  envio_plataforma: 'Envio para Plataforma',
  envio_garantia: 'Envio para Garantia',
  retorno_plataforma: 'Retorno da Plataforma',
  retorno_garantia: 'Retorno da Garantia',
};

const ETAPA_MANUTENCAO_LABELS: Record<string, string> = {
  aguardando_triagem: 'Aguardando Triagem',
  em_triagem: 'Em Triagem',
  aguardando_envio_plataforma: 'Aguardando Envio Plataforma',
  em_analise_plataforma: 'Em Análise Plataforma',
  aguardando_envio_garantia: 'Aguardando Envio Garantia',
  em_garantia: 'Em Garantia',
  concluido_estoque: 'Devolvido ao Estoque',
  descartado: 'Descartado',
};

const ETAPA_MANUTENCAO_COLORS: Record<string, string> = {
  aguardando_triagem: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  em_triagem: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  aguardando_envio_plataforma: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  em_analise_plataforma: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  aguardando_envio_garantia: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  em_garantia: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  concluido_estoque: 'bg-green-500/10 text-green-600 border-green-500/30',
  descartado: 'bg-red-500/10 text-red-600 border-red-500/30',
};

const MOTIVO_MANUTENCAO_LABELS: Record<string, string> = {
  sem_sinal: 'Sem Sinal',
  bateria_baixa: 'Bateria Baixa',
  localizacao_incorreta: 'Localização Incorreta',
  ignicao_incorreta: 'Ignição Incorreta',
  solicitacao_associado: 'Solicitação do Associado',
  preventiva: 'Manutenção Preventiva',
  outro: 'Outro',
};

const RESULTADO_MANUTENCAO_LABELS: Record<string, string> = {
  resolvido: 'Resolvido',
  substituicao: 'Substituição',
  nao_resolvido: 'Não Resolvido',
};

const RESULTADO_MANUTENCAO_COLORS: Record<string, string> = {
  resolvido: 'bg-green-500/10 text-green-600 border-green-500/30',
  substituicao: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  nao_resolvido: 'bg-red-500/10 text-red-600 border-red-500/30',
};

const TIPO_SERVICO_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  instalacao: { label: 'Instalação', icon: Car, color: 'text-blue-600 bg-blue-500/10 border-blue-500/30' },
  vistoria_manutencao: { label: 'Manutenção de Campo', icon: Wrench, color: 'text-amber-600 bg-amber-500/10 border-amber-500/30' },
  vistoria_retirada: { label: 'Retirada', icon: Package, color: 'text-red-600 bg-red-500/10 border-red-500/30' },
};

interface TimelineItem {
  id: string;
  tipo: 'movimentacao' | 'servico' | 'manutencao_interna';
  label: string;
  data: string;
  detalhes?: string;
  usuario?: string;
  icon: React.ElementType;
  color: string;
  badge?: { label: string; color: string };
  statusTransicao?: { de: string; para: string };
}

export function DetalhesRastreadorDialog({ open, onOpenChange, rastreadorId }: DetalhesRastreadorDialogProps) {
  const queryClient = useQueryClient();
  const { data: plataformasLabels } = usePlataformasLabels();
  const [editandoCampo, setEditandoCampo] = useState<string | null>(null);
  const [valorEditado, setValorEditado] = useState('');

  const handleIniciarEdicao = useCallback((campo: string, valorAtual: string) => {
    setEditandoCampo(campo);
    setValorEditado(valorAtual === '-' ? '' : valorAtual);
  }, []);

  const handleSalvarCampo = useCallback(async () => {
    if (!editandoCampo || !rastreadorId) return;
    const { error } = await supabase
      .from('rastreadores')
      .update({ [editandoCampo]: valorEditado || null })
      .eq('id', rastreadorId);
    if (error) {
      toast.error('Erro ao salvar');
    } else {
      toast.success('Campo atualizado');
      queryClient.invalidateQueries({ queryKey: ['rastreador-detalhes', rastreadorId] });
    }
    setEditandoCampo(null);
  }, [editandoCampo, valorEditado, rastreadorId, queryClient]);

  const handleCancelarEdicao = useCallback(() => {
    setEditandoCampo(null);
  }, []);

  // Query para buscar dados completos do rastreador
  const { data: rastreador, isLoading } = useQuery({
    queryKey: ['rastreador-detalhes', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select(`
          id, codigo, imei, numero_serie, plataforma, id_plataforma, status,
          ultima_comunicacao, created_at, updated_at, portador_id,
          portador:profiles!rastreadores_portador_id_fkey(id, nome),
          veiculo:veiculos!rastreadores_veiculo_id_fkey(
            id, placa, modelo, marca,
            associado:associados(id, nome, cpf)
          )
        `)
        .eq('id', rastreadorId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open,
    refetchInterval: 30000,
  });

  // Query unificada: movimentações de estoque
  const { data: historicoMovimentacoes } = useQuery({
    queryKey: ['rastreador-historico-mov', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select(`
          id, tipo, status_anterior, status_novo, nota_fiscal, observacoes, created_at,
          usuario:profiles!estoque_movimentacoes_usuario_id_fkey(nome)
        `)
        .eq('rastreador_id', rastreadorId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open,
    refetchInterval: 30000,
  });

  // Query unificada: TODOS os serviços vinculados ao rastreador
  const { data: historicoServicos } = useQuery({
    queryKey: ['rastreador-historico-servicos-completo', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id, tipo, status, protocolo, created_at, concluida_em,
          resultado_manutencao, observacoes_analise,
          profissional:profiles!servicos_profissional_id_fkey(nome)
        `)
        .eq('rastreador_id', rastreadorId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open,
    refetchInterval: 30000,
  });

  // Query unificada: TODAS as manutenções internas
  const { data: historicoManutencaoInterna } = useQuery({
    queryKey: ['rastreador-historico-manutencao-completo', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreador_manutencao_interna')
        .select(`
          id, etapa, diagnostico_inicial, defeito_identificado, acao_tomada,
          encaminhado_para, laudo_externo, created_at, resolvido_em,
          resolvido_por_profile:profiles!rastreador_manutencao_interna_resolvido_por_fkey(nome),
          servico_origem:servicos!rastreador_manutencao_interna_servico_origem_id_fkey(protocolo)
        `)
        .eq('rastreador_id', rastreadorId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open,
    refetchInterval: 30000,
  });

  // Query para manutenção de campo ativa
  const { data: servicoManutencao } = useQuery({
    queryKey: ['rastreador-servico-manutencao', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id, protocolo, status, data_agendada, periodo, motivo_manutencao, observacoes,
          profissional:profiles!servicos_profissional_id_fkey(nome)
        `)
        .eq('rastreador_id', rastreadorId!)
        .eq('tipo', 'vistoria_manutencao')
        .not('status', 'in', '("concluida","cancelada","aprovada")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open && rastreador?.status === 'manutencao',
  });

  // Query para manutenção interna ativa
  const statusManutencaoInterna = ['retorno_base', 'triagem', 'em_analise_plataforma', 'em_garantia'];
  const { data: manutencaoInterna } = useQuery({
    queryKey: ['rastreador-manutencao-interna', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreador_manutencao_interna')
        .select(`
          id, etapa, diagnostico_inicial, defeito_identificado, encaminhado_para,
          numero_protocolo_externo, laudo_externo, created_at,
          servico_origem:servicos!rastreador_manutencao_interna_servico_origem_id_fkey(protocolo)
        `)
        .eq('rastreador_id', rastreadorId!)
        .not('etapa', 'in', '("concluido_estoque","descartado")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open && statusManutencaoInterna.includes(rastreador?.status || ''),
  });

  // Consolidar timeline unificada
  const timelineItems: TimelineItem[] = [];

  // Movimentações de estoque
  historicoMovimentacoes?.forEach((mov) => {
    timelineItems.push({
      id: `mov-${mov.id}`,
      tipo: 'movimentacao',
      label: tipoMovimentacaoLabels[mov.tipo] || mov.tipo,
      data: mov.created_at,
      detalhes: [mov.nota_fiscal ? `NF: ${mov.nota_fiscal}` : '', mov.observacoes || ''].filter(Boolean).join(' • '),
      usuario: mov.usuario?.nome,
      icon: Package,
      color: 'text-emerald-600',
      statusTransicao: mov.status_anterior && mov.status_novo ? { de: mov.status_anterior, para: mov.status_novo } : undefined,
    });
  });

  // Serviços de campo
  historicoServicos?.forEach((s) => {
    const tipoConfig = TIPO_SERVICO_LABELS[s.tipo] || { label: s.tipo, icon: FileText, color: 'text-muted-foreground bg-muted border-muted' };
    timelineItems.push({
      id: `svc-${s.id}`,
      tipo: 'servico',
      label: tipoConfig.label,
      data: s.concluida_em || s.created_at,
      detalhes: [s.protocolo, s.observacoes_analise].filter(Boolean).join(' — '),
      usuario: s.profissional?.nome,
      icon: tipoConfig.icon,
      color: tipoConfig.color.split(' ')[0],
      badge: s.resultado_manutencao
        ? { label: RESULTADO_MANUTENCAO_LABELS[s.resultado_manutencao] || s.resultado_manutencao, color: RESULTADO_MANUTENCAO_COLORS[s.resultado_manutencao] || 'bg-muted' }
        : { label: s.status, color: 'bg-muted' },
    });
  });

  // Manutenções internas
  historicoManutencaoInterna?.forEach((m) => {
    timelineItems.push({
      id: `mi-${m.id}`,
      tipo: 'manutencao_interna',
      label: `Manutenção Interna — ${ETAPA_MANUTENCAO_LABELS[m.etapa] || m.etapa}`,
      data: m.resolvido_em || m.created_at,
      detalhes: [m.diagnostico_inicial, m.acao_tomada, m.laudo_externo ? `Laudo: ${m.laudo_externo}` : ''].filter(Boolean).join(' • '),
      usuario: m.resolvido_por_profile?.nome,
      icon: Settings,
      color: 'text-purple-600',
      badge: { label: ETAPA_MANUTENCAO_LABELS[m.etapa] || m.etapa, color: ETAPA_MANUTENCAO_COLORS[m.etapa] || 'bg-muted' },
    });
  });

  // Ordenar por data decrescente
  timelineItems.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const isLoadingTimeline = !historicoMovimentacoes && !historicoServicos && !historicoManutencaoInterna;

  const status = (rastreador?.status as StatusRastreador) || 'estoque';
  const config = statusConfig[status] || statusConfig.estoque;
  const StatusIcon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Detalhes do Rastreador</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="p-6 pt-0 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : rastreador ? (
          <ScrollArea className="max-h-[calc(90vh-100px)]">
            <div className="p-6 pt-0 space-y-6">
              {/* Header Card */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-lg">{rastreador.codigo}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={config.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {config.label}
                      </Badge>
                      {rastreador.plataforma && (
                        <Badge variant="secondary">
                          <Server className="h-3 w-3 mr-1" />
                          {plataformasLabels?.[rastreador.plataforma] || rastreador.plataforma}
                        </Badge>
                      )}
                    </div>
                    {rastreador.portador && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                        <User className="h-4 w-4" />
                        <span>Portador: {rastreador.portador.nome}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Manutenção de Campo Ativa */}
              {rastreador.status === 'manutencao' && servicoManutencao && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-amber-600 uppercase tracking-wide flex items-center gap-2">
                    <Wrench className="h-4 w-4" />
                    Manutenção em Andamento
                  </h3>
                  <div className="rounded-lg border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{servicoManutencao.protocolo}</span>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        {servicoManutencao.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="flex items-center gap-2">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Motivo: {MOTIVO_MANUTENCAO_LABELS[servicoManutencao.motivo_manutencao || ''] || servicoManutencao.motivo_manutencao || '-'}
                      </p>
                      {servicoManutencao.data_agendada && (
                        <p className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          Agendado: {format(new Date(servicoManutencao.data_agendada), 'dd/MM/yyyy', { locale: ptBR })} - {servicoManutencao.periodo || 'A definir'}
                        </p>
                      )}
                      {servicoManutencao.profissional?.nome && (
                        <p className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5" />
                          Técnico: {servicoManutencao.profissional.nome}
                        </p>
                      )}
                      {servicoManutencao.observacoes && (
                        <p className="text-xs mt-2 italic">{servicoManutencao.observacoes}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Manutenção Interna Ativa */}
              {statusManutencaoInterna.includes(rastreador.status || '') && manutencaoInterna && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-purple-600 uppercase tracking-wide flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Manutenção Interna (Bancada)
                  </h3>
                  <div className="rounded-lg border-2 border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-900 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className={ETAPA_MANUTENCAO_COLORS[manutencaoInterna.etapa] || 'bg-muted'}>
                        {ETAPA_MANUTENCAO_LABELS[manutencaoInterna.etapa] || manutencaoInterna.etapa}
                      </Badge>
                      {manutencaoInterna.servico_origem?.protocolo && (
                        <span className="text-xs text-muted-foreground">
                          Origem: {manutencaoInterna.servico_origem.protocolo}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {manutencaoInterna.diagnostico_inicial && (
                        <p>Diagnóstico: {manutencaoInterna.diagnostico_inicial}</p>
                      )}
                      {manutencaoInterna.defeito_identificado && (
                        <p>Defeito: {manutencaoInterna.defeito_identificado}</p>
                      )}
                      {manutencaoInterna.encaminhado_para && (
                        <p>Encaminhado para: {manutencaoInterna.encaminhado_para}</p>
                      )}
                      {manutencaoInterna.numero_protocolo_externo && (
                        <p className="font-mono">Protocolo Externo: {manutencaoInterna.numero_protocolo_externo}</p>
                      )}
                      {manutencaoInterna.laudo_externo && (
                        <p className="text-xs mt-2 italic">Laudo: {manutencaoInterna.laudo_externo}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Informações Técnicas */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Informações Técnicas
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow label="IMEI" value={rastreador.imei || '-'} mono />
                  <EditableInfoRow
                    label="Número de Série"
                    value={rastreador.numero_serie || '-'}
                    campo="numero_serie"
                    editandoCampo={editandoCampo}
                    valorEditado={valorEditado}
                    onIniciarEdicao={handleIniciarEdicao}
                    onSalvar={handleSalvarCampo}
                    onCancelar={handleCancelarEdicao}
                    onChange={setValorEditado}
                  />
                  <InfoRow label="Plataforma" value={plataformasLabels?.[rastreador.plataforma] || rastreador.plataforma || '-'} />
                  <EditableInfoRow
                    label="ID na Plataforma"
                    value={rastreador.id_plataforma || '-'}
                    campo="id_plataforma"
                    editandoCampo={editandoCampo}
                    valorEditado={valorEditado}
                    onIniciarEdicao={handleIniciarEdicao}
                    onSalvar={handleSalvarCampo}
                    onCancelar={handleCancelarEdicao}
                    onChange={setValorEditado}
                    mono
                  />
                </div>
              </div>

              {/* Veículo Vinculado */}
              {rastreador.veiculo && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Veículo Vinculado
                  </h3>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-primary" />
                      <span className="font-medium">{rastreador.veiculo.placa}</span>
                      {rastreador.veiculo.modelo && (
                        <span className="text-muted-foreground">
                          {rastreador.veiculo.marca} {rastreador.veiculo.modelo}
                        </span>
                      )}
                    </div>
                    {rastreador.veiculo.associado && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span>{rastreador.veiculo.associado.nome}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Datas */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Datas
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <InfoRow
                    label="Entrada no Sistema"
                    value={rastreador.created_at ? format(new Date(rastreador.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '-'}
                  />
                  <InfoRow
                    label="Última Comunicação"
                    value={rastreador.ultima_comunicacao ? format(new Date(rastreador.ultima_comunicacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Sem comunicação'}
                  />
                </div>
              </div>

              <Separator />

              {/* Timeline Unificada */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico Completo
                </h3>
                {isLoadingTimeline ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : timelineItems.length > 0 ? (
                  <div className="relative space-y-0">
                    {/* Linha vertical da timeline */}
                    <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                    {timelineItems.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.id} className="relative pl-10 py-3 first:pt-0 last:pb-0">
                          {/* Ícone na timeline */}
                          <div className={`absolute left-2 top-3 first:top-0 w-5 h-5 rounded-full border-2 border-background bg-background flex items-center justify-center`}>
                            <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                          </div>
                          <div className="rounded-lg border p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{item.label}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.badge && (
                                  <Badge variant="outline" className={`text-xs ${item.badge.color}`}>
                                    {item.badge.label}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(item.data), "dd/MM/yy HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                            {item.statusTransicao && (
                              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                <span>{statusConfig[item.statusTransicao.de as StatusRastreador]?.label || item.statusTransicao.de}</span>
                                <ArrowRight className="h-3 w-3" />
                                <span>{statusConfig[item.statusTransicao.para as StatusRastreador]?.label || item.statusTransicao.para}</span>
                              </div>
                            )}
                            {item.detalhes && (
                              <p className="text-xs text-muted-foreground mt-1">{item.detalhes}</p>
                            )}
                            {item.usuario && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                {item.usuario}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum registro no histórico
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="p-6 text-center text-muted-foreground">
            Rastreador não encontrado
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</div>
    </div>
  );
}

interface EditableInfoRowProps {
  label: string;
  value: string;
  campo: string;
  editandoCampo: string | null;
  valorEditado: string;
  onIniciarEdicao: (campo: string, valor: string) => void;
  onSalvar: () => void;
  onCancelar: () => void;
  onChange: (valor: string) => void;
  mono?: boolean;
}

function EditableInfoRow({ label, value, campo, editandoCampo, valorEditado, onIniciarEdicao, onSalvar, onCancelar, onChange, mono }: EditableInfoRowProps) {
  const isEditing = editandoCampo === campo;

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {!isEditing && (
          <button
            onClick={() => onIniciarEdicao(campo, value)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Editar"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>
      {isEditing ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={valorEditado}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSalvar();
              if (e.key === 'Escape') onCancelar();
            }}
          />
          <button onClick={onSalvar} className="text-green-600 hover:text-green-700 shrink-0">
            <Check className="h-4 w-4" />
          </button>
          <button onClick={onCancelar} className="text-red-600 hover:text-red-700 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</div>
      )}
    </div>
  );
}

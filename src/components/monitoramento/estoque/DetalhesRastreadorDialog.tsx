import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  // Tipos de manutenção
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

export function DetalhesRastreadorDialog({ open, onOpenChange, rastreadorId }: DetalhesRastreadorDialogProps) {
  const { data: plataformasLabels } = usePlataformasLabels();

  // Query para buscar dados completos do rastreador
  const { data: rastreador, isLoading } = useQuery({
    queryKey: ['rastreador-detalhes', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select(`
          id,
          codigo,
          imei,
          numero_serie,
          plataforma,
          id_plataforma,
          status,
          ultima_comunicacao,
          created_at,
          updated_at,
          portador_id,
          portador:profiles!rastreadores_portador_id_fkey(id, nome),
          veiculo:veiculos!rastreadores_veiculo_id_fkey(
            id,
            placa,
            modelo,
            marca,
            associado:associados(id, nome, cpf)
          )
        `)
        .eq('id', rastreadorId!)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open,
  });

  // Query para buscar histórico de movimentações de estoque
  const { data: historico, isLoading: isLoadingHistorico } = useQuery({
    queryKey: ['rastreador-historico', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select(`
          id,
          tipo,
          quantidade,
          status_anterior,
          status_novo,
          nota_fiscal,
          observacoes,
          created_at,
          usuario:profiles!estoque_movimentacoes_usuario_id_fkey(nome)
        `)
        .eq('rastreador_id', rastreadorId!)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open,
  });

  // Query para buscar serviço de manutenção ativo (se em manutenção de campo)
  const { data: servicoManutencao } = useQuery({
    queryKey: ['rastreador-servico-manutencao', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id,
          protocolo,
          status,
          data_agendada,
          periodo,
          motivo_manutencao,
          observacoes,
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

  // Query para buscar manutenção interna ativa (se em triagem/plataforma/garantia)
  const statusManutencaoInterna = ['retorno_base', 'triagem', 'em_analise_plataforma', 'em_garantia'];
  const { data: manutencaoInterna } = useQuery({
    queryKey: ['rastreador-manutencao-interna', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreador_manutencao_interna')
        .select(`
          id,
          etapa,
          diagnostico_inicial,
          defeito_identificado,
          encaminhado_para,
          numero_protocolo_externo,
          laudo_externo,
          created_at,
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

  // Query para buscar histórico de serviços de manutenção (campo)
  const { data: historicoServicosManutencao } = useQuery({
    queryKey: ['rastreador-historico-servicos', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id,
          protocolo,
          status,
          resultado_manutencao,
          concluida_em,
          observacoes_analise,
          profissional:profiles!servicos_profissional_id_fkey(nome)
        `)
        .eq('rastreador_id', rastreadorId!)
        .eq('tipo', 'vistoria_manutencao')
        .in('status', ['concluida', 'aprovada', 'cancelada'] as any)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open,
  });

  // Query para buscar histórico de manutenções internas (bancada)
  const { data: historicoManutencaoInterna } = useQuery({
    queryKey: ['rastreador-historico-manutencao-interna', rastreadorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreador_manutencao_interna')
        .select(`
          id,
          etapa,
          acao_tomada,
          laudo_externo,
          encaminhado_para,
          created_at,
          resolvido_em,
          resolvido_por_profile:profiles!rastreador_manutencao_interna_resolvido_por_fkey(nome)
        `)
        .eq('rastreador_id', rastreadorId!)
        .in('etapa', ['concluido_estoque', 'descartado'] as any)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!rastreadorId && open,
  });

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
                  <InfoRow label="Número de Série" value={rastreador.numero_serie || '-'} />
                  <InfoRow label="Plataforma" value={plataformasLabels?.[rastreador.plataforma] || rastreador.plataforma || '-'} />
                  <InfoRow label="ID na Plataforma" value={rastreador.id_plataforma || '-'} mono />
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

              {/* Histórico de Movimentações de Estoque */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Movimentações
                </h3>
                {isLoadingHistorico ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : historico && historico.length > 0 ? (
                  <div className="space-y-2">
                    {historico.map((mov) => (
                      <div key={mov.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {tipoMovimentacaoLabels[mov.tipo] || mov.tipo}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(mov.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {mov.status_anterior && mov.status_novo && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <span>{statusConfig[mov.status_anterior as StatusRastreador]?.label || mov.status_anterior}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span>{statusConfig[mov.status_novo as StatusRastreador]?.label || mov.status_novo}</span>
                          </div>
                        )}
                        {mov.nota_fiscal && (
                          <div className="text-xs text-muted-foreground mt-1">
                            NF: {mov.nota_fiscal}
                          </div>
                        )}
                        {mov.observacoes && (
                          <p className="text-xs text-muted-foreground mt-1">{mov.observacoes}</p>
                        )}
                        {mov.usuario && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {mov.usuario.nome}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma movimentação registrada
                  </p>
                )}
              </div>

              {/* Histórico de Manutenções de Campo */}
              {historicoServicosManutencao && historicoServicosManutencao.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Histórico de Manutenções (Campo)
                    </h3>
                    <div className="space-y-2">
                      {historicoServicosManutencao.map((s) => (
                        <div key={s.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{s.protocolo}</span>
                            <Badge 
                              variant="outline" 
                              className={s.resultado_manutencao ? RESULTADO_MANUTENCAO_COLORS[s.resultado_manutencao] || 'bg-muted' : 'bg-muted'}
                            >
                              {s.resultado_manutencao 
                                ? (RESULTADO_MANUTENCAO_LABELS[s.resultado_manutencao] || s.resultado_manutencao)
                                : s.status}
                            </Badge>
                          </div>
                          {s.observacoes_analise && (
                            <p className="text-xs text-muted-foreground mt-1 italic">"{s.observacoes_analise}"</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            {s.concluida_em && (
                              <span>{format(new Date(s.concluida_em), "dd/MM/yyyy", { locale: ptBR })}</span>
                            )}
                            {s.profissional?.nome && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {s.profissional.nome}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Histórico de Manutenções Internas (Bancada) */}
              {historicoManutencaoInterna && historicoManutencaoInterna.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Histórico de Manutenções (Bancada)
                    </h3>
                    <div className="space-y-2">
                      {historicoManutencaoInterna.map((m) => (
                        <div key={m.id} className="rounded-lg border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <Badge 
                              variant="outline" 
                              className={ETAPA_MANUTENCAO_COLORS[m.etapa] || 'bg-muted'}
                            >
                              {m.etapa === 'concluido_estoque' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                              {m.etapa === 'descartado' && <XCircle className="h-3 w-3 mr-1" />}
                              {ETAPA_MANUTENCAO_LABELS[m.etapa] || m.etapa}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {m.resolvido_em 
                                ? format(new Date(m.resolvido_em), "dd/MM/yyyy", { locale: ptBR })
                                : format(new Date(m.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          {m.acao_tomada && (
                            <p className="text-xs mt-1">{m.acao_tomada}</p>
                          )}
                          {m.encaminhado_para && (
                            <p className="text-xs text-muted-foreground">Encaminhado: {m.encaminhado_para}</p>
                          )}
                          {m.laudo_externo && (
                            <p className="text-xs text-muted-foreground italic">Laudo: {m.laudo_externo}</p>
                          )}
                          {m.resolvido_por_profile?.nome && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {m.resolvido_por_profile.nome}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
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

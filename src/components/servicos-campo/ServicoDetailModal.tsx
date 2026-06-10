import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDataLocal } from '@/lib/date-utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  User, Car, MapPin, Calendar, Clock, FileText,
  MessageSquare, Navigation, ExternalLink, Cpu, AlertTriangle,
  DollarSign, Info, Camera, Receipt, History, IdCard, Loader2,
  MapPinned, MoreHorizontal, Hash, Wrench, PackageMinus, ArrowRightLeft,

} from 'lucide-react';

import { RealocarInstalacaoDialog } from '@/components/instalacoes/RealocarInstalacaoDialog';
import { RealocarServicoSimplesDialog } from './RealocarServicoSimplesDialog';
import { CancelarServicoDialog } from './CancelarServicoDialog';
import { DevolverAoCadastroDialog } from './DevolverAoCadastroDialog';
import { MarcarManutencaoDialog } from '@/components/monitoramento/MarcarManutencaoDialog';
import { MarcarRetiradaDialog } from '@/components/monitoramento/MarcarRetiradaDialog';
import { AlterarTipoServicoDialog } from './AlterarTipoServicoDialog';

import { LiberarServicoButton } from './LiberarServicoButton';
import { usePermissions } from '@/hooks/usePermissions';

import { ConcluirPrestadorExternoButton } from './ConcluirPrestadorExternoButton';
import { RealizarVistoriaInternaButton } from './RealizarVistoriaInternaButton';
import { BadgeVistoriaLimbo } from './BadgeVistoriaLimbo';

import { cn } from '@/lib/utils';
import {
  TIPO_SERVICO_LABELS, STATUS_SERVICO_LABELS, STATUS_SERVICO_COLORS,
  PERIODO_LABELS,
  type Servico,
} from '@/hooks/useServicos';
import { MOTIVO_RETIRADA_LABELS, INTEGRIDADE_APARELHO_LABELS, INTEGRIDADE_APARELHO_COLORS } from '@/types/retirada';
import { ServicoTipoBadge } from './ServicoTipoBadge';
import { useDocumentosPorAssociado } from '@/hooks/useDocumentos';
import {
  useDocumentosCotacao,
  useResumoFinanceiroAssociado,
  useCobrancasAssociado,
} from '@/hooks/useDocumentosCotacao';
import {
  useFotosVistoriaUnificada,
  agruparFotosPorCategoria,
  formatarTipoFoto,
} from '@/hooks/useFotosAutovistoria';
import { useAssociadoHistoricoCompleto } from '@/hooks/useAssociadoHistoricoCompleto';
import { AssociadoFichaCompletaDialog } from './AssociadoFichaCompletaDialog';
import { TIPO_DOCUMENTO_LABELS, STATUS_DOCUMENTO_LABELS, STATUS_DOCUMENTO_COLORS } from '@/types/cadastro';
import { EnderecoServicoEditavel } from './EnderecoServicoEditavel';

interface ServicoDetailModalProps {
  servico: Servico | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServicoDetailModal({ servico, open, onOpenChange }: ServicoDetailModalProps) {
  const [fichaOpen, setFichaOpen] = useState(false);
  const [realocarOpen, setRealocarOpen] = useState(false);
  const [realocarSimplesOpen, setRealocarSimplesOpen] = useState(false);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [devolverOpen, setDevolverOpen] = useState(false);
  const [manutencaoOpen, setManutencaoOpen] = useState(false);
  const [retiradaOpen, setRetiradaOpen] = useState(false);
  const [alterarTipoOpen, setAlterarTipoOpen] = useState(false);

  const { isDiretor, isCoordenadorMonitoramento, isAnalistaMonitoramento } = usePermissions();
  const podeAcoesMonitor = !!(isDiretor || isCoordenadorMonitoramento || isAnalistaMonitoramento);

  if (!servico) return null;

  const isRetirada = servico.tipo === 'vistoria_retirada';
  // 'vistoria_entrada' é a primeira visita (equivale a instalação) — ver mem://logic/operations/vistoria-entrada-equivale-instalacao
  const isInstalacao = servico.tipo === 'instalacao' || servico.tipo === 'vistoria_entrada' || servico.tipo === 'revistoria';
  const instalacaoOrigemId = (servico as any).instalacao_origem_id as string | null | undefined;
  const motivoRetirada = (servico as any).motivo_retirada;
  const multaAplicada = (servico as any).multa_aplicada;
  const integridade = (servico as any).integridade_aparelho;
  const enderecoCompleto = [
    servico.logradouro,
    servico.numero,
    servico.complemento,
    servico.bairro,
    servico.cidade,
    servico.uf,
    servico.cep,
  ].filter(Boolean).join(', ');

  const wppNumero = (servico.associado?.whatsapp || servico.associado?.telefone || '').replace(/\D/g, '');
  const mapsUrl = enderecoCompleto
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`
    : null;

  const associadoId = servico.associado_id || undefined;
  const cotacaoId = servico.cotacao_id || undefined;
  const contratoId = servico.contrato_id || undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[92vh] p-0 flex flex-col gap-0 overflow-hidden">
          {/* ============= HEADER REDESIGN ============= */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b bg-gradient-to-b from-muted/40 to-background space-y-4">
            {/* Linha 1: identidade do serviço */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
                  <span className="font-mono uppercase">{servico.veiculo?.placa || '—'}</span>
                  {servico.veiculo?.marca && (
                    <span className="text-sm font-normal text-muted-foreground">
                      · {servico.veiculo?.marca} {servico.veiculo?.modelo}
                    </span>
                  )}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 truncate">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{servico.associado?.nome || 'Sem cliente vinculado'}</span>
                </p>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <ServicoTipoBadge servico={servico} />
                  <Badge className={cn('text-xs border-transparent', STATUS_SERVICO_COLORS[servico.status])}>
                    {STATUS_SERVICO_LABELS[servico.status]}
                  </Badge>
                </div>
                {servico.protocolo && (
                  <span className="text-[11px] font-mono text-muted-foreground inline-flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {servico.protocolo}
                  </span>
                )}
              </div>
            </div>

            {/* Linha 2: meta-info compacta */}
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs text-muted-foreground">
              {servico.data_agendada && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {(() => {
                    const d = parseDataLocal(servico.data_agendada);
                    return d ? format(d, "dd 'de' MMM 'de' yyyy", { locale: ptBR }) : '—';
                  })()}
                </span>
              )}
              {servico.periodo && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {PERIODO_LABELS[servico.periodo]}
                  {servico.hora_agendada && ` · ${servico.hora_agendada.slice(0, 5)}`}
                </span>
              )}
              {(servico.bairro || servico.cidade) && (
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{[servico.bairro, servico.cidade].filter(Boolean).join(' · ')}</span>
                </span>
              )}
              {servico.profissional?.nome && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {servico.profissional.nome}
                </span>
              )}
            </div>

            {/* Linha 3: ações — primárias inline, secundárias no menu */}
            <div className="flex items-center gap-2 flex-wrap">
              {associadoId && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5 h-9"
                  onClick={() => setFichaOpen(true)}
                >
                  <IdCard className="h-4 w-4" /> Ficha do associado
                </Button>
              )}
              {wppNumero && (
                <Button asChild variant="outline" size="sm" className="gap-1.5 h-9">
                  <a href={`https://wa.me/55${wppNumero}`} target="_blank" rel="noreferrer">
                    <MessageSquare className="h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              )}
              {mapsUrl && (
                <Button asChild variant="outline" size="sm" className="gap-1.5 h-9">
                  <a href={mapsUrl} target="_blank" rel="noreferrer">
                    <Navigation className="h-4 w-4" /> Rota no Maps
                  </a>
                </Button>
              )}

              {(() => {
                const statusRealocavel = ['agendada', 'pendente', 'nao_compareceu', 'reagendada', 'cancelada', 'em_analise', 'imprevisto_pendente'].includes(servico.status);
                const statusCancelavel = ['agendada', 'pendente', 'reagendada', 'nao_compareceu', 'em_analise', 'imprevisto_pendente'].includes(servico.status);
                const statusDevolvivel = !['concluida', 'aprovada', 'reprovada', 'aprovada_ressalvas', 'cancelada'].includes(servico.status);
                const podeRealocarInstalacao = isInstalacao && !!instalacaoOrigemId;
                return (
                  <>
                    {statusRealocavel && (podeRealocarInstalacao || !isInstalacao) && (
                      <Button
                        variant={servico.status === 'cancelada' ? 'default' : 'outline'}
                        size="sm"
                        className="gap-1.5 h-9"
                        onClick={() => podeRealocarInstalacao ? setRealocarOpen(true) : setRealocarSimplesOpen(true)}
                        title={servico.status === 'cancelada'
                          ? 'Reabrir este serviço cancelado e reagendar'
                          : 'Realocar este serviço para outra data, técnico, rota ou base'}
                      >
                        <MapPinned className="h-4 w-4" />
                        {servico.status === 'cancelada' ? 'Reabrir e reagendar' : 'Realocar'}
                      </Button>
                    )}

                    {podeAcoesMonitor && statusCancelavel && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-9 text-destructive hover:text-destructive"
                        onClick={() => setCancelarOpen(true)}
                        title="Cancelar este serviço"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Cancelar
                      </Button>
                    )}

                    {podeAcoesMonitor && contratoId && statusDevolvivel && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-9"
                        onClick={() => setDevolverOpen(true)}
                        title="Reverter aprovação do Cadastro e reabrir a cotação para revisão"
                      >
                        <History className="h-4 w-4" />
                        Devolver ao Cadastro
                      </Button>
                    )}

                    {podeAcoesMonitor && isInstalacao && statusDevolvivel && servico.veiculo_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-9 border-indigo-500/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/10"
                        onClick={() => setManutencaoOpen(true)}
                        title="Opcional: converter este serviço em Vistoria de Manutenção (rastreador já está no veículo)"
                      >
                        <Wrench className="h-4 w-4" />
                        Tratar como Manutenção
                      </Button>
                    )}

                    {podeAcoesMonitor && isInstalacao && statusDevolvivel && servico.veiculo_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-9 border-amber-500/60 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                        onClick={() => setRetiradaOpen(true)}
                        title="Opcional: converter este serviço em Retirada do Rastreador + vistoria acompanhante"
                      >
                        <PackageMinus className="h-4 w-4" />
                        Tratar como Retirada
                      </Button>
                    )}

                    {podeAcoesMonitor && ['pendente','agendada','reagendada','em_rota','em_andamento','em_analise','imprevisto_pendente'].includes(servico.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 h-9"
                        onClick={() => setAlterarTipoOpen(true)}
                        title="Corrigir o tipo do serviço quando foi marcado errado (antes da execução)"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        Alterar tipo do serviço
                      </Button>
                    )}

                  </>
                );
              })()}

              <RealizarVistoriaInternaButton
                servico={servico}
                onBeforeOpen={() => onOpenChange(false)}
              />

              {isInstalacao && (
                <BadgeVistoriaLimbo
                  servicoId={servico.id}
                  tipo={servico.tipo}
                  status={servico.status}
                />
              )}


            </div>

          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <Tabs defaultValue="resumo" className="w-full">
              <div className="pt-3 pb-0 sticky top-0 bg-background/95 backdrop-blur z-20 border-b">
                <div className="relative">
                  <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-background to-transparent" />
                  <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-background to-transparent" />
                  <TabsList className="h-10 w-full justify-start gap-1 bg-transparent p-0 px-6 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <TabsTrigger value="resumo" className="shrink-0">Resumo</TabsTrigger>
                    <TabsTrigger value="cliente" className="shrink-0 gap-1.5"><User className="h-3.5 w-3.5" /> Cliente & Veículo</TabsTrigger>
                    <TabsTrigger value="endereco" className="shrink-0 gap-1.5"><MapPin className="h-3.5 w-3.5" /> Endereço</TabsTrigger>
                    {isRetirada && <TabsTrigger value="retirada" className="shrink-0">Retirada</TabsTrigger>}
                    {isInstalacao && <TabsTrigger value="rastreador" className="shrink-0 gap-1.5"><Cpu className="h-3.5 w-3.5" /> Rastreador</TabsTrigger>}
                    <TabsTrigger value="documentos" className="shrink-0 gap-1.5"><FileText className="h-3.5 w-3.5" /> Documentos</TabsTrigger>
                    <TabsTrigger value="fotos" className="shrink-0 gap-1.5"><Camera className="h-3.5 w-3.5" /> Fotos</TabsTrigger>
                    <TabsTrigger value="financeiro" className="shrink-0 gap-1.5"><Receipt className="h-3.5 w-3.5" /> Financeiro</TabsTrigger>
                    <TabsTrigger value="historico-associado" className="shrink-0 gap-1.5"><History className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
                    <TabsTrigger value="historico" className="shrink-0 gap-1.5"><Clock className="h-3.5 w-3.5" /> Timeline</TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* RESUMO */}
              <TabsContent value="resumo" className="p-6 space-y-4">
                <Section title="Agendamento" icon={Calendar}>
                  <Field label="Data" value={(() => { const d = parseDataLocal(servico.data_agendada); return d ? format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '—'; })()} />
                  <Field label="Período" value={servico.periodo ? PERIODO_LABELS[servico.periodo] : '—'} />
                  <Field label="Hora" value={servico.hora_agendada?.slice(0, 5) || '—'} />
                  <Field label="Permite encaixe" value={servico.permite_encaixe ? 'Sim' : 'Não'} />
                </Section>

                {(() => {
                  const rast = (servico as any).rastreadores;
                  if (!isInstalacao || !rast) return null;
                  if (!rast.local_instalacao && !rast.descricao_instalacao && !rast.foto_local_instalacao_url) return null;
                  return (
                    <Section title="Local da instalação" icon={MapPin}>
                      <Field label="Local" value={rast.local_instalacao || '—'} />
                      {rast.descricao_instalacao && (
                        <Field label="Descrição" value={rast.descricao_instalacao} />
                      )}
                      {rast.foto_local_instalacao_url && (
                        <div className="space-y-1.5">
                          <Label>Foto do local</Label>
                          <a
                            href={rast.foto_local_instalacao_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-32 h-32 rounded-md overflow-hidden border border-border hover:opacity-80 transition"
                          >
                            <img
                              src={rast.foto_local_instalacao_url}
                              alt="Local da instalação do rastreador"
                              className="w-full h-full object-cover"
                            />
                          </a>
                        </div>
                      )}
                    </Section>
                  );
                })()}

                {servico.observacoes && (
                  <Section title="Observações" icon={Info}>
                    <p className="text-sm whitespace-pre-wrap">{servico.observacoes}</p>
                  </Section>
                )}

                {servico.profissional && (
                  <Section title="Técnico atribuído" icon={User}>
                    <Field label="Nome" value={servico.profissional.nome} />
                    {servico.profissional.telefone && (
                      <Field label="Telefone" value={servico.profissional.telefone} />
                    )}
                  </Section>
                )}
              </TabsContent>

              {/* CLIENTE & VEÍCULO */}
              <TabsContent value="cliente" className="p-6 space-y-4">
                <Section title="Cliente" icon={User}>
                  <Field label="Nome" value={servico.associado?.nome || '—'} />
                  <Field label="CPF" value={servico.associado?.cpf || '—'} />
                  <Field label="Telefone" value={servico.associado?.telefone || '—'} />
                  <Field label="WhatsApp" value={servico.associado?.whatsapp || '—'} />
                  <Field label="E-mail" value={servico.associado?.email || '—'} />
                </Section>

                <Section title="Veículo" icon={Car}>
                  <Field label="Placa" value={servico.veiculo?.placa || '—'} mono />
                  <Field label="Marca / Modelo" value={`${servico.veiculo?.marca || ''} ${servico.veiculo?.modelo || ''}`.trim() || '—'} />
                  <Field label="Ano" value={`${servico.veiculo?.ano_fabricacao || '—'} / ${servico.veiculo?.ano_modelo || '—'}`} />
                  <Field label="Cor" value={servico.veiculo?.cor || '—'} />
                </Section>
              </TabsContent>

              {/* ENDEREÇO */}
              <TabsContent value="endereco" className="p-6 space-y-4">
                <EnderecoServicoEditavel
                  servicoId={servico.id}
                  canEdit={podeAcoesMonitor}
                  mapsUrl={mapsUrl}
                  localVistoria={servico.local_vistoria}
                  values={{
                    cep: servico.cep,
                    logradouro: servico.logradouro,
                    numero: servico.numero,
                    complemento: servico.complemento,
                    bairro: servico.bairro,
                    cidade: servico.cidade,
                    uf: servico.uf,
                  }}
                />
              </TabsContent>

              {/* RETIRADA */}
              {isRetirada && (
                <TabsContent value="retirada" className="p-6 space-y-4">
                  <Section title="Detalhes da retirada" icon={AlertTriangle}>
                    {motivoRetirada && (
                      <Field label="Motivo" value={MOTIVO_RETIRADA_LABELS[motivoRetirada as keyof typeof MOTIVO_RETIRADA_LABELS] || motivoRetirada} />
                    )}
                    <Field label="Solicitado por" value={(servico as any).solicitado_por_modulo || '—'} />
                    {integridade && (
                      <div>
                        <Label>Integridade do aparelho</Label>
                        <Badge className={cn('text-xs', INTEGRIDADE_APARELHO_COLORS[integridade as keyof typeof INTEGRIDADE_APARELHO_COLORS])}>
                          {INTEGRIDADE_APARELHO_LABELS[integridade as keyof typeof INTEGRIDADE_APARELHO_LABELS]}
                        </Badge>
                      </div>
                    )}
                    {multaAplicada && (
                      <div>
                        <Label>Multa</Label>
                        <Badge variant="destructive" className="gap-1">
                          <DollarSign className="h-3 w-3" />
                          {(servico as any).multa_valor
                            ? `R$ ${Number((servico as any).multa_valor).toFixed(2)}`
                            : 'Aplicada'}
                        </Badge>
                        {(servico as any).multa_motivo && (
                          <p className="text-xs text-muted-foreground mt-1">{(servico as any).multa_motivo}</p>
                        )}
                      </div>
                    )}
                  </Section>
                </TabsContent>
              )}

              {/* RASTREADOR */}
              {isInstalacao && (
                <TabsContent value="rastreador" className="p-6 space-y-4">
                  <Section title="Rastreador" icon={Cpu}>
                    <Field label="ID" value={servico.rastreador_id || '—'} mono />
                    <Field label="IMEI" value={servico.imei_rastreador || '—'} mono />
                    <Field label="Quilometragem" value={servico.quilometragem ? `${servico.quilometragem} km` : '—'} />
                  </Section>

                  {(() => {
                    const rast = (servico as any).rastreadores;
                    if (!rast) return null;
                    if (!rast.local_instalacao && !rast.descricao_instalacao && !rast.foto_local_instalacao_url) return null;
                    return (
                      <Section title="Local da instalação" icon={MapPin}>
                        <Field label="Local" value={rast.local_instalacao || '—'} />
                        {rast.descricao_instalacao && (
                          <Field label="Descrição" value={rast.descricao_instalacao} />
                        )}
                        {rast.foto_local_instalacao_url && (
                          <div className="space-y-1.5">
                            <Label>Foto do local</Label>
                            <a
                              href={rast.foto_local_instalacao_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-32 h-32 rounded-md overflow-hidden border border-border hover:opacity-80 transition"
                            >
                              <img
                                src={rast.foto_local_instalacao_url}
                                alt="Local da instalação do rastreador"
                                className="w-full h-full object-cover"
                              />
                            </a>
                          </div>
                        )}
                      </Section>
                    );
                  })()}
                </TabsContent>
              )}

              {/* DOCUMENTOS */}
              <TabsContent value="documentos" className="p-6 space-y-4">
                <DocumentosTab associadoId={associadoId} cotacaoId={cotacaoId} />
              </TabsContent>

              {/* FOTOS */}
              <TabsContent value="fotos" className="p-6 space-y-4">
                <FotosTab contratoId={contratoId} cotacaoId={cotacaoId} />
              </TabsContent>

              {/* FINANCEIRO */}
              <TabsContent value="financeiro" className="p-6 space-y-4">
                <FinanceiroTab associadoId={associadoId} />
              </TabsContent>

              {/* HISTÓRICO DO ASSOCIADO */}
              <TabsContent value="historico-associado" className="p-6 space-y-4">
                <HistoricoAssociadoTab associadoId={associadoId} />
              </TabsContent>

              {/* TIMELINE DO SERVIÇO */}
              <TabsContent value="historico" className="p-6 space-y-4">
                <Section title="Linha do tempo" icon={Clock}>
                  <Timeline label="Criado" date={servico.created_at} />
                  <Timeline label="Em rota" date={servico.em_rota_em} />
                  <Timeline label="Iniciado" date={servico.iniciada_em} />
                  <Timeline label="Concluído" date={servico.concluida_em} />
                  {servico.analisado_em && (
                    <Timeline label="Analisado" date={servico.analisado_em} />
                  )}
                </Section>

                {servico.observacoes_analise && (
                  <Section title="Observações da análise" icon={FileText}>
                    <p className="text-sm whitespace-pre-wrap">{servico.observacoes_analise}</p>
                  </Section>
                )}

                {servico.motivo_reprovacao && (
                  <Section title="Motivo da reprovação" icon={AlertTriangle}>
                    <p className="text-sm whitespace-pre-wrap text-destructive">{servico.motivo_reprovacao}</p>
                  </Section>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <AssociadoFichaCompletaDialog
        associadoId={associadoId}
        open={fichaOpen}
        onOpenChange={setFichaOpen}
      />

      {isInstalacao && instalacaoOrigemId && (
        <RealocarInstalacaoDialog
          open={realocarOpen}
          onOpenChange={setRealocarOpen}
          instalacaoId={servico.id}
          veiculoLabel={servico.veiculo?.placa || undefined}
          associadoNome={servico.associado?.nome || undefined}
        />
      )}

      {!isInstalacao && (
        <RealocarServicoSimplesDialog
          open={realocarSimplesOpen}
          onOpenChange={setRealocarSimplesOpen}
          servicoId={servico.id}
          servicoTipo={servico.tipo}
          servicoLabel={`${TIPO_SERVICO_LABELS[servico.tipo] || servico.tipo}${servico.veiculo?.placa ? ` · ${servico.veiculo.placa}` : ''}`}
        />
      )}

      <CancelarServicoDialog
        open={cancelarOpen}
        onOpenChange={setCancelarOpen}
        servicoId={servico.id}
        servicoLabel={servico.veiculo?.placa || undefined}
      />

      {contratoId && (
        <DevolverAoCadastroDialog
          open={devolverOpen}
          onOpenChange={setDevolverOpen}
          contratoId={contratoId}
          servicoLabel={servico.veiculo?.placa || undefined}
        />
      )}

      {isInstalacao && servico.veiculo_id && (
        <MarcarManutencaoDialog
          open={manutencaoOpen}
          onOpenChange={setManutencaoOpen}
          servicoId={servico.id}
          veiculoId={servico.veiculo_id}
          veiculoPlaca={servico.veiculo?.placa || undefined}
          onSuccess={() => onOpenChange(false)}
        />
      )}

      {isInstalacao && servico.veiculo_id && (
        <MarcarRetiradaDialog
          open={retiradaOpen}
          onOpenChange={setRetiradaOpen}
          servicoId={servico.id}
          veiculoId={servico.veiculo_id}
          veiculoPlaca={servico.veiculo?.placa || undefined}
          onSuccess={() => onOpenChange(false)}
        />
      )}



    </>
  );
}

// ============= SUB-TABS =============

function DocumentosTab({ associadoId, cotacaoId }: { associadoId?: string; cotacaoId?: string }) {
  const { data: docsAssoc, isLoading: l1 } = useDocumentosPorAssociado(associadoId);
  const { data: docsCot, isLoading: l2 } = useDocumentosCotacao(cotacaoId);

  if (l1 || l2) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const todos = [
    ...(docsAssoc || []).map((d: any) => ({
      id: d.id,
      tipo: d.tipo,
      nome: d.nome_arquivo || d.tipo,
      url: d.arquivo_url,
      status: d.status,
      origem: 'Associado',
    })),
    ...(docsCot || []).map((d) => ({
      id: d.id,
      tipo: d.tipo,
      nome: d.arquivo_nome || d.tipo,
      url: d.arquivo_url,
      status: d.status,
      origem: 'Cotação',
    })),
  ];

  if (todos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum documento encontrado para este associado.
      </p>
    );
  }

  return (
    <Section title="Documentos" icon={FileText}>
      <div className="col-span-full space-y-2">
        {todos.map((d) => {
          const tipoLabel = (TIPO_DOCUMENTO_LABELS as any)[d.tipo] || d.tipo;
          const statusLabel = (STATUS_DOCUMENTO_LABELS as any)[d.status] || d.status;
          const statusColor = (STATUS_DOCUMENTO_COLORS as any)[d.status] || 'bg-muted text-muted-foreground';
          return (
            <a
              key={d.id}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 p-3 rounded-md border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tipoLabel}</p>
                  <p className="text-xs text-muted-foreground truncate">{d.nome} · {d.origem}</p>
                </div>
              </div>
              <Badge className={cn('text-xs shrink-0', statusColor)}>{statusLabel}</Badge>
            </a>
          );
        })}
      </div>
    </Section>
  );
}

function FotosTab({ contratoId, cotacaoId }: { contratoId?: string; cotacaoId?: string }) {
  const { data, isLoading } = useFotosVistoriaUnificada({ contratoId, cotacaoId });

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const todasFotos = [...(data?.fotosInstalador || []), ...(data?.fotosAutovistoria || [])];
  if (todasFotos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhuma foto de vistoria/instalação encontrada.
      </p>
    );
  }

  const agrupadas = agruparFotosPorCategoria(todasFotos);
  const grupos: Array<[string, typeof todasFotos]> = [
    ['Identificação', agrupadas.identificacao],
    ['Exterior', agrupadas.exterior],
    ['Interior', agrupadas.interior],
    ['Outros', agrupadas.outros],
  ];

  return (
    <div className="space-y-6">
      {grupos.map(([nome, fotos]) =>
        fotos.length > 0 ? (
          <div key={nome} className="space-y-2">
            <p className="text-sm font-semibold">{nome}</p>
            <Separator />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {fotos.map((f) => (
                <a key={f.id} href={f.arquivo_url} target="_blank" rel="noreferrer" className="block group">
                  <div className="aspect-square rounded-md overflow-hidden bg-muted">
                    <img src={f.arquivo_url} alt={f.tipo} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">{formatarTipoFoto(f.tipo)}</p>
                </a>
              ))}
            </div>
          </div>
        ) : null
      )}
      {data?.video360Url && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Vídeo 360°</p>
          <Separator />
          <video src={data.video360Url} controls className="w-full max-h-[400px] rounded-md" />
        </div>
      )}
    </div>
  );
}

function FinanceiroTab({ associadoId }: { associadoId?: string }) {
  const { data: resumo, isLoading: l1 } = useResumoFinanceiroAssociado(associadoId);
  const { data: cobr, isLoading: l2 } = useCobrancasAssociado(associadoId);

  if (l1 || l2) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!associadoId) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem associado vinculado.</p>;
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-4">
      <Section title="Resumo financeiro" icon={DollarSign}>
        <Field label="Meses pagos" value={String(resumo?.mesesPagos ?? 0)} />
        <Field label="Em atraso" value={String(resumo?.emAtraso ?? 0)} />
        <Field label="Total pago" value={fmt(cobr?.totais.pago ?? 0)} />
        <Field label="Em aberto" value={fmt(cobr?.totais.emAberto ?? 0)} />
        {resumo?.proximaCobranca && (
          <>
            <Field
              label="Próximo vencimento"
              value={format(new Date(resumo.proximaCobranca.data_vencimento), 'dd/MM/yyyy')}
            />
            <Field label="Valor próx." value={fmt(resumo.proximaCobranca.valor || 0)} />
          </>
        )}
      </Section>

      <Section title="Últimas cobranças" icon={Receipt}>
        <div className="col-span-full space-y-2">
          {(cobr?.faturas || []).slice(0, 5).map((f: any) => (
            <div key={f.id} className="flex items-center justify-between p-2.5 rounded-md border text-sm">
              <div>
                <p className="font-medium">{fmt(f.valor || 0)}</p>
                <p className="text-xs text-muted-foreground">
                  Venc.: {format(new Date(f.data_vencimento), 'dd/MM/yyyy')}
                </p>
              </div>
              <Badge variant="outline" className="text-xs">{f.status}</Badge>
            </div>
          ))}
          {(cobr?.faturas || []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sem cobranças.</p>
          )}
        </div>
      </Section>
    </div>
  );
}

function HistoricoAssociadoTab({ associadoId }: { associadoId?: string }) {
  const { data, isLoading } = useAssociadoHistoricoCompleto(associadoId);
  const eventos = (data as any[]) || [];

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!associadoId) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem associado vinculado.</p>;
  }

  if (eventos.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Sem histórico registrado.</p>;
  }

  return (
    <div className="space-y-2">
      {eventos.map((ev: any) => (
        <div key={ev.id} className="flex gap-3 p-3 rounded-md border">
          <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm">{ev.descricao}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ev.data ? format(new Date(ev.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
              {ev.usuario?.nome && <span> · {ev.usuario.nome}</span>}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============= HELPERS =============

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </div>
      <Separator />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className={cn('text-sm', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function Timeline({ label, date }: { label: string; date: string | null }) {
  if (!date) {
    return (
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">—</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between text-sm">
      <span>{label}</span>
      <span className="text-muted-foreground">
        {format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
      </span>
    </div>
  );
}

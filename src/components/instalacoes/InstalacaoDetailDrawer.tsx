import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar, 
  Clock, 
  MapPin, 
  Car, 
  User, 
  Phone, 
  Navigation,
  Loader2,
  Edit,
  PlayCircle,
  CheckCircle,
  XCircle,
  RotateCcw,
  Cpu,
  UserX,
  Shield,
  ExternalLink,
  Send,
  Copy,
  Image,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useInstalacao, useUpdateInstalacaoStatus, type Instalacao } from '@/hooks/useInstalacoes';
import { STATUS_INSTALACAO_LABELS, STATUS_INSTALACAO_COLORS, PERIODO_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';
import { useFotosVistoriaUnificada, agruparFotosPorCategoria, formatarTipoFoto, type FotoAutovistoria } from '@/hooks/useFotosAutovistoria';
import { VisualizadorFoto } from '@/components/analise/VisualizadorFoto';
import { Camera, Video, IdCard, FileText } from 'lucide-react';

interface InstalacaoDetailDrawerProps {
  instalacaoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

export function InstalacaoDetailDrawer({ 
  instalacaoId, 
  open, 
  onOpenChange,
  onEdit 
}: InstalacaoDetailDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fotoDialogUrl, setFotoDialogUrl] = useState<string | null>(null);
  const [visualizadorAberto, setVisualizadorAberto] = useState(false);
  const [fotoIndex, setFotoIndex] = useState(0);
  const [fotosAtivas, setFotosAtivas] = useState<Array<{ url: string; label: string; tipo?: string }>>([]);
  const { data: instalacao, isLoading } = useInstalacao(instalacaoId || undefined);
  const updateStatus = useUpdateInstalacaoStatus();

  // Buscar link do prestador (se houver)
  const { data: prestadorLink } = useQuery({
    queryKey: ['prestador-link-instalacao', instalacaoId],
    queryFn: async () => {
      if (!instalacaoId) return null;
      const { data } = await (supabase as any)
        .from('instalacao_prestador_links')
        .select('*, prestador:prestador_id(razao_social, nome_fantasia, whatsapp, telefone)')
        .eq('instalacao_id', instalacaoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!instalacaoId && open,
  });

  // Enviar/reenviar link do prestador
  const enviarLinkPrestador = useMutation({
    mutationFn: async () => {
      if (!instalacao) throw new Error('Sem instalação');
      // Buscar prestador_id do serviço vinculado
      const { data: servico } = await (supabase as any)
        .from('servicos')
        .select('prestador_id')
        .eq('associado_id', instalacao.associado_id)
        .eq('tipo', 'instalacao')
        .not('prestador_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prestadorId = servico?.prestador_id;
      if (!prestadorId) throw new Error('Nenhum prestador vinculado a esta instalação');

      const { data, error } = await supabase.functions.invoke('gerar-link-prestador', {
        body: { instalacao_id: instalacaoId, prestador_id: prestadorId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['prestador-link-instalacao', instalacaoId] });
      toast({
        title: 'Link enviado!',
        description: data.whatsapp_enviado
          ? `WhatsApp enviado para ${data.prestador_nome}`
          : `Link gerado para ${data.prestador_nome}`,
      });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  // Buscar registro de presença GPS
  const { data: registroPresenca } = useQuery({
    queryKey: ['registro-presenca-instalacao', instalacaoId],
    queryFn: async () => {
      if (!instalacaoId) return null;
      const inst = await supabase.from('instalacoes').select('associado_id, veiculo_id').eq('id', instalacaoId).single();
      if (!inst.data) return null;
      
      const { data: servicos } = await supabase
        .from('servicos')
        .select('id')
        .eq('associado_id', inst.data.associado_id)
        .eq('tipo', 'instalacao')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!servicos?.length) return null;
      
      const { data } = await (supabase as any)
        .from('registros_presenca')
        .select('*')
        .eq('servico_id', servicos[0].id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      return data;
    },
    enabled: !!instalacaoId && open,
  });

  // Buscar histórico de recusas do serviço
  const { data: historicoRecusas } = useQuery({
    queryKey: ['historico-recusas-instalacao', instalacaoId],
    queryFn: async () => {
      if (!instalacaoId) return [];
      // Buscar serviço associado
      const inst = await supabase.from('instalacoes').select('associado_id').eq('id', instalacaoId).single();
      if (!inst.data) return [];
      
      const { data: servicos } = await supabase
        .from('servicos')
        .select('id')
        .eq('associado_id', inst.data.associado_id)
        .eq('tipo', 'instalacao')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!servicos?.length) return [];

      const { data } = await (supabase as any)
        .from('registros_recusa_tarefa')
        .select('*, profissional:profiles(nome)')
        .eq('servico_id', servicos[0].id)
        .order('created_at', { ascending: false });

      return data || [];
    },
    enabled: !!instalacaoId && open,
  });

  // Dados completos do associado
  const { data: associadoFull } = useQuery({
    queryKey: ['associado-full-drawer', instalacao?.associado_id],
    enabled: !!instalacao?.associado_id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from('associados')
        .select('nome, cpf, rg, data_nascimento, estado_civil, profissao, telefone, telefone_secundario, email, logradouro, numero, complemento, bairro, cidade, uf, cep, status, created_at, cnh_numero, cnh_categoria, cnh_validade, plano_id')
        .eq('id', instalacao!.associado_id)
        .maybeSingle();
      return data;
    },
  });

  // Plano vigente + cotacao_id a partir do contrato
  const { data: contratoInfo } = useQuery({
    queryKey: ['contrato-plano-drawer', instalacao?.contrato_id, associadoFull?.plano_id],
    enabled: open && (!!instalacao?.contrato_id || !!associadoFull?.plano_id),
    queryFn: async () => {
      let planoId: string | null = associadoFull?.plano_id || null;
      let cotacaoId: string | null = null;
      let dataAdesao: string | null = null;
      let mensalidade: number | null = null;

      if (instalacao?.contrato_id) {
        const { data: contrato } = await (supabase as any)
          .from('contratos')
          .select('cotacao_id, created_at, valor_mensalidade, plano_id')
          .eq('id', instalacao.contrato_id)
          .maybeSingle();
        if (contrato) {
          cotacaoId = contrato.cotacao_id || null;
          dataAdesao = contrato.created_at;
          mensalidade = contrato.valor_mensalidade ?? null;
          planoId = contrato.plano_id || planoId;
        }
      }

      let planoNome: string | null = null;
      if (planoId) {
        const { data: plano } = await supabase
          .from('planos')
          .select('nome')
          .eq('id', planoId)
          .maybeSingle();
        planoNome = plano?.nome || null;
      }

      return { planoNome, mensalidade, dataAdesao, cotacaoId };
    },
  });

  // Fotos (autovistoria + instalador)
  const { data: fotosData } = useFotosVistoriaUnificada({
    contratoId: instalacao?.contrato_id || undefined,
    cotacaoId: contratoInfo?.cotacaoId || undefined,
  });

  const abrirGaleria = (fotos: FotoAutovistoria[], index: number) => {
    setFotosAtivas(fotos.map(f => ({ url: f.arquivo_url, label: formatarTipoFoto(f.tipo), tipo: f.tipo })));
    setFotoIndex(index);
    setVisualizadorAberto(true);
  };

  const abrirVideo360 = (url: string) => {
    setFotosAtivas([{ url, label: 'Vídeo 360°', tipo: 'video_360' }]);
    setFotoIndex(0);
    setVisualizadorAberto(true);
  };

  const handleStatusChange = async (status: Instalacao['status']) => {
    if (!instalacaoId) return;
    
    try {
      await updateStatus.mutateAsync({ id: instalacaoId, status });
      toast({ 
        title: 'Status atualizado!',
        description: `Instalação marcada como ${STATUS_INSTALACAO_LABELS[status]}`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao atualizar status',
        variant: 'destructive',
      });
    }
  };

  const openGoogleMaps = () => {
    if (!instalacao) return;
    const address = [
      instalacao.logradouro,
      instalacao.numero,
      instalacao.bairro,
      instalacao.cidade,
      instalacao.uf,
    ].filter(Boolean).join(', ');
    
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  const openWhatsApp = () => {
    if (!instalacao?.associados?.telefone) return;
    const phone = instalacao.associados.telefone.replace(/\D/g, '');
    const message = `Olá ${instalacao.associados.nome}! Somos da equipe de instalação de rastreadores.`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Calcular se está atrasada
  const isAtrasada = useMemo(() => {
    if (!instalacao) return false;
    if (['concluida', 'cancelada'].includes(instalacao.status)) return false;
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataAgendada = new Date(instalacao.data_agendada + 'T00:00:00');
    
    return dataAgendada < hoje;
  }, [instalacao]);

  // Pegar instalador (prioriza profiles que já tem fallback no hook)
  const instaladorInfo = instalacao?.profiles || instalacao?.instalador_responsavel;

  if (!instalacaoId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle>Detalhes da Instalação</DialogTitle>
            {instalacao && (
              <Badge className={cn(isAtrasada ? "bg-orange-500 text-white" : STATUS_INSTALACAO_COLORS[instalacao.status])}>
                {isAtrasada ? "Atrasada" : STATUS_INSTALACAO_LABELS[instalacao.status]}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !instalacao ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Instalação não encontrada
          </div>
        ) : (
          <div className="overflow-y-auto p-4 space-y-6">
            {/* Associado */}
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Associado</h3>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{instalacao.associados?.nome}</p>
                  <p className="text-sm text-muted-foreground">{instalacao.associados?.telefone}</p>
                </div>
                <Button variant="outline" size="sm" onClick={openWhatsApp}>
                  <Phone className="h-4 w-4 mr-1" />
                  WhatsApp
                </Button>
              </div>
            </section>

            <Separator />

            {/* Agendamento */}
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Agendamento</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(new Date(instalacao.data_agendada), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{PERIODO_LABELS[instalacao.periodo]}</span>
                </div>
              </div>

              {instaladorInfo && (
                <div className="flex items-center gap-2 mt-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Instalador: <strong>{instaladorInfo.nome}</strong>
                  </span>
                </div>
              )}

              {instalacao.rastreadores && (
                <div className="flex items-center gap-2 mt-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Rastreador: <strong>{instalacao.rastreadores.codigo}</strong>
                  </span>
                </div>
              )}
            </section>

            <Separator />

            {/* Veículo */}
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Veículo</h3>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Car className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {instalacao.veiculos?.marca} {instalacao.veiculos?.modelo} {instalacao.veiculos?.ano_modelo}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                      {instalacao.veiculos?.placa}
                    </span>
                    {instalacao.veiculos?.cor && <span>• {instalacao.veiculos.cor}</span>}
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* Endereço */}
            <section>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Endereço</h3>
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm">
                    {instalacao.logradouro}
                    {instalacao.numero && `, ${instalacao.numero}`}
                    {instalacao.complemento && ` - ${instalacao.complemento}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {instalacao.bairro}
                    {instalacao.cidade && ` - ${instalacao.cidade}`}
                    {instalacao.uf && `/${instalacao.uf}`}
                  </p>
                  {instalacao.cep && (
                    <p className="text-sm text-muted-foreground">CEP: {instalacao.cep}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={openGoogleMaps}>
                  <Navigation className="h-4 w-4 mr-1" />
                  Maps
                </Button>
              </div>
            </section>

            {/* Seção Prestador */}
            {prestadorLink && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Send className="h-4 w-4" />
                    Prestador
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {prestadorLink.prestador?.nome_fantasia || prestadorLink.prestador?.razao_social || 'Prestador'}
                      </span>
                      <Badge variant="outline" className={cn(
                        prestadorLink.status === 'aguardando' && 'bg-amber-500/15 text-amber-700 border-amber-500/30',
                        prestadorLink.status === 'em_execucao' && 'bg-blue-500/15 text-blue-700 border-blue-500/30',
                        prestadorLink.status === 'concluida' && 'bg-green-500/15 text-green-700 border-green-500/30',
                      )}>
                        {prestadorLink.status === 'aguardando' && '⏳ Aguardando'}
                        {prestadorLink.status === 'em_execucao' && '🔧 Em execução'}
                        {prestadorLink.status === 'concluida' && '✅ Concluído'}
                      </Badge>
                    </div>

                    {prestadorLink.chegada_em && (
                      <p className="text-xs text-muted-foreground">
                        Chegada: {format(new Date(prestadorLink.chegada_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                    {prestadorLink.concluida_em && (
                      <p className="text-xs text-muted-foreground">
                        Concluído: {format(new Date(prestadorLink.concluida_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}

                    {prestadorLink.foto_comprovante_url && (
                      <div
                        className="cursor-pointer"
                        onClick={() => setFotoDialogUrl(prestadorLink.foto_comprovante_url)}
                      >
                        <img
                          src={prestadorLink.foto_comprovante_url}
                          alt="Comprovante"
                          className="h-20 w-20 object-cover rounded-md border"
                        />
                        <p className="text-xs text-primary mt-1">Clique para ampliar</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const url = `https://pratic-connect-21.lovable.app/prestador/instalacao/${prestadorLink.token}`;
                          navigator.clipboard.writeText(url);
                          toast({ title: 'Link copiado!' });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copiar Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => enviarLinkPrestador.mutate()}
                        disabled={enviarLinkPrestador.isPending}
                      >
                        {enviarLinkPrestador.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Reenviar
                      </Button>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* Dialog para foto ampliada */}
            <Dialog open={!!fotoDialogUrl} onOpenChange={() => setFotoDialogUrl(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Comprovante do Prestador</DialogTitle>
                </DialogHeader>
                {fotoDialogUrl && (
                  <img src={fotoDialogUrl} alt="Comprovante" className="w-full rounded-md" />
                )}
              </DialogContent>
            </Dialog>

            {registroPresenca && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Shield className="h-4 w-4" />
                    Registro de Presença
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={
                        registroPresenca.gps_indisponivel
                          ? 'bg-muted text-muted-foreground'
                          : registroPresenca.dentro_do_raio
                            ? 'bg-green-500/15 text-green-700 border-green-500/30'
                            : 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                      }>
                        {registroPresenca.gps_indisponivel
                          ? 'GPS indisponível'
                          : registroPresenca.dentro_do_raio
                            ? 'Dentro do raio'
                            : registroPresenca.confirmou_presenca
                              ? 'Fora do raio (confirmou presença)'
                              : 'Fora do raio'}
                      </Badge>
                    </div>
                    {registroPresenca.distancia_metros != null && (
                      <p className="text-muted-foreground">
                        Distância registrada: <strong>{Math.round(registroPresenca.distancia_metros)}m</strong>
                      </p>
                    )}
                    {registroPresenca.latitude_vistoriador && registroPresenca.longitude_vistoriador && (
                      <a
                        href={`https://www.google.com/maps?q=${registroPresenca.latitude_vistoriador},${registroPresenca.longitude_vistoriador}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver localização no mapa
                      </a>
                    )}
                  </div>
                </section>
              </>
            )}

            {/* Histórico de Atribuições (Recusas) */}
            {historicoRecusas && historicoRecusas.length > 0 && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <RotateCcw className="h-4 w-4" />
                    Histórico de Atribuições
                  </h3>
                  <div className="space-y-2">
                    {historicoRecusas.map((rec: any) => (
                      <div key={rec.id} className="flex items-start gap-2 text-sm border border-border/50 rounded-md p-2">
                        <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{rec.profissional?.nome || 'Profissional'}</p>
                          <p className="text-muted-foreground text-xs">Recusou: {rec.motivo}</p>
                          {rec.motivo_livre && (
                            <p className="text-muted-foreground text-xs italic">"{rec.motivo_livre}"</p>
                          )}
                          <p className="text-muted-foreground text-xs">
                            {format(new Date(rec.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {instalacao.observacoes && (
              <>
                <Separator />
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Observações</h3>
                  <p className="text-sm">{instalacao.observacoes}</p>
                </section>
              </>
            )}

            <Separator />

            {/* Dados do Associado */}
            {associadoFull && (
              <section className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <IdCard className="h-4 w-4" />
                  Dados do Associado
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Nome:</span> <strong>{associadoFull.nome}</strong></div>
                  {associadoFull.cpf && <div><span className="text-muted-foreground">CPF:</span> {associadoFull.cpf}</div>}
                  {associadoFull.rg && <div><span className="text-muted-foreground">RG:</span> {associadoFull.rg}</div>}
                  {associadoFull.data_nascimento && <div><span className="text-muted-foreground">Nascimento:</span> {format(new Date(associadoFull.data_nascimento + 'T00:00:00'), 'dd/MM/yyyy')}</div>}
                  {associadoFull.estado_civil && <div><span className="text-muted-foreground">Estado Civil:</span> {associadoFull.estado_civil}</div>}
                  {associadoFull.profissao && <div><span className="text-muted-foreground">Profissão:</span> {associadoFull.profissao}</div>}
                  {associadoFull.telefone && <div><span className="text-muted-foreground">Telefone:</span> {associadoFull.telefone}</div>}
                  {associadoFull.telefone_secundario && <div><span className="text-muted-foreground">Telefone 2:</span> {associadoFull.telefone_secundario}</div>}
                  {associadoFull.email && <div className="sm:col-span-2"><span className="text-muted-foreground">E-mail:</span> {associadoFull.email}</div>}
                </div>

                {(associadoFull.logradouro || associadoFull.cidade) && (
                  <div className="text-sm border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground mb-1">Endereço residencial</p>
                    <p>
                      {associadoFull.logradouro}
                      {associadoFull.numero && `, ${associadoFull.numero}`}
                      {associadoFull.complemento && ` - ${associadoFull.complemento}`}
                    </p>
                    <p className="text-muted-foreground">
                      {associadoFull.bairro}
                      {associadoFull.cidade && ` - ${associadoFull.cidade}`}
                      {associadoFull.uf && `/${associadoFull.uf}`}
                      {associadoFull.cep && ` • CEP: ${associadoFull.cep}`}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-t border-border pt-3">
                  {associadoFull.status && <div><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{associadoFull.status}</Badge></div>}
                  {associadoFull.created_at && <div><span className="text-muted-foreground">Cadastro:</span> {format(new Date(associadoFull.created_at), 'dd/MM/yyyy')}</div>}
                  {contratoInfo?.planoNome && <div><span className="text-muted-foreground">Plano:</span> <strong>{contratoInfo.planoNome}</strong></div>}
                  {contratoInfo?.mensalidade != null && <div><span className="text-muted-foreground">Mensalidade:</span> <strong>{contratoInfo.mensalidade.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>}
                  {contratoInfo?.dataAdesao && <div><span className="text-muted-foreground">Adesão:</span> {format(new Date(contratoInfo.dataAdesao), 'dd/MM/yyyy')}</div>}
                </div>

                {(associadoFull.cnh_numero || associadoFull.cnh_categoria || associadoFull.cnh_validade) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm border-t border-border pt-3">
                    {associadoFull.cnh_numero && <div><span className="text-muted-foreground">CNH:</span> {associadoFull.cnh_numero}</div>}
                    {associadoFull.cnh_categoria && <div><span className="text-muted-foreground">Categoria:</span> {associadoFull.cnh_categoria}</div>}
                    {associadoFull.cnh_validade && <div><span className="text-muted-foreground">Validade:</span> {format(new Date(associadoFull.cnh_validade + 'T00:00:00'), 'dd/MM/yyyy')}</div>}
                  </div>
                )}
              </section>
            )}

            {/* Galeria de Autovistoria */}
            {fotosData?.fotosAutovistoria && fotosData.fotosAutovistoria.length > 0 && (() => {
              const grupos = agruparFotosPorCategoria(fotosData.fotosAutovistoria);
              const todas = fotosData.fotosAutovistoria;
              return (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Camera className="h-4 w-4" />
                      Galeria de Autovistoria ({todas.length})
                    </h3>
                    {(['identificacao', 'exterior', 'interior', 'outros'] as const).map((cat) =>
                      grupos[cat].length > 0 ? (
                        <div key={cat}>
                          <p className="text-xs text-muted-foreground mb-1.5 capitalize">{cat}</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {grupos[cat].map((foto) => {
                              const idx = todas.findIndex((f) => f.id === foto.id);
                              return (
                                <button
                                  key={foto.id}
                                  onClick={() => abrirGaleria(todas, idx)}
                                  className="aspect-square rounded-md overflow-hidden border border-border hover:border-primary transition-colors"
                                >
                                  <img src={foto.arquivo_url} alt={formatarTipoFoto(foto.tipo)} className="w-full h-full object-cover" loading="lazy" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null
                    )}
                  </section>
                </>
              );
            })()}

            {/* Galeria do Instalador */}
            {((fotosData?.fotosInstalador && fotosData.fotosInstalador.length > 0) || fotosData?.video360Url) && (() => {
              const grupos = fotosData.fotosInstalador ? agruparFotosPorCategoria(fotosData.fotosInstalador) : null;
              const todas = fotosData.fotosInstalador || [];
              return (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      Galeria do Instalador ({todas.length})
                    </h3>
                    {fotosData.video360Url && (
                      <button
                        onClick={() => abrirVideo360(fotosData.video360Url!)}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Video className="h-4 w-4" />
                        Ver Vídeo 360°
                      </button>
                    )}
                    {grupos && (['identificacao', 'exterior', 'interior', 'outros'] as const).map((cat) =>
                      grupos[cat].length > 0 ? (
                        <div key={cat}>
                          <p className="text-xs text-muted-foreground mb-1.5 capitalize">{cat}</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {grupos[cat].map((foto) => {
                              const idx = todas.findIndex((f) => f.id === foto.id);
                              return (
                                <button
                                  key={foto.id}
                                  onClick={() => abrirGaleria(todas, idx)}
                                  className="aspect-square rounded-md overflow-hidden border border-border hover:border-primary transition-colors"
                                >
                                  <img src={foto.arquivo_url} alt={formatarTipoFoto(foto.tipo)} className="w-full h-full object-cover" loading="lazy" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null
                    )}
                  </section>
                </>
              );
            })()}

            <VisualizadorFoto
              fotos={fotosAtivas}
              indexInicial={fotoIndex}
              open={visualizadorAberto}
              onClose={() => setVisualizadorAberto(false)}
            />

            <Separator />

            <section className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Ações</h3>
              
              <div className="flex flex-wrap gap-2">
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                )}

                {instalacao.status === 'agendada' && (
                  <Button 
                    size="sm" 
                    onClick={() => handleStatusChange('em_rota')}
                    disabled={updateStatus.isPending}
                  >
                    <PlayCircle className="h-4 w-4 mr-1" />
                    Iniciar Rota
                  </Button>
                )}

                {instalacao.status === 'em_rota' && (
                  <Button 
                    size="sm" 
                    onClick={() => handleStatusChange('em_andamento')}
                    disabled={updateStatus.isPending}
                  >
                    <PlayCircle className="h-4 w-4 mr-1" />
                    Iniciar Instalação
                  </Button>
                )}

                {instalacao.status === 'em_andamento' && (
                  <Button 
                    size="sm" 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleStatusChange('concluida')}
                    disabled={updateStatus.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Concluir
                  </Button>
                )}

                {['agendada', 'em_rota', 'em_andamento'].includes(instalacao.status) && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange('nao_compareceu')}
                      disabled={updateStatus.isPending}
                    >
                      <UserX className="h-4 w-4 mr-1" />
                      Não Compareceu
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleStatusChange('reagendada')}
                      disabled={updateStatus.isPending}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Reagendar
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleStatusChange('cancelada')}
                      disabled={updateStatus.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

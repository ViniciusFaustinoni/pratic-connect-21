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
  Trash2,
  Shield,
  ExternalLink,
  Send,
  Copy,
  Image,
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { useInstalacao, useUpdateInstalacaoStatus, useDeleteInstalacao, type Instalacao } from '@/hooks/useInstalacoes';
import { STATUS_INSTALACAO_LABELS, STATUS_INSTALACAO_COLORS, PERIODO_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';

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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [fotoDialogUrl, setFotoDialogUrl] = useState<string | null>(null);
  const { data: instalacao, isLoading } = useInstalacao(instalacaoId || undefined);
  const updateStatus = useUpdateInstalacaoStatus();
  const deleteInstalacao = useDeleteInstalacao();

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
      // Precisamos de um prestador_id — buscar do serviço
      const { data: servico } = await supabase
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
  const handleDelete = async () => {
    if (!instalacaoId) return;
    
    try {
      await deleteInstalacao.mutateAsync(instalacaoId);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } catch (error) {
      // Error handled by hook
    }
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle>Detalhes da Instalação</DrawerTitle>
            {instalacao && (
              <Badge className={cn(isAtrasada ? "bg-orange-500 text-white" : STATUS_INSTALACAO_COLORS[instalacao.status])}>
                {isAtrasada ? "Atrasada" : STATUS_INSTALACAO_LABELS[instalacao.status]}
              </Badge>
            )}
          </div>
        </DrawerHeader>

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

            {/* Registro de Presença GPS */}
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

            {/* Ações */}
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

                {instalacao.status === 'cancelada' && (
                  <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir instalação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. A instalação será permanentemente removida do sistema.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDelete}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          {deleteInstalacao.isPending && (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          )}
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </section>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

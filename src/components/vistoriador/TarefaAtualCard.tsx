import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Phone, Car, Clock, Navigation, Play, 
  CheckCircle2, User, ChevronRight, Loader2, Route, Zap,
  MessageCircle, MessageSquareWarning, Timer, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TarefaAtual, useIniciarTarefa, useIniciarRota, TarefaAtualComConfirmacao } from '@/hooks/useTarefaAtual';
import { useIniciarServico } from '@/hooks/useIniciarServico';
import { useRegistrarContato } from '@/hooks/useRegistrarContato';
import { TIPO_SERVICO_LABELS, isInstalacao } from '@/hooks/useServicos';
import { isManutencao } from '@/hooks/useCriarManutencao';
import { isRetirada } from '@/hooks/useCriarRetirada';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ImprevistoBotao } from './ImprevistoBotao';
import { SlaIndicador } from '@/components/ui/SlaIndicador';
import { ModalRecusaTarefa } from './ModalRecusaTarefa';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TarefaAtualCardProps {
  tarefa: TarefaAtual & {
    confirmacao_whatsapp?: string | null;
    confirmado_via_whatsapp_em?: string | null;
    permite_encaixe?: boolean;
    contato_realizado_em?: string | null;
    contato_tipo?: string | null;
    cliente: {
      id: string;
      nome: string;
      telefone: string;
      whatsapp?: string | null;
    };
  };
}

export function TarefaAtualCard({ tarefa }: TarefaAtualCardProps) {
  const navigate = useNavigate();
  const [showConcluirDialog, setShowConcluirDialog] = useState(false);
  const { mutate: iniciarTarefa, isPending: isIniciando } = useIniciarTarefa();
  const { mutate: iniciarRota, isPending: isIniciandoRota } = useIniciarRota();
  const { buscarProximaTarefa, isLoading: isBuscandoProxima } = useIniciarServico();
  const { mutate: registrarContato, isPending: isRegistrandoContato } = useRegistrarContato();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [showRecusaModal, setShowRecusaModal] = useState(false);
  const [isRecusando, setIsRecusando] = useState(false);
  
  // Ler config de recusa
  const { data: configRecusa } = useQuery({
    queryKey: ['config-recusa-tarefa'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['recusa_exigir_motivo', 'recusa_limite_alerta']);
      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      return {
        exigirMotivo: map.recusa_exigir_motivo !== 'false',
        limiteAlerta: parseInt(map.recusa_limite_alerta || '3', 10),
      };
    },
    staleTime: 1000 * 60 * 10,
  });

  // Estado para atualização em tempo real (a cada minuto)
  const [agora, setAgora] = useState(new Date());
  
  useEffect(() => {
    const interval = setInterval(() => setAgora(new Date()), 60000); // Atualiza a cada minuto
    return () => clearInterval(interval);
  }, []);

  // Verificar se pode iniciar rota baseado no horário agendado
  const podeIniciarPorHorario = useMemo(() => {
    // Se não é hoje, pode iniciar (tarefas futuras atribuídas manualmente)
    const hoje = agora.toISOString().split('T')[0];
    if (tarefa.data_agendada !== hoje) return true;
    
    // Se é encaixe, pode iniciar a qualquer momento
    if (tarefa.permite_encaixe) return true;
    
    // Se não tem hora específica, pode iniciar
    if (!tarefa.hora_agendada) return true;
    
    // Verificar se hora atual >= hora agendada
    const horaAtual = agora.toTimeString().slice(0, 5); // "HH:MM"
    const horaAgendada = tarefa.hora_agendada.slice(0, 5);
    return horaAtual >= horaAgendada;
  }, [agora, tarefa.data_agendada, tarefa.hora_agendada, tarefa.permite_encaixe]);

  // Calcular tempo restante para habilitar
  const tempoRestante = useMemo(() => {
    if (podeIniciarPorHorario || !tarefa.hora_agendada) return null;
    
    const [h, m] = tarefa.hora_agendada.split(':').map(Number);
    const horaAgendada = new Date(agora);
    horaAgendada.setHours(h, m, 0, 0);
    
    const diff = horaAgendada.getTime() - agora.getTime();
    if (diff <= 0) return null;
    
    const minutos = Math.ceil(diff / 60000);
    return minutos;
  }, [agora, tarefa.hora_agendada, podeIniciarPorHorario]);

  const enderecoCompleto = [
    tarefa.endereco.logradouro,
    tarefa.endereco.numero,
    tarefa.endereco.bairro,
    tarefa.endereco.cidade,
    tarefa.endereco.uf
  ].filter(Boolean).join(', ') || 'Endereço não informado';

  const abrirNavegacao = () => {
    if (tarefa.endereco.latitude && tarefa.endereco.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${tarefa.endereco.latitude},${tarefa.endereco.longitude}`;
      window.location.href = url;
    }
  };

  const ligarCliente = () => {
    if (tarefa.cliente.telefone) {
      // Registrar contato se ainda não foi feito
      if (!tarefa.contato_realizado_em) {
        registrarContato({ tarefaId: tarefa.id, tipo: 'ligacao' });
      }
      const numeroLimpo = tarefa.cliente.telefone.replace(/\D/g, '');
      window.location.href = `tel:${numeroLimpo}`;
    }
  };

  const abrirWhatsApp = () => {
    const numero = tarefa.cliente.whatsapp || tarefa.cliente.telefone;
    if (numero) {
      // Registrar contato se ainda não foi feito
      if (!tarefa.contato_realizado_em) {
        registrarContato({ tarefaId: tarefa.id, tipo: 'whatsapp' });
      }
      const numeroLimpo = numero.replace(/\D/g, '');
      const mensagem = encodeURIComponent(
        `Olá ${tarefa.cliente.nome?.split(' ')[0] || ''}, sou o técnico da PRATIC. ` +
        `Estou entrando em contato para confirmar os detalhes do serviço agendado. Podemos conversar?`
      );
      window.open(`https://wa.me/55${numeroLimpo}?text=${mensagem}`, '_blank');
    }
  };

  const contatoRealizado = !!tarefa.contato_realizado_em;

  const handleIniciarRota = () => {
    iniciarRota({ tarefaId: tarefa.id });
  };

  const handleIniciarTarefa = () => {
    iniciarTarefa({ tarefaId: tarefa.id });
  };

  const handleRecusar = async (motivo: string, motivoLivre?: string) => {
    setIsRecusando(true);
    try {
      // Buscar turno ativo
      const { data: turnoAtivo } = await supabase
        .from('turnos_profissionais')
        .select('id')
        .eq('profissional_id', profile?.id || '')
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const turnoId = turnoAtivo?.id || null;

      // Registrar recusa
      await (supabase as any).from('registros_recusa_tarefa').insert({
        servico_id: tarefa.id,
        profissional_id: profile?.id,
        turno_id: turnoId,
        motivo,
        motivo_livre: motivoLivre || null,
      });

      // Desatribuir serviço
      await supabase.from('servicos').update({
        profissional_id: null,
        status: 'pendente',
      }).eq('id', tarefa.id);

      // Verificar limite de recusas e enviar alerta
      if (turnoId) {
        const { count } = await (supabase as any)
          .from('registros_recusa_tarefa')
          .select('id', { count: 'exact', head: true })
          .eq('turno_id', turnoId);

        const limite = configRecusa?.limiteAlerta || 3;
        if ((count || 0) >= limite) {
          // Verificar se já existe alerta para este turno
          const { data: alertaExistente } = await supabase
            .from('notificacoes')
            .select('id')
            .eq('referencia_id', turnoId)
            .eq('subtipo', 'recusa_limite_atingido')
            .limit(1);

          if (!alertaExistente?.length) {
            // Buscar coordenadores/admins
            const { data: coordenadores } = await supabase
              .from('user_roles')
              .select('user_id')
              .in('role', ['coordenador_monitoramento', 'admin', 'diretoria']);

            for (const coord of (coordenadores || [])) {
              await supabase.from('notificacoes').insert({
                user_id: coord.user_id,
                titulo: '⚠️ Vistoriador com muitas recusas',
                mensagem: `Vistoriador ${profile?.nome || ''} recusou ${count} tarefas neste turno.`,
                tipo: 'alerta',
                subtipo: 'recusa_limite_atingido',
                referencia_id: turnoId,
                referencia_tipo: 'turno',
                lida: false,
                canal_sistema: true,
                prioridade: 'alta',
              });
            }
          }
        }
      }

      // Buscar próxima tarefa
      buscarProximaTarefa();
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      setShowRecusaModal(false);
    } catch (err) {
      console.error('Erro ao recusar tarefa:', err);
      toast.error('Erro ao recusar tarefa');
    } finally {
      setIsRecusando(false);
    }
  };

  const handleRecusarClick = () => {
    if (configRecusa?.exigirMotivo) {
      setShowRecusaModal(true);
    } else {
      handleRecusar('Sem motivo informado');
    }
  };

  const handleExecutar = () => {
    if (isManutencao(tarefa.tipo)) {
      navigate(`/instalador/manutencao/${tarefa.id}`);
    } else if (isRetirada(tarefa.tipo)) {
      navigate(`/instalador/retirada/${tarefa.id}`);
    } else if (isInstalacao(tarefa.tipo)) {
      navigate(`/instalador/instalacao/${tarefa.id}`);
    } else {
      navigate(`/instalador/vistoria/${tarefa.id}`);
    }
  };

  const isAgendada = tarefa.status === 'agendada';
  const isEmRota = tarefa.status === 'em_rota';
  const isEmAndamento = tarefa.status === 'em_andamento';

  // Verificar se é um encaixe (tarefa foi antecipada)
  const isEncaixe = tarefa.permite_encaixe === true;
  const dataOriginal = (tarefa as any).data_agendada_original;

  return (
    <>
      <Card className={cn(
        "border-primary/50 shadow-lg",
        isEncaixe && "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={isInstalacao(tarefa.tipo) ? 'default' : 'secondary'}>
                {TIPO_SERVICO_LABELS[tarefa.tipo] || tarefa.tipo}
              </Badge>
              <Badge 
                variant="outline"
                className={cn(
                  isEmAndamento && "bg-warning/20 text-warning-foreground border-warning/30",
                  isEmRota && "bg-primary/20 text-primary border-primary/30",
                  isAgendada && "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700"
                )}
              >
                {isEmAndamento ? 'Em Andamento' : isEmRota ? 'Em Rota' : 'Agendada'}
              </Badge>
              {/* Badge de Encaixe */}
              {isEncaixe && (
                <Badge 
                  variant="outline"
                  className="bg-amber-500/20 text-amber-700 border-amber-500/50 dark:text-amber-400 gap-1"
                >
                  <Zap className="h-3 w-3" />
                  Encaixe
                </Badge>
              )}
              {/* Badge de Confirmação WhatsApp */}
              {tarefa.confirmacao_whatsapp === 'confirmada' && (
                <Badge 
                  variant="outline"
                  className="bg-green-500/20 text-green-700 border-green-500/50 dark:text-green-400 gap-1"
                >
                  <MessageCircle className="h-3 w-3" />
                  Cliente confirmou
                </Badge>
              )}
              {tarefa.confirmacao_whatsapp === 'enviada' && (
                <Badge 
                  variant="outline"
                  className="bg-blue-500/20 text-blue-700 border-blue-500/50 dark:text-blue-400 gap-1"
                >
                  <MessageCircle className="h-3 w-3" />
                  Aguardando resposta
                </Badge>
              )}
              {tarefa.confirmacao_whatsapp === 'reagendado' && (
                <Badge 
                  variant="outline"
                  className="bg-orange-500/20 text-orange-700 border-orange-500/50 dark:text-orange-400 gap-1"
                >
                  <MessageSquareWarning className="h-3 w-3" />
                  Cliente quer reagendar
                </Badge>
              )}
            </div>
            {tarefa.distancia_km !== undefined && (
              <span className="text-sm text-muted-foreground">
                {tarefa.distancia_km.toFixed(1)} km
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <CardTitle className="text-lg">
              Tarefa Atual
            </CardTitle>
            {/* Mostrar data original se foi encaixe */}
            {isEncaixe && dataOriginal && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                Antecipado de {format(parseISO(dataOriginal), "dd/MM", { locale: ptBR })}
              </span>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Cliente */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{tarefa.cliente.nome}</p>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">{tarefa.cliente.telefone}</p>
                <SlaIndicador criadoEm={tarefa.data_agendada} tipoServico={tarefa.tipo} />
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={abrirWhatsApp}
              disabled={!tarefa.cliente.whatsapp && !tarefa.cliente.telefone}
              className={cn(
                "text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950",
                contatoRealizado && tarefa.contato_tipo === 'whatsapp' && "border-green-500 bg-green-50 dark:bg-green-950"
              )}
            >
              {contatoRealizado && tarefa.contato_tipo === 'whatsapp' ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={ligarCliente}
              disabled={!tarefa.cliente.telefone}
              className={cn(
                contatoRealizado && tarefa.contato_tipo === 'ligacao' && "border-green-500 bg-green-50 dark:bg-green-950"
              )}
            >
              {contatoRealizado && tarefa.contato_tipo === 'ligacao' ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Veículo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center flex-shrink-0">
              <Car className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">
                {tarefa.veiculo.marca} {tarefa.veiculo.modelo}
              </p>
              <p className="text-sm text-muted-foreground font-mono">
                {tarefa.veiculo.placa}
              </p>
            </div>
          </div>

          {/* Endereço */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/50 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{enderecoCompleto}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={abrirNavegacao}
              disabled={!tarefa.endereco.latitude}
            >
              <Navigation className="h-4 w-4" />
            </Button>
          </div>

          {/* Horário */}
          {tarefa.hora_agendada && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Agendado para {tarefa.hora_agendada.slice(0, 5)}
                </p>
              </div>
            </div>
          )}

          {/* Botão de Imprevisto */}
          {(tarefa as any).profissional_id && 
           (isAgendada || isEmRota || isEmAndamento) && 
           !(tarefa as any).imprevisto_registrado_em && (
            <ImprevistoBotao
              tarefaId={tarefa.id}
              clienteNome={tarefa.cliente.nome}
              clienteTelefone={tarefa.cliente.telefone}
              clienteWhatsapp={tarefa.cliente.whatsapp}
            />
          )}

          {/* Ações */}
          <div className="space-y-3 pt-2">
            {isAgendada ? (
              // Tarefa atribuída - contato obrigatório antes de iniciar percurso
              <div className="space-y-2">
                {/* Mensagem de orientação quando contato não foi feito */}
                {!contatoRealizado && (
                  <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md py-2 px-3">
                    <MessageCircle className="h-4 w-4 flex-shrink-0" />
                    <span>Entre em contato com o associado antes de iniciar o percurso</span>
                  </div>
                )}
                
                {/* Feedback de contato realizado */}
                {contatoRealizado && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-500/10 rounded-md py-2 px-3">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    <span>Contato realizado via {tarefa.contato_tipo === 'whatsapp' ? 'WhatsApp' : 'Ligação'}</span>
                  </div>
                )}

                <Button
                  onClick={handleIniciarRota}
                  disabled={isIniciandoRota || !podeIniciarPorHorario || !contatoRealizado}
                  className="w-full gap-2"
                >
                  {isIniciandoRota ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Iniciar Tarefa
                </Button>
                
                {/* Feedback visual quando bloqueado por horário */}
                {!podeIniciarPorHorario && tarefa.hora_agendada && (
                  <div className="flex items-center justify-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md py-2 px-3">
                    <Timer className="h-4 w-4" />
                    <span>
                      {tempoRestante && tempoRestante > 60 
                        ? `Disponível em ${Math.floor(tempoRestante / 60)}h ${tempoRestante % 60}min (${tarefa.hora_agendada.slice(0, 5)})`
                        : `Disponível em ${tempoRestante} min (${tarefa.hora_agendada.slice(0, 5)})`
                      }
                    </span>
                  </div>
                )}
              </div>
            ) : isEmRota ? (
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={abrirNavegacao}
                  disabled={!tarefa.endereco.latitude}
                  className="gap-2"
                >
                  <Navigation className="h-4 w-4" />
                  Navegar
                </Button>
                <Button
                  onClick={handleIniciarTarefa}
                  disabled={isIniciando}
                  className="gap-2"
                >
                  {isIniciando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Cheguei no Local
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleExecutar}
                className="w-full gap-2"
              >
                <ChevronRight className="h-4 w-4" />
                Executar {TIPO_SERVICO_LABELS[tarefa.tipo] || tarefa.tipo}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para buscar próxima tarefa após conclusão */}
      <AlertDialog open={showConcluirDialog} onOpenChange={setShowConcluirDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Tarefa Concluída!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja buscar a próxima tarefa mais próxima de você?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Encerrar por hoje</AlertDialogCancel>
            <AlertDialogAction
              onClick={buscarProximaTarefa}
              disabled={isBuscandoProxima}
            >
              {isBuscandoProxima ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Buscando...
                </>
              ) : (
                'Buscar Próxima'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

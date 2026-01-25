import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Car, 
  CheckCircle2, 
  Clock, 
  Shield, 
  XCircle,
  FileCheck,
  Calendar,
  Wrench,
  PartyPopper,
  KeyRound,
  Navigation,
  MapPin,
  UserCheck,
  Bell
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { CriarContaAssociadoForm } from '@/components/public/CriarContaAssociadoForm';

interface AssociadoData {
  id: string;
  nome: string;
  email: string;
  status: string;
  user_id: string | null;
  plano: { nome: string } | null;
  veiculos: {
    id: string;
    placa: string;
    modelo: string;
    marca: string;
    status: string;
    cobertura_roubo_furto: boolean;
    cobertura_total: boolean;
  }[];
  contrato: {
    id: string;
    status: string;
  } | null;
  instalacoes: {
    id: string;
    status: string;
    data_agendada: string | null;
    rota_id: string | null;
    instalador_responsavel: {
      nome: string;
    } | null;
  }[];
}

function useAcompanhamentoProposta(token: string | undefined) {
  return useQuery({
    queryKey: ['acompanhamento-proposta', token],
    queryFn: async (): Promise<AssociadoData | null> => {
      if (!token) return null;

      // Buscar contrato pelo link_token
      const { data: contrato, error: contratoError } = await supabase
        .from('contratos')
        .select('id, associado_id, status')
        .eq('link_token', token)
        .maybeSingle();

      if (contratoError) {
        console.error('Erro ao buscar contrato:', contratoError);
        return null;
      }

      if (!contrato?.associado_id) return null;

      // Buscar dados do associado incluindo email
      const { data: associado, error: assocError } = await supabase
        .from('associados')
        .select(`
          id,
          nome,
          email,
          status,
          user_id,
          plano:planos (nome)
        `)
        .eq('id', contrato.associado_id)
        .single();

      if (assocError || !associado) return null;

      // Buscar veículos
      const { data: veiculos } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, marca, status, cobertura_roubo_furto, cobertura_total')
        .eq('associado_id', contrato.associado_id);

      // Buscar instalações COM dados do vistoriador
      const { data: instalacoes } = await supabase
        .from('instalacoes')
        .select(`
          id, 
          status, 
          data_agendada,
          rota_id,
          instalador_responsavel:profiles!instalador_responsavel_id(nome)
        `)
        .eq('associado_id', contrato.associado_id)
        .order('created_at', { ascending: false })
        .limit(1);

      return {
        ...associado,
        plano: associado.plano as any,
        veiculos: veiculos || [],
        contrato: {
          id: contrato.id,
          status: contrato.status || 'pendente',
        },
        instalacoes: instalacoes || [],
      };
    },
    enabled: !!token,
    refetchInterval: 30000, // Atualiza a cada 30s
  });
}

function getStatusInfo(associado: AssociadoData) {
  const veiculo = associado.veiculos[0];
  const instalacao = associado.instalacoes[0];
  const contrato = associado.contrato;

  // Verificar se foi reprovado/cancelado
  if (contrato?.status === 'cancelado') {
    return {
      status: 'reprovado',
      icon: XCircle,
      color: 'destructive',
      title: 'Proposta Recusada',
      description: 'Sua proposta foi recusada. Entre em contato para mais informações.',
      showDetails: false,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
    };
  }

  // PRIORIDADE 1: Instalação em andamento
  if (instalacao?.status === 'em_andamento') {
    return {
      status: 'em_andamento',
      icon: Wrench,
      color: 'success',
      title: 'Instalação em Andamento',
      description: 'O técnico está realizando a instalação do rastreador no seu veículo.',
      showDetails: true,
      showInstalacao: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: true,
    };
  }

  // PRIORIDADE 2: Técnico a caminho (em_rota)
  if (instalacao?.status === 'em_rota') {
    const nomeVistoriador = instalacao.instalador_responsavel?.nome || 'Técnico';
    return {
      status: 'em_rota',
      icon: Navigation,
      color: 'primary',
      title: 'Técnico a Caminho!',
      description: 'O técnico já iniciou o deslocamento até você. Prepare-se para recebê-lo!',
      showDetails: true,
      showInstalacao: true,
      showCriarConta: false,
      showEmRota: true,
      showEmAndamento: false,
      showAtribuidaRota: false,
      nomeVistoriador,
    };
  }

  // PRIORIDADE 3: Instalação atribuída a uma rota (aguardando vistoriador iniciar)
  if (instalacao?.rota_id && instalacao?.status === 'agendada') {
    const nomeVistoriador = instalacao.instalador_responsavel?.nome || 'Técnico';
    return {
      status: 'atribuida_rota',
      icon: UserCheck,
      color: 'primary',
      title: 'Instalação Agendada!',
      description: `O vistoriador ${nomeVistoriador} foi designado para realizar sua instalação.`,
      showDetails: true,
      showInstalacao: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: true,
      nomeVistoriador,
    };
  }

  // ATIVO MAS SEM CONTA CRIADA → Mostrar formulário de criação
  if (associado.status === 'ativo' && !associado.user_id) {
    return {
      status: 'criar_conta',
      icon: KeyRound,
      color: 'success',
      title: 'Crie sua Conta!',
      description: 'Seu cadastro foi aprovado! Crie seu login para acessar o app PRATIC.',
      showDetails: true,
      showCriarConta: true,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // Verificar se está ativo com cobertura total (já tem conta)
  if (associado.status === 'ativo' && veiculo?.cobertura_total) {
    return {
      status: 'ativo_total',
      icon: PartyPopper,
      color: 'success',
      title: 'Cobertura Total Ativa!',
      description: 'Parabéns! Seu veículo está com cobertura total ativa.',
      showDetails: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // Verificar se tem cobertura roubo/furto ativa (aguardando instalação)
  if (veiculo?.cobertura_roubo_furto && !veiculo?.cobertura_total) {
    return {
      status: 'roubo_furto',
      icon: Shield,
      color: 'primary',
      title: 'Cobertura Roubo e Furto Ativa',
      description: 'Seu veículo já está protegido contra roubo e furto. Aguardando instalação do rastreador para cobertura total.',
      showDetails: true,
      showInstalacao: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // Verificar se está aguardando instalação
  if (associado.status === 'aguardando_instalacao') {
    return {
      status: 'aguardando_instalacao',
      icon: Wrench,
      color: 'warning',
      title: 'Aguardando Instalação',
      description: 'Sua proposta foi aprovada! Aguardando agendamento da instalação do rastreador.',
      showDetails: true,
      showInstalacao: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // Em análise
  if (associado.status === 'em_analise') {
    return {
      status: 'em_analise',
      icon: Clock,
      color: 'warning',
      title: 'Proposta em Análise',
      description: 'Seus documentos, contrato e imagens da vistoria estão sendo analisados pelo setor de cadastro.',
      showDetails: true,
      showCriarConta: false,
      showEmRota: false,
      showEmAndamento: false,
      showAtribuidaRota: false,
    };
  }

  // Default - pendente
  return {
    status: 'pendente',
    icon: FileCheck,
    color: 'muted',
    title: 'Proposta Recebida',
    description: 'Aguardando processamento da sua proposta.',
    showDetails: true,
    showCriarConta: false,
    showEmRota: false,
    showEmAndamento: false,
    showAtribuidaRota: false,
  };
}

export default function AcompanhamentoProposta() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();
  const { data: associado, isLoading, error } = useAcompanhamentoProposta(token);

  // Realtime subscription para atualização instantânea quando status mudar
  useEffect(() => {
    if (!associado?.id) return;

    const channel = supabase
      .channel(`acompanhamento-cliente-${associado.id}`)
      // Escutar mudanças nas instalações
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'instalacoes',
          filter: `associado_id=eq.${associado.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['acompanhamento-proposta', token] });
        }
      )
      // Escutar mudanças no status do associado (para análise cadastral e ativação)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'associados',
          filter: `id=eq.${associado.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['acompanhamento-proposta', token] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [associado?.id, token, queryClient]);

  if (isLoading) {
    return (
      <div className="dark min-h-screen public-premium-bg p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-24 w-full rounded-xl bg-white/5" />
          <Skeleton className="h-[400px] rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !associado) {
    return (
      <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative z-10"
        >
          <Card className="max-w-md w-full border-destructive/30 bg-card/80 backdrop-blur-xl">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-xl font-bold mb-2 text-foreground">Proposta não encontrada</h1>
              <p className="text-muted-foreground">
                Este link é inválido ou a proposta não existe mais.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(associado);
  const veiculo = associado.veiculos[0];
  const instalacao = associado.instalacoes[0];
  const StatusIcon = statusInfo.icon;

  const colorClasses = {
    success: {
      bg: 'bg-success/10',
      border: 'border-success/30',
      text: 'text-success',
      badge: 'bg-success/20 text-success border-success/30',
    },
    primary: {
      bg: 'bg-primary/10',
      border: 'border-primary/30',
      text: 'text-primary',
      badge: 'bg-primary/20 text-primary border-primary/30',
    },
    warning: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    },
    destructive: {
      bg: 'bg-destructive/10',
      border: 'border-destructive/30',
      text: 'text-destructive',
      badge: 'bg-destructive/20 text-destructive border-destructive/30',
    },
    muted: {
      bg: 'bg-muted/30',
      border: 'border-border',
      text: 'text-muted-foreground',
      badge: 'bg-muted text-muted-foreground border-border',
    },
  };

  const colors = colorClasses[statusInfo.color as keyof typeof colorClasses];

  return (
    <div className="dark min-h-screen public-premium-bg relative">
      {/* Ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
      </div>

      {/* Header */}
      <motion.header 
        className="header-premium-glow text-white sticky top-0 z-20"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, type: 'spring' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
              <img 
                src="/pratic-logo.png" 
                alt="PRATIC" 
                className="h-12 w-12 object-contain rounded-lg bg-white/10 p-1 relative z-10"
              />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">PRATIC</h1>
              <p className="text-xs text-white/60">Proteção Veicular</p>
            </div>
          </div>
          <Badge variant="outline" className="border-white/20 text-white bg-white/5 backdrop-blur-sm px-4">
            Acompanhamento
          </Badge>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Status Principal */}
          <Card className={`${colors.border} bg-card/80 backdrop-blur-xl`}>
            <CardContent className="py-8 text-center space-y-6">
              <motion.div 
                className={`w-20 h-20 mx-auto rounded-full ${colors.bg} flex items-center justify-center`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              >
                <StatusIcon className={`h-10 w-10 ${colors.text}`} />
              </motion.div>
              
              <div>
                <Badge className={`${colors.badge} mb-4`}>
                  {statusInfo.title}
                </Badge>
                <h2 className="text-xl font-bold mb-3 text-foreground">
                  Olá, {associado.nome.split(' ')[0]}!
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {statusInfo.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Formulário de Criação de Conta (quando ativo sem user_id) */}
          {statusInfo.showCriarConta && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <CriarContaAssociadoForm 
                associadoId={associado.id}
                nomeAssociado={associado.nome}
                emailCadastrado={associado.email}
              />
            </motion.div>
          )}
          {/* Card de Técnico a Caminho */}
          {statusInfo.showEmRota && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-primary/5 border-primary/30 overflow-hidden">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    {/* Ícone pulsante */}
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping" />
                      <div className="relative w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                        <Navigation className="h-7 w-7 text-primary animate-pulse" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        Técnico a Caminho
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        O profissional está se deslocando até o endereço agendado
                      </p>
                    </div>
                  </div>
                  
                  {/* Dicas para o cliente */}
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-foreground">Prepare-se para a chegada:</p>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        Tenha o veículo acessível e estacionado
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        Tenha os documentos do veículo em mãos
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                        Aguarde no local combinado
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Card de Vistoriador Designado (Atribuído à Rota) */}
          {statusInfo.showAtribuidaRota && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-primary/5 border-primary/30 overflow-hidden">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    {/* Ícone do vistoriador */}
                    <div className="relative flex-shrink-0">
                      <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                        <UserCheck className="h-7 w-7 text-primary" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">
                        Vistoriador Designado
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-primary">{statusInfo.nomeVistoriador}</span> 
                        {' '}irá realizar sua instalação
                      </p>
                    </div>
                  </div>
                  
                  {/* Informações adicionais */}
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-xs font-medium text-foreground">
                      Próximos passos:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                        Aguarde o vistoriador iniciar o deslocamento
                      </li>
                      <li className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary flex-shrink-0" />
                        Você será notificado quando ele estiver a caminho
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Card de Instalação em Andamento */}
          {statusInfo.showEmAndamento && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="bg-success/5 border-success/30">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <div className="absolute inset-0 bg-success/20 rounded-full animate-pulse" />
                      <div className="relative w-14 h-14 rounded-full bg-success/20 flex items-center justify-center">
                        <Wrench className="h-7 w-7 text-success" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground">Instalação em Andamento</h3>
                      <p className="text-sm text-muted-foreground">
                        O técnico está instalando o rastreador no seu veículo. Aguarde a conclusão.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-success/10 rounded-lg">
                    <p className="text-sm text-success text-center font-medium">
                      ⏱️ Tempo estimado: 30-60 minutos
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {statusInfo.showDetails && veiculo && (
            <Card className="bg-card/80 backdrop-blur-xl border-border/50">
              <CardContent className="py-6 space-y-4">
                <div className="flex items-center gap-3 text-foreground">
                  <Car className="h-5 w-5 text-primary" />
                  <span className="font-medium">
                    {veiculo.marca} {veiculo.modelo}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {veiculo.placa}
                  </Badge>
                </div>

                {/* Status das Coberturas */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    {veiculo.cobertura_roubo_furto ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={veiculo.cobertura_roubo_furto ? 'text-foreground' : 'text-muted-foreground'}>
                      Cobertura Roubo e Furto
                    </span>
                    {veiculo.cobertura_roubo_furto && (
                      <Badge className="bg-success/20 text-success border-success/30 text-xs">
                        Ativa
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {veiculo.cobertura_total ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className={veiculo.cobertura_total ? 'text-foreground' : 'text-muted-foreground'}>
                      Cobertura Total (após instalação)
                    </span>
                    {veiculo.cobertura_total && (
                      <Badge className="bg-success/20 text-success border-success/30 text-xs">
                        Ativa
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info de Instalação */}
          {statusInfo.showInstalacao && instalacao && (
            <Card className="bg-card/80 backdrop-blur-xl border-border/50">
              <CardContent className="py-6 space-y-4">
                <div className="flex items-center gap-3 text-foreground">
                  <Wrench className="h-5 w-5 text-primary" />
                  <span className="font-medium">Instalação do Rastreador</span>
                </div>

                {instalacao.status === 'concluida' ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-success">Instalação concluída</span>
                  </div>
                ) : instalacao.data_agendada ? (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Agendada para</p>
                      <p className="font-medium">
                        {format(new Date(instalacao.data_agendada), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-warning" />
                    <span className="text-muted-foreground">Aguardando agendamento</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Plano */}
          {associado.plano && (
            <Card className="bg-card/80 backdrop-blur-xl border-border/50">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 text-foreground">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="font-medium">Plano:</span>
                  <span className="text-muted-foreground">{associado.plano.nome}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-auto relative z-10 bg-card/30 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} PRATIC - Proteção Veicular. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

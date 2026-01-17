import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Shield, Car, CheckCircle, AlertCircle, Clock, Search, Lock, Sparkles, FileCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useContratoByToken, useGerarAutentiqueByToken } from '@/hooks/useContratoLink';
import { EscolhaVistoria } from '@/components/associado/EscolhaVistoria';
import { AgendarVistoria } from '@/components/associado/AgendarVistoria';
import { Autovistoria } from '@/components/associado/Autovistoria';
import { PagamentoAdesao } from '@/components/associado/PagamentoAdesao';
import { ConfirmacaoVistoria } from '@/components/associado/ConfirmacaoVistoria';
import { DocumentosPendentes } from '@/components/associado/DocumentosPendentes';
import { SyncStatusIndicator } from '@/components/associado/SyncStatusIndicator';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Logo PRATIC
import logoPratic from '@/assets/logopratic.png';

// Mapeamento de status do associado para exibição
const STATUS_ASSOCIADO_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  'em_cadastro': { label: 'Aguardando Vistoria', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  'documentacao_pendente': { label: 'Aguardando Documentos', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
  'em_analise': { label: 'Em Análise', variant: 'default', icon: <Search className="h-3 w-3" /> },
  'aprovado': { label: 'Aprovado', variant: 'outline', icon: <CheckCircle className="h-3 w-3" /> },
  'ativo': { label: 'Ativo', variant: 'outline', icon: <CheckCircle className="h-3 w-3" /> },
};

type Etapa = 'documentos' | 'escolha' | 'agendar' | 'autovistoria' | 'pagamento' | 'confirmacao';

// Stepper premium do fluxo de proposta
const etapasFluxo = [
  { id: 'documentos', label: 'Documentos', icon: FileCheck },
  { id: 'vistoria', label: 'Vistoria', icon: Car },
  { id: 'pagamento', label: 'Pagamento', icon: Sparkles },
  { id: 'conclusao', label: 'Conclusão', icon: CheckCircle },
];

export default function AssociadoVistoria() {
  const { token } = useParams<{ token: string }>();
  const { data: contrato, isLoading, error, isAutentiqueTimeout, retryAutentiquePolling } = useContratoByToken(token);
  const gerarAutentique = useGerarAutentiqueByToken();
  const [etapa, setEtapa] = useState<Etapa>('documentos');
  const [vistoriaId, setVistoriaId] = useState<string | null>(null);
  const [dadosAgendamento, setDadosAgendamento] = useState<{ data: string; horario: string } | null>(null);
  const [linkGeradoAntecipado, setLinkGeradoAntecipado] = useState<string | null>(null);

  // Calcular índice da etapa atual para o stepper
  const etapaIndex = useMemo(() => {
    switch (etapa) {
      case 'documentos': return 0;
      case 'escolha':
      case 'agendar':
      case 'autovistoria':
        return 1;
      case 'pagamento': return 2;
      case 'confirmacao': return 3;
      default: return 0;
    }
  }, [etapa]);

  // Calcular se está em modo somente leitura (bloqueia edição)
  const isReadOnly = useMemo(() => {
    if (!contrato) return false;
    if (contrato.status === 'pendente_assinatura') return true;
    if (contrato.autentique_url) return true;
    if (contrato.adesao_paga && contrato.status !== 'assinado') return true;
    return false;
  }, [contrato]);

  // Debug logs
  useEffect(() => {
    console.log('[AssociadoVistoria] Token:', token);
    console.log('[AssociadoVistoria] Contrato:', contrato);
  }, [token, contrato]);

  // Determinar etapa baseado no estado do contrato
  useEffect(() => {
    if (contrato) {
      if (contrato.adesao_paga) {
        setEtapa('confirmacao');
      } else if (contrato.tipo_vistoria === 'agendada' && dadosAgendamento) {
        setEtapa('pagamento');
      } else if (contrato.tipo_vistoria === 'autovistoria') {
        setEtapa('autovistoria');
      } else if (contrato.tipo_vistoria) {
        // Já escolheu tipo de vistoria
        setEtapa(contrato.tipo_vistoria === 'agendada' ? 'agendar' : 'autovistoria');
      } else {
        // Começa na escolha de vistoria (documentos já foram enviados no fluxo do vendedor)
        setEtapa('escolha');
      }
    }
  }, [contrato, dadosAgendamento]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center public-premium-bg">
        <motion.div 
          className="text-center space-y-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (error || !contrato) {
    return (
      <div className="min-h-screen flex items-center justify-center public-premium-bg p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="max-w-md w-full border-destructive/30 bg-card/80 backdrop-blur-xl">
            <CardHeader className="text-center">
              <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <CardTitle>Link Inválido</CardTitle>
              <CardDescription>
                Este link de proposta não foi encontrado ou expirou.
                Entre em contato com a associação para obter um novo link.
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
    );
  }

  const clienteNome = contrato.associados?.nome || contrato.leads?.nome || contrato.cliente_nome || 'Cliente';
  const veiculoInfo = contrato.veiculo_marca 
    ? `${contrato.veiculo_marca} ${contrato.veiculo_modelo || ''}`
    : 'Veículo não informado';
  
  // Detectar tipo de veículo
  const MARCAS_MOTOS = ['HONDA', 'YAMAHA', 'SUZUKI', 'KAWASAKI', 'BMW MOTORRAD', 'HARLEY-DAVIDSON', 'TRIUMPH', 'DUCATI', 'KTM', 'DAFRA', 'SHINERAY', 'KASINSKI'];
  const tipoVeiculo = MARCAS_MOTOS.some(marca => contrato.veiculo_marca?.toUpperCase()?.includes(marca)) ? 'moto' : 'carro';

  // Mensagem contextual
  const getReadOnlyMessage = () => {
    if (contrato?.autentique_url || contrato?.status === 'pendente_assinatura') {
      return 'Aguardando assinatura do contrato. Verifique seu email.';
    }
    if (contrato?.adesao_paga) {
      return 'Pagamento confirmado! Sua adesão está sendo processada.';
    }
    return 'Suas informações estão sendo processadas.';
  };

  return (
    <div className="min-h-screen public-premium-bg">
      {/* Header Premium */}
      <motion.header 
        className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/30"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoPratic} alt="PRATIC" className="h-8 w-auto" />
            <div className="h-6 w-px bg-border/50" />
            <div className="flex items-center gap-2 text-primary">
              <Shield className="h-5 w-5" />
              <span className="font-semibold text-sm hidden sm:inline">Proposta de Adesão</span>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
            <span className="hidden sm:inline">Olá, </span>{clienteNome.split(' ')[0]}
          </Badge>
        </div>
      </motion.header>

      {/* Barra de Veículo */}
      <motion.div 
        className="bg-muted/30 border-b border-border/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{veiculoInfo}</p>
              <div className="flex items-center gap-2">
                {contrato.veiculo_placa && (
                  <Badge variant="outline" className="font-mono text-[10px] py-0 px-1.5">
                    {contrato.veiculo_placa}
                  </Badge>
                )}
                {contrato.veiculo_ano && (
                  <span className="text-xs text-muted-foreground">{contrato.veiculo_ano}</span>
                )}
              </div>
            </div>
          </div>
          {contrato.planos?.nome && (
            <Badge className="bg-primary/10 text-primary border-0 text-xs">
              {contrato.planos.nome}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Conteúdo Principal */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Stepper Premium */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-border/30 bg-card/60 backdrop-blur-xl overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                {etapasFluxo.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = index === etapaIndex;
                  const isCompleted = index < etapaIndex;

                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <motion.div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                            isCompleted && "bg-success text-success-foreground",
                            isActive && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                            !isActive && !isCompleted && "bg-muted text-muted-foreground"
                          )}
                          animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                          transition={{ duration: 0.5, repeat: isActive ? Infinity : 0, repeatDelay: 2 }}
                        >
                          {isCompleted ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </motion.div>
                        <span className={cn(
                          "text-xs mt-2 font-medium text-center",
                          isActive && "text-primary",
                          isCompleted && "text-success",
                          !isActive && !isCompleted && "text-muted-foreground"
                        )}>
                          {step.label}
                        </span>
                      </div>
                      {index < etapasFluxo.length - 1 && (
                        <div className={cn(
                          "h-0.5 flex-1 mx-2 -mt-6 transition-colors duration-300",
                          index < etapaIndex ? "bg-success" : "bg-muted"
                        )} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Alerta de Modo Somente Leitura */}
        {isReadOnly && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Alert className="bg-primary/5 border-primary/20">
              <Lock className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary">
                <strong>Modo visualização:</strong> {getReadOnlyMessage()}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* DOCUMENTOS PENDENTES */}
        {contrato.associado_id && (
          <DocumentosPendentes 
            associadoId={contrato.associado_id} 
            readOnly={isReadOnly}
            onTodosEnviados={() => {
              console.log('[AssociadoVistoria] Todos documentos enviados');
            }}
          />
        )}

        {/* Conteúdo da Etapa com animação */}
        <motion.div
          key={etapa}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {etapa === 'escolha' && (
            <EscolhaVistoria
              contratoId={contrato.id}
              disabled={isReadOnly}
              tipoSelecionado={contrato.tipo_vistoria as 'agendada' | 'autovistoria' | null}
              onEscolher={(tipo) => {
                if (tipo === 'agendada') {
                  setEtapa('agendar');
                } else {
                  setEtapa('autovistoria');
                }
              }}
            />
          )}

          {etapa === 'agendar' && (
            <AgendarVistoria
              contratoId={contrato.id}
              associadoId={contrato.associado_id || ''}
              readOnly={isReadOnly}
              onAgendar={(data, horario, vistoriaId) => {
                setDadosAgendamento({ data, horario });
                setVistoriaId(vistoriaId);
                setEtapa('pagamento');
              }}
              onVoltar={() => setEtapa('escolha')}
            />
          )}

          {etapa === 'autovistoria' && (
            <Autovistoria
              contratoId={contrato.id}
              associadoId={contrato.associado_id || ''}
              tipoVeiculo={tipoVeiculo as 'carro' | 'moto'}
              readOnly={isReadOnly}
              onComplete={(vistoriaId) => {
                setVistoriaId(vistoriaId);
                setEtapa('pagamento');
              }}
              onVoltar={() => setEtapa('escolha')}
            />
          )}

          {etapa === 'pagamento' && (
            <PagamentoAdesao
              contratoId={contrato.id}
              valorAdesao={contrato.valor_adesao}
              clienteNome={clienteNome}
              clienteEmail={contrato.associados?.email || contrato.leads?.email || contrato.cliente_email || ''}
              clienteCpf={contrato.associados?.cpf || contrato.leads?.cpf || contrato.cliente_cpf || ''}
              onPagamentoConfirmado={() => {
                if (token && !contrato?.autentique_url) {
                  console.log('[AssociadoVistoria] Iniciando geração do link Autentique...');
                  gerarAutentique.mutate(token, {
                    onSuccess: (result) => {
                      console.log('[AssociadoVistoria] Link gerado:', result.signatureLink);
                      setLinkGeradoAntecipado(result.signatureLink);
                    },
                    onError: (err) => {
                      console.error('[AssociadoVistoria] Erro:', err);
                    },
                  });
                }
                setEtapa('confirmacao');
              }}
            />
          )}

          {etapa === 'confirmacao' && (
            <ConfirmacaoVistoria
              tipoVistoria={contrato.tipo_vistoria as 'agendada' | 'autovistoria'}
              dadosAgendamento={dadosAgendamento}
              autentiqueUrl={linkGeradoAntecipado || contrato.autentique_url}
              isAutentiqueTimeout={isAutentiqueTimeout}
              onRetryAutentique={retryAutentiquePolling}
              contratoToken={token}
              adesaoPaga={contrato.adesao_paga}
              contratoAssinado={contrato.status === 'assinado'}
              isGeneratingLink={gerarAutentique.isPending}
              autentiqueDocumentoId={contrato.autentique_documento_id}
              clienteEmail={contrato.associados?.email || contrato.leads?.email || contrato.cliente_email || ''}
              onVoltar={() => setEtapa('pagamento')}
            />
          )}
        </motion.div>

        {/* Indicador de sincronização */}
        {contrato.status !== 'assinado' && contrato.status !== 'cancelado' && contrato.status !== 'ativo' && (
          <SyncStatusIndicator />
        )}
      </main>
    </div>
  );
}

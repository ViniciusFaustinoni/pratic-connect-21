import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Car, Calendar, Camera, CheckCircle, AlertCircle, Clock, FileCheck, Search, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useContratoByToken, useGerarAutentiqueByToken } from '@/hooks/useContratoLink';
import { EscolhaVistoria } from '@/components/associado/EscolhaVistoria';
import { AgendarVistoria } from '@/components/associado/AgendarVistoria';
import { Autovistoria } from '@/components/associado/Autovistoria';
import { PagamentoAdesao } from '@/components/associado/PagamentoAdesao';
import { ConfirmacaoVistoria } from '@/components/associado/ConfirmacaoVistoria';
import { DocumentosPendentes } from '@/components/associado/DocumentosPendentes';
import { SyncStatusIndicator } from '@/components/associado/SyncStatusIndicator';

// Mapeamento de status do associado para exibição
const STATUS_ASSOCIADO_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  'em_cadastro': { label: 'Aguardando Vistoria', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  'documentacao_pendente': { label: 'Aguardando Documentos', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
  'em_analise': { label: 'Em Análise', variant: 'default', icon: <Search className="h-3 w-3" /> },
  'aprovado': { label: 'Aprovado', variant: 'outline', icon: <CheckCircle className="h-3 w-3" /> },
  'ativo': { label: 'Ativo', variant: 'outline', icon: <CheckCircle className="h-3 w-3" /> },
};

type Etapa = 'escolha' | 'agendar' | 'autovistoria' | 'pagamento' | 'confirmacao';

export default function AssociadoVistoria() {
  const { token } = useParams<{ token: string }>();
  const { data: contrato, isLoading, error, isAutentiqueTimeout, retryAutentiquePolling } = useContratoByToken(token);
  const gerarAutentique = useGerarAutentiqueByToken();
  const [etapa, setEtapa] = useState<Etapa>('escolha');
  const [vistoriaId, setVistoriaId] = useState<string | null>(null);
  const [dadosAgendamento, setDadosAgendamento] = useState<{ data: string; horario: string } | null>(null);
  const [linkGeradoAntecipado, setLinkGeradoAntecipado] = useState<string | null>(null);

  // Calcular se está em modo somente leitura (bloqueia edição)
  // IMPORTANTE: Este useMemo deve ficar ANTES de qualquer early return
  const isReadOnly = useMemo(() => {
    if (!contrato) return false;
    
    // Status do associado em análise
    if (contrato.associados?.status === 'em_analise') return true;
    
    // Contrato aguardando assinatura
    if (contrato.status === 'pendente_assinatura') return true;
    if (contrato.autentique_url) return true;
    
    // Adesão paga mas não assinado ainda (em fluxo de assinatura)
    if (contrato.adesao_paga && contrato.status !== 'assinado') return true;
    
    return false;
  }, [contrato]);

  // Debug logs para diagnosticar problemas
  useEffect(() => {
    console.log('[AssociadoVistoria] Token recebido:', token);
    console.log('[AssociadoVistoria] isLoading:', isLoading);
    console.log('[AssociadoVistoria] Contrato:', contrato);
    console.log('[AssociadoVistoria] Error:', error);
  }, [token, contrato, error, isLoading]);

  // Determinar etapa baseado no estado do contrato
  useEffect(() => {
    if (contrato) {
      if (contrato.adesao_paga) {
        setEtapa('confirmacao');
      } else if (contrato.tipo_vistoria === 'agendada' && dadosAgendamento) {
        setEtapa('pagamento');
      } else if (contrato.tipo_vistoria === 'autovistoria') {
        // Verificar se todas as fotos foram enviadas
        setEtapa('autovistoria');
      }
    }
  }, [contrato, dadosAgendamento]);

  // Early returns APÓS todos os hooks
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error || !contrato) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-destructive/5 to-destructive/10 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <CardTitle>Link Inválido</CardTitle>
            <CardDescription>
              Este link de vistoria não foi encontrado ou expirou.
              Entre em contato com a associação para obter um novo link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const clienteNome = contrato.associados?.nome || contrato.leads?.nome || contrato.cliente_nome || 'Cliente';
  const veiculoInfo = contrato.veiculo_marca 
    ? `${contrato.veiculo_marca} ${contrato.veiculo_modelo || ''} - ${contrato.veiculo_placa || ''}`
    : 'Veículo não informado';
  
  // Detectar tipo de veículo baseado na marca (heurística simples)
  const MARCAS_MOTOS = ['HONDA', 'YAMAHA', 'SUZUKI', 'KAWASAKI', 'BMW MOTORRAD', 'HARLEY-DAVIDSON', 'TRIUMPH', 'DUCATI', 'KTM', 'DAFRA', 'SHINERAY', 'KASINSKI'];
  const tipoVeiculo = MARCAS_MOTOS.some(marca => contrato.veiculo_marca?.toUpperCase()?.includes(marca)) ? 'moto' : 'carro';

  // Mensagem contextual baseada no estado
  const getReadOnlyMessage = () => {
    if (contrato?.associados?.status === 'em_analise') {
      return 'Seus dados estão em análise pela nossa equipe. Aguarde o retorno.';
    }
    if (contrato?.autentique_url || contrato?.status === 'pendente_assinatura') {
      return 'Aguardando assinatura do contrato. Verifique seu email.';
    }
    if (contrato?.adesao_paga) {
      return 'Pagamento confirmado! Sua adesão está sendo processada.';
    }
    return 'Suas informações estão sendo processadas.';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Car className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Vistoria do Veículo</h1>
          </div>
          <p className="text-muted-foreground">
            Olá, <strong>{clienteNome}</strong>!
          </p>
        </div>

        {/* Alerta de Modo Somente Leitura */}
        {isReadOnly && (
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
            <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              <strong>Modo visualização:</strong> {getReadOnlyMessage()}
            </AlertDescription>
          </Alert>
        )}

        {/* Info do Veículo */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{veiculoInfo}</p>
                <p className="text-sm text-muted-foreground">
                  Plano: {contrato.planos?.nome || 'Não informado'}
                </p>
              </div>
              {/* Status do Associado */}
              {contrato.associados?.status && STATUS_ASSOCIADO_CONFIG[contrato.associados.status] && (
                <Badge 
                  variant={STATUS_ASSOCIADO_CONFIG[contrato.associados.status].variant}
                  className="flex items-center gap-1"
                >
                  {STATUS_ASSOCIADO_CONFIG[contrato.associados.status].icon}
                  {STATUS_ASSOCIADO_CONFIG[contrato.associados.status].label}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Progresso - Etapas clicáveis */}
        <div className="flex items-center justify-center gap-2">
          {['escolha', 'vistoria', 'pagamento', 'confirmacao'].map((step, index) => {
            const isActive = 
              (step === 'escolha' && etapa === 'escolha') ||
              (step === 'vistoria' && (etapa === 'agendar' || etapa === 'autovistoria')) ||
              (step === 'pagamento' && etapa === 'pagamento') ||
              (step === 'confirmacao' && etapa === 'confirmacao');
            
            const isCompleted = 
              (step === 'escolha' && etapa !== 'escolha') ||
              (step === 'vistoria' && (etapa === 'pagamento' || etapa === 'confirmacao')) ||
              (step === 'pagamento' && etapa === 'confirmacao');

            // Permitir navegação para etapas completadas
            const handleStepClick = () => {
              if (!isCompleted) return;
              
              if (step === 'escolha') {
                setEtapa('escolha');
              } else if (step === 'vistoria') {
                // Voltar para a etapa de vistoria correta
                if (contrato?.tipo_vistoria === 'agendada') {
                  setEtapa('agendar');
                } else if (contrato?.tipo_vistoria === 'autovistoria') {
                  setEtapa('autovistoria');
                }
              } else if (step === 'pagamento') {
                setEtapa('pagamento');
              }
            };

            return (
              <div key={step} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStepClick}
                  disabled={!isCompleted}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCompleted
                      ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600'
                      : isActive
                      ? 'bg-primary text-primary-foreground cursor-default'
                      : 'bg-muted text-muted-foreground cursor-default'
                  }`}
                  title={isCompleted ? `Voltar para ${step}` : undefined}
                >
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </button>
                {index < 3 && (
                  <div className={`w-8 h-0.5 ${isCompleted ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* DOCUMENTOS PENDENTES - Mostra se houver documentos solicitados */}
        {contrato.associado_id && (
          <DocumentosPendentes 
            associadoId={contrato.associado_id} 
            readOnly={isReadOnly}
            onTodosEnviados={() => {
              // Recarregar dados do contrato
              console.log('[AssociadoVistoria] Todos documentos enviados, recarregando...');
            }}
          />
        )}

        {/* Conteúdo da Etapa */}
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
              // Iniciar geração do link imediatamente quando pagamento é confirmado
              if (token && !contrato?.autentique_url) {
                console.log('[AssociadoVistoria] Iniciando geração antecipada do link Autentique...');
                gerarAutentique.mutate(token, {
                  onSuccess: (result) => {
                    console.log('[AssociadoVistoria] Link gerado antecipadamente:', result.signatureLink);
                    setLinkGeradoAntecipado(result.signatureLink);
                  },
                  onError: (err) => {
                    console.error('[AssociadoVistoria] Erro na geração antecipada:', err);
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

        {/* Indicador de sincronização automática - só mostra se contrato não finalizado */}
        {contrato.status !== 'assinado' && contrato.status !== 'cancelado' && contrato.status !== 'ativo' && (
          <SyncStatusIndicator />
        )}
      </div>
    </div>
  );
}

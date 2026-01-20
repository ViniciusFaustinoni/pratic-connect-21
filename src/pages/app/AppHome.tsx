import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Receipt, MapPin, Phone, MessageCircle, CheckCircle, ChevronRight, Shield, AlertTriangle, Camera, Loader2 } from 'lucide-react';
import { useAssociado } from '@/contexts/AssociadoContext';
import { useResumoApp } from '@/hooks/useAppAssociado';
import { RevistoriaBanner } from '@/components/app/RevistoriaBanner';

const formatCurrency = (v: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (d: string) => 
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

export default function AppHome() {
  const { revistoria, manifestacoes } = useAssociado();
  const { associado, veiculos, boletoPendente, isLoading } = useResumoApp();
  
  // Contar manifestações com resposta não lida
  const manifestacoesNaoLidas = manifestacoes?.filter(m => m.status === 'respondido').length || 0;
  
  // Usar dados reais ou fallback
  const nomeAssociado = associado?.nome || 'Associado';
  const primeiroNome = nomeAssociado.split(' ')[0];
  const statusAssociado = associado?.status || 'em_analise';
  const plano = associado?.plano_nome || 'Sem plano';
  const desde = associado?.data_adesao?.split('-')[0] || new Date().getFullYear().toString();
  
  // Determinar estados
  const isEmAnalise = statusAssociado === 'em_analise';
  const isSuspenso = statusAssociado === 'suspenso';
  const isInadimplente = statusAssociado === 'inadimplente';
  
  // Mostrar banner de revistoria apenas a partir do 6° dia de atraso
  const mostrarBannerRevistoria = revistoria && (
    revistoria.diasAtraso >= 6 || revistoria.status === 'em_analise'
  );
  
  // Veículo desprotegido: após 1 dia de atraso na revistoria
  const veiculoDesprotegido = revistoria && revistoria.diasAtraso >= 1 && 
    revistoria.status !== 'em_analise' && revistoria.status !== 'aprovada';

  // Status final
  const isDesprotegido = veiculoDesprotegido;
  const isAtivo = !isDesprotegido && statusAssociado === 'ativo';

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-24 px-4">
      {/* SAUDAÇÃO */}
      <div className="pt-2">
        <p className="text-sm text-muted-foreground">{getGreeting()},</p>
        <h1 className="text-2xl font-bold text-foreground">{primeiroNome}! 👋</h1>
      </div>

      {/* BANNER REVISTORIA */}
      {mostrarBannerRevistoria && revistoria && (
        <RevistoriaBanner
          diasAtraso={revistoria.diasAtraso}
          status={revistoria.status}
        />
      )}

      {/* CARD DE SITUAÇÃO - EM ANÁLISE */}
      {isEmAnalise && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
              <div>
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                  Cadastro em Análise
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  Estamos analisando seus documentos. Você será notificado assim que o processo for concluído.
                </p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-3">
                  ⏱️ Tempo médio: 24 horas úteis
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CARD DE SITUAÇÃO - ATIVO/SUSPENSO/INADIMPLENTE */}
      {!isEmAnalise && (
        <Card className={isAtivo 
          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950"
          : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
        }>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isAtivo ? 'bg-green-500' : 'bg-red-500'}`}>
                  {isAtivo ? <Shield className="h-6 w-6 text-white" /> : <AlertTriangle className="h-6 w-6 text-white" />}
                </div>
                <div>
                  <p className={`text-sm ${isAtivo ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {isDesprotegido ? 'Seu veículo está' : 'Sua proteção está'}
                  </p>
                  <p className={`text-lg font-bold ${isAtivo ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {isAtivo ? 'ATIVA' : isDesprotegido ? 'DESPROTEGIDO' : isSuspenso ? 'SUSPENSA' : isInadimplente ? 'INADIMPLENTE' : 'INATIVA'}
                  </p>
                </div>
              </div>
              {isAtivo ? (
                <CheckCircle className="h-8 w-8 text-green-500" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-500" />
              )}
            </div>
            <div className={`mt-3 flex items-center gap-2 text-sm ${isAtivo ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              <span>{plano}</span>
              <span>•</span>
              <span>Desde {desde}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* BOLETO PENDENTE */}
      {boletoPendente && (
        <Link to={`/app/boletos/${boletoPendente.id}`}>
          <Card className="border-yellow-200 bg-yellow-50 transition-colors hover:bg-yellow-100 dark:border-yellow-900 dark:bg-yellow-950 dark:hover:bg-yellow-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500">
                    <Receipt className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Boleto {boletoPendente.status === 'vencido' ? 'vencido' : 'pendente'}
                    </p>
                    <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">
                      {formatCurrency(boletoPendente.valor || 0)}
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      {boletoPendente.status === 'vencido' ? 'Venceu em' : 'Vence em'} {formatDate(boletoPendente.data_vencimento)}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      {/* MEUS VEÍCULOS */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Meus Veículos</h2>
          <Badge variant="secondary">{veiculos.length} veículo(s)</Badge>
        </div>

        {veiculos.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-muted-foreground">
              Nenhum veículo cadastrado
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {veiculos.map((veiculo) => (
              <Link key={veiculo.id} to={`/app/veiculos/${veiculo.id}`}>
                <Card className="transition-colors hover:bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Car className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-foreground">{veiculo.placa}</p>
                            {veiculo.rastreador_ativo && (
                              <Badge variant="outline" className="border-green-500 text-xs text-green-600">
                                Rastreado
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {veiculo.marca} {veiculo.modelo} {veiculo.ano_modelo}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ATALHOS RÁPIDOS */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Acesso Rápido</h2>
        <div className="grid grid-cols-3 gap-3">
          <Link to="/app/boletos" className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <Receipt className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-medium text-foreground">Boletos</span>
          </Link>

          <Link to="/app/rastreamento" className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <MapPin className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs font-medium text-foreground">Rastrear</span>
          </Link>

          <Link to="/app/revistoria" className="relative flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
              <Camera className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs font-medium text-foreground">Revistoria</span>
            {revistoria && revistoria.diasAtraso >= 6 && revistoria.status !== 'em_analise' && revistoria.status !== 'aprovada' && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                !
              </span>
            )}
          </Link>

          <Link to="/app/assistencia" className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900">
              <Phone className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-xs font-medium text-foreground">Ajuda 24h</span>
          </Link>

          <Link to="/app/sinistros" className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs font-medium text-foreground">Sinistros</span>
          </Link>

          <Link to="/app/ouvidoria" className="relative flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-900">
              <MessageCircle className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <span className="text-xs font-medium text-foreground">Ouvidoria</span>
            {manifestacoesNaoLidas > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {manifestacoesNaoLidas}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* BOTÃO EMERGÊNCIA */}
      <div className="mt-2">
        <Link to="/app/assistencia/nova">
          <Button 
            size="lg" 
            className="w-full bg-destructive py-6 text-destructive-foreground hover:bg-destructive/90"
          >
            <Phone className="mr-2 h-5 w-5" />
            Solicitar Assistência 24h
          </Button>
        </Link>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Guincho, pane seca, chaveiro, bateria
        </p>
      </div>
    </div>
  );
}

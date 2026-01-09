import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Receipt, MapPin, Phone, MessageCircle, CheckCircle, ChevronRight, Shield, AlertTriangle, Camera } from 'lucide-react';
import { useAssociado } from '@/contexts/AssociadoContext';
import { RevistoriaBanner } from '@/components/app/RevistoriaBanner';

// MOCK DATA
const MOCK_ASSOCIADO = {
  nome: 'João Silva',
  plano: 'Plano Completo',
  status: 'ativo' as const,
  desde: '2024',
};

const MOCK_VEICULOS = [
  { id: '1', placa: 'ABC-1234', modelo: 'VW Gol 2020', cor: 'Prata', status: 'ativo', temRastreador: true },
  { id: '2', placa: 'DEF-5678', modelo: 'Hyundai HB20 2022', cor: 'Branco', status: 'ativo', temRastreador: true },
];

const MOCK_BOLETO = {
  id: '1',
  referencia: 'Fevereiro/2026',
  valor: 249.90,
  vencimento: '2026-02-15',
  status: 'pendente' as const,
};

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
  const { associado, isTestMode, revistoria, manifestacoes } = useAssociado();
  
  // Contar manifestações com resposta não lida
  const manifestacoesNaoLidas = manifestacoes?.filter(m => m.status === 'respondido').length || 0;
  
  // Usar dados do contexto de teste ou mock
  const nomeAssociado = isTestMode && associado ? associado.nome : MOCK_ASSOCIADO.nome;
  const primeiroNome = nomeAssociado.split(' ')[0];
  
  // Mostrar banner de revistoria apenas a partir do 6° dia de atraso
  const mostrarBannerRevistoria = revistoria && (
    revistoria.diasAtraso >= 6 || revistoria.status === 'em_analise'
  );
  
  // Veículo desprotegido: após 1 dia de atraso na revistoria
  const veiculoDesprotegido = revistoria && revistoria.diasAtraso >= 1 && 
    revistoria.status !== 'em_analise' && revistoria.status !== 'aprovada';

  return (
    <div className="flex flex-col gap-6 pb-24">
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

      {/* CARD DE SITUAÇÃO */}
      {(() => {
        const statusAssociado = isTestMode && associado ? associado.status : MOCK_ASSOCIADO.status;
        const plano = isTestMode && associado ? associado.plano : MOCK_ASSOCIADO.plano;
        const desde = isTestMode && associado ? associado.associadoDesde?.split('-')[0] : MOCK_ASSOCIADO.desde;
        
        // Veículo desprotegido sobrepõe o status ativo
        const isDesprotegido = veiculoDesprotegido;
        const isAtivo = !isDesprotegido && statusAssociado === 'ativo';
        const isSuspenso = statusAssociado === 'suspenso';
        
        return (
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
                      {isAtivo ? 'ATIVA' : isDesprotegido ? 'DESPROTEGIDO' : isSuspenso ? 'SUSPENSA' : 'INATIVA'}
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
        );
      })()}

      {/* BOLETO PENDENTE */}
      {MOCK_BOLETO && (
        <Link to={`/app/boletos/${MOCK_BOLETO.id}`}>
          <Card className="border-yellow-200 bg-yellow-50 transition-colors hover:bg-yellow-100 dark:border-yellow-900 dark:bg-yellow-950 dark:hover:bg-yellow-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500">
                    <Receipt className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Boleto pendente</p>
                    <p className="text-lg font-bold text-yellow-900 dark:text-yellow-100">{formatCurrency(MOCK_BOLETO.valor)}</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">Vence em {formatDate(MOCK_BOLETO.vencimento)}</p>
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
          <Badge variant="secondary">{MOCK_VEICULOS.length} veículo(s)</Badge>
        </div>

        <div className="flex flex-col gap-2">
          {MOCK_VEICULOS.map((veiculo) => (
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
                          {veiculo.temRastreador && (
                            <Badge variant="outline" className="border-green-500 text-xs text-green-600">
                              Rastreado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{veiculo.modelo}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* ATALHOS RÁPIDOS */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Acesso Rápido</h2>
        <div className="grid grid-cols-3 gap-3">
          <Link to="/app/boletos" className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Receipt className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-foreground">Boletos</span>
          </Link>

          <Link to="/app/rastreamento" className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <MapPin className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-foreground">Rastrear</span>
          </Link>

          <Link to="/app/revistoria" className="relative flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <Camera className="h-6 w-6 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-foreground">Revistoria</span>
            {revistoria && revistoria.diasAtraso >= 6 && revistoria.status !== 'em_analise' && revistoria.status !== 'aprovada' && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                !
              </span>
            )}
          </Link>

          <Link to="/app/assistencia" className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              <Phone className="h-6 w-6 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-foreground">Ajuda 24h</span>
          </Link>

          <Link to="/app/sinistros" className="flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <span className="text-xs font-medium text-foreground">Sinistros</span>
          </Link>

          <Link to="/app/ouvidoria" className="relative flex flex-col items-center gap-2 rounded-xl bg-muted/50 p-4 transition-colors hover:bg-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100">
              <MessageCircle className="h-6 w-6 text-cyan-600" />
            </div>
            <span className="text-xs font-medium text-foreground">Ouvidoria</span>
            {manifestacoesNaoLidas > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
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
            className="w-full bg-red-600 py-6 text-white hover:bg-red-700"
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

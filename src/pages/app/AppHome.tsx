import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Receipt, MapPin, Phone, AlertTriangle, FileText, Loader2, Lock, ShieldCheck, ShieldOff, Ban } from 'lucide-react';
import { useAssociado } from '@/contexts/AssociadoContext';
import { useResumoApp } from '@/hooks/useAppAssociado';
import { useMinhasCoberturas } from '@/hooks/useMinhasCoberturasApp';
import { RevistoriaBanner } from '@/components/app/RevistoriaBanner';
import { AlertaCotacaoCancelada } from '@/components/app/AlertaCotacaoCancelada';
import { useCotacaoCanceladaPorPagamento } from '@/hooks/useCotacaoCancelada';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ============================================
// HELPERS
// ============================================
const formatCurrency = (v: number) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (d: string) => 
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

const formatRelativeTime = (dateStr?: string) => {
  if (!dateStr) return 'Nunca';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  
  if (diffMin < 1) return 'Agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  return `há ${Math.floor(diffHours / 24)} dias`;
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    ativo: 'Ativo',
    suspenso: 'Suspenso',
    em_analise: 'Em Análise',
    bloqueado: 'Bloqueado',
    cancelado: 'Cancelado',
    inadimplente: 'Inadimplente',
  };
  return labels[status] || status;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    ativo: 'bg-green-100 text-green-800',
    suspenso: 'bg-red-100 text-red-800',
    em_analise: 'bg-yellow-100 text-yellow-800',
    bloqueado: 'bg-gray-100 text-gray-800',
    inadimplente: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

// ============================================
// COMPONENT
// ============================================
export default function AppHome() {
  const navigate = useNavigate();
  const { revistoria } = useAssociado();
  const { associado, veiculos, boletoPendente, isLoading } = useResumoApp();
  const { temCoberturaTotal, podeAssistencia, mensagemCoberturaParcial, coberturasPorVeiculo, beneficiosAdicionaisSuspensos } = useMinhasCoberturas();
  
  // Verificar se há cotação cancelada por falta de pagamento
  const { data: cotacaoCancelada } = useCotacaoCanceladaPorPagamento(associado?.id);
  
  // Dados do associado
  const nomeAssociado = associado?.nome || 'Associado';
  const primeiroNome = nomeAssociado.split(' ')[0];
  const statusAssociado = associado?.status || 'em_analise';
  
  // Veículo principal
  const veiculoPrincipal = veiculos.length > 0 ? veiculos[0] : null;
  
  // Mostrar banner de revistoria apenas a partir do 6° dia de atraso
  const mostrarBannerRevistoria = revistoria && (
    revistoria.diasAtraso >= 6 || revistoria.status === 'em_analise'
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* ALERTA DE COTAÇÃO CANCELADA POR FALTA DE PAGAMENTO */}
      {cotacaoCancelada && (
        <AlertaCotacaoCancelada
          motivo={cotacaoCancelada.motivo_cancelamento || undefined}
          data={cotacaoCancelada.cancelada_em || undefined}
          variante="banner"
        />
      )}

      {/* SAUDAÇÃO */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Olá, {primeiroNome}!
        </h1>
        <p className="text-sm text-gray-500">Bem-vindo de volta</p>
      </div>

      {/* BANNER REVISTORIA */}
      {mostrarBannerRevistoria && revistoria && (
        <RevistoriaBanner
          diasAtraso={revistoria.diasAtraso}
          status={revistoria.status}
        />
      )}

      {/* CARDS DOS VEÍCULOS COM STATUS INDIVIDUAL */}
      {veiculos.length > 0 && veiculos.map((veiculo) => {
        const cobertura = coberturasPorVeiculo.find(c => c.veiculoId === veiculo.id);
        const isInadimplente = cobertura?.inadimplente || false;
        return (
          <Card key={veiculo.id} className="bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isInadimplente ? 'bg-red-100' : 'bg-blue-100'}`}>
                  <Car className={`h-6 w-6 ${isInadimplente ? 'text-red-600' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-lg font-bold text-gray-900">
                    {veiculo.placa}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {veiculo.marca} {veiculo.modelo}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={getStatusColor(statusAssociado)}>
                    {getStatusLabel(statusAssociado)}
                  </Badge>
                  {isInadimplente ? (
                    <Badge variant="destructive" className="text-[10px]">
                      <ShieldOff className="h-2.5 w-2.5 mr-1" /> Cobertura Suspensa
                    </Badge>
                  ) : veiculo.status === 'ativo' ? (
                    <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">
                      <ShieldCheck className="h-2.5 w-2.5 mr-1" /> Protegido
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* ALERTA BENEFÍCIOS ADICIONAIS SUSPENSOS */}
      {beneficiosAdicionaisSuspensos && (
        <Alert className="border-amber-200 bg-amber-50">
          <Ban className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            <strong>Benefícios adicionais suspensos</strong> — Há inadimplência em um dos veículos. 
            Benefícios como proteção de vidros, danos a terceiros e carro reserva ficam suspensos 
            em todos os veículos até que todos estejam em dia.
          </AlertDescription>
        </Alert>
      )}

      {/* CARD PRÓXIMO BOLETO */}
      {boletoPendente && (
        <Card className="bg-white shadow-sm border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* Ícone documento */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
                <FileText className="h-5 w-5 text-yellow-600" />
              </div>
              
              <div className="flex-1">
                <p className="text-sm text-gray-500">Próximo vencimento</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatDate(boletoPendente.data_vencimento)}
                </p>
                <p className="text-xl font-bold text-blue-600 mt-1">
                  {formatCurrency(boletoPendente.valor || 0)}
                </p>
              </div>
            </div>
            
            {/* Botão Pagar agora */}
            <Button 
              variant="outline" 
              className="w-full mt-4 border-blue-600 text-blue-600 hover:bg-blue-50"
              onClick={() => navigate(`/app/boletos/${boletoPendente.id}`)}
            >
              Pagar agora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* CARD RASTREAMENTO RÁPIDO - Só mostra se tiver cobertura total */}
      {temCoberturaTotal && veiculoPrincipal?.rastreador_ativo && (
        <Card className="bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              {/* Ícone localização */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <MapPin className="h-5 w-5 text-green-600" />
              </div>
              
              <div className="flex-1">
                <p className="text-sm text-gray-500">Última posição</p>
                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                  Localização disponível no mapa
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Atualizado {formatRelativeTime(new Date().toISOString())}
                </p>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => navigate('/app/rastreamento')}
            >
              Ver no mapa
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ALERTA COBERTURA PARCIAL */}
      {mensagemCoberturaParcial && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertDescription className="text-blue-800 text-sm">
            {mensagemCoberturaParcial}
          </AlertDescription>
        </Alert>
      )}

      {/* GRID DE ATALHOS RÁPIDOS 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {/* Assistência 24h - Desabilitado se não tiver cobertura total */}
        {podeAssistencia ? (
          <Link to="/app/assistencia">
            <Card className="bg-white shadow-sm hover:bg-gray-50 transition-colors">
              <CardContent className="p-4 flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-orange-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">Assistência 24h</span>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="bg-gray-100 opacity-70 cursor-not-allowed">
            <CardContent className="p-4 flex flex-col items-center gap-2 relative">
              <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                <Phone className="h-6 w-6 text-gray-400" />
              </div>
              <span className="text-sm font-medium text-gray-400">Assistência 24h</span>
              <Badge variant="outline" className="text-[10px] mt-1 border-gray-300 text-gray-500">
                <Lock className="h-2.5 w-2.5 mr-1" />
                Requer instalação
              </Badge>
            </CardContent>
          </Card>
        )}
        
        {/* Abrir Sinistro */}
        <Link to="/app/sinistros/novo">
          <Card className="bg-white shadow-sm hover:bg-gray-50 transition-colors">
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Abrir Sinistro</span>
            </CardContent>
          </Card>
        </Link>
        
        {/* Meus Boletos */}
        <Link to="/app/boletos">
          <Card className="bg-white shadow-sm hover:bg-gray-50 transition-colors">
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Meus Boletos</span>
            </CardContent>
          </Card>
        </Link>
        
        {/* Documentos */}
        <Link to="/app/documentos">
          <Card className="bg-white shadow-sm hover:bg-gray-50 transition-colors">
            <CardContent className="p-4 flex flex-col items-center gap-2">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Documentos</span>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

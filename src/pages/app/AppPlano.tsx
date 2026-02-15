import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  Phone, 
  MapPin, 
  Wrench, 
  Car,
  Fuel,
  Key,
  AlertTriangle,
  Flame,
  Droplets,
  Check,
  ChevronLeft,
  Crown,
  Calendar,
  Receipt,
  CheckCircle,
  Clock,
  HelpCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMyAssociado } from '@/hooks/useMyData';
import { useConfig0800 } from '@/hooks/useConfig0800';
import { LucideIcon } from 'lucide-react';

interface BeneficioExpandido {
  icone: LucideIcon;
  titulo: string;
  descricao: string;
  detalhes?: string;
}

const BENEFICIOS_POR_TIPO: Record<string, BeneficioExpandido[]> = {
  passeio: [
    { 
      icone: Shield, 
      titulo: 'Proteção 24h', 
      descricao: 'Monitoramento contínuo do seu veículo em todo território nacional',
      detalhes: 'Central de monitoramento ativa 24 horas por dia'
    },
    { 
      icone: Phone, 
      titulo: 'Central de atendimento', 
      descricao: 'Suporte 24h para emergências e dúvidas',
      detalhes: '0800 980 0001'
    },
    { 
      icone: MapPin, 
      titulo: 'Rastreamento em tempo real', 
      descricao: 'Acompanhe a localização do seu veículo pelo aplicativo'
    },
    { 
      icone: Wrench, 
      titulo: 'Assistência mecânica', 
      descricao: 'Guincho, pane seca, troca de pneu e chaveiro'
    },
    { 
      icone: Car, 
      titulo: 'Carro reserva', 
      descricao: 'Veículo reserva por até 7 dias em caso de sinistro aprovado'
    },
  ],
  trabalho: [
    { 
      icone: Shield, 
      titulo: 'Proteção 24h', 
      descricao: 'Monitoramento contínuo do seu veículo em todo território nacional',
      detalhes: 'Central de monitoramento ativa 24 horas por dia'
    },
    { 
      icone: Phone, 
      titulo: 'Central prioritária', 
      descricao: 'Atendimento prioritário 24h para motoristas de app',
      detalhes: '0800 980 0001'
    },
    { 
      icone: MapPin, 
      titulo: 'Rastreamento em tempo real', 
      descricao: 'Acompanhe a localização do seu veículo pelo aplicativo'
    },
    { 
      icone: Wrench, 
      titulo: 'Assistência mecânica ilimitada', 
      descricao: 'Guincho, pane seca, troca de pneu e chaveiro sem limite de uso'
    },
    { 
      icone: Car, 
      titulo: 'Carro reserva', 
      descricao: 'Veículo reserva por até 15 dias em caso de sinistro aprovado'
    },
    { 
      icone: Fuel, 
      titulo: 'Pane seca', 
      descricao: 'Fornecimento de até 10 litros de combustível'
    },
    { 
      icone: Key, 
      titulo: 'Chaveiro 24h', 
      descricao: 'Serviço de chaveiro para abertura e troca de fechadura'
    },
  ],
};

const COBERTURAS = [
  { icone: AlertTriangle, titulo: 'Roubo e Furto', descricao: '100% da tabela FIPE' },
  { icone: Flame, titulo: 'Incêndio', descricao: '100% da tabela FIPE' },
  { icone: Droplets, titulo: 'Alagamento', descricao: '100% da tabela FIPE' },
  { icone: Car, titulo: 'Perda Total', descricao: '100% da tabela FIPE' },
];

const CORES_POR_TIPO: Record<string, { bg: string; badge: string }> = {
  passeio: { bg: 'bg-blue-50 dark:bg-blue-950/30', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  trabalho: { bg: 'bg-purple-50 dark:bg-purple-950/30', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
};

// Mock de histórico de pagamentos
const mockHistoricoPagamentos = [
  { id: '1', referencia: 'Dezembro/2025', valor: 189.90, status: 'pago', dataPagamento: '2025-12-05' },
  { id: '2', referencia: 'Novembro/2025', valor: 189.90, status: 'pago', dataPagamento: '2025-11-05' },
  { id: '3', referencia: 'Outubro/2025', valor: 189.90, status: 'pago', dataPagamento: '2025-10-05' },
];

export default function AppPlano() {
  const navigate = useNavigate();
  const { data: associado, isLoading } = useMyAssociado();
  const { telefone0800, telefone0800Link } = useConfig0800();

  const plano = associado?.planos;
  const contrato = associado?.contratos?.find(c => c.status === 'ativo') || associado?.contratos?.[0];
  const tipoUso = plano?.tipo_uso?.toLowerCase() || 'passeio';
  const beneficios = BENEFICIOS_POR_TIPO[tipoUso] || BENEFICIOS_POR_TIPO.passeio;
  const cores = CORES_POR_TIPO[tipoUso] || CORES_POR_TIPO.passeio;

  const formatDataAdesao = () => {
    if (!associado?.data_adesao) return null;
    try {
      return format(new Date(associado.data_adesao), "MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return null;
    }
  };

  if (isLoading) {
    return <PlanoLoading />;
  }

  if (!plano) {
    return (
      <div className="flex flex-col gap-4 p-4 pb-24">
        <Button 
          variant="ghost" 
          size="sm" 
          className="self-start -ml-2"
          onClick={() => navigate('/app/home')}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>

        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Crown className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Nenhum plano ativo
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Entre em contato conosco para conhecer nossos planos de proteção.
            </p>
            <Button onClick={() => window.open(`tel:${telefone0800Link}`)}>
              <Phone className="h-4 w-4 mr-2" />
              Ligar Agora
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Header */}
      <Button 
        variant="ghost" 
        size="sm" 
        className="self-start -ml-2"
        onClick={() => navigate('/app/home')}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Voltar
      </Button>

      {/* Resumo do Plano */}
      <Card className={`border-0 shadow-sm overflow-hidden`}>
        <CardHeader className={`${cores.bg} pb-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-white/80 dark:bg-black/20`}>
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{plano.nome}</CardTitle>
                  <Badge className={cores.badge} variant="secondary">
                    {tipoUso.charAt(0).toUpperCase() + tipoUso.slice(1)}
                  </Badge>
                </div>
                {contrato?.numero && (
                  <p className="text-sm text-muted-foreground">
                    Contrato #{contrato.numero}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {formatDataAdesao() && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Associado desde {formatDataAdesao()}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo Financeiro */}
      {contrato && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Resumo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Mensalidade</span>
              <span className="text-lg font-bold text-foreground">
                {contrato.valor_mensal?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            {contrato.dia_vencimento && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Vencimento</span>
                <span className="text-sm font-medium text-foreground">
                  Todo dia {contrato.dia_vencimento}
                </span>
              </div>
            )}
            <Separator />
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/app/boletos')}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Ver Boletos
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Benefícios Inclusos */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Check className="h-4 w-4" />
            Benefícios Inclusos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {beneficios.map((beneficio, index) => {
            const Icone = beneficio.icone;
            return (
              <div key={index} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <Icone className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{beneficio.titulo}</p>
                  <p className="text-sm text-muted-foreground">{beneficio.descricao}</p>
                  {beneficio.detalhes && (
                    <p className="text-xs text-primary mt-1">
                      {beneficio.detalhes === '0800 980 0001' ? telefone0800 : beneficio.detalhes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Coberturas */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Coberturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {COBERTURAS.map((cobertura, index) => {
              const Icone = cobertura.icone;
              return (
                <div 
                  key={index}
                  className="flex flex-col items-center gap-2 rounded-xl bg-muted p-4 text-center"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Icone className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{cobertura.titulo}</p>
                  <p className="text-xs text-muted-foreground">{cobertura.descricao}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Pagamentos */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Histórico de Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {mockHistoricoPagamentos.map((pagamento, index) => (
            <div key={pagamento.id}>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {pagamento.referencia}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pagamento.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div className="text-right">
                    <p className="text-xs font-medium text-green-600">Pago</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(pagamento.dataPagamento), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>
              </div>
              {index < mockHistoricoPagamentos.length - 1 && <Separator />}
            </div>
          ))}
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => navigate('/app/boletos')}
          >
            Ver todos os boletos
          </Button>
        </CardContent>
      </Card>

      {/* Precisa de Ajuda */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Precisa de Ajuda?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Fale Conosco</p>
              <p className="text-sm text-muted-foreground">{telefone0800}</p>
            </div>
          </div>
          <Button 
            className="w-full"
            onClick={() => window.open(`tel:${telefone0800Link}`)}
          >
            <Phone className="h-4 w-4 mr-2" />
            Ligar Agora
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanoLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <Skeleton className="h-8 w-24" />
      
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

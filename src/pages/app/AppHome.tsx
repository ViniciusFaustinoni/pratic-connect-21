import { useNavigate } from 'react-router-dom';
import { 
  Car, 
  MapPin, 
  FileText, 
  LifeBuoy, 
  AlertTriangle,
  ChevronRight,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
  Shield
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useMyAssociado, 
  useMyVehicles, 
  useMyVehicleWithTracker,
  useMyPendingDocuments 
} from '@/hooks/useMyData';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Configuração de status do veículo
const statusVeiculoConfig: Record<string, { label: string; cor: string; icone: typeof CheckCircle }> = {
  ativo: { label: 'Protegido', cor: 'bg-green-100 text-green-800', icone: CheckCircle },
  em_analise: { label: 'Em análise', cor: 'bg-yellow-100 text-yellow-800', icone: Clock },
  aprovado: { label: 'Aprovado', cor: 'bg-blue-100 text-blue-800', icone: CheckCircle },
  instalacao_pendente: { label: 'Aguardando instalação', cor: 'bg-orange-100 text-orange-800', icone: Clock },
  suspenso: { label: 'Suspenso', cor: 'bg-yellow-100 text-yellow-800', icone: Clock },
  cancelado: { label: 'Cancelado', cor: 'bg-red-100 text-red-800', icone: XCircle },
  bloqueado: { label: 'Bloqueado', cor: 'bg-red-100 text-red-800', icone: XCircle },
  sinistrado: { label: 'Sinistrado', cor: 'bg-red-100 text-red-800', icone: AlertTriangle },
};

// Mock de boleto (tabela não existe ainda)
const mockBoleto = {
  id: '1',
  competencia: 'Janeiro/2026',
  vencimento: '10/01/2026',
  valor: 189.90,
  status: 'pendente' as const,
  pixCopiaCola: '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000'
};

export default function AppHome() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: associado, isLoading: loadingAssociado } = useMyAssociado();
  const { data: veiculos, isLoading: loadingVeiculos } = useMyVehicles();
  const { data: rastreador, isLoading: loadingRastreador } = useMyVehicleWithTracker();
  const { data: docsPendentes, isLoading: loadingDocs } = useMyPendingDocuments();

  const veiculo = veiculos?.[0];
  const isLoading = loadingAssociado || loadingVeiculos;

  const getPrimeiroNome = (nome: string) => nome.split(' ')[0];

  const getStatusVeiculo = (status: string | null) => {
    return statusVeiculoConfig[status || 'ativo'] || statusVeiculoConfig.ativo;
  };

  const copiarPix = async () => {
    try {
      await navigator.clipboard.writeText(mockBoleto.pixCopiaCola);
      toast.success('Código Pix copiado!');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const formatarUltimaComunicacao = (data: string | null) => {
    if (!data) return null;
    try {
      const date = new Date(data);
      return formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
    } catch {
      return null;
    }
  };

  // Montar alertas
  const alertas: Array<{
    id: string;
    tipo: 'documento' | 'boleto';
    titulo: string;
    descricao: string;
    rota: string;
  }> = [];

  if (docsPendentes && docsPendentes.length > 0) {
    alertas.push({
      id: 'docs',
      tipo: 'documento',
      titulo: 'Documentos pendentes',
      descricao: `${docsPendentes.length} documento(s) precisam de atenção`,
      rota: '/app/documentos'
    });
  }

  if (isLoading) {
    return <HomeLoading />;
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Saudação */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {profile?.nome ? getPrimeiroNome(profile.nome) : 'Associado'}! 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Plano: {associado?.planos?.nome || 'Carregando...'}
        </p>
      </div>

      {/* Card do Veículo */}
      {veiculo && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            {/* Header do card */}
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Car className="h-4 w-4" />
              <span className="text-sm font-medium">Seu Veículo</span>
            </div>
            
            {/* Conteúdo */}
            <div className="space-y-3">
              {/* Placa e Modelo */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xl font-bold text-foreground">{veiculo.placa}</p>
                  <p className="text-sm text-muted-foreground">
                    {veiculo.marca} {veiculo.modelo} {veiculo.ano_modelo}
                  </p>
                </div>
                {(() => {
                  const status = getStatusVeiculo(veiculo.status);
                  const StatusIcon = status.icone;
                  return (
                    <Badge className={`${status.cor} gap-1`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  );
                })()}
              </div>

              {/* Última posição */}
              {!loadingRastreador && rastreador?.ultima_comunicacao && (
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        Última atualização {formatarUltimaComunicacao(rastreador.ultima_comunicacao) || ''}
                      </p>
                      {rastreador.ultima_posicao_lat && rastreador.ultima_posicao_lng && (
                        <p className="text-sm text-foreground">
                          {rastreador.ultima_posicao_lat.toFixed(4)}, {rastreador.ultima_posicao_lng.toFixed(4)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Botão ver no mapa */}
              <Button 
                variant="outline" 
                className="w-full justify-between"
                onClick={() => navigate('/app/rastreamento')}
              >
                Ver no mapa
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sem veículo */}
      {!veiculo && !loadingVeiculos && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Car className="h-5 w-5" />
              <p className="text-sm">Nenhum veículo cadastrado</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card do Próximo Boleto */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Próximo Boleto</span>
          </div>

          {/* Conteúdo */}
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">{mockBoleto.competencia}</p>
                <p className="text-sm text-muted-foreground">
                  Vence em {mockBoleto.vencimento}
                </p>
              </div>
              <p className="text-2xl font-bold text-foreground">
                R$ {mockBoleto.valor.toFixed(2).replace('.', ',')}
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" onClick={copiarPix}>
                <Copy className="h-4 w-4" />
                Copiar Pix
              </Button>
              <Button 
                variant="default" 
                className="flex-1 gap-2"
                onClick={() => navigate('/app/boletos')}
              >
                <FileText className="h-4 w-4" />
                Ver Boleto
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Acesso Rápido */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Acesso Rápido
        </h2>
        <div className="grid grid-cols-4 gap-3">
          <QuickAccessButton
            icon={LifeBuoy}
            label="Assistência"
            onClick={() => navigate('/app/assistencia')}
            color="text-red-600"
            bgColor="bg-red-50"
          />
          <QuickAccessButton
            icon={FileText}
            label="Boletos"
            onClick={() => navigate('/app/boletos')}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
          <QuickAccessButton
            icon={MapPin}
            label="Mapa"
            onClick={() => navigate('/app/rastreamento')}
            color="text-green-600"
            bgColor="bg-green-50"
          />
          <QuickAccessButton
            icon={AlertTriangle}
            label="Sinistros"
            onClick={() => navigate('/app/sinistros')}
            color="text-orange-600"
            bgColor="bg-orange-50"
          />
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas
          </h2>
          <div className="space-y-2">
            {alertas.map(alerta => (
              <Alert 
                key={alerta.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(alerta.rota)}
              >
                <FileText className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    <span className="font-medium">{alerta.titulo}</span>
                    {' — '}
                    {alerta.descricao}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </div>
      )}

      {/* Tudo em dia */}
      {alertas.length === 0 && !loadingDocs && (
        <Card className="border-0 shadow-sm bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 p-2">
                <Shield className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-800">Tudo em dia!</p>
                <p className="text-sm text-green-600">
                  Você não possui pendências.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Componente de botão de acesso rápido
function QuickAccessButton({ 
  icon: Icon, 
  label, 
  onClick,
  color,
  bgColor
}: { 
  icon: typeof Car;
  label: string;
  onClick: () => void;
  color: string;
  bgColor: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:bg-muted/50 transition-colors"
    >
      <div className={`rounded-full p-2.5 ${bgColor}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </button>
  );
}

// Loading state
function HomeLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      {/* Saudação */}
      <div className="space-y-1">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Card veículo */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-5 w-28" />
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      {/* Card boleto */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-5 w-28" />
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </CardContent>
      </Card>

      {/* Acesso rápido */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

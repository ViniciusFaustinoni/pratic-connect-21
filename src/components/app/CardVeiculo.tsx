import { useNavigate } from 'react-router-dom';
import { 
  Car, 
  MapPin, 
  ChevronRight,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VeiculoData {
  id: string;
  placa: string;
  marca?: string;
  modelo: string;
  ano_modelo: number;
  cor?: string;
  status: string | null;
}

interface RastreadorData {
  ultima_comunicacao?: string | null;
  ultima_posicao_lat?: number | null;
  ultima_posicao_lng?: number | null;
}

interface CardVeiculoProps {
  veiculo: VeiculoData;
  rastreador?: RastreadorData | null;
  compacto?: boolean;
  mostrarMapa?: boolean;
  onClick?: () => void;
}

const statusConfig: Record<string, { 
  label: string; 
  cor: string; 
  icone: typeof CheckCircle;
  headerBg?: string;
}> = {
  ativo: { 
    label: 'Protegido', 
    cor: 'bg-green-100 text-green-800 border-green-200', 
    icone: CheckCircle,
    headerBg: 'bg-green-50'
  },
  em_analise: { 
    label: 'Em Análise', 
    cor: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    icone: Clock,
    headerBg: 'bg-yellow-50'
  },
  aprovado: { 
    label: 'Aprovado', 
    cor: 'bg-blue-100 text-blue-800 border-blue-200', 
    icone: CheckCircle,
    headerBg: 'bg-blue-50'
  },
  instalacao_pendente: { 
    label: 'Aguardando Instalação', 
    cor: 'bg-orange-100 text-orange-800 border-orange-200', 
    icone: Clock,
    headerBg: 'bg-orange-50'
  },
  suspenso: { 
    label: 'Suspenso', 
    cor: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    icone: AlertTriangle,
    headerBg: 'bg-yellow-50'
  },
  cancelado: { 
    label: 'Cancelado', 
    cor: 'bg-red-100 text-red-800 border-red-200', 
    icone: XCircle,
    headerBg: 'bg-red-50'
  },
  bloqueado: { 
    label: 'Bloqueado', 
    cor: 'bg-red-100 text-red-800 border-red-200', 
    icone: XCircle,
    headerBg: 'bg-red-50'
  },
  sinistrado: { 
    label: 'Sinistrado', 
    cor: 'bg-red-100 text-red-800 border-red-200', 
    icone: AlertTriangle,
    headerBg: 'bg-red-50'
  },
};

export function CardVeiculo({ 
  veiculo, 
  rastreador,
  compacto = false,
  mostrarMapa = true,
  onClick
}: CardVeiculoProps) {
  const navigate = useNavigate();
  const config = statusConfig[veiculo.status || 'ativo'] || statusConfig.ativo;
  const StatusIcon = config.icone;

  const formatarUltimaComunicacao = (data: string | null | undefined) => {
    if (!data) return null;
    try {
      const date = new Date(data);
      return formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
    } catch {
      return null;
    }
  };

  const isOnline = rastreador?.ultima_comunicacao 
    ? (Date.now() - new Date(rastreador.ultima_comunicacao).getTime()) < 1000 * 60 * 30 // 30 min
    : false;

  // Versão compacta (para listas)
  if (compacto) {
    return (
      <Card 
        className="border-0 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onClick}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-muted p-2">
                <Car className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{veiculo.placa}</p>
                <p className="text-xs text-muted-foreground">
                  {veiculo.marca} {veiculo.modelo} {veiculo.ano_modelo}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${config.cor} gap-1`}>
                <StatusIcon className="h-3 w-3" />
                {config.label}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Versão completa (para Home)
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        {/* Header do card */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Car className="h-4 w-4" />
            <span className="text-sm font-medium">Seu Veículo</span>
          </div>
          {rastreador?.ultima_comunicacao && (
            <div className={`flex items-center gap-1 text-xs ${isOnline ? 'text-green-600' : 'text-muted-foreground'}`}>
              {isOnline ? (
                <>
                  <Wifi className="h-3 w-3" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Offline
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Conteúdo */}
        <div className="space-y-3">
          {/* Placa e Modelo */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xl font-bold text-foreground">{veiculo.placa}</p>
              <p className="text-sm text-muted-foreground">
                {veiculo.marca} {veiculo.modelo} {veiculo.ano_modelo}
                {veiculo.cor && ` • ${veiculo.cor}`}
              </p>
            </div>
            <Badge className={`${config.cor} gap-1`}>
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </Badge>
          </div>

          {/* Última posição */}
          {rastreador?.ultima_comunicacao && veiculo.status === 'ativo' && (
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

          {/* Mensagem para status especiais */}
          {veiculo.status === 'instalacao_pendente' && (
            <p className="text-sm text-orange-600 bg-orange-50 p-2 rounded-lg">
              Aguardando agendamento da instalação do rastreador.
            </p>
          )}

          {veiculo.status === 'em_analise' && (
            <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg">
              Documentação em análise. Você será notificado em breve.
            </p>
          )}

          {veiculo.status === 'bloqueado' && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
              Veículo bloqueado. Entre em contato para regularizar.
            </p>
          )}

          {/* Botão ver no mapa */}
          {mostrarMapa && (
            <Button 
              variant="outline" 
              className="w-full justify-between"
              onClick={() => navigate('/app/rastreamento')}
            >
              Ver no mapa
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default CardVeiculo;

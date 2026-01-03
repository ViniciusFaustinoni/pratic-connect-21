import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Copy, 
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Clock,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface BoletoData {
  id: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado';
  pixCopiaCola?: string;
  diasParaVencer?: number;
}

interface CardBoletoProps {
  boleto: BoletoData;
  compacto?: boolean;
  mostrarAcoes?: boolean;
  onClick?: () => void;
}

const statusConfig = {
  pendente: {
    label: 'Pendente',
    cor: 'bg-yellow-100 text-yellow-800',
    headerBg: 'bg-blue-50',
    headerText: 'text-blue-900',
    icone: Clock
  },
  pago: {
    label: 'Pago',
    cor: 'bg-green-100 text-green-800',
    headerBg: 'bg-green-50',
    headerText: 'text-green-900',
    icone: CheckCircle
  },
  vencido: {
    label: 'Vencido',
    cor: 'bg-red-100 text-red-800',
    headerBg: 'bg-red-50',
    headerText: 'text-red-900',
    icone: AlertTriangle
  },
  cancelado: {
    label: 'Cancelado',
    cor: 'bg-gray-100 text-gray-800',
    headerBg: 'bg-gray-50',
    headerText: 'text-gray-900',
    icone: FileText
  }
};

export function CardBoleto({ 
  boleto, 
  compacto = false,
  mostrarAcoes = true,
  onClick
}: CardBoletoProps) {
  const navigate = useNavigate();
  const config = statusConfig[boleto.status] || statusConfig.pendente;
  const StatusIcon = config.icone;

  const copiarPix = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (boleto.pixCopiaCola) {
      try {
        await navigator.clipboard.writeText(boleto.pixCopiaCola);
        toast.success('Código Pix copiado!');
      } catch {
        toast.error('Erro ao copiar. Tente novamente.');
      }
    }
  };

  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // Versão compacta (para listas)
  if (compacto) {
    return (
      <Card 
        className="border-0 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onClick || (() => navigate(`/app/boletos/${boleto.id}`))}
      >
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-muted p-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{boleto.competencia}</p>
                <p className="text-xs text-muted-foreground">
                  Venc: {boleto.vencimento}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-semibold text-foreground">{formatarValor(boleto.valor)}</p>
                <Badge className={config.cor}>
                  {config.label}
                </Badge>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Card de boleto pago (versão especial)
  if (boleto.status === 'pago') {
    return (
      <Card className="border-0 shadow-sm bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-100 p-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-green-800">Tudo em dia!</p>
              <p className="text-sm text-green-600">
                Seu boleto de {boleto.competencia} está pago.
              </p>
            </div>
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => navigate('/app/boletos')}
              className="text-green-700"
            >
              Ver todos
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Versão completa (para Home)
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">
              {boleto.status === 'vencido' ? 'Boleto Vencido' : 'Próximo Boleto'}
            </span>
          </div>
          {boleto.diasParaVencer !== undefined && boleto.diasParaVencer <= 5 && boleto.status === 'pendente' && (
            <Badge variant="destructive" className="text-xs">
              {boleto.diasParaVencer === 0 
                ? 'Vence hoje!' 
                : `Vence em ${boleto.diasParaVencer} dia${boleto.diasParaVencer > 1 ? 's' : ''}`
              }
            </Badge>
          )}
        </div>

        {/* Conteúdo */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">{boleto.competencia}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Vence em{' '}
                <span className={boleto.status === 'vencido' ? 'text-red-600 font-medium' : ''}>
                  {boleto.vencimento}
                </span>
              </p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {formatarValor(boleto.valor)}
            </p>
          </div>

          {/* Alerta de vencido */}
          {boleto.status === 'vencido' && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">
              Atenção: Este boleto está vencido. Podem haver juros e multa.
            </p>
          )}

          {/* Botões */}
          {mostrarAcoes && (
            <div className="flex gap-2">
              {boleto.pixCopiaCola && (
                <Button variant="outline" className="flex-1 gap-2" onClick={copiarPix}>
                  <Copy className="h-4 w-4" />
                  Copiar Pix
                </Button>
              )}
              <Button 
                variant="default" 
                className="flex-1 gap-2"
                onClick={() => navigate(`/app/boletos/${boleto.id}`)}
              >
                <ExternalLink className="h-4 w-4" />
                Ver Boleto
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default CardBoleto;

import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Bell, 
  AlertTriangle,
  ChevronRight,
  X,
  CreditCard,
  Car,
  Shield,
  LucideIcon
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type TipoAlerta = 'documento' | 'boleto' | 'aviso' | 'veiculo' | 'urgente';

interface AlertaData {
  id: string;
  tipo: TipoAlerta;
  titulo: string;
  descricao: string;
  acao?: string;
  rota?: string;
  dispensavel?: boolean;
}

interface CardAlertaProps {
  alerta: AlertaData;
  onDispensar?: (id: string) => void;
}

const alertaConfig: Record<TipoAlerta, {
  icone: LucideIcon;
  cor: string;
  bgCor: string;
  borderCor: string;
}> = {
  documento: {
    icone: FileText,
    cor: 'text-yellow-600',
    bgCor: 'bg-yellow-50',
    borderCor: 'border-yellow-200'
  },
  boleto: {
    icone: CreditCard,
    cor: 'text-red-600',
    bgCor: 'bg-red-50',
    borderCor: 'border-red-200'
  },
  aviso: {
    icone: Bell,
    cor: 'text-blue-600',
    bgCor: 'bg-blue-50',
    borderCor: 'border-blue-200'
  },
  veiculo: {
    icone: Car,
    cor: 'text-orange-600',
    bgCor: 'bg-orange-50',
    borderCor: 'border-orange-200'
  },
  urgente: {
    icone: AlertTriangle,
    cor: 'text-red-600',
    bgCor: 'bg-red-50',
    borderCor: 'border-red-200'
  }
};

export function CardAlerta({ alerta, onDispensar }: CardAlertaProps) {
  const navigate = useNavigate();
  const config = alertaConfig[alerta.tipo] || alertaConfig.aviso;
  const Icone = config.icone;

  const handleClick = () => {
    if (alerta.rota) {
      navigate(alerta.rota);
    }
  };

  const handleDispensar = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDispensar?.(alerta.id);
  };

  return (
    <Alert 
      className={`${config.bgCor} ${config.borderCor} ${alerta.rota ? 'cursor-pointer hover:opacity-90' : ''} transition-opacity relative`}
      onClick={alerta.rota ? handleClick : undefined}
    >
      <Icone className={`h-4 w-4 ${config.cor}`} />
      <AlertTitle className={config.cor}>
        {alerta.titulo}
      </AlertTitle>
      <AlertDescription className="text-muted-foreground">
        {alerta.descricao}
        {alerta.acao && alerta.rota && (
          <Button 
            variant="link" 
            className={`p-0 h-auto ml-1 ${config.cor}`}
            onClick={handleClick}
          >
            {alerta.acao}
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        )}
      </AlertDescription>
      
      {/* Botão dispensar */}
      {alerta.dispensavel && onDispensar && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-60 hover:opacity-100"
          onClick={handleDispensar}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </Alert>
  );
}

// Lista de alertas
interface ListaAlertasProps {
  alertas: AlertaData[];
  onDispensar?: (id: string) => void;
  titulo?: string;
}

export function ListaAlertas({ 
  alertas, 
  onDispensar,
  titulo = 'Alertas'
}: ListaAlertasProps) {
  if (alertas.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        {titulo}
      </h2>
      <div className="space-y-2">
        {alertas.map(alerta => (
          <CardAlerta 
            key={alerta.id} 
            alerta={alerta} 
            onDispensar={onDispensar}
          />
        ))}
      </div>
    </div>
  );
}

// Card "Tudo em dia"
interface CardTudoEmDiaProps {
  titulo?: string;
  descricao?: string;
}

export function CardTudoEmDia({
  titulo = 'Tudo em dia!',
  descricao = 'Você não possui pendências.'
}: CardTudoEmDiaProps) {
  return (
    <div className="rounded-lg border-0 shadow-sm bg-green-50 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-green-100 p-2">
          <Shield className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <p className="font-semibold text-green-800">{titulo}</p>
          <p className="text-sm text-green-600">{descricao}</p>
        </div>
      </div>
    </div>
  );
}

export default CardAlerta;

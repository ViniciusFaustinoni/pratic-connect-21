import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface AlertaContabil {
  tipo: 'vermelho' | 'amarelo' | 'azul';
  mensagem: string;
}

interface Props {
  alertas: AlertaContabil[];
}

export function AlertasContabeis({ alertas }: Props) {
  if (alertas.length === 0) return null;

  const config = {
    vermelho: {
      icon: AlertTriangle,
      className: 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-200',
    },
    amarelo: {
      icon: AlertCircle,
      className: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-200',
    },
    azul: {
      icon: Info,
      className: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200',
    },
  };

  return (
    <div className="space-y-2">
      {alertas.map((alerta, i) => {
        const { icon: Icon, className } = config[alerta.tipo];
        return (
          <Alert key={i} className={className}>
            <Icon className="h-4 w-4" />
            <AlertDescription>{alerta.mensagem}</AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}

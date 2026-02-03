import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AssociadoSuspensoAlertProps {
  motivo?: string | null;
  dataBloqueio?: string | null;
}

const formatDate = (d: string | null | undefined) => 
  d ? new Date(d).toLocaleDateString('pt-BR') : null;

export function AssociadoSuspensoAlert({ motivo, dataBloqueio }: AssociadoSuspensoAlertProps) {
  return (
    <Alert className="border-yellow-300 bg-yellow-50">
      <AlertTriangle className="h-5 w-5 text-yellow-600" />
      <AlertTitle className="text-yellow-800 font-semibold">
        Associado Suspenso
      </AlertTitle>
      <AlertDescription className="text-yellow-700">
        <p className="mt-1">
          {motivo || 'Sem motivo informado'}
        </p>
        {dataBloqueio && (
          <p className="text-xs text-yellow-600 mt-2">
            Suspenso em: {formatDate(dataBloqueio)}
          </p>
        )}
        <p className="text-xs text-yellow-600 mt-1">
          O associado não tem acesso aos benefícios da proteção.
        </p>
      </AlertDescription>
    </Alert>
  );
}

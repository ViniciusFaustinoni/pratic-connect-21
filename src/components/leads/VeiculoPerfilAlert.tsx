import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VeiculoPerfilAlertProps {
  anoVeiculo?: number | null;
  valorFipe?: number | null;
  className?: string;
}

const LIMITE_IDADE_ANOS = 15;
const FIPE_MINIMO = 15000;
const FIPE_MAXIMO = 500000;

export function VeiculoPerfilAlert({ anoVeiculo, valorFipe, className }: VeiculoPerfilAlertProps) {
  const alertas: { tipo: string; mensagem: string; detalhe: string }[] = [];
  const anoAtual = new Date().getFullYear();

  // Verificar idade do veículo
  if (anoVeiculo) {
    const idadeVeiculo = anoAtual - anoVeiculo;
    if (idadeVeiculo > LIMITE_IDADE_ANOS) {
      alertas.push({
        tipo: 'idade',
        mensagem: `Veículo com ${idadeVeiculo} anos`,
        detalhe: `Veículos com mais de ${LIMITE_IDADE_ANOS} anos podem ter restrições para filiação. Consulte as regras de aceitação.`,
      });
    }
  }

  // Verificar valor FIPE abaixo do mínimo
  if (valorFipe && valorFipe < FIPE_MINIMO) {
    alertas.push({
      tipo: 'fipe_baixo',
      mensagem: `FIPE abaixo de R$ ${FIPE_MINIMO.toLocaleString('pt-BR')}`,
      detalhe: `Veículos com valor FIPE inferior a R$ ${FIPE_MINIMO.toLocaleString('pt-BR')} podem não ser elegíveis para proteção.`,
    });
  }

  // Verificar valor FIPE acima do máximo
  if (valorFipe && valorFipe > FIPE_MAXIMO) {
    alertas.push({
      tipo: 'fipe_alto',
      mensagem: `FIPE acima de R$ ${FIPE_MAXIMO.toLocaleString('pt-BR')}`,
      detalhe: `Veículos com valor FIPE superior a R$ ${FIPE_MAXIMO.toLocaleString('pt-BR')} requerem análise especial.`,
    });
  }

  if (alertas.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={className}>
        {alertas.map((alerta, index) => (
          <Tooltip key={index}>
            <TooltipTrigger asChild>
              <Alert 
                variant="default" 
                className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 cursor-help"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                  {alerta.mensagem}
                </AlertDescription>
              </Alert>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm">{alerta.detalhe}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

import { TrendingUp, TrendingDown, Minus, HelpCircle, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCustoBeneficio, type IndicadorSaude } from '@/hooks/useCustoBeneficios';
import { Skeleton } from '@/components/ui/skeleton';

interface CustoRealInfoProps {
  beneficioId: string;
  tipo?: 'benefit' | 'adicional';
  precoAtual?: number;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

function formatarNumero(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(valor);
}

function getIndicadorConfig(indicador: IndicadorSaude, margem: number) {
  const configs = {
    sem_dados: {
      cor: 'text-muted-foreground',
      bg: 'bg-muted/50',
      borderCor: 'border-muted',
      icone: <HelpCircle className="h-4 w-4" />,
      label: 'Sem dados suficientes',
    },
    prejuizo: {
      cor: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30',
      borderCor: 'border-red-200 dark:border-red-800',
      icone: <TrendingDown className="h-4 w-4" />,
      label: `PREJUÍZO: ${formatarMoeda(margem)}`,
    },
    equilibrio: {
      cor: 'text-yellow-600 dark:text-yellow-400',
      bg: 'bg-yellow-50 dark:bg-yellow-950/30',
      borderCor: 'border-yellow-200 dark:border-yellow-800',
      icone: <Minus className="h-4 w-4" />,
      label: 'EQUILÍBRIO: R$ 0,00',
    },
    superavit: {
      cor: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-950/30',
      borderCor: 'border-green-200 dark:border-green-800',
      icone: <TrendingUp className="h-4 w-4" />,
      label: `SUPERÁVIT: +${formatarMoeda(margem)}`,
    },
  };
  
  return configs[indicador];
}

export function CustoRealInfo({ beneficioId, tipo = 'adicional', precoAtual }: CustoRealInfoProps) {
  const { data: custoData, isLoading } = useCustoBeneficio(beneficioId, tipo);

  if (isLoading) {
    return (
      <div className="mt-2 p-3 rounded-md border bg-muted/20">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-5 w-24" />
      </div>
    );
  }

  if (!custoData) {
    return (
      <div className="mt-2 p-3 rounded-md border border-muted bg-muted/20">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          Registre custos em sinistros para calcular o custo real
        </p>
      </div>
    );
  }

  const {
    custo_real,
    gasto_total_60d,
    total_cotas,
    preco_sugerido,
    indicador,
  } = custoData;

  // Usar preço atualizado se disponível (para feedback em tempo real)
  const precoEfetivo = precoAtual ?? preco_sugerido;
  const margem = precoEfetivo - custo_real;
  const temDados = total_cotas > 0 && gasto_total_60d > 0;
  
  // Recalcular indicador com preço efetivo
  let indicadorEfetivo: IndicadorSaude = indicador as IndicadorSaude;
  if (temDados && precoAtual !== undefined) {
    if (precoAtual < custo_real) indicadorEfetivo = 'prejuizo';
    else if (precoAtual > custo_real) indicadorEfetivo = 'superavit';
    else indicadorEfetivo = 'equilibrio';
  }

  const config = getIndicadorConfig(indicadorEfetivo, margem);

  return (
    <div className={`mt-2 p-3 rounded-md border ${config.bg} ${config.borderCor}`}>
      {/* Linha 1: Custo Real com Tooltip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <span>💰 Custo Real (60 dias):</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="p-0.5 hover:bg-accent rounded-full">
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1 text-xs">
                  <p><strong>Como é calculado:</strong></p>
                  <p className="font-mono">Gasto total ÷ Soma das cotas</p>
                  <hr className="my-1 border-border" />
                  <p><strong>Gasto total:</strong> {formatarMoeda(gasto_total_60d)}</p>
                  <p><strong>Total cotas:</strong> {formatarNumero(total_cotas)}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className="font-semibold">
          {temDados ? formatarMoeda(custo_real) : '—'}
        </span>
      </div>

      {/* Linha 2: Indicador de Saúde */}
      {temDados && (
        <div className={`flex items-center gap-1.5 mt-2 text-sm font-medium ${config.cor}`}>
          {config.icone}
          <span>{config.label} por cota</span>
        </div>
      )}

      {/* Alerta se prejuízo */}
      {indicadorEfetivo === 'prejuizo' && (
        <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
          ⚠️ O preço configurado não cobre os custos reais!
        </p>
      )}

      {/* Dica se sem dados */}
      {!temDados && (
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
          <Info className="h-3 w-3" />
          Registre custos em sinistros para calcular
        </p>
      )}
    </div>
  );
}

export default CustoRealInfo;

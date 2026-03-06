import React from 'react';
import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type IndicadorSaude as TipoIndicador, getCorIndicador } from '@/hooks/useCustoBeneficios';
import { formatarMoeda } from '@/utils/format';

interface IndicadorSaudeProps {
  precoSugerido: number;
  custoReal: number;
  showMargem?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  gastoTotal?: number;
  totalCotas?: number;
}

function calcularIndicador(preco: number, custoReal: number): TipoIndicador {
  if (custoReal === 0) return 'sem_dados';
  if (preco < custoReal) return 'prejuizo';
  if (preco > custoReal) return 'superavit';
  return 'equilibrio';
}

export function IndicadorSaude({ 
  precoSugerido, 
  custoReal, 
  showMargem = true,
  showTooltip = true,
  size = 'md',
  gastoTotal,
  totalCotas
}: IndicadorSaudeProps) {
  const indicador = calcularIndicador(precoSugerido, custoReal);
  const margem = precoSugerido - custoReal;
  const cores = getCorIndicador(indicador);
  
  const sizeClasses = {
    sm: 'text-xs gap-0.5',
    md: 'text-sm gap-1',
    lg: 'text-base gap-1.5'
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };
  
  let icone: React.ReactNode;
  let texto: string;
  
  switch (indicador) {
    case 'superavit':
      icone = <TrendingUp className={iconSizes[size]} />;
      texto = showMargem ? `+${formatarMoeda(margem)}` : 'Superávit';
      break;
    case 'prejuizo':
      icone = <TrendingDown className={iconSizes[size]} />;
      texto = showMargem ? formatarMoeda(margem) : 'Prejuízo';
      break;
    case 'equilibrio':
      icone = <Minus className={iconSizes[size]} />;
      texto = showMargem ? 'R$ 0,00' : 'Equilíbrio';
      break;
    default:
      icone = <HelpCircle className={iconSizes[size]} />;
      texto = 'Sem dados';
  }
  
  const content = (
    <div className={`flex items-center font-medium ${sizeClasses[size]} ${cores.text}`}>
      {icone}
      <span>{texto}</span>
    </div>
  );
  
  if (!showTooltip || indicador === 'sem_dados') {
    return content;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p><strong>Preço configurado:</strong> {formatarMoeda(precoSugerido)}</p>
            <p><strong>Custo real (60d):</strong> {formatarMoeda(custoReal)}</p>
            {gastoTotal !== undefined && (
              <p><strong>Gasto total:</strong> {formatarMoeda(gastoTotal)}</p>
            )}
            {totalCotas !== undefined && (
              <p><strong>Total de cotas:</strong> {totalCotas.toLocaleString('pt-BR')}</p>
            )}
            <p className={`font-semibold ${cores.text}`}>
              <strong>Margem:</strong> {formatarMoeda(margem)} por cota
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface BadgeIndicadorProps {
  indicador: TipoIndicador;
  size?: 'sm' | 'md';
}

export function BadgeIndicador({ indicador, size = 'md' }: BadgeIndicadorProps) {
  const cores = getCorIndicador(indicador);
  
  const labels: Record<TipoIndicador, string> = {
    superavit: 'Superávit',
    equilibrio: 'Equilíbrio',
    prejuizo: 'Prejuízo',
    sem_dados: 'Sem dados'
  };
  
  const sizeClasses = size === 'sm' 
    ? 'px-1.5 py-0.5 text-xs' 
    : 'px-2 py-1 text-sm';
  
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${cores.bg} ${cores.text} ${cores.border} border`}>
      {labels[indicador]}
    </span>
  );
}

export default IndicadorSaude;

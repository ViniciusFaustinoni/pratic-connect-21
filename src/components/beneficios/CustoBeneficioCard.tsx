import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Minus, DollarSign, Users, Receipt } from 'lucide-react';
import { type IndicadorSaude, getCorIndicador } from '@/hooks/useCustoBeneficios';

interface CustoBeneficioCardProps {
  precoSugerido: number;
  custoReal: number;
  gastoTotal60d: number;
  totalCotas: number;
  indicador: IndicadorSaude;
  className?: string;
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor);
}

export function CustoBeneficioCard({
  precoSugerido,
  custoReal,
  gastoTotal60d,
  totalCotas,
  indicador,
  className = ''
}: CustoBeneficioCardProps) {
  const cores = getCorIndicador(indicador);
  const margem = precoSugerido - custoReal;
  
  const getIndicadorContent = () => {
    switch (indicador) {
      case 'superavit':
        return {
          icon: <TrendingUp className="w-5 h-5" />,
          label: 'SUPERÁVIT',
          valor: `+${formatarMoeda(margem)} por cota`
        };
      case 'prejuizo':
        return {
          icon: <TrendingDown className="w-5 h-5" />,
          label: 'PREJUÍZO',
          valor: `${formatarMoeda(margem)} por cota`
        };
      case 'equilibrio':
        return {
          icon: <Minus className="w-5 h-5" />,
          label: 'EQUILÍBRIO',
          valor: 'Preço = Custo'
        };
      default:
        return {
          icon: <DollarSign className="w-5 h-5" />,
          label: 'SEM DADOS',
          valor: 'Aguardando dados de gastos'
        };
    }
  };
  
  const indicadorContent = getIndicadorContent();
  
  return (
    <Card className={`${cores.border} border-2 ${className}`}>
      <CardHeader className={`${cores.bg} pb-3`}>
        <div className={`flex items-center gap-2 ${cores.text}`}>
          {indicadorContent.icon}
          <CardTitle className="text-base font-semibold">
            {indicadorContent.label}
          </CardTitle>
        </div>
        <p className={`text-sm ${cores.text}`}>
          {indicadorContent.valor}
        </p>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Receipt className="w-4 h-4" />
            <span className="text-sm">Gasto total (60d)</span>
          </div>
          <span className="font-medium">{formatarMoeda(gastoTotal60d)}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span className="text-sm">Total de cotas</span>
          </div>
          <span className="font-medium">{totalCotas.toLocaleString('pt-BR')}</span>
        </div>
        
        <Separator />
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Custo por cota</span>
          <span className="font-semibold text-foreground">{formatarMoeda(custoReal)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default CustoBeneficioCard;

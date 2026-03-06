import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatarMoeda } from '@/utils/format';

interface CardResumoFinanceiroProps {
  titulo: string;
  valor: number;
  icone: LucideIcon;
  cor: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  subtitulo?: string;
  variacao?: {
    valor: number;
    tipo: 'percentual' | 'absoluto';
    positivo: boolean;
  };
}

const cores = {
  blue: 'border-l-blue-500 bg-blue-50',
  green: 'border-l-green-500 bg-green-50',
  yellow: 'border-l-yellow-500 bg-yellow-50',
  red: 'border-l-red-500 bg-red-50',
  purple: 'border-l-purple-500 bg-purple-50',
};

const coresIcone = {
  blue: 'text-blue-500',
  green: 'text-green-500',
  yellow: 'text-yellow-500',
  red: 'text-red-500',
  purple: 'text-purple-500',
};

export function CardResumoFinanceiro({
  titulo,
  valor,
  icone: Icone,
  cor,
  subtitulo,
  variacao
}: CardResumoFinanceiroProps) {
  return (
    <Card className={`border-l-4 ${cores[cor]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{titulo}</span>
          <Icone className={`h-4 w-4 ${coresIcone[cor]}`} />
        </div>
        
        <p className="text-2xl font-bold text-foreground">{formatarMoeda(valor)}</p>
        
        {subtitulo && (
          <p className="text-xs text-muted-foreground mt-1">{subtitulo}</p>
        )}
        
        {variacao && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${variacao.positivo ? 'text-green-600' : 'text-red-600'}`}>
            {variacao.positivo ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>
              {variacao.tipo === 'percentual' 
                ? `${variacao.valor.toFixed(1)}%`
                : formatarMoeda(variacao.valor)
              }
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

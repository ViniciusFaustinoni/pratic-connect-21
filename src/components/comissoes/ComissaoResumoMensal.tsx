import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle, DollarSign, TrendingUp } from 'lucide-react';
import type { ComissaoResumo } from '@/types/comissoes';

interface ComissaoResumoMensalProps {
  resumo: ComissaoResumo | null | undefined;
  titulo?: string;
}

export function ComissaoResumoMensal({ resumo, titulo = 'Resumo do Mês' }: ComissaoResumoMensalProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const total = (resumo?.totalPendente || 0) + (resumo?.totalAprovada || 0) + (resumo?.totalPago || 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total */}
        <div className="text-center py-2 bg-muted/50 rounded-lg">
          <div className="text-2xl font-bold text-primary">
            {formatCurrency(total)}
          </div>
          <div className="text-xs text-muted-foreground">Total de comissões</div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <Clock className="h-4 w-4 mx-auto text-amber-600 mb-1" />
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-500">
              {formatCurrency(resumo?.totalPendente || 0)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {resumo?.quantidadePendente || 0} pendentes
            </div>
          </div>

          <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <CheckCircle className="h-4 w-4 mx-auto text-blue-600 mb-1" />
            <div className="text-sm font-semibold text-blue-700 dark:text-blue-500">
              {formatCurrency(resumo?.totalAprovada || 0)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {resumo?.quantidadeAprovada || 0} aprovadas
            </div>
          </div>

          <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <DollarSign className="h-4 w-4 mx-auto text-green-600 mb-1" />
            <div className="text-sm font-semibold text-green-700 dark:text-green-500">
              {formatCurrency(resumo?.totalPago || 0)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {resumo?.quantidadePago || 0} pagas
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

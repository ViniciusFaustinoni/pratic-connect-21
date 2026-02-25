import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, DollarSign, ShieldCheck } from 'lucide-react';
import type { LimiteCoberturaTerceiros } from '@/types/terceiros';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

interface Props {
  limite: LimiteCoberturaTerceiros | null | undefined;
  isLoading?: boolean;
}

export function CoberturaTerceirosInfo({ limite, isLoading }: Props) {
  if (isLoading || !limite) return null;

  const excedeu = limite.disponivel < 0;

  return (
    <Card className={excedeu ? 'border-red-400' : 'border-blue-300'}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-5 w-5" />
          Cobertura de Terceiros — {limite.plano_nome}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Limite total</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(limite.limite_total)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Consumido</p>
            <p className="text-lg font-bold text-orange-600">{formatCurrency(limite.total_consumido)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Disponível</p>
            <p className={`text-lg font-bold ${excedeu ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(limite.disponivel)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {limite.cota_isento ? (
            <Badge className="bg-emerald-100 text-emerald-800">
              <ShieldCheck className="h-3 w-3 mr-1" />
              ISENTO de cota para terceiro
            </Badge>
          ) : (
            <Badge className="bg-orange-100 text-orange-800">
              Cota do associado: {formatCurrency(limite.cota_associado)}
            </Badge>
          )}

          {limite.cota_dobrada && (
            <Badge className="bg-red-100 text-red-800">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Cota dobrada: {limite.motivo_cota_dobrada}
            </Badge>
          )}
        </div>

        {excedeu && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-700 font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              🚨 EXCEDENTE: {formatCurrency(Math.abs(limite.disponivel))} — Associado responsável
            </p>
          </div>
        )}

        {limite.limite_total === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-700">
              ⚠️ Este plano não possui cobertura de terceiros configurada.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

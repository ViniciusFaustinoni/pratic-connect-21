import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, AlertTriangle } from 'lucide-react';
import type { LimiteCoberturaTerceiros } from '@/types/terceiros';

interface Props {
  limite: LimiteCoberturaTerceiros | null | undefined;
  sinistroId: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function CardLimitesTerceiros({ limite, sinistroId }: Props) {
  if (!limite) return null;

  const excedente = limite.total_consumido > limite.limite_total;
  const valorExcedente = limite.total_consumido - limite.limite_total;

  return (
    <Card className={excedente ? 'border-red-300' : 'border-primary/30'}>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Cobertura — {limite.plano_nome}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Limite total:</span>
            <p className="font-medium">{fmt(limite.limite_total)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Consumido:</span>
            <p className="font-medium">{fmt(limite.total_consumido)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Disponível:</span>
            <p className={`font-medium ${limite.disponivel < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {fmt(Math.max(0, limite.disponivel))}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Cota associado:</span>
            <p className="font-medium">
              {limite.cota_isento ? 'ISENTO' : fmt(limite.cota_associado)}
            </p>
          </div>
        </div>

        {limite.cota_dobrada && (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Cota dobrada: {limite.motivo_cota_dobrada}
          </Badge>
        )}

        {excedente && (
          <Badge variant="destructive" className="text-xs">
            🚨 EXCEDENTE: {fmt(valorExcedente)} — Associado responsável
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}

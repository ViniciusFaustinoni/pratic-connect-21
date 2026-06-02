import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, CheckCircle2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanoCotacao } from '@/hooks/usePlanosCotacao';

interface PlanoCardProps {
  plano: PlanoCotacao;
  isSelecionado: boolean;
  ordemSelecao: number;
  valorAdicional: number;
  valorAdesao: number;
  isExpanded: boolean;
  onToggle: (plano: PlanoCotacao) => void;
  onToggleExpand: (planoId: string, e?: React.MouseEvent) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function PlanoCardBase({
  plano,
  isSelecionado,
  ordemSelecao,
  valorAdicional,
  valorAdesao,
  isExpanded,
  onToggle,
  onToggleExpand,
}: PlanoCardProps) {
  const coberturasVisiveis = plano.coberturas.filter(
    c => !(plano.coberturasRemovidas || []).some(cr => cr.toLowerCase().includes(c.toLowerCase()))
  );

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md relative',
        isSelecionado
          ? 'ring-2 ring-primary border-primary bg-primary/5'
          : 'hover:border-primary/50',
        plano.destaque && !isSelecionado && 'border-amber-500/50'
      )}
      onClick={() => onToggle(plano)}
    >
      {isSelecionado && (
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center z-10">
          {ordemSelecao}º
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2 gap-1">
          <h4 className="font-semibold text-sm">{plano.nome}</h4>
          {isSelecionado ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : plano.destaque ? (
            <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
              Recomendado
            </Badge>
          ) : null}
        </div>
        <p className="text-xl font-bold text-primary mb-3">
          {formatCurrency(plano.valorMensal + valorAdicional)}
          <span className="text-xs font-normal text-muted-foreground">/mês</span>
        </p>
        <ul className="text-xs space-y-1 text-muted-foreground">
          {coberturasVisiveis.slice(0, 4).map((cobertura, idx) => (
            <li key={idx} className="flex items-start gap-1">
              <Check className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
              <span>{cobertura}</span>
            </li>
          ))}
          <div
            className={`overflow-hidden transition-all duration-200 ${
              isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            {coberturasVisiveis.slice(4).map((cobertura, idx) => (
              <li key={idx + 4} className="flex items-start gap-1 mt-1">
                <Check className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                <span>{cobertura}</span>
              </li>
            ))}
          </div>
          {plano.coberturas.length > 4 && (
            <li className="pt-1">
              <button
                type="button"
                onClick={(e) => onToggleExpand(plano.id, e)}
                className="flex items-center gap-1 text-primary hover:underline text-xs font-medium"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Ver menos
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Ver mais {plano.coberturas.length - 4}
                  </>
                )}
              </button>
            </li>
          )}
        </ul>
        <Separator className="my-3" />
        <div className="text-xs flex items-center gap-1">
          <span className="text-muted-foreground">Filiação: </span>
          <span className="font-medium text-primary">{formatCurrency(valorAdesao || 0)}</span>
        </div>
        {plano.alertaDesagio && (
          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {plano.alertaDesagio}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export const PlanoCard = React.memo(PlanoCardBase);

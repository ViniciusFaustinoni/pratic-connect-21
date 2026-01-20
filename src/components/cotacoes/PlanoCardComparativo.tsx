import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Check, X, Star, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlanoComparativo {
  id: string;
  nome: string;
  valorMensal: number;
  valorAdesao?: number;
  coberturas?: string[];
  naoInclui?: string[];
  destaque?: boolean;
  // Campos expandidos para PDF e exibição
  coberturaFipe?: number;
  cota?: string;
  cotaPercentual?: number;
  cotaMinima?: number;
  cotaDesagio?: number;
  cotaMinimaDesagio?: number;
  adicionalMensal?: number;
  anoMinimo?: number;
  alertaDesagio?: string;
  coberturasRemovidas?: string[];
}

interface PlanoCardComparativoProps {
  plano: PlanoComparativo;
  valorAdesao: number;
  isRecomendado?: boolean;
  isSelecionado?: boolean;
  indice?: number;
  categoriaVeiculo?: string;
  onSelecionar?: (plano: PlanoComparativo) => void;
  onVerDetalhes?: (plano: PlanoComparativo) => void;
  isCoberturaRemovida?: (cobertura: string, categoria?: string) => boolean;
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value && value !== 0) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function PlanoCardComparativo({
  plano,
  valorAdesao,
  isRecomendado = false,
  isSelecionado = false,
  indice,
  categoriaVeiculo,
  onSelecionar,
  onVerDetalhes,
  isCoberturaRemovida,
}: PlanoCardComparativoProps) {
  const primeiroPagamento = (plano.valorAdesao ?? valorAdesao ?? 0) + (plano.valorMensal ?? 0);
  const coberturas = plano.coberturas || [];
  const naoInclui = plano.naoInclui || [];

  // Limitar coberturas exibidas para não poluir
  const coberturasExibidas = coberturas.slice(0, 8);
  const temMaisCoberturas = coberturas.length > 8;

  return (
    <Card
      className={cn(
        "relative cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-1",
        isRecomendado && "ring-2 ring-amber-500/50 border-amber-500",
        isSelecionado && "ring-2 ring-green-500 border-green-500 bg-green-50/50 dark:bg-green-950/20",
        !isRecomendado && !isSelecionado && "hover:border-primary/50"
      )}
      onClick={() => onSelecionar?.(plano)}
    >
      {/* Badge Recomendado */}
      {isRecomendado && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-amber-50 hover:bg-amber-500 shadow-md">
          <Star className="h-3 w-3 mr-1 fill-current" />
          Mais Vendido
        </Badge>
      )}

      {/* Badge de índice quando há múltiplos */}
      {typeof indice === 'number' && !isRecomendado && (
        <Badge 
          variant="secondary" 
          className="absolute -top-2.5 left-4 text-xs"
        >
          Opção {indice + 1}
        </Badge>
      )}

      {/* Indicador de selecionado */}
      {isSelecionado && (
        <div className="absolute top-3 right-3">
          <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="h-4 w-4 text-white" />
          </div>
        </div>
      )}

      <CardContent className="pt-8 pb-4 space-y-4">
        {/* Nome do plano */}
        <div className="text-center">
          <h3 className="text-lg font-bold">{plano.nome}</h3>
        </div>

        {/* Valor em destaque */}
        <div className={cn(
          "rounded-xl p-4 text-center",
          isRecomendado ? "bg-amber-50 dark:bg-amber-950/30" : "bg-primary/5"
        )}>
          <p className="text-3xl font-bold text-primary">
            {formatCurrency(plano.valorMensal)}
          </p>
          <p className="text-sm text-muted-foreground">/mês</p>
        </div>

        {/* Coberturas incluídas */}
        <div className="space-y-1.5">
          {coberturasExibidas.map((cobertura, i) => {
            const isRemovida = isCoberturaRemovida?.(cobertura, categoriaVeiculo) || false;
            
            return (
              <div 
                key={i} 
                className={cn(
                  "flex items-center gap-2 text-sm",
                  isRemovida && "opacity-50"
                )}
              >
                {isRemovida ? (
                  <X className="h-4 w-4 text-destructive flex-shrink-0" />
                ) : (
                  <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                )}
                <span className={cn(isRemovida && "line-through")}>
                  {cobertura}
                </span>
              </div>
            );
          })}
          
          {/* Coberturas não incluídas (primeiras 3) */}
          {naoInclui.slice(0, 3).map((item, i) => (
            <div 
              key={`nao-${i}`}
              className="flex items-center gap-2 text-sm opacity-40"
            >
              <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="line-through">{item}</span>
            </div>
          ))}

          {temMaisCoberturas && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{coberturas.length - 8} coberturas
            </p>
          )}
        </div>

        <Separator />

        {/* Valores adicionais */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Adesão</span>
            <span>{formatCurrency(plano.valorAdesao ?? valorAdesao)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>1º Pagamento</span>
            <span className="text-primary">{formatCurrency(primeiroPagamento)}</span>
          </div>
        </div>

        {/* Botões */}
        <div className="flex gap-2 pt-2">
          <Button
            variant={isSelecionado ? "default" : "outline"}
            className={cn(
              "flex-1",
              isSelecionado && "bg-green-600 hover:bg-green-700"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onSelecionar?.(plano);
            }}
          >
            {isSelecionado ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Selecionado
              </>
            ) : (
              'Selecionar'
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onVerDetalhes?.(plano);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

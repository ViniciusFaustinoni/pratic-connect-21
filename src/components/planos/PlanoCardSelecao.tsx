import { Check, X, Shield, Star } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { isCoberturaRemovida } from '@/data/restricoesCategorias';

interface PlanoData {
  id: string;
  codigo?: string | null;
  nome: string;
  descricao?: string | null;
  coberturas?: string[] | null;
  cobertura_fipe?: number | null;
  valor_adesao?: number;
  destaque?: boolean | null;
  linha?: string | null;
  categoriaVeiculo?: string;
}

interface PlanoCardSelecaoProps {
  plano: PlanoData;
  selecionado: boolean;
  onSelecionar: () => void;
  valorMensal?: number;
  mostrarCoberturas?: boolean;
  compact?: boolean;
  categoriaVeiculo?: string;
}

const LINHA_CORES: Record<string, string> = {
  'select': 'from-blue-500 to-blue-600',
  'select-one': 'from-emerald-500 to-green-600',
  'especial': 'from-orange-500 to-amber-600',
  'lancamento': 'from-violet-500 to-purple-600',
  'advanced': 'from-red-500 to-rose-600',
  'eletricos': 'from-teal-500 to-cyan-600',
};

export function PlanoCardSelecao({ 
  plano, 
  selecionado, 
  onSelecionar, 
  valorMensal,
  mostrarCoberturas = true,
  compact = false,
  categoriaVeiculo
}: PlanoCardSelecaoProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const gradientClass = plano.linha ? LINHA_CORES[plano.linha] || 'from-gray-500 to-gray-600' : 'from-primary to-primary/80';
  const coberturasToShow = compact ? (plano.coberturas?.slice(0, 4) || []) : (plano.coberturas || []);

  return (
    <Card 
      className={cn(
        'relative cursor-pointer transition-all hover:shadow-lg border-2',
        selecionado ? 'ring-2 ring-primary border-primary shadow-md' : 'border-border hover:border-primary/50',
        compact ? 'p-2' : ''
      )}
      onClick={onSelecionar}
    >
      {/* Indicador de seleção */}
      {selecionado && (
        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1 z-10">
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* Badge de destaque */}
      {plano.destaque && (
        <Badge className="absolute -top-2 left-3 bg-amber-500 text-white flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" />
          Recomendado
        </Badge>
      )}

      {/* Barra de cor da linha */}
      <div className={cn(
        'absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-gradient-to-b',
        gradientClass
      )} />

      <CardHeader className={cn('pb-2', compact ? 'px-3 pt-3' : 'pl-4')}>
        <div className="flex items-center gap-2">
          <Shield className={cn('h-5 w-5', selecionado ? 'text-primary' : 'text-muted-foreground')} />
          <CardTitle className={cn('text-base', compact ? 'text-sm' : '')}>{plano.nome}</CardTitle>
        </div>
        {plano.descricao && !compact && (
          <CardDescription className="text-xs mt-1">{plano.descricao}</CardDescription>
        )}
      </CardHeader>

      <CardContent className={cn(compact ? 'px-3 pb-3' : 'pl-4')}>
        {/* Coberturas */}
        {mostrarCoberturas && coberturasToShow.length > 0 && (
          <div className={cn('space-y-1 mb-3', compact ? 'space-y-0.5' : '')}>
            {coberturasToShow.map((cobertura, index) => {
              const isRemovida = isCoberturaRemovida(cobertura, categoriaVeiculo || plano.categoriaVeiculo);
              
              return (
                <div key={index} className={cn('flex items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
                  {isRemovida ? (
                    <>
                      <X className={cn('flex-shrink-0 text-destructive', compact ? 'h-3 w-3' : 'h-4 w-4')} />
                      <span className="text-muted-foreground truncate line-through">{cobertura}</span>
                      {!compact && <span className="text-xs text-destructive ml-auto">(não disponível)</span>}
                    </>
                  ) : (
                    <>
                      <Check className={cn('flex-shrink-0 text-green-500', compact ? 'h-3 w-3' : 'h-4 w-4')} />
                      <span className="text-muted-foreground truncate">{cobertura}</span>
                    </>
                  )}
                </div>
              );
            })}
            {compact && plano.coberturas && plano.coberturas.length > 4 && (
              <span className="text-xs text-muted-foreground pl-5">
                +{plano.coberturas.length - 4} coberturas
              </span>
            )}
          </div>
        )}

        {/* Valores */}
        <div className={cn('flex items-center justify-between pt-2 border-t', compact ? 'text-xs' : '')}>
          {plano.valor_adesao !== undefined && (
            <div>
              <span className="text-muted-foreground text-xs">Filiação</span>
              <p className={cn('font-medium', compact ? 'text-sm' : '')}>{formatCurrency(plano.valor_adesao)}</p>
            </div>
          )}
          {valorMensal !== undefined && (
            <div className="text-right">
              <span className="text-muted-foreground text-xs">Mensalidade</span>
              <p className={cn('font-bold text-primary', compact ? 'text-base' : 'text-lg')}>
                {formatCurrency(valorMensal)}
              </p>
            </div>
          )}
        </div>

        {/* Cobertura FIPE */}
        {plano.cobertura_fipe && plano.cobertura_fipe > 0 && !compact && (
          <div className="mt-2 text-xs text-muted-foreground">
            Cobertura: {plano.cobertura_fipe}% FIPE
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanoOficial } from '@/hooks/usePlanosOficiais';

interface PlanoCardCotacaoProps {
  plano: PlanoOficial;
  onSelect: (plano: PlanoOficial) => void;
  planoBasico?: PlanoOficial;
  isSelected?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function PlanoCardCotacao({ 
  plano, 
  onSelect, 
  planoBasico,
  isSelected 
}: PlanoCardCotacaoProps) {
  const diferenca = planoBasico && plano.id !== planoBasico.id
    ? plano.valorMensal - planoBasico.valorMensal
    : null;

  return (
    <Card 
      className={cn(
        "relative border-2 transition-all duration-200",
        plano.destaque && "border-primary shadow-[0_0_20px_hsl(var(--primary)/0.2)]",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        !plano.destaque && !isSelected && "border-border hover:border-primary/50"
      )}
    >
      {/* Badge Recomendado ou Tag */}
      {(plano.destaque || plano.tag) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground shadow-lg px-3 py-1">
            <Star className="w-3 h-3 mr-1 fill-current" />
            {plano.tag || 'RECOMENDADO'}
          </Badge>
        </div>
      )}

      <CardHeader className={cn("pb-3", plano.destaque && "pt-6")}>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              {plano.nome}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {plano.descricao}
            </p>
          </div>
          
          {diferenca !== null && diferenca > 0 && (
            <Badge variant="secondary" className="text-xs shrink-0">
              +{formatCurrency(diferenca)}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Valor Mensal */}
        <div className="text-center py-2 rounded-lg bg-muted/50">
          <span className="text-2xl font-bold text-foreground">
            {formatCurrency(plano.valorMensal)}
          </span>
          <span className="text-sm text-muted-foreground">/mês</span>
        </div>

        {/* Info rápida */}
        <div className="text-xs text-muted-foreground text-center">
          Cobertura {plano.coberturaFipe}% FIPE • {plano.cota}
        </div>

        {/* Coberturas */}
        <div className="space-y-1.5">
          {plano.coberturas.slice(0, 6).map((cobertura, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-foreground/90">{cobertura}</span>
            </div>
          ))}
          {plano.coberturas.length > 6 && (
            <p className="text-xs text-muted-foreground ml-6">
              +{plano.coberturas.length - 6} coberturas adicionais
            </p>
          )}
        </div>

        {/* Não incluído */}
        {plano.naoInclui.length > 0 && (
          <div className="pt-2 border-t border-border space-y-1.5">
            {plano.naoInclui.slice(0, 3).map((item, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <X className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        )}

        {/* Botão Selecionar */}
        <Button
          onClick={() => onSelect(plano)}
          variant={plano.destaque ? "default" : "outline"}
          className={cn(
            "w-full",
            plano.destaque && "shadow-lg"
          )}
        >
          {isSelected ? 'Plano Selecionado' : 'Selecionar este plano'}
        </Button>

        {/* Filiação */}
        <p className="text-xs text-center text-muted-foreground">
          Filiação: {formatCurrency(plano.valorAdesao)}
        </p>
      </CardContent>
    </Card>
  );
}

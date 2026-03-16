import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, X, Star, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanoCotacao } from '@/hooks/usePlanosCotacao';

interface PlanoCardCotacaoProps {
  plano: PlanoCotacao;
  onSelect: (plano: PlanoCotacao) => void;
  planoBasico?: PlanoCotacao;
  isSelected?: boolean;
  selectionOrder?: number;
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
  isSelected,
  selectionOrder
}: PlanoCardCotacaoProps) {
  const diferenca = planoBasico && plano.id !== planoBasico.id
    ? plano.valorMensal - planoBasico.valorMensal
    : null;

  return (
    <Card 
      className={cn(
        "relative border-2 transition-all duration-200 cursor-pointer",
        plano.destaque && !isSelected && "border-primary shadow-[0_0_20px_hsl(var(--primary)/0.2)]",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background border-primary",
        !plano.destaque && !isSelected && "border-border hover:border-primary/50"
      )}
      onClick={() => onSelect(plano)}
    >
      {/* Badge de ordem de seleção */}
      {isSelected && selectionOrder && (
        <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-lg z-10">
          {selectionOrder}º
        </div>
      )}
      
      {/* Badge Recomendado ou Tag */}
      {(plano.destaque || plano.tag) && !isSelected && (
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
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                {plano.nome}
              </CardTitle>
              {plano.elegibilidadeStatus === 'negado' && (
                <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] px-1.5 py-0">
                  Restrição de modelo
                </Badge>
              )}
              {plano.elegibilidadeStatus === 'limitado' && (
                <Badge className="bg-amber-500/15 text-amber-600 border-amber-300 text-[10px] px-1.5 py-0">
                  Aceitação condicionada
                </Badge>
              )}
            </div>
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

        {/* Coberturas - com indicação visual de restrições */}
        <div className="space-y-1.5">
          {plano.coberturas.slice(0, 6).map((cobertura, index) => {
            // Verifica se esta cobertura está na lista de removidas (agora dinâmica do banco)
            const isRemovida = plano.coberturasRemovidas.some(
              rem => cobertura.toLowerCase().includes(rem.toLowerCase())
            );

            return (
              <div key={index} className="flex items-center gap-2 text-sm">
                {isRemovida ? (
                  <>
                    <X className="w-4 h-4 text-destructive shrink-0" />
                    <span className="text-muted-foreground line-through">
                      {cobertura}
                    </span>
                    <span className="text-xs text-destructive ml-auto">
                      (não disponível)
                    </span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="text-foreground/90">{cobertura}</span>
                  </>
                )}
              </div>
            );
          })}
          {plano.coberturas.length > 6 && (
            <p className="text-xs text-muted-foreground ml-6">
              +{plano.coberturas.length - 6} coberturas adicionais
            </p>
          )}
        </div>

        {/* Alerta de categoria especial - exibe quando há mensagem de alerta */}
        {plano.alertaDesagio && (
          <Alert className="border-amber-500/50 bg-amber-500/10 py-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
              {plano.alertaDesagio}
            </AlertDescription>
          </Alert>
        )}

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
          onClick={(e) => {
            e.stopPropagation();
            onSelect(plano);
          }}
          variant={isSelected ? "default" : plano.destaque ? "default" : "outline"}
          className={cn(
            "w-full",
            isSelected && "bg-primary/90",
            plano.destaque && !isSelected && "shadow-lg"
          )}
        >
          {isSelected ? '✓ Selecionado' : 'Adicionar à comparação'}
        </Button>

        {/* Filiação */}
        <p className="text-xs text-center text-muted-foreground">
          Filiação: {formatCurrency(plano.valorAdesao)}
        </p>
      </CardContent>
    </Card>
  );
}

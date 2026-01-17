import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Shield, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlanoOpcao {
  id: string;
  nome: string;
  codigo?: string;
  valorMensal: number;
  valorAdesao?: number;
  coberturas?: string[];
  destaque?: boolean;
  nivel?: 'basic' | 'premium' | 'exclusive';
}

interface EscolhaPlanoProps {
  planos: PlanoOpcao[];
  planoSelecionadoId: string | null;
  onSelectPlano: (planoId: string) => void;
  onConfirmar: () => void;
  isLoading?: boolean;
}

const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
};

const getNivelIcon = (nivel?: string) => {
  switch (nivel) {
    case 'exclusive':
      return <Star className="h-4 w-4 text-yellow-500" />;
    case 'premium':
      return <Zap className="h-4 w-4 text-purple-500" />;
    default:
      return <Shield className="h-4 w-4 text-primary" />;
  }
};

const getNivelLabel = (nivel?: string) => {
  switch (nivel) {
    case 'exclusive':
      return 'Exclusive';
    case 'premium':
      return 'Premium';
    default:
      return 'Basic';
  }
};

export function EscolhaPlano({
  planos,
  planoSelecionadoId,
  onSelectPlano,
  onConfirmar,
  isLoading,
}: EscolhaPlanoProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Escolha seu plano</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione a opção que melhor atende suas necessidades
        </p>
      </div>

      <div className="grid gap-4">
        {planos.map((plano) => {
          const isSelected = plano.id === planoSelecionadoId;

          return (
            <Card
              key={plano.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                isSelected && 'ring-2 ring-primary border-primary',
                plano.destaque && 'border-primary/50'
              )}
              onClick={() => onSelectPlano(plano.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getNivelIcon(plano.nivel)}
                      <span className="font-semibold">{plano.nome}</span>
                      {plano.destaque && (
                        <Badge variant="secondary" className="text-xs">
                          Recomendado
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-bold text-primary">
                        {formatarMoeda(plano.valorMensal)}
                      </span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>

                    {plano.valorAdesao && plano.valorAdesao > 0 && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Taxa de adesão: {formatarMoeda(plano.valorAdesao)}
                      </p>
                    )}

                    {plano.coberturas && plano.coberturas.length > 0 && (
                      <div className="space-y-1">
                        {plano.coberturas.slice(0, 4).map((cobertura, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                            <span className="truncate">{cobertura}</span>
                          </div>
                        ))}
                        {plano.coberturas.length > 4 && (
                          <p className="text-xs text-muted-foreground pl-5">
                            + {plano.coberturas.length - 4} coberturas
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                      isSelected
                        ? 'border-primary bg-primary'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {isSelected && <Check className="h-4 w-4 text-primary-foreground" />}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={onConfirmar}
        disabled={!planoSelecionadoId || isLoading}
      >
        {isLoading ? 'Carregando...' : 'Continuar'}
      </Button>
    </div>
  );
}

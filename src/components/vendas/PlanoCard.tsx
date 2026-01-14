import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanoCardProps {
  plano: {
    id: string;
    nome: string;
    descricao: string;
    coberturas: string[];
    valorAdesao: number;
    valorMensal: number;
    destaque?: boolean;
  };
  selecionado?: boolean;
  onSelecionar?: () => void;
}

export function PlanoCard({ plano, selecionado, onSelecionar }: PlanoCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div
      className={cn(
        'relative rounded-lg border bg-card p-4 transition-all',
        selecionado && 'ring-2 ring-primary border-primary',
        plano.destaque && 'border-primary/50'
      )}
    >
      {/* Badge destaque */}
      {plano.destaque && (
        <Badge className="absolute -top-2 right-3 bg-primary text-primary-foreground">
          ⭐ Recomendado
        </Badge>
      )}

      {/* Borda colorida à esquerda */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 rounded-l-lg',
          plano.destaque ? 'bg-primary' : 'bg-muted-foreground/30'
        )}
      />

      {/* Header */}
      <div className="mb-3 pl-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">{plano.nome}</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{plano.descricao}</p>
      </div>

      {/* Coberturas */}
      <div className="space-y-1.5 mb-4 pl-3">
        {plano.coberturas.map((cobertura, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
            <span>{cobertura}</span>
          </div>
        ))}
      </div>

      {/* Valores */}
      <div className="flex items-end justify-between gap-4 mb-4 pl-3">
        <div>
          <span className="text-xs text-muted-foreground">Filiação</span>
          <p className="font-medium">{formatCurrency(plano.valorAdesao)}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-muted-foreground">Mensalidade</span>
          <p className="font-bold text-xl text-primary">
            {formatCurrency(plano.valorMensal)}
          </p>
        </div>
      </div>

      {/* Botão */}
      <div className="pl-3">
        <Button
          onClick={onSelecionar}
          variant={selecionado ? 'default' : 'outline'}
          className="w-full"
        >
          {selecionado ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Selecionado
            </>
          ) : (
            'Selecionar'
          )}
        </Button>
      </div>
    </div>
  );
}

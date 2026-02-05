import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { Check, X, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Comissao, StatusComissao } from '@/types/comissoes';

interface ComissaoCardProps {
  comissao: Comissao;
  onAprovar?: (id: string) => void;
  onCancelar?: (id: string) => void;
  onMarcarPaga?: (id: string) => void;
  showVendedor?: boolean;
  showActions?: boolean;
}

const statusConfig: Record<StatusComissao, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', variant: 'secondary' },
  aprovada: { label: 'Aprovada', variant: 'default' },
  paga: { label: 'Paga', variant: 'outline' },
  cancelada: { label: 'Cancelada', variant: 'destructive' },
};

export function ComissaoCard({
  comissao,
  onAprovar,
  onCancelar,
  onMarcarPaga,
  showVendedor = true,
  showActions = true,
}: ComissaoCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const status = statusConfig[comissao.status];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Vendedor */}
            {showVendedor && comissao.vendedor && (
              <div className="flex items-center gap-2 mb-2">
                <UserAvatar
                  src={comissao.vendedor.avatar_url}
                  name={comissao.vendedor.nome}
                  size="sm"
                />
                <span className="font-medium text-sm truncate">
                  {comissao.vendedor.nome}
                </span>
              </div>
            )}

            {/* Contrato/Associado */}
            <div className="text-sm text-muted-foreground mb-1">
              {comissao.contrato?.associado?.nome}
              {comissao.contrato?.veiculo?.placa && (
                <span className="ml-2 text-xs">
                  ({comissao.contrato.veiculo.placa})
                </span>
              )}
            </div>

            {/* Período */}
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(comissao.ano_referencia, comissao.mes_referencia - 1), 'MMMM yyyy', { locale: ptBR })}
            </div>

            {/* Detalhes do cálculo */}
            <div className="mt-2 text-xs text-muted-foreground">
              Base: {formatCurrency(comissao.valor_base)} × {comissao.percentual_aplicado}%
              {comissao.bonus_meta && comissao.bonus_meta > 0 && (
                <span className="text-primary ml-1">
                  + bônus {formatCurrency(comissao.bonus_meta)}
                </span>
              )}
            </div>
          </div>

          <div className="text-right flex flex-col items-end gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            
            <div className="text-lg font-semibold text-primary">
              {formatCurrency(comissao.valor_total)}
            </div>

            {/* Ações */}
            {showActions && (
              <div className="flex gap-1">
                {comissao.status === 'pendente' && onAprovar && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => onAprovar(comissao.id)}
                    title="Aprovar"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                {comissao.status === 'pendente' && onCancelar && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onCancelar(comissao.id)}
                    title="Cancelar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {comissao.status === 'aprovada' && onMarcarPaga && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10"
                    onClick={() => onMarcarPaga(comissao.id)}
                    title="Marcar como paga"
                  >
                    <DollarSign className="h-4 w-4" />
                  </Button>
                )}
                {comissao.status === 'paga' && (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlanoDetalhes {
  id: string;
  nome: string;
  valorMensal: number;
  valorAdesao?: number;
  coberturas?: string[];
  naoInclui?: string[];
  cota?: number;
  taxaAdministrativa?: number;
  valorRastreamento?: number;
  valorAssistencia?: number;
}

interface PlanoDetalhesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plano: PlanoDetalhes | null;
  valorAdesao: number;
  categoriaVeiculo?: string;
  onSelecionar?: (plano: PlanoDetalhes) => void;
  isCoberturaRemovida?: (cobertura: string, categoria?: string) => boolean;
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value && value !== 0) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function PlanoDetalhesModal({
  open,
  onOpenChange,
  plano,
  valorAdesao,
  categoriaVeiculo,
  onSelecionar,
  isCoberturaRemovida,
}: PlanoDetalhesModalProps) {
  if (!plano) return null;

  const adesaoFinal = plano.valorAdesao ?? valorAdesao ?? 0;
  const primeiroPagamento = adesaoFinal + (plano.valorMensal ?? 0);
  const coberturas = plano.coberturas || [];
  const naoInclui = plano.naoInclui || [];

  // Dividir coberturas em 2 colunas
  const meio = Math.ceil(coberturas.length / 2);
  const coberturasCol1 = coberturas.slice(0, meio);
  const coberturasCol2 = coberturas.slice(meio);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{plano.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Coberturas em 2 colunas */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">
              COBERTURAS INCLUÍDAS
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              {[...coberturasCol1, ...coberturasCol2].map((cobertura, i) => {
                const isRemovida = isCoberturaRemovida?.(cobertura, categoriaVeiculo) || false;
                
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-2 text-sm py-1",
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
            </div>

            {/* Não inclui */}
            {naoInclui.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                  NÃO INCLUI
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  {naoInclui.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <X className="h-4 w-4 flex-shrink-0" />
                      <span className="line-through">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Composição do valor */}
          <div>
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">
              COMPOSIÇÃO DO VALOR
            </h4>
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-2">
                {plano.cota !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cota Base</span>
                    <span>{formatCurrency(plano.cota)}</span>
                  </div>
                )}
                {plano.taxaAdministrativa !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxa Administrativa</span>
                    <span>{formatCurrency(plano.taxaAdministrativa)}</span>
                  </div>
                )}
                {plano.valorRastreamento !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rastreamento</span>
                    <span>{formatCurrency(plano.valorRastreamento)}</span>
                  </div>
                )}
                {plano.valorAssistencia !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Assistência 24h</span>
                    <span>{formatCurrency(plano.valorAssistencia)}</span>
                  </div>
                )}

                <Separator className="my-2" />

                <div className="flex justify-between font-bold text-primary">
                  <span>MENSALIDADE</span>
                  <span>{formatCurrency(plano.valorMensal)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Taxa de adesão */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Taxa de Adesão (pagamento único)</span>
            <span className="font-medium">{formatCurrency(adesaoFinal)}</span>
          </div>

          {/* Primeiro pagamento destaque */}
          <div className="bg-green-500 text-white rounded-xl p-4 text-center">
            <p className="text-sm opacity-90">PRIMEIRO PAGAMENTO</p>
            <p className="text-3xl font-bold">{formatCurrency(primeiroPagamento)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="w-full"
            onClick={() => {
              onSelecionar?.(plano);
              onOpenChange(false);
            }}
          >
            Selecionar este plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

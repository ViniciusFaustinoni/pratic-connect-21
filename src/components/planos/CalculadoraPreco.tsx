import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calculator } from 'lucide-react';
import { useTabelasPreco } from '@/hooks/usePlanos';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function CalculadoraPreco() {
  const [valorFipe, setValorFipe] = useState<string>('');
  const [resultado, setResultado] = useState<{ taxa: number; faixa: string } | null>(null);
  const { data: tabelas } = useTabelasPreco();

  const calcular = () => {
    const valor = parseFloat(valorFipe.replace(/\D/g, '')) / 100;
    
    if (!valor || !tabelas) {
      setResultado(null);
      return;
    }

    const faixa = tabelas.find(
      t => valor >= Number(t.fipe_de) && valor <= Number(t.fipe_ate)
    );

    if (faixa) {
      setResultado({
        taxa: Number(faixa.taxa_comercial) || 0,
        faixa: `${formatCurrency(Number(faixa.fipe_de))} - ${formatCurrency(Number(faixa.fipe_ate))}`,
      });
    } else {
      setResultado(null);
    }
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(raw) / 100);
    setValorFipe(formatted);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Calculator className="h-4 w-4 mr-2" />
          Calculadora
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Calculadora de Preço</DialogTitle>
          <DialogDescription>
            Informe o valor FIPE para calcular a mensalidade estimada
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="valorFipe">Valor FIPE do Veículo</Label>
            <Input
              id="valorFipe"
              placeholder="R$ 0,00"
              value={valorFipe}
              onChange={handleValorChange}
            />
          </div>
          <Button onClick={calcular} className="w-full">
            Calcular
          </Button>
          {resultado && (
            <div className="p-4 rounded-lg bg-muted space-y-2">
              <p className="text-sm text-muted-foreground">Faixa: {resultado.faixa}</p>
              <p className="text-lg font-semibold">
                Mensalidade estimada: {formatCurrency(resultado.taxa)}
              </p>
            </div>
          )}
          {valorFipe && !resultado && (
            <p className="text-sm text-muted-foreground text-center">
              Nenhuma faixa encontrada para este valor
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

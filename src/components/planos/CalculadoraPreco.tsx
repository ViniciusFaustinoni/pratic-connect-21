import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calculator, Fuel, MapPin, Car } from 'lucide-react';
import { 
  PRECOS_SELECT_RJ, 
  calcularPrecoRegiao,
  ADICIONAL_NIVEL,
  type Regiao 
} from '@/data/planosPrecos';

interface ResultadoCalculo {
  plano: string;
  nivel: string;
  mensalidade: number;
  desagio: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function CalculadoraPreco() {
  const [open, setOpen] = useState(false);
  const [valorFipe, setValorFipe] = useState('');
  const [regiao, setRegiao] = useState<Regiao>('rj');
  const [combustivel, setCombustivel] = useState<'gasolina' | 'diesel'>('gasolina');
  const [resultados, setResultados] = useState<ResultadoCalculo[]>([]);

  const calcular = () => {
    const fipe = parseFloat(valorFipe.replace(/\D/g, ''));
    if (isNaN(fipe) || fipe <= 0) return;

    // Encontrar faixa de preço
    const faixa = PRECOS_SELECT_RJ.find(
      f => fipe >= f.fipeMin && fipe <= f.fipeMax
    );

    if (!faixa) {
      setResultados([]);
      return;
    }

    const precoBase = combustivel === 'gasolina' ? faixa.gasolina : faixa.diesel;
    const precoDesagio = combustivel === 'gasolina' ? faixa.desagioGasolina : faixa.desagioDiesel;

    const precoRegiao = calcularPrecoRegiao(precoBase, regiao);
    const precoDesagioRegiao = calcularPrecoRegiao(precoDesagio, regiao);

    const novosResultados: ResultadoCalculo[] = [
      {
        plano: 'Select',
        nivel: 'Basic',
        mensalidade: precoRegiao + ADICIONAL_NIVEL.basic,
        desagio: precoDesagioRegiao + ADICIONAL_NIVEL.basic,
      },
      {
        plano: 'Select',
        nivel: 'Premium',
        mensalidade: precoRegiao + ADICIONAL_NIVEL.premium,
        desagio: precoDesagioRegiao + ADICIONAL_NIVEL.premium,
      },
      {
        plano: 'Select',
        nivel: 'Exclusive',
        mensalidade: precoRegiao + ADICIONAL_NIVEL.exclusive,
        desagio: precoDesagioRegiao + ADICIONAL_NIVEL.exclusive,
      },
    ];

    setResultados(novosResultados);
  };

  const handleValorFipeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(parseInt(value) || 0);
    setValorFipe(formatted);
  };

  const limpar = () => {
    setValorFipe('');
    setResultados([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Calculator className="h-4 w-4" />
          Calculadora
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculadora de Mensalidade
          </DialogTitle>
          <DialogDescription>
            Calcule a mensalidade estimada com base no valor FIPE do veículo
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Valor FIPE */}
          <div className="space-y-2">
            <Label htmlFor="fipe" className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Valor FIPE
            </Label>
            <Input
              id="fipe"
              placeholder="R$ 0"
              value={valorFipe}
              onChange={handleValorFipeChange}
              className="text-lg font-semibold"
            />
          </div>

          {/* Região */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Região
            </Label>
            <Select value={regiao} onValueChange={(v) => setRegiao(v as Regiao)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a região" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rj">Rio de Janeiro</SelectItem>
                <SelectItem value="lagos">Região dos Lagos</SelectItem>
                <SelectItem value="sp">São Paulo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Combustível */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Fuel className="h-4 w-4" />
              Combustível
            </Label>
            <Select 
              value={combustivel} 
              onValueChange={(v) => setCombustivel(v as 'gasolina' | 'diesel')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o combustível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gasolina">Gasolina / Flex</SelectItem>
                <SelectItem value="diesel">Diesel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-2">
            <Button onClick={calcular} className="flex-1">
              Calcular
            </Button>
            <Button variant="outline" onClick={limpar}>
              Limpar
            </Button>
          </div>

          {/* Resultados */}
          {resultados.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="font-semibold text-sm">Mensalidades Estimadas:</h4>
              <div className="grid gap-2">
                {resultados.map((resultado, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{resultado.plano}</span>
                          <Badge variant="secondary" className="text-xs">
                            {resultado.nivel}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">
                            {formatCurrency(resultado.mensalidade)}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Com deságio: {formatCurrency(resultado.desagio)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                * Valores sujeitos a alteração. Consulte a tabela completa.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Car, 
  Lock,
  Pencil,
  ArrowLeft,
  Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRegioesAtivas } from '@/hooks/useRegioes';
import { useCombustiveis, useMarcasModelosFallback } from '@/hooks/useConteudosSistema';
import { COMBUSTIVEIS_FALLBACK } from '@/data/combustiveis';

interface VeiculoEncontrado {
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  cor?: string;
  combustivel?: string;
  codigoFipe?: string;
  valorFipe?: number;
}

interface EtapaDadosVeiculoProps {
  veiculoFipe: VeiculoEncontrado | null;
  modoEntrada: 'fipe' | 'manual';
  marca: string;
  setMarca: (marca: string) => void;
  modelo: string;
  setModelo: (modelo: string) => void;
  ano: string;
  setAno: (ano: string) => void;
  valorFipe: number | null;
  setValorFipe: (valor: number | null) => void;
  combustivel: string;
  setCombustivel: (combustivel: string) => void;
  regiao: string;
  setRegiao: (regiao: string) => void;
  onBack: () => void;
  onCalcular: () => void;
  isCalculando: boolean;
}

// MARCAS e MODELOS agora vêm do banco via useMarcasModelosFallback()
// Fallback local mantido como constante caso o hook não retorne dados
const MARCAS_FALLBACK = [
  'Volkswagen', 'Chevrolet', 'Fiat', 'Ford', 'Hyundai', 
  'Toyota', 'Honda', 'Renault', 'Nissan', 'Jeep', 
  'Peugeot', 'Citroën', 'Mitsubishi', 'Kia', 'BYD', 'Caoa Chery', 'RAM', 'Outras'
];

const ANOS = Array.from({ length: 17 }, (_, i) => String(2026 - i));

// COMBUSTIVEIS agora vem do banco via useCombustiveis() — fallback em combustiveis.ts

// REGIOES agora vem do banco via useRegioesAtivas()

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const parseCurrency = (value: string): number | null => {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

export function EtapaDadosVeiculo({
  veiculoFipe,
  modoEntrada,
  marca,
  setMarca,
  modelo,
  setModelo,
  ano,
  setAno,
  valorFipe,
  setValorFipe,
  combustivel,
  setCombustivel,
  regiao,
  setRegiao,
  onBack,
  onCalcular,
  isCalculando,
}: EtapaDadosVeiculoProps) {
  const { data: regioesDb = [] } = useRegioesAtivas();
  const REGIOES = regioesDb.map(r => ({ value: r.codigo.toLowerCase(), label: r.nome }));

  const [camposDesbloqueados, setCamposDesbloqueados] = useState(modoEntrada === 'manual');
  const [valorFipeInput, setValorFipeInput] = useState(
    valorFipe ? formatCurrency(valorFipe) : ''
  );

  const isFromFipe = modoEntrada === 'fipe' && !camposDesbloqueados;

  const modelosDisponiveis = useMemo(() => {
    if (!marca) return [];
    return MODELOS_POR_MARCA[marca] || [];
  }, [marca]);

  const handleValorFipeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValorFipeInput(value);
    const parsed = parseCurrency(value);
    setValorFipe(parsed);
  };

  const handleDesbloquear = () => {
    setCamposDesbloqueados(true);
  };

  const canCalculate = marca && modelo && ano && valorFipe && combustivel && regiao;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Dados do Veículo</CardTitle>
              <CardDescription>
                {modoEntrada === 'fipe' 
                  ? 'Dados preenchidos automaticamente via FIPE'
                  : 'Preencha os dados do veículo manualmente'}
              </CardDescription>
            </div>
          </div>
          
          {/* Badge de origem */}
          <Badge 
            variant="secondary"
            className={cn(
              "text-xs",
              modoEntrada === 'fipe' 
                ? "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30" 
                : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
            )}
          >
            {modoEntrada === 'fipe' ? '✓ Via FIPE' : '✎ Manual'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Grid de campos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Marca */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Marca <span className="text-destructive">*</span>
              {isFromFipe && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            {isFromFipe ? (
              <Input 
                value={marca} 
                disabled 
                className="bg-muted/50" 
              />
            ) : (
              <Select value={marca} onValueChange={setMarca}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a marca" />
                </SelectTrigger>
                <SelectContent>
                  {MARCAS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Modelo */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Modelo <span className="text-destructive">*</span>
              {isFromFipe && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            {isFromFipe ? (
              <Input 
                value={modelo} 
                disabled 
                className="bg-muted/50" 
              />
            ) : (
              <Select value={modelo} onValueChange={setModelo} disabled={!marca}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo" />
                </SelectTrigger>
                <SelectContent>
                  {modelosDisponiveis.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Ano */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Ano Modelo <span className="text-destructive">*</span>
              {isFromFipe && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            {isFromFipe ? (
              <Input 
                value={ano} 
                disabled 
                className="bg-muted/50" 
              />
            ) : (
              <Select value={ano} onValueChange={setAno}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {ANOS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Valor FIPE */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Valor FIPE <span className="text-destructive">*</span>
              {isFromFipe && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            {isFromFipe ? (
              <Input 
                value={valorFipe ? formatCurrency(valorFipe) : ''} 
                disabled 
                className="bg-muted/50" 
              />
            ) : (
              <Input 
                placeholder="R$ 0,00"
                value={valorFipeInput}
                onChange={handleValorFipeChange}
              />
            )}
          </div>

          {/* Combustível */}
          <div className="space-y-2">
            <Label>
              Combustível <span className="text-destructive">*</span>
            </Label>
            <Select value={combustivel} onValueChange={setCombustivel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o combustível" />
              </SelectTrigger>
              <SelectContent>
                {COMBUSTIVEIS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Região */}
          <div className="space-y-2">
            <Label>
              Região <span className="text-destructive">*</span>
            </Label>
            <Select value={regiao} onValueChange={setRegiao}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a região" />
              </SelectTrigger>
              <SelectContent>
                {REGIOES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botão editar (só aparece se veio da FIPE e ainda não desbloqueou) */}
        {modoEntrada === 'fipe' && !camposDesbloqueados && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDesbloquear}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="mr-2 h-4 w-4" />
            Editar dados
          </Button>
        )}

        {/* Navegação */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onBack}
            size="lg"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          
          <Button
            onClick={onCalcular}
            disabled={!canCalculate || isCalculando}
            size="lg"
            className="min-w-[180px]"
          >
            {isCalculando ? (
              <>
                <Calculator className="mr-2 h-4 w-4 animate-pulse" />
                Calculando...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-4 w-4" />
                Calcular Cotação
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

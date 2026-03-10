import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calculator, Check, Car, Briefcase } from 'lucide-react';
import { useTabelasPreco } from '@/hooks/usePlanos';
import { useFatorVeiculoAntigo, useFatorUsoTrabalho } from '@/hooks/useConteudosSistema';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

interface ResultadoFaixa {
  faixaFipe: string;
  valorMinimo: number;
  valorMaximo: number;
  planoMinimo: string;
  planoMaximo: string;
  fatoresAplicados: string[];
  valorFipeInformado: number;
}

type AnoVeiculo = 'recente' | 'antigo';
type TipoUso = 'particular' | 'trabalho';
type CoberturaDesejada = 'todas' | 'basica' | 'completa' | 'premium';

// Fatores de risco agora vêm do banco via useFatorVeiculoAntigo() e useFatorUsoTrabalho()

export function CalculadoraPreco() {
  const [valorFipe, setValorFipe] = useState<string>('');
  const [anoVeiculo, setAnoVeiculo] = useState<AnoVeiculo>('recente');
  const [tipoUso, setTipoUso] = useState<TipoUso>('particular');
  const [coberturaDesejada, setCoberturaDesejada] = useState<CoberturaDesejada>('todas');
  const [resultado, setResultado] = useState<ResultadoFaixa | null>(null);
  
  const { data: tabelas } = useTabelasPreco();
  const { data: FATOR_VEICULO_ANTIGO = 1.15 } = useFatorVeiculoAntigo();
  const { data: FATOR_USO_TRABALHO = 1.20 } = useFatorUsoTrabalho();

  const calcular = () => {
    const valor = parseFloat(valorFipe.replace(/\D/g, '')) / 100;
    
    if (!valor || !tabelas || tabelas.length === 0) {
      setResultado(null);
      return;
    }

    // Buscar faixas FIPE correspondentes
    const faixasEncontradas = tabelas.filter(
      t => valor >= Number(t.fipe_de) && valor <= Number(t.fipe_ate)
    );

    if (faixasEncontradas.length === 0) {
      setResultado(null);
      return;
    }

    // Calcular fator de risco
    let fator = 1.0;
    const fatoresAplicados: string[] = [];

    if (anoVeiculo === 'antigo') {
      fator *= FATOR_VEICULO_ANTIGO;
      const pctAntigo = Math.round((FATOR_VEICULO_ANTIGO - 1) * 100);
      fatoresAplicados.push(`Veículo com mais de 10 anos (+${pctAntigo}%)`);
    } else {
      fatoresAplicados.push('Veículo até 10 anos');
    }

    if (tipoUso === 'trabalho') {
      fator *= FATOR_USO_TRABALHO;
      const pctTrabalho = Math.round((FATOR_USO_TRABALHO - 1) * 100);
      fatoresAplicados.push(`Uso para trabalho/app (+${pctTrabalho}%)`);
    } else {
      fatoresAplicados.push('Uso particular');
    }

    // Filtrar por cobertura se especificado
    let faixasFiltradas = faixasEncontradas;
    if (coberturaDesejada !== 'todas') {
      const nomeCobertura = {
        basica: 'básica',
        completa: 'total',
        premium: 'premium',
      }[coberturaDesejada];
      
      faixasFiltradas = faixasEncontradas.filter(f => 
        f.planos?.nome?.toLowerCase().includes(nomeCobertura)
      );
      
      // Se não encontrou com filtro, usar todas
      if (faixasFiltradas.length === 0) {
        faixasFiltradas = faixasEncontradas;
      }
    }

    // Calcular valores mensais para cada plano
    const valoresCalculados = faixasFiltradas.map(f => {
      // Base = taxa_comercial ou soma dos componentes
      const taxaComercial = Number(f.taxa_comercial) || 0;
      const taxaAdmin = Number(f.taxa_administrativa) || 0;
      const valorRastreamento = Number(f.valor_rastreamento) || 0;
      const valorAssistencia = Number(f.valor_assistencia) || 0;
      const valorCota = Number(f.valor_cota) || 0;
      
      // Usar taxa_comercial se disponível, senão somar componentes
      const valorBase = taxaComercial > 0 
        ? taxaComercial 
        : taxaAdmin + valorRastreamento + valorAssistencia + valorCota;
      
      return {
        valor: valorBase * fator,
        plano: f.planos?.nome || 'Plano',
      };
    });

    if (valoresCalculados.length === 0) {
      setResultado(null);
      return;
    }

    // Ordenar por valor
    valoresCalculados.sort((a, b) => a.valor - b.valor);

    const menorValor = valoresCalculados[0];
    const maiorValor = valoresCalculados[valoresCalculados.length - 1];

    // Pegar info da faixa
    const primeiraFaixa = faixasEncontradas[0];
    
    setResultado({
      faixaFipe: `${formatCurrency(Number(primeiraFaixa.fipe_de))} - ${formatCurrency(Number(primeiraFaixa.fipe_ate))}`,
      valorMinimo: menorValor.valor,
      valorMaximo: maiorValor.valor,
      planoMinimo: menorValor.plano,
      planoMaximo: maiorValor.plano,
      fatoresAplicados,
      valorFipeInformado: valor,
    });
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(Number(raw) / 100);
    setValorFipe(formatted);
  };

  const limpar = () => {
    setValorFipe('');
    setAnoVeiculo('recente');
    setTipoUso('particular');
    setCoberturaDesejada('todas');
    setResultado(null);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Calculator className="h-4 w-4 mr-2" />
          Calculadora
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Calculadora de Preço</DialogTitle>
          <DialogDescription>
            Simule rapidamente a faixa de mensalidade
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-5">
          {/* Valor FIPE */}
          <div className="space-y-2">
            <Label htmlFor="valorFipe">Valor FIPE do Veículo</Label>
            <Input
              id="valorFipe"
              placeholder="R$ 0,00"
              value={valorFipe}
              onChange={handleValorChange}
            />
          </div>

          {/* Ano do Veículo */}
          <div className="space-y-2">
            <Label>Ano do Veículo</Label>
            <ToggleGroup 
              type="single" 
              value={anoVeiculo} 
              onValueChange={(v) => v && setAnoVeiculo(v as AnoVeiculo)}
              className="justify-start"
            >
              <ToggleGroupItem value="recente" aria-label="Até 10 anos" className="flex-1">
                Até 10 anos
              </ToggleGroupItem>
              <ToggleGroupItem value="antigo" aria-label="Mais de 10 anos" className="flex-1">
                Mais de 10 anos
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Tipo de Uso */}
          <div className="space-y-2">
            <Label>Tipo de Uso</Label>
            <ToggleGroup 
              type="single" 
              value={tipoUso} 
              onValueChange={(v) => v && setTipoUso(v as TipoUso)}
              className="justify-start"
            >
              <ToggleGroupItem value="particular" aria-label="Particular" className="flex-1 gap-2">
                <Car className="h-4 w-4" />
                Particular
              </ToggleGroupItem>
              <ToggleGroupItem value="trabalho" aria-label="Trabalho/App" className="flex-1 gap-2">
                <Briefcase className="h-4 w-4" />
                Trabalho/App
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Cobertura */}
          <div className="space-y-2">
            <Label>Cobertura</Label>
            <Select value={coberturaDesejada} onValueChange={(v) => setCoberturaDesejada(v as CoberturaDesejada)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a cobertura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as opções</SelectItem>
                <SelectItem value="basica">Proteção Básica</SelectItem>
                <SelectItem value="completa">Proteção Total</SelectItem>
                <SelectItem value="premium">Proteção Premium</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Botões */}
          <div className="flex gap-2">
            <Button onClick={calcular} className="flex-1">
              Calcular
            </Button>
            <Button variant="outline" onClick={limpar}>
              Limpar
            </Button>
          </div>

          {/* Resultado */}
          {resultado && (
            <div className="space-y-4 pt-4 border-t">
              {/* Header do resultado */}
              <div className="text-sm text-muted-foreground">
                <p>Estimativa para veículo {formatCurrency(resultado.valorFipeInformado)}</p>
                <p className="text-xs">Faixa FIPE: {resultado.faixaFipe}</p>
              </div>

              {/* Valores */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center space-y-2">
                <p className="text-sm text-muted-foreground">Mensalidade estimada:</p>
                <p className="text-2xl font-bold text-primary">
                  {resultado.valorMinimo === resultado.valorMaximo ? (
                    formatCurrency(resultado.valorMinimo)
                  ) : (
                    <>
                      {formatCurrency(resultado.valorMinimo)} a {formatCurrency(resultado.valorMaximo)}
                    </>
                  )}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                {resultado.valorMinimo !== resultado.valorMaximo && (
                  <p className="text-xs text-muted-foreground">
                    {resultado.planoMinimo} até {resultado.planoMaximo}
                  </p>
                )}
              </div>

              {/* Critérios aplicados */}
              <div className="space-y-1">
                <p className="text-sm font-medium">Critérios aplicados:</p>
                {resultado.fatoresAplicados.map((fator, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    {fator}
                  </div>
                ))}
              </div>

              {/* Disclaimer */}
              <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                * Valores sujeitos a análise. Entre em contato para cotação personalizada.
              </p>
            </div>
          )}

          {/* Mensagem quando não encontra */}
          {valorFipe && !resultado && (
            <p className="text-sm text-muted-foreground text-center">
              Nenhuma faixa encontrada para este valor. Tente outro valor FIPE.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

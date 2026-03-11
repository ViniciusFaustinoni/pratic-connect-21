import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calculator, Check, Car, Briefcase } from 'lucide-react';
import { useTabelasPreco } from '@/hooks/usePlanos';
import { formatarMoeda } from '@/utils/format';
import { resolverTipoUsoQuery, resolverPrecoApp } from '@/utils/precoApp';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface ResultadoLinha {
  linha: string;
  linhaLabel: string;
  valorMensal: number;
  valorDesagio: number | null;
}

interface ResultadoCalc {
  linhas: ResultadoLinha[];
  faixaFipe: string;
  valorFipeInformado: number;
  regiaoLabel: string;
  tipoUsoLabel: string;
}

type TipoUso = 'particular' | 'aplicativo';

const REGIOES = [
  { value: 'rj', label: 'Rio de Janeiro' },
  { value: 'lagos', label: 'Região dos Lagos' },
  { value: 'sp', label: 'São Paulo' },
] as const;

const LINHA_LABELS: Record<string, string> = {
  select: 'Select',
  'select-one': 'Select One',
  'select-premium': 'Select Premium',
  lancamento: 'Lançamento',
  especial: 'Especial',
  advanced: 'Advanced',
  eletrico: 'Elétrico',
};

function useAdicionalApp() {
  return useQuery({
    queryKey: ['configuracoes', 'adicional_app'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'adicional_app')
        .single();
      return parseFloat(data?.valor || '35.90') || 35.90;
    },
  });
}

export function CalculadoraPreco() {
  const [valorFipe, setValorFipe] = useState<string>('');
  const [tipoUso, setTipoUso] = useState<TipoUso>('particular');
  const [regiao, setRegiao] = useState<string>('rj');
  const [resultado, setResultado] = useState<ResultadoCalc | null>(null);
  const [semResultado, setSemResultado] = useState(false);

  const { data: tabelas } = useTabelasPreco();
  const { data: adicionalApp = 35.90 } = useAdicionalApp();

  const calcular = () => {
    const valor = parseFloat(valorFipe.replace(/\D/g, '')) / 100;

    if (!valor || !tabelas || tabelas.length === 0) {
      setResultado(null);
      setSemResultado(!!valor);
      return;
    }

    // Get unique linha_slugs from the data
    const linhasSlugs = [...new Set(tabelas.map(t => t.linha_slug).filter(Boolean))] as string[];

    const linhas: ResultadoLinha[] = [];

    for (const linhaSlug of linhasSlugs) {
      // Determine which tipo_uso to query for this linha/regiao
      const tipoUsoPricing = resolverTipoUsoQuery(linhaSlug, regiao, tipoUso);

      // Find matching row
      const faixa = tabelas.find(t =>
        t.linha_slug === linhaSlug &&
        t.regiao === regiao &&
        t.tipo_uso === tipoUsoPricing &&
        valor >= Number(t.fipe_min) &&
        valor <= Number(t.fipe_max)
      );

      if (!faixa || Number(faixa.valor_mensal) <= 0) continue;

      let valorMensal = Number(faixa.valor_mensal);

      // Apply app surcharge if needed
      if (tipoUso === 'aplicativo') {
        valorMensal = resolverPrecoApp(linhaSlug, regiao, tipoUso, valorMensal, adicionalApp);
      }

      linhas.push({
        linha: linhaSlug,
        linhaLabel: LINHA_LABELS[linhaSlug] || linhaSlug,
        valorMensal: Math.round(valorMensal * 100) / 100,
        valorDesagio: faixa.valor_desagio != null ? Number(faixa.valor_desagio) : null,
      });
    }

    if (linhas.length === 0) {
      setResultado(null);
      setSemResultado(true);
      return;
    }

    // Sort by price ascending
    linhas.sort((a, b) => a.valorMensal - b.valorMensal);

    // Get faixa description from first match
    const primeiraFaixa = tabelas.find(t =>
      t.linha_slug === linhas[0].linha &&
      t.regiao === regiao &&
      valor >= Number(t.fipe_min) &&
      valor <= Number(t.fipe_max)
    );

    setResultado({
      linhas,
      faixaFipe: primeiraFaixa
        ? `${formatarMoeda(Number(primeiraFaixa.fipe_min))} - ${formatarMoeda(Number(primeiraFaixa.fipe_max))}`
        : '',
      valorFipeInformado: valor,
      regiaoLabel: REGIOES.find(r => r.value === regiao)?.label || regiao,
      tipoUsoLabel: tipoUso === 'aplicativo' ? 'Aplicativo / Trabalho' : 'Particular',
    });
    setSemResultado(false);
  };

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const formatted = formatarMoeda(Number(raw) / 100);
    setValorFipe(formatted);
  };

  const limpar = () => {
    setValorFipe('');
    setTipoUso('particular');
    setRegiao('rj');
    setResultado(null);
    setSemResultado(false);
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
            Simule rapidamente a mensalidade por linha de produto
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

          {/* Região */}
          <div className="space-y-2">
            <Label>Região</Label>
            <Select value={regiao} onValueChange={setRegiao}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a região" />
              </SelectTrigger>
              <SelectContent>
                {REGIOES.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <ToggleGroupItem value="aplicativo" aria-label="Aplicativo/Trabalho" className="flex-1 gap-2">
                <Briefcase className="h-4 w-4" />
                Aplicativo
              </ToggleGroupItem>
            </ToggleGroup>
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
              <div className="text-sm text-muted-foreground">
                <p>Veículo {formatarMoeda(resultado.valorFipeInformado)}</p>
                <p className="text-xs">Faixa: {resultado.faixaFipe}</p>
              </div>

              {/* Critérios */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  {resultado.regiaoLabel}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  {resultado.tipoUsoLabel}
                </span>
              </div>

              {/* Preços por linha */}
              <div className="space-y-2">
                {resultado.linhas.map((linha) => (
                  <div
                    key={linha.linha}
                    className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/10"
                  >
                    <span className="text-sm font-medium">{linha.linhaLabel}</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-primary">
                        {formatarMoeda(linha.valorMensal)}
                      </span>
                      <span className="text-xs text-muted-foreground">/mês</span>
                      {linha.valorDesagio != null && (
                        <p className="text-xs text-muted-foreground">
                          Deságio: {formatarMoeda(linha.valorDesagio)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2 border-t">
                * Valores da tabela vigente. Cotação final sujeita a análise.
              </p>
            </div>
          )}

          {semResultado && (
            <div className="text-center py-4">
              <p className="text-sm font-medium text-muted-foreground">
                Consulte um consultor
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Nenhuma faixa encontrada para este valor e região.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

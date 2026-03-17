import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, Save, Loader2, Scale, Info, ArrowRightLeft, AlertTriangle, DollarSign, ShieldCheck } from 'lucide-react';
import { useComissoesFaixas } from '@/hooks/useComissoesFaixas';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatarMoeda } from '@/utils/format';

interface PontuacaoConfig {
  pontos_nova_adesao: number;
  pontos_migracao_aprovada: number;
  pontos_indicacao_convertida: number;
  pontos_reativacao_120_dias: number;
  pontos_troca_titularidade: number;
  pontos_substituicao_placa: number;
  pontos_troca_titularidade_parcial: number;
  pontos_substituicao_placa_parcial: number;
  estorno_cancelamento_antes_1_boleto: boolean;
  prazo_reativacao_dias: number;
}

interface RepasseMaiorConfig {
  repasse_maior_corte_boletos: number;
  repasse_maior_pct_favoravel: number;
  repasse_maior_valor_favoravel: number;
  repasse_maior_pct_reduzido: number;
  repasse_maior_valor_reduzido: number;
}

interface MigracaoConfig {
  migracao_comprovantes_exigidos: number;
  migracao_prazo_resposta_horas: number;
  migracao_canal_oficial: string;
  migracao_isentar_carencia: boolean;
}

const PONTUACAO_DEFAULTS: PontuacaoConfig = {
  pontos_nova_adesao: 1,
  pontos_migracao_aprovada: 1,
  pontos_indicacao_convertida: 1,
  pontos_reativacao_120_dias: 1,
  pontos_troca_titularidade: 0.5,
  pontos_substituicao_placa: 0.5,
  pontos_troca_titularidade_parcial: 0,
  pontos_substituicao_placa_parcial: 0,
  estorno_cancelamento_antes_1_boleto: true,
  prazo_reativacao_dias: 120,
};

const REPASSE_DEFAULTS: RepasseMaiorConfig = {
  repasse_maior_corte_boletos: 4,
  repasse_maior_pct_favoravel: 50,
  repasse_maior_valor_favoravel: 100,
  repasse_maior_pct_reduzido: 70,
  repasse_maior_valor_reduzido: 150,
};

const MIGRACAO_DEFAULTS: MigracaoConfig = {
  migracao_comprovantes_exigidos: 3,
  migracao_prazo_resposta_horas: 48,
  migracao_canal_oficial: 'e-mail',
  migracao_isentar_carencia: true,
};

const CAMPOS_BLOCO1: { chave: keyof PontuacaoConfig; label: string }[] = [
  { chave: 'pontos_nova_adesao', label: 'Nova Adesão' },
  { chave: 'pontos_migracao_aprovada', label: 'Migração Aprovada' },
  { chave: 'pontos_indicacao_convertida', label: 'Indicação Convertida' },
  { chave: 'pontos_reativacao_120_dias', label: 'Reativação acima de 120 dias' },
  { chave: 'pontos_troca_titularidade', label: 'Troca de Titularidade com boleto quitado integralmente' },
  { chave: 'pontos_substituicao_placa', label: 'Substituição de Placa com boleto quitado integralmente' },
  { chave: 'pontos_troca_titularidade_parcial', label: 'Troca de Titularidade com pagamento parcial do boleto' },
  { chave: 'pontos_substituicao_placa_parcial', label: 'Substituição de Placa com pagamento parcial do boleto' },
];

const CHAVES_PARCIAL = ['pontos_troca_titularidade_parcial', 'pontos_substituicao_placa_parcial'];

const TAXAS_CHAVES = [
  'taxa_adesao_percentual_fipe',
  'taxa_adesao_minimo_volante',
  'taxa_adesao_minimo_base',
  'taxa_repasse_volante',
  'taxa_substituicao_placa',
  'taxa_troca_titularidade',
  'taxa_revistoria',
  'multa_rastreador',
] as const;

type TaxasConfig = Record<typeof TAXAS_CHAVES[number], string>;

const TAXAS_DEFAULTS: TaxasConfig = {
  taxa_adesao_percentual_fipe: '1',
  taxa_adesao_minimo_volante: '100',
  taxa_adesao_minimo_base: '100',
  taxa_repasse_volante: '50',
  taxa_substituicao_placa: '50',
  taxa_troca_titularidade: '50',
  taxa_revistoria: '50',
  multa_rastreador: '400',
};

// ═══════════ AUTORIZAÇÕES E EXCEÇÕES ═══════════

const AUTORIZACOES_CHAVES = [
  'excecao_faixas_vendas',
  'excecao_fipe_max_carro',
  'excecao_fipe_max_moto',
  'excecao_historico_boletos_ativo',
  'excecao_historico_boletos_minimo',
  'excecao_zero_km_ativo',
  'restricao_mudanca_linha',
  'restricao_depreciacao_cobertura_100',
  'restricao_blindado_absoluta',
] as const;

interface FaixaVenda {
  min: number;
  max: number | null;
  permitidas: number;
}

interface AutorizacoesConfig {
  faixas_vendas: FaixaVenda[];
  fipe_max_carro: string;
  fipe_max_moto: string;
  historico_boletos_ativo: boolean;
  historico_boletos_minimo: string;
  zero_km_ativo: boolean;
  restricao_mudanca_linha: boolean;
  restricao_depreciacao_cobertura_100: boolean;
  restricao_blindado_absoluta: boolean;
}

const AUTORIZACOES_DEFAULTS: AutorizacoesConfig = {
  faixas_vendas: [
    { min: 0, max: 9, permitidas: 0 },
    { min: 10, max: 19, permitidas: 1 },
    { min: 20, max: 29, permitidas: 2 },
    { min: 30, max: null, permitidas: 3 },
  ],
  fipe_max_carro: '120000',
  fipe_max_moto: '27000',
  historico_boletos_ativo: true,
  historico_boletos_minimo: '6',
  zero_km_ativo: true,
  restricao_mudanca_linha: true,
  restricao_depreciacao_cobertura_100: true,
  restricao_blindado_absoluta: true,
};

function useTaxasConfiguracoes() {
  return useQuery({
    queryKey: ['configuracoes-taxas-adesao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [...TAXAS_CHAVES]);
      if (error) throw error;
      const map = { ...TAXAS_DEFAULTS };
      for (const row of data || []) {
        if (row.chave in map) {
          (map as Record<string, string>)[row.chave] = row.valor ?? TAXAS_DEFAULTS[row.chave as keyof TaxasConfig];
        }
      }
      return map;
    },
    staleTime: 1000 * 60 * 5,
  });
}

function useAutorizacoesConfiguracoes() {
  return useQuery({
    queryKey: ['configuracoes-autorizacoes-excecoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [...AUTORIZACOES_CHAVES]);
      if (error) throw error;
      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      let faixas = AUTORIZACOES_DEFAULTS.faixas_vendas;
      try {
        if (map.excecao_faixas_vendas) faixas = JSON.parse(map.excecao_faixas_vendas);
      } catch { /* keep default */ }
      return {
        faixas_vendas: faixas,
        fipe_max_carro: map.excecao_fipe_max_carro ?? AUTORIZACOES_DEFAULTS.fipe_max_carro,
        fipe_max_moto: map.excecao_fipe_max_moto ?? AUTORIZACOES_DEFAULTS.fipe_max_moto,
        historico_boletos_ativo: map.excecao_historico_boletos_ativo !== 'false',
        historico_boletos_minimo: map.excecao_historico_boletos_minimo ?? AUTORIZACOES_DEFAULTS.historico_boletos_minimo,
        zero_km_ativo: map.excecao_zero_km_ativo !== 'false',
        restricao_mudanca_linha: map.restricao_mudanca_linha !== 'false',
        restricao_depreciacao_cobertura_100: map.restricao_depreciacao_cobertura_100 !== 'false',
        restricao_blindado_absoluta: map.restricao_blindado_absoluta !== 'false',
      } as AutorizacoesConfig;
    },
    staleTime: 1000 * 60 * 5,
  });
}


export default function RegrasVenda() {
  const { parametros, isLoading, updateParametro } = useComissoesFaixas();
  const queryClient = useQueryClient();
  const { data: taxasDB, isLoading: isLoadingTaxas } = useTaxasConfiguracoes();
  const [pontuacao, setPontuacao] = useState<PontuacaoConfig>(PONTUACAO_DEFAULTS);
  const [repasse, setRepasse] = useState<RepasseMaiorConfig>(REPASSE_DEFAULTS);
  const [migracao, setMigracao] = useState<MigracaoConfig>(MIGRACAO_DEFAULTS);
  const [taxas, setTaxas] = useState<TaxasConfig>(TAXAS_DEFAULTS);
  const [initialized, setInitialized] = useState(false);
  const [taxasInitialized, setTaxasInitialized] = useState(false);
  const [savingPontuacao, setSavingPontuacao] = useState(false);
  const [savingRepasse, setSavingRepasse] = useState(false);
  const [savingMigracao, setSavingMigracao] = useState(false);
  const [savingTaxas, setSavingTaxas] = useState(false);

  // Initialize taxas from DB
  useEffect(() => {
    if (taxasDB && !taxasInitialized) {
      setTaxas(taxasDB);
      setTaxasInitialized(true);
    }
  }, [taxasDB, taxasInitialized]);

  // Initialize state from DB
  useEffect(() => {
    if (!parametros.length || initialized) return;
    const nextPontuacao = { ...PONTUACAO_DEFAULTS };
    const nextRepasse = { ...REPASSE_DEFAULTS };
    const nextMigracao = { ...MIGRACAO_DEFAULTS };

    for (const p of parametros) {
      if (p.chave in nextPontuacao) {
        if (p.chave === 'estorno_cancelamento_antes_1_boleto') {
          (nextPontuacao as Record<string, unknown>)[p.chave] = p.valor === 'true';
        } else {
          (nextPontuacao as Record<string, unknown>)[p.chave] = parseFloat(p.valor) || 0;
        }
      }
      if (p.chave in nextRepasse) {
        (nextRepasse as Record<string, unknown>)[p.chave] = parseFloat(p.valor) || 0;
      }
      if (p.chave === 'migracao_comprovantes_exigidos') {
        nextMigracao.migracao_comprovantes_exigidos = parseInt(p.valor) || 3;
      }
      if (p.chave === 'migracao_prazo_resposta_horas') {
        nextMigracao.migracao_prazo_resposta_horas = parseInt(p.valor) || 48;
      }
      if (p.chave === 'migracao_canal_oficial') {
        nextMigracao.migracao_canal_oficial = p.valor || 'e-mail';
      }
      if (p.chave === 'migracao_isentar_carencia') {
        nextMigracao.migracao_isentar_carencia = p.valor === 'true';
      }
    }
    setPontuacao(nextPontuacao);
    setRepasse(nextRepasse);
    setMigracao(nextMigracao);
    setInitialized(true);
  }, [parametros, initialized]);

  const handlePontuacaoChange = (chave: keyof PontuacaoConfig, value: string) => {
    setPontuacao((prev) => ({ ...prev, [chave]: value === '' ? 0 : parseFloat(value) }));
  };

  const handleRepasseChange = (chave: keyof RepasseMaiorConfig, value: string) => {
    setRepasse((prev) => ({ ...prev, [chave]: value === '' ? 0 : parseFloat(value) }));
  };

  const handleSavePontuacao = async () => {
    setSavingPontuacao(true);
    try {
      const entries = Object.entries(pontuacao) as [keyof PontuacaoConfig, unknown][];
      for (const [chave, valor] of entries) {
        await updateParametro.mutateAsync({ chave: chave as string, valor: String(valor) });
      }
      toast.success('Configurações de pontuação salvas com sucesso!');
    } catch {
      // error handled by mutation
    } finally {
      setSavingPontuacao(false);
    }
  };

  const handleSaveRepasse = async () => {
    setSavingRepasse(true);
    try {
      const entries = Object.entries(repasse) as [keyof RepasseMaiorConfig, unknown][];
      for (const [chave, valor] of entries) {
        await updateParametro.mutateAsync({ chave: chave as string, valor: String(valor) });
      }
      toast.success('Configurações de repasse maior salvas com sucesso!');
    } catch {
      // error handled by mutation
    } finally {
      setSavingRepasse(false);
    }
  };

  const handleSaveMigracao = async () => {
    setSavingMigracao(true);
    try {
      await updateParametro.mutateAsync({ chave: 'migracao_comprovantes_exigidos', valor: String(migracao.migracao_comprovantes_exigidos) });
      await updateParametro.mutateAsync({ chave: 'migracao_prazo_resposta_horas', valor: String(migracao.migracao_prazo_resposta_horas) });
      await updateParametro.mutateAsync({ chave: 'migracao_canal_oficial', valor: migracao.migracao_canal_oficial });
      await updateParametro.mutateAsync({ chave: 'migracao_isentar_carencia', valor: String(migracao.migracao_isentar_carencia) });
      toast.success('Configurações de migração salvas com sucesso!');
    } catch {
      // error handled by mutation
    } finally {
      setSavingMigracao(false);
    }
  };

  const handleTaxaChange = (chave: keyof TaxasConfig, value: string) => {
    setTaxas(prev => ({ ...prev, [chave]: value }));
  };

  const handleSaveTaxas = async () => {
    setSavingTaxas(true);
    try {
      for (const chave of TAXAS_CHAVES) {
        await supabase
          .from('configuracoes')
          .update({ valor: taxas[chave], updated_at: new Date().toISOString() })
          .eq('chave', chave);
      }
      queryClient.invalidateQueries({ queryKey: ['configuracoes-taxas-adesao'] });
      queryClient.invalidateQueries({ queryKey: ['configuracao'] });
      toast.success('Configurações de taxas e adesão salvas com sucesso!');
    } catch {
      toast.error('Erro ao salvar configurações de taxas');
    } finally {
      setSavingTaxas(false);
    }
  };

  if (isLoading || isLoadingTaxas) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Regras de Venda</h1>
        <p className="text-muted-foreground">
          Configure as regras comerciais que orientam o processo de vendas e a avaliação dos consultores.
        </p>
      </div>

      <Tabs defaultValue="pontuacao" className="w-full">
        <TabsList>
          <TabsTrigger value="pontuacao" className="gap-2">
            <Award className="h-4 w-4" />
            Pontuação do Consultor
          </TabsTrigger>
          <TabsTrigger value="repasse-maior" className="gap-2">
            <Scale className="h-4 w-4" />
            Repasse Maior
          </TabsTrigger>
          <TabsTrigger value="migracao" className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Migração
          </TabsTrigger>
          <TabsTrigger value="taxas-adesao" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Taxas e Adesão
          </TabsTrigger>
        </TabsList>

        {/* ═══════════ ABA PONTUAÇÃO ═══════════ */}
        <TabsContent value="pontuacao" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Valor de cada tipo de operação no ranking</CardTitle>
              <CardDescription>
                Define quantos pontos cada tipo de operação representa no ranking do consultor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {CAMPOS_BLOCO1.map(({ chave, label }) => (
                <div key={chave} className="space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor={chave} className="flex-1 text-sm">
                      {label}
                    </Label>
                    <Input
                      id={chave}
                      type="number"
                      step="0.1"
                      min="0"
                      className="w-24 text-right"
                      value={pontuacao[chave] as number}
                      onChange={(e) => handlePontuacaoChange(chave, e.target.value)}
                    />
                  </div>
                  {CHAVES_PARCIAL.includes(chave) && (pontuacao[chave] as number) === 0 && (
                    <p className="text-xs text-muted-foreground ml-1">
                      O procedimento é realizado, mas não gera pontuação no ranking.
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cancelamento antes do primeiro boleto</CardTitle>
              <CardDescription>
                Define o que acontece com a pontuação do consultor quando um associado cancela antes de pagar o primeiro boleto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="estorno" className="flex-1 text-sm">
                  Estornar pontuação do consultor
                </Label>
                <Switch
                  id="estorno"
                  checked={pontuacao.estorno_cancelamento_antes_1_boleto}
                  onCheckedChange={(checked) =>
                    setPontuacao((prev) => ({ ...prev, estorno_cancelamento_antes_1_boleto: checked }))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Quando ativado, a venda é removida do ranking. Se o consultor já recebeu comissão antecipada, o valor será descontado na próxima bonificação.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prazo mínimo de inadimplência para reativação contar como nova adesão</CardTitle>
              <CardDescription>
                Reativações abaixo deste prazo não geram pontuação. Acima dele, contam como nova adesão.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="prazo" className="flex-1 text-sm">
                  Prazo em dias
                </Label>
                <Input
                  id="prazo"
                  type="number"
                  min="1"
                  className="w-24 text-right"
                  value={pontuacao.prazo_reativacao_dias}
                  onChange={(e) => handlePontuacaoChange('prazo_reativacao_dias', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSavePontuacao} disabled={savingPontuacao} className="gap-2">
              {savingPontuacao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configurações
            </Button>
          </div>
        </TabsContent>

        {/* ═══════════ ABA REPASSE MAIOR ═══════════ */}
        <TabsContent value="repasse-maior" className="space-y-6 mt-4">
          {/* BLOCO 1 — Critério de corte */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Divisão por histórico de pagamentos</CardTitle>
              <CardDescription>
                Define a quantidade de boletos pagos que separa os dois grupos de associados. Associados com essa quantidade ou mais recebem a condição mais favorável.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="corte_boletos" className="flex-1 text-sm">
                  Quantidade de boletos pagos para grupo favorável
                </Label>
                <Input
                  id="corte_boletos"
                  type="number"
                  min="1"
                  step="1"
                  className="w-24 text-right"
                  value={repasse.repasse_maior_corte_boletos}
                  onChange={(e) => handleRepasseChange('repasse_maior_corte_boletos', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* BLOCO 2 — Grupo favorável */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Condições para associados com bom histórico</CardTitle>
              <CardDescription>
                Valores aplicados quando o associado possui boletos pagos igual ou acima do corte definido.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="pct_favoravel" className="flex-1 text-sm">
                  Percentual mínimo do débito a pagar
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="pct_favoravel"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    className="w-24 text-right"
                    value={repasse.repasse_maior_pct_favoravel}
                    onChange={(e) => handleRepasseChange('repasse_maior_pct_favoravel', e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="valor_favoravel" className="flex-1 text-sm">
                  Valor mínimo em reais
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    id="valor_favoravel"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-24 text-right"
                    value={repasse.repasse_maior_valor_favoravel}
                    onChange={(e) => handleRepasseChange('repasse_maior_valor_favoravel', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BLOCO 3 — Grupo reduzido */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Condições para associados com histórico reduzido</CardTitle>
              <CardDescription>
                Valores aplicados quando o associado possui boletos pagos abaixo do corte definido.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="pct_reduzido" className="flex-1 text-sm">
                  Percentual mínimo do débito a pagar
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="pct_reduzido"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    className="w-24 text-right"
                    value={repasse.repasse_maior_pct_reduzido}
                    onChange={(e) => handleRepasseChange('repasse_maior_pct_reduzido', e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="valor_reduzido" className="flex-1 text-sm">
                  Valor mínimo em reais
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    id="valor_reduzido"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-24 text-right"
                    value={repasse.repasse_maior_valor_reduzido}
                    onChange={(e) => handleRepasseChange('repasse_maior_valor_reduzido', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BLOCO 4 — Nota informativa */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Pontuação nas operações com pagamento parcial</AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
              Este bloco é apenas informativo. O comportamento descrito aqui é controlado pela aba Pontuação do Consultor.
            </AlertDescription>
          </Alert>
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Quando o associado utiliza o pagamento parcial permitido por esta regra, o procedimento é realizado, mas a pontuação gerada para o consultor segue o que está configurado na aba <strong>Pontuação do Consultor</strong> para os tipos com pagamento parcial.
              </p>
            </CardContent>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button onClick={handleSaveRepasse} disabled={savingRepasse} className="gap-2">
              {savingRepasse ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configurações
            </Button>
          </div>
        </TabsContent>

        {/* ═══════════ ABA MIGRAÇÃO ═══════════ */}
        <TabsContent value="migracao" className="space-y-6 mt-4">
          {/* BLOCO 1 — Comprovantes exigidos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Documentação obrigatória para aprovação</CardTitle>
              <CardDescription>
                Define quantos comprovantes de pagamento da associação anterior o consultor deve apresentar para solicitar migração.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="comprovantes_exigidos" className="flex-1 text-sm">
                  Quantidade de comprovantes exigidos
                </Label>
                <Input
                  id="comprovantes_exigidos"
                  type="number"
                  min="1"
                  step="1"
                  className="w-24 text-right"
                  value={migracao.migracao_comprovantes_exigidos}
                  onChange={(e) =>
                    setMigracao((prev) => ({
                      ...prev,
                      migracao_comprovantes_exigidos: e.target.value === '' ? 0 : parseInt(e.target.value),
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* BLOCO 2 — Prazo de resposta */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Prazo para resposta da Praticcar</CardTitle>
              <CardDescription>
                Tempo máximo em horas úteis para a Praticcar responder à solicitação de migração enviada por e-mail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="prazo_resposta" className="flex-1 text-sm">
                  Prazo em horas úteis
                </Label>
                <Input
                  id="prazo_resposta"
                  type="number"
                  min="1"
                  step="1"
                  className="w-24 text-right"
                  value={migracao.migracao_prazo_resposta_horas}
                  onChange={(e) =>
                    setMigracao((prev) => ({
                      ...prev,
                      migracao_prazo_resposta_horas: e.target.value === '' ? 0 : parseInt(e.target.value),
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* BLOCO 3 — Canal oficial */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Canal válido para solicitação</CardTitle>
              <CardDescription>
                Define qual canal é aceito para receber pedidos de autorização de migração. Solicitações por outros canais são automaticamente inválidas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="canal_oficial" className="flex-1 text-sm">
                  Canal oficial
                </Label>
                <Input
                  id="canal_oficial"
                  type="text"
                  className="w-48 text-right"
                  value={migracao.migracao_canal_oficial}
                  onChange={(e) =>
                    setMigracao((prev) => ({ ...prev, migracao_canal_oficial: e.target.value }))
                  }
                />
              </div>
              <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Solicitações recebidas por qualquer canal diferente do informado acima são consideradas inválidas e não geram autorização.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* BLOCO 4 — Isenção de carência */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Isenção de carência para migrações aprovadas</CardTitle>
              <CardDescription>
                Define se associados com migração aprovada ficam isentos do período de carência padrão.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="isentar_carencia" className="flex-1 text-sm">
                  Isentar carência em migrações aprovadas
                </Label>
                <Switch
                  id="isentar_carencia"
                  checked={migracao.migracao_isentar_carencia}
                  onCheckedChange={(checked) =>
                    setMigracao((prev) => ({ ...prev, migracao_isentar_carencia: checked }))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quando ativado, o período de carência configurado no sistema não se aplica a associados cuja migração foi formalmente aprovada. Quando desativado, a carência padrão vale para todos.
              </p>
            </CardContent>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button onClick={handleSaveMigracao} disabled={savingMigracao} className="gap-2">
              {savingMigracao ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configurações
            </Button>
          </div>
        </TabsContent>

        {/* ═══════════ ABA TAXAS E ADESÃO ═══════════ */}
        <TabsContent value="taxas-adesao" className="space-y-6 mt-4">
          {/* BLOCO 1 — Cálculo da taxa de adesão */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cálculo da taxa de adesão</CardTitle>
              <CardDescription>
                A taxa de adesão é calculada como um percentual do valor FIPE do veículo no momento da contratação.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="taxa_adesao_percentual_fipe" className="flex-1 text-sm">
                  Percentual sobre o valor FIPE
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="taxa_adesao_percentual_fipe"
                    type="number"
                    min="0"
                    step="0.1"
                    className="w-24 text-right"
                    value={taxas.taxa_adesao_percentual_fipe}
                    onChange={(e) => handleTaxaChange('taxa_adesao_percentual_fipe', e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BLOCO 2 — Valores mínimos de adesão */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Valor mínimo por tipo de atendimento</CardTitle>
              <CardDescription>
                Define o menor valor aceitável para a taxa de adesão conforme o local onde a vistoria e instalação são realizadas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="taxa_adesao_minimo_volante" className="flex-1 text-sm">
                  Valor mínimo para vistoria volante (na residência do associado)
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    id="taxa_adesao_minimo_volante"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28 text-right"
                    value={taxas.taxa_adesao_minimo_volante}
                    onChange={(e) => handleTaxaChange('taxa_adesao_minimo_volante', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="taxa_adesao_minimo_base" className="flex-1 text-sm">
                  Valor mínimo para atendimento na base administrativa
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    id="taxa_adesao_minimo_base"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28 text-right"
                    value={taxas.taxa_adesao_minimo_base}
                    onChange={(e) => handleTaxaChange('taxa_adesao_minimo_base', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BLOCO 3 — Repasse volante */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Repasse para instalações fora da base</CardTitle>
              <CardDescription>
                Quando a vistoria e instalação são realizadas na residência do associado, há um repasse obrigatório à Praticcar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="taxa_repasse_volante" className="flex-1 text-sm">
                  Valor do repasse para instalação volante
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    id="taxa_repasse_volante"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28 text-right"
                    value={taxas.taxa_repasse_volante}
                    onChange={(e) => handleTaxaChange('taxa_repasse_volante', e.target.value)}
                  />
                </div>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm text-muted-foreground">
                  Este repasse é obrigatório e se aplica também nos procedimentos de troca de titularidade e substituição de placa realizados fora da base.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* BLOCO 4 — Taxas de procedimentos administrativos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Taxas para procedimentos específicos</CardTitle>
              <CardDescription>
                Valores cobrados para procedimentos que não são nova adesão.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="taxa_substituicao_placa" className="flex-1 text-sm">
                  Taxa de substituição de placa
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    id="taxa_substituicao_placa"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28 text-right"
                    value={taxas.taxa_substituicao_placa}
                    onChange={(e) => handleTaxaChange('taxa_substituicao_placa', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="taxa_troca_titularidade" className="flex-1 text-sm">
                  Taxa de troca de titularidade
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    id="taxa_troca_titularidade"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28 text-right"
                    value={taxas.taxa_troca_titularidade}
                    onChange={(e) => handleTaxaChange('taxa_troca_titularidade', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="taxa_revistoria" className="flex-1 text-sm">
                  Taxa de revistoria
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    id="taxa_revistoria"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28 text-right"
                    value={taxas.taxa_revistoria}
                    onChange={(e) => handleTaxaChange('taxa_revistoria', e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="multa_rastreador" className="flex-1 text-sm">
                  Multa por não devolução do rastreador
                </Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <Input
                    id="multa_rastreador"
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-28 text-right"
                    value={taxas.multa_rastreador}
                    onChange={(e) => handleTaxaChange('multa_rastreador', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button onClick={handleSaveTaxas} disabled={savingTaxas} className="gap-2">
              {savingTaxas ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configurações
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Award, Save, Loader2, Scale, Info } from 'lucide-react';
import { useComissoesFaixas } from '@/hooks/useComissoesFaixas';
import { toast } from 'sonner';

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

export default function RegrasVenda() {
  const { parametros, isLoading, updateParametro } = useComissoesFaixas();
  const [pontuacao, setPontuacao] = useState<PontuacaoConfig>(PONTUACAO_DEFAULTS);
  const [repasse, setRepasse] = useState<RepasseMaiorConfig>(REPASSE_DEFAULTS);
  const [initialized, setInitialized] = useState(false);
  const [savingPontuacao, setSavingPontuacao] = useState(false);
  const [savingRepasse, setSavingRepasse] = useState(false);

  // Initialize state from DB
  useEffect(() => {
    if (!parametros.length || initialized) return;
    const nextPontuacao = { ...PONTUACAO_DEFAULTS };
    const nextRepasse = { ...REPASSE_DEFAULTS };

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
    }
    setPontuacao(nextPontuacao);
    setRepasse(nextRepasse);
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

  if (isLoading) {
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
      </Tabs>
    </div>
  );
}

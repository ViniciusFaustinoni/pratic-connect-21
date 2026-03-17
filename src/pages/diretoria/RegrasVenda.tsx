import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Award, Save, Loader2 } from 'lucide-react';
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

const DEFAULTS: PontuacaoConfig = {
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
  const [config, setConfig] = useState<PontuacaoConfig>(DEFAULTS);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize state from DB
  useEffect(() => {
    if (!parametros.length || initialized) return;
    const next = { ...DEFAULTS };
    for (const p of parametros) {
      if (p.chave in next) {
        if (p.chave === 'estorno_cancelamento_antes_1_boleto') {
          (next as Record<string, unknown>)[p.chave] = p.valor === 'true';
        } else {
          (next as Record<string, unknown>)[p.chave] = parseFloat(p.valor) || 0;
        }
      }
    }
    setConfig(next);
    setInitialized(true);
  }, [parametros, initialized]);

  const handleNumberChange = (chave: keyof PontuacaoConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [chave]: value === '' ? 0 : parseFloat(value) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(config) as [keyof PontuacaoConfig, unknown][];
      for (const [chave, valor] of entries) {
        const valorStr = typeof valor === 'boolean' ? String(valor) : String(valor);
        await updateParametro.mutateAsync({ chave: chave as string, valor: valorStr });
      }
      toast.success('Configurações salvas com sucesso!');
    } catch {
      // error already handled by mutation's onError
    } finally {
      setSaving(false);
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
          {/* Futuras abas: basta adicionar novos TabsTrigger + TabsContent */}
        </TabsList>

        <TabsContent value="pontuacao" className="space-y-6 mt-4">
          {/* BLOCO 1 — Peso por tipo de operação */}
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
                      value={config[chave] as number}
                      onChange={(e) => handleNumberChange(chave, e.target.value)}
                    />
                  </div>
                  {CHAVES_PARCIAL.includes(chave) && (config[chave] as number) === 0 && (
                    <p className="text-xs text-muted-foreground ml-1">
                      O procedimento é realizado, mas não gera pontuação no ranking.
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* BLOCO 2 — Regra de estorno */}
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
                  checked={config.estorno_cancelamento_antes_1_boleto}
                  onCheckedChange={(checked) =>
                    setConfig((prev) => ({ ...prev, estorno_cancelamento_antes_1_boleto: checked }))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Quando ativado, a venda é removida do ranking. Se o consultor já recebeu comissão antecipada, o valor será descontado na próxima bonificação.
              </p>
            </CardContent>
          </Card>

          {/* BLOCO 3 — Prazo de reativação */}
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
                  value={config.prazo_reativacao_dias}
                  onChange={(e) => handleNumberChange('prazo_reativacao_dias', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configurações
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

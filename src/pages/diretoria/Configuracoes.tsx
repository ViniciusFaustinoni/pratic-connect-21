import { useMemo, useState, useCallback } from 'react';
import { 
  Settings, 
  Building, 
  DollarSign, 
  Bell, 
  Calculator,
  Save,
  TrendingDown,
  FileSignature,
  LucideIcon,
  Info,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ValueLabelListEditor } from '@/components/configuracoes/json-editors/ValueLabelListEditor';
import { CotasTaxasEditor } from '@/components/configuracoes/json-editors/CotasTaxasEditor';
import { KeyValueEditor } from '@/components/configuracoes/json-editors/KeyValueEditor';
import { GlossarioEditor } from '@/components/configuracoes/json-editors/GlossarioEditor';
import { DepreciacaoEditor } from '@/components/configuracoes/json-editors/DepreciacaoEditor';

interface CategoriaConfig {
  label: string;
  icon: LucideIcon;
  desc: string;
}

const categoriaConfig: Record<string, CategoriaConfig> = {
  empresa: { label: 'Empresa', icon: Building, desc: 'Dados cadastrais da associação' },
  financeiro: { label: 'Financeiro', icon: DollarSign, desc: 'Configurações de cobrança e pagamentos' },
  operacional: { label: 'Operacional', icon: Settings, desc: 'Prazos e regras operacionais' },
  notificacoes: { label: 'Notificações', icon: Bell, desc: 'Canais de comunicação' },
  atuarial: { label: 'Atuarial', icon: Calculator, desc: 'Parâmetros de cálculo' },
  documentos: { label: 'Documentos', icon: FileSignature, desc: 'Posição de rubrica e assinatura nos documentos' },
};

/** Descrições amigáveis de fallback para chaves conhecidas */
const FALLBACK_HINTS: Record<string, string> = {
  cotas_taxas: 'Valores globais de cotas de participação. Planos com configuração própria (aba Cotas no modal do plano) ignoram estes valores.',
  combustiveis: 'Lista de combustíveis disponíveis em todo o sistema. Usada como referência global.',
  categorias_veiculo: 'Categorias de veículo exibidas na cotação. Usada como referência global.',
  estimativa_fipe_ajuste_marca: 'Fatores de ajuste por marca para estimativa quando FIPE real não é encontrada. Valor 1.0 = sem ajuste.',
  glossario_consultor: 'Termos e definições exibidos para consultores no módulo comercial.',
  marcas_modelos_fallback: 'Marcas e modelos usados quando a consulta à tabela FIPE falha. Serve como alternativa de entrada manual.',
  motos_aceitas: 'Regras de aceitação de motos por marca. Cada plano pode ter regras próprias de elegibilidade.',
  marcas_aceitas_motos: 'Lista de marcas de moto aceitas para cotação na Linha Advanced. Apenas essas marcas aparecerão no cotador quando o tipo de veículo for moto.',
  observacoes_categoria: 'Textos explicativos exibidos ao selecionar cada categoria de veículo na cotação.',
  regras_depreciacao: 'Percentuais de depreciação aplicados no cálculo de indenização. Concorrentes: usa-se o maior. Adicionais: aplicam-se de forma composta sobre o valor já depreciado.',
};

type ConfigRow = {
  id: string;
  chave: string;
  valor: string | null;
  tipo: string | null;
  categoria: string;
  descricao: string | null;
  editavel: boolean | null;
};

export default function ConfiguracoesSistema() {
  const queryClient = useQueryClient();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('empresa');

  const { data: configuracoes, isLoading } = useQuery({
    queryKey: ['configuracoes-sistema'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .order('categoria')
        .order('chave');
      if (error) throw error;
      return data as ConfigRow[];
    }
  });

  const configsPorCategoria = useMemo(() => {
    const grupos: Record<string, ConfigRow[]> = {};
    configuracoes?.forEach(c => {
      if (!grupos[c.categoria]) {
        grupos[c.categoria] = [];
      }
      grupos[c.categoria].push(c);
    });
    return grupos;
  }, [configuracoes]);

  const updateConfig = useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      let profileId: string | null = null;
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        profileId = profile?.id || null;
      }
      
      const { error } = await supabase
        .from('configuracoes')
        .update({ 
          valor, 
          updated_at: new Date().toISOString(),
          updated_by: profileId
        })
        .eq('chave', chave);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success('Configuração salva!');
      queryClient.invalidateQueries({ queryKey: ['configuracoes-sistema'] });
      setEditedValues(prev => {
        const next = { ...prev };
        delete next[variables.chave];
        return next;
      });
    },
    onError: () => {
      toast.error('Erro ao salvar configuração');
    }
  });

  const handleValueChange = useCallback((chave: string, valor: string) => {
    setEditedValues(prev => ({ ...prev, [chave]: valor }));
  }, []);

  const handleSave = useCallback((chave: string, valorOriginal: string | null) => {
    const valor = editedValues[chave] ?? valorOriginal ?? '';
    updateConfig.mutate({ chave, valor });
  }, [editedValues, updateConfig]);

  const formatChave = (chave: string) => {
    return chave
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  /** Try to parse JSON safely */
  const safeParse = (val: string): unknown => {
    try { return JSON.parse(val); } catch { return null; }
  };

  /** Render visual editor for known JSON configs */
  const renderJsonEditor = (config: ConfigRow): JSX.Element | null => {
    const currentValue = editedValues[config.chave] ?? config.valor ?? '';
    const parsed = safeParse(currentValue);
    if (!parsed) return null;

    const hasChanges = config.chave in editedValues && editedValues[config.chave] !== config.valor;

    const handleJsonChange = (newData: unknown) => {
      // Clean up empty optional fields for cotas_taxas
      const cleaned = typeof newData === 'object' ? newData : newData;
      handleValueChange(config.chave, JSON.stringify(cleaned));
    };

    const saveBtn = hasChanges ? (
      <div className="flex justify-end pt-2">
        <Button size="sm" onClick={() => handleSave(config.chave, config.valor)} disabled={updateConfig.isPending}>
          <Save className="h-4 w-4 mr-2" /> Salvar alterações
        </Button>
      </div>
    ) : null;

    switch (config.chave) {
      case 'combustiveis':
      case 'categorias_veiculo':
        if (!Array.isArray(parsed)) return null;
        return (
          <div className="space-y-2">
            <ValueLabelListEditor
              items={parsed as { value: string; label: string }[]}
              onChange={handleJsonChange}
              valuePlaceholder="Código (ex: diesel)"
              labelPlaceholder="Nome exibido (ex: Diesel)"
            />
            {saveBtn}
          </div>
        );

      case 'cotas_taxas':
        if (!Array.isArray(parsed)) return null;
        return (
          <div className="space-y-2">
            <CotasTaxasEditor rows={parsed} onChange={handleJsonChange} />
            {saveBtn}
          </div>
        );

      case 'estimativa_fipe_ajuste_marca':
        if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return (
          <div className="space-y-2">
            <KeyValueEditor
              data={parsed as Record<string, number>}
              onChange={handleJsonChange}
              keyLabel="Marca"
              valueLabel="Fator"
              valueType="number"
            />
            {saveBtn}
          </div>
        );

      case 'motos_aceitas':
        if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return (
          <div className="space-y-2">
            <KeyValueEditor
              data={parsed as Record<string, string>}
              onChange={handleJsonChange}
              keyLabel="Marca"
              valueLabel="Regra de aceitação"
              valueType="text"
            />
            {saveBtn}
          </div>
        );

      case 'observacoes_categoria':
        if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return (
          <div className="space-y-2">
            <KeyValueEditor
              data={parsed as Record<string, string>}
              onChange={handleJsonChange}
              keyLabel="Categoria"
              valueLabel="Observação"
              valueType="text"
            />
            {saveBtn}
          </div>
        );

      case 'glossario_consultor':
        if (!Array.isArray(parsed)) return null;
        return (
          <div className="space-y-2">
            <GlossarioEditor
              items={parsed as { termo: string; definicao: string }[]}
              onChange={handleJsonChange}
            />
            {saveBtn}
          </div>
        );

      case 'regras_depreciacao':
        if (!Array.isArray(parsed)) return null;
        return (
          <div className="space-y-2">
            <DepreciacaoEditor
              items={parsed as { flag: string; label: string; percentual: number; adicional?: boolean }[]}
              onChange={handleJsonChange}
            />
            {saveBtn}
          </div>
        );

      case 'marcas_aceitas_motos':
        if (!Array.isArray(parsed)) return null;
        return (
          <div className="space-y-2">
            <div className="space-y-2">
              {(parsed as string[]).map((marca, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={marca}
                    onChange={(e) => {
                      const updated = [...(parsed as string[])];
                      updated[i] = e.target.value;
                      handleJsonChange(updated);
                    }}
                    placeholder="Nome da marca"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const updated = (parsed as string[]).filter((_, idx) => idx !== i);
                      handleJsonChange(updated);
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleJsonChange([...(parsed as string[]), ''])}
              >
                + Adicionar marca
              </Button>
            </div>
            {saveBtn}
          </div>
        );

      default:
        return null;
    }
  };

  const renderInput = (config: ConfigRow) => {
    const currentValue = editedValues[config.chave] ?? config.valor ?? '';
    const hasChanges = editedValues[config.chave] !== undefined && editedValues[config.chave] !== config.valor;

    if (!config.editavel) {
      return (
        <div className="flex items-center gap-2">
          <Input value={currentValue} disabled className="bg-muted" />
          <Badge variant="secondary">Somente leitura</Badge>
        </div>
      );
    }

    // For JSON type, try visual editor first
    if (config.tipo === 'json') {
      const visualEditor = renderJsonEditor(config);
      if (visualEditor) return visualEditor;

      // Fallback: raw JSON textarea for unknown structures
      return (
        <div className="space-y-2">
          <Textarea
            value={currentValue}
            onChange={(e) => handleValueChange(config.chave, e.target.value)}
            rows={4}
            className="font-mono text-sm"
          />
          {hasChanges && (
            <Button 
              size="sm" 
              onClick={() => handleSave(config.chave, config.valor)}
              disabled={updateConfig.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          )}
        </div>
      );
    }

    switch (config.tipo) {
      case 'booleano':
        return (
          <div className="flex items-center gap-4">
            <Switch
              checked={currentValue === 'true'}
              onCheckedChange={(checked) => {
                updateConfig.mutate({ chave: config.chave, valor: String(checked) });
              }}
            />
            <span className="text-sm text-muted-foreground">
              {currentValue === 'true' ? 'Ativado' : 'Desativado'}
            </span>
          </div>
        );

      case 'percentual':
        return (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type="number"
                value={currentValue}
                onChange={(e) => handleValueChange(config.chave, e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
            </div>
            {hasChanges && (
              <Button size="sm" onClick={() => handleSave(config.chave, config.valor)} disabled={updateConfig.isPending}>
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        );

      case 'moeda':
        return (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input
                type="number"
                step="0.01"
                value={currentValue}
                onChange={(e) => handleValueChange(config.chave, e.target.value)}
                className="pl-10"
              />
            </div>
            {hasChanges && (
              <Button size="sm" onClick={() => handleSave(config.chave, config.valor)} disabled={updateConfig.isPending}>
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        );

      case 'numero':
        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={currentValue}
              onChange={(e) => handleValueChange(config.chave, e.target.value)}
              className="flex-1"
            />
            {hasChanges && (
              <Button size="sm" onClick={() => handleSave(config.chave, config.valor)} disabled={updateConfig.isPending}>
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        );

      default:
        return (
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={currentValue}
              onChange={(e) => handleValueChange(config.chave, e.target.value)}
              className="flex-1"
            />
            {hasChanges && (
              <Button size="sm" onClick={() => handleSave(config.chave, config.valor)} disabled={updateConfig.isPending}>
                <Save className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
    }
  };

  const availableCategories = Object.keys(categoriaConfig).filter(
    cat => configsPorCategoria[cat]?.length > 0
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const fipeMenorConfig = configuracoes?.find(c => c.chave === 'fipe_menor_ativo');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
        <p className="text-muted-foreground">Gerencie os parâmetros de funcionamento da associação</p>
      </div>

      {/* Banner: fallback global */}
      <Alert className="border-primary/30 bg-primary/5">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm">
          <strong>Valores de fallback global.</strong> Estas configurações são padrões do sistema.
          Planos e benefícios com configuração própria (editados no modal de cada plano) <strong>sobrescrevem</strong> estes valores.
          Alterações aqui afetam apenas planos que <em>não</em> possuem configuração específica.
        </AlertDescription>
      </Alert>

      {/* Card destacado: FIPE Menor */}
      {fipeMenorConfig && (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-5 px-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <TrendingDown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Regra FIPE Menor 1%</h3>
                <p className="text-sm text-muted-foreground">
                  {fipeMenorConfig.descricao || 'Permite enquadrar veículos em faixa de preço inferior com desconto de 1% na FIPE'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge variant={fipeMenorConfig.valor === 'true' ? 'default' : 'secondary'}>
                {fipeMenorConfig.valor === 'true' ? 'Ativa' : 'Desativada'}
              </Badge>
              <Switch
                checked={fipeMenorConfig.valor === 'true'}
                onCheckedChange={(checked) => {
                  updateConfig.mutate({ chave: 'fipe_menor_ativo', valor: String(checked) });
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {availableCategories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma configuração disponível</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            {availableCategories.map(cat => {
              const config = categoriaConfig[cat];
              const Icon = config?.icon || Settings;
              return (
                <TabsTrigger key={cat} value={cat} className="gap-2">
                  <Icon className="h-4 w-4" />
                  {config?.label || cat}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {availableCategories.map(cat => {
            const config = categoriaConfig[cat];
            const configs = configsPorCategoria[cat] || [];
            
            return (
              <TabsContent key={cat} value={cat}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {config?.icon && <config.icon className="h-5 w-5" />}
                      {config?.label || cat}
                    </CardTitle>
                    <CardDescription>{config?.desc}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {configs.map(cfg => {
                      const fallbackHint = FALLBACK_HINTS[cfg.chave];
                      return (
                        <div key={cfg.id} className="space-y-2">
                          <Label className="font-medium text-base">{formatChave(cfg.chave)}</Label>
                          {cfg.descricao && (
                            <p className="text-sm text-muted-foreground">{cfg.descricao}</p>
                          )}
                          {fallbackHint && (
                            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-md px-3 py-2">
                              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span>{fallbackHint}</span>
                            </div>
                          )}
                          {renderInput(cfg)}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}

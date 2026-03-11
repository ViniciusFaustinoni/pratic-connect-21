import { useMemo, useState } from 'react';
import { 
  Settings, 
  Building, 
  DollarSign, 
  Bell, 
  Calculator,
  Save,
  LucideIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';


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
      
      // Buscar profile.id (FK exige referência a profiles, não auth.users)
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

  const handleValueChange = (chave: string, valor: string) => {
    setEditedValues(prev => ({ ...prev, [chave]: valor }));
  };

  const handleSave = (chave: string, valorOriginal: string | null) => {
    const valor = editedValues[chave] ?? valorOriginal ?? '';
    updateConfig.mutate({ chave, valor });
  };

  const formatChave = (chave: string) => {
    return chave
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
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

      case 'json':
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
              <Button 
                size="sm" 
                onClick={() => handleSave(config.chave, config.valor)}
                disabled={updateConfig.isPending}
              >
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
              <Button 
                size="sm" 
                onClick={() => handleSave(config.chave, config.valor)}
                disabled={updateConfig.isPending}
              >
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
              <Button 
                size="sm" 
                onClick={() => handleSave(config.chave, config.valor)}
                disabled={updateConfig.isPending}
              >
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
              <Button 
                size="sm" 
                onClick={() => handleSave(config.chave, config.valor)}
                disabled={updateConfig.isPending}
              >
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

  // Find the fipe_menor_ativo config for the highlighted card
  const fipeMenorConfig = configuracoes?.find(c => c.chave === 'fipe_menor_ativo');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações do Sistema</h1>
        <p className="text-muted-foreground">Gerencie os parâmetros de funcionamento da associação</p>
      </div>

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
          <TabsList className="mb-4">
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
                  <CardContent className="space-y-6">
                    {configs.map(cfg => (
                      <div key={cfg.id} className="space-y-2">
                        <Label className="font-medium">{formatChave(cfg.chave)}</Label>
                        {cfg.descricao && (
                          <p className="text-sm text-muted-foreground">{cfg.descricao}</p>
                        )}
                        {renderInput(cfg)}
                      </div>
                    ))}
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

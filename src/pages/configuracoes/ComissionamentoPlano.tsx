import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Save, Loader2, AlertTriangle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { formatarMoeda } from '@/utils/format';

interface NivelConfig {
  nivel_nome: string;
  tipo_comissao: string;
  valor: number;
  parcelas: number;
  ativo: boolean;
}

export default function ComissionamentoPlano() {
  const queryClient = useQueryClient();
  const [expandedPlano, setExpandedPlano] = useState<string | null>(null);
  const [editingConfigs, setEditingConfigs] = useState<Record<string, NivelConfig[]>>({});

  // Fetch active plans
  const { data: planos, isLoading: loadingPlanos } = useQuery({
    queryKey: ['planos-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  // Fetch all existing configs
  const { data: allConfigs } = useQuery({
    queryKey: ['comissao-plano-nivel'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('comissao_plano_nivel')
        .select('*')
        .order('nivel_nome');
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch distinct level names from grades
  const { data: niveisDistintos } = useQuery({
    queryKey: ['niveis-distintos'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('grades_comissao_niveis')
        .select('nome');
      if (error) throw error;
      const unique = [...new Set((data as any[]).map((n: any) => n.nome))] as string[];
      return unique.sort();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ planoId, configs }: { planoId: string; configs: NivelConfig[] }) => {
      // Delete existing for this plan, then insert
      await (supabase as any)
        .from('comissao_plano_nivel')
        .delete()
        .eq('plano_id', planoId);

      const rows = configs.map(c => ({
        plano_id: planoId,
        nivel_nome: c.nivel_nome,
        tipo_comissao: c.tipo_comissao,
        valor: c.valor,
        parcelas: c.parcelas,
        ativo: c.ativo,
      }));

      if (rows.length > 0) {
        const { error } = await (supabase as any)
          .from('comissao_plano_nivel')
          .insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Configuração salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['comissao-plano-nivel'] });
    },
    onError: () => toast.error('Erro ao salvar configuração.'),
  });

  const getConfigsForPlano = (planoId: string): NivelConfig[] => {
    if (editingConfigs[planoId]) return editingConfigs[planoId];

    const existing = (allConfigs || []).filter((c: any) => c.plano_id === planoId);
    const niveis = niveisDistintos || [];

    return niveis.map(nome => {
      const found = existing.find((c: any) => c.nivel_nome === nome);
      return {
        nivel_nome: nome,
        tipo_comissao: found?.tipo_comissao || 'valor_fixo',
        valor: found?.valor || 0,
        parcelas: found?.parcelas || 0,
        ativo: found?.ativo ?? true,
      };
    });
  };

  const updateConfig = (planoId: string, index: number, field: string, value: any) => {
    const configs = [...getConfigsForPlano(planoId)];
    (configs[index] as any)[field] = value;
    setEditingConfigs(prev => ({ ...prev, [planoId]: configs }));
  };

  const togglePlano = (planoId: string) => {
    if (expandedPlano === planoId) {
      setExpandedPlano(null);
    } else {
      setExpandedPlano(planoId);
      if (!editingConfigs[planoId]) {
        setEditingConfigs(prev => ({ ...prev, [planoId]: getConfigsForPlano(planoId) }));
      }
    }
  };

  const getConfiguredCount = (planoId: string) => {
    return (allConfigs || []).filter((c: any) => c.plano_id === planoId && c.ativo && c.parcelas > 0).length;
  };

  if (loadingPlanos) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Comissionamento por Plano</h2>
        <p className="text-sm text-muted-foreground">Configure a comissão recorrente por mensalidade para cada plano e nível da hierarquia comercial.</p>
      </div>

      {(!niveisDistintos || niveisDistintos.length === 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Nenhum nível de comissão encontrado</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Crie a hierarquia comercial nas Grades de Comissão antes de configurar o comissionamento por plano.</p>
            <Link to="/configuracoes/grades-comissao">
              <Button variant="outline" size="sm" className="mt-2">Configurar Grades de Comissão</Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {niveisDistintos && niveisDistintos.length > 0 && niveisDistintos.length <= 2 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Apenas {niveisDistintos.length} nível(is) cadastrado(s). Para uma hierarquia completa, configure mais níveis em{' '}
            <Link to="/configuracoes/grades-comissao" className="font-medium text-primary underline underline-offset-4 hover:text-primary/80">
              Grades de Comissão
            </Link>.
          </AlertDescription>
        </Alert>
      )}

      {planos?.map(plano => {
        const isExpanded = expandedPlano === plano.id;
        const configs = getConfigsForPlano(plano.id);
        const configuredCount = getConfiguredCount(plano.id);

        return (
          <Card key={plano.id}>
            <CardHeader
              className="cursor-pointer hover:bg-muted/50 transition-colors py-4"
              onClick={() => togglePlano(plano.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-sm font-medium">{plano.nome}</CardTitle>
                  {configuredCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {configuredCount} {configuredCount === 1 ? 'nível' : 'níveis'} configurado{configuredCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="pt-0">
                {configs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Nenhum nível disponível.</p>
                ) : (
                  <>
                    {/* Header */}
                    <div className="hidden md:grid grid-cols-[1fr_150px_120px_100px_60px] gap-3 pb-2 border-b text-xs font-medium text-muted-foreground">
                      <span>Nível</span>
                      <span>Tipo</span>
                      <span>Valor</span>
                      <span>Parcelas</span>
                      <span>Ativo</span>
                    </div>

                    <div className="space-y-3 mt-3">
                      {configs.map((config, idx) => (
                        <div key={config.nivel_nome} className="grid grid-cols-1 md:grid-cols-[1fr_150px_120px_100px_60px] gap-3 items-center">
                          <span className="text-sm font-medium text-foreground">{config.nivel_nome}</span>

                          <Select
                            value={config.tipo_comissao}
                            onValueChange={v => updateConfig(plano.id, idx, 'tipo_comissao', v)}
                          >
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="valor_fixo">Valor fixo (R$)</SelectItem>
                              <SelectItem value="percentual">Percentual (%)</SelectItem>
                            </SelectContent>
                          </Select>

                          <Input
                            type="number"
                            min={0}
                            step={config.tipo_comissao === 'percentual' ? 0.1 : 1}
                            value={config.valor || ''}
                            onChange={e => updateConfig(plano.id, idx, 'valor', parseFloat(e.target.value) || 0)}
                            placeholder={config.tipo_comissao === 'percentual' ? '%' : 'R$'}
                            className="h-9 text-xs"
                          />

                          <Input
                            type="number"
                            min={0}
                            value={config.parcelas || ''}
                            onChange={e => updateConfig(plano.id, idx, 'parcelas', parseInt(e.target.value) || 0)}
                            placeholder="Nº"
                            className="h-9 text-xs"
                          />

                          <Switch
                            checked={config.ativo}
                            onCheckedChange={v => updateConfig(plano.id, idx, 'ativo', v)}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end mt-4 pt-3 border-t">
                      <Button
                        size="sm"
                        onClick={() => saveMutation.mutate({ planoId: plano.id, configs })}
                        disabled={saveMutation.isPending}
                      >
                        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                        Salvar
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

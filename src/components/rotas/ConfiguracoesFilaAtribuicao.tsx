import { useState, useEffect } from 'react';
import { Save, Workflow, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const CONFIG_KEYS = [
  'fila_raio_proximidade_metros',
  'fila_raio_quase_disponivel_metros',
  'fila_max_por_profissional',
  'fila_tempo_expiracao_horas',
  'redistribuicao_raio_km',
  'fila_tempo_quase_disponivel_min',
  'fila_etapa_quase_disponivel',
] as const;

interface FilaConfig {
  raioProximidade: string;
  raioQuaseDisponivel: string;
  maxPorProfissional: string;
  tempoExpiracao: string;
  redistribuicaoRaio: string;
  tempoQuaseDisponivel: string;
  etapaQuaseDisponivel: string;
}

const DEFAULTS: FilaConfig = {
  raioProximidade: '500',
  raioQuaseDisponivel: '1000',
  maxPorProfissional: '3',
  tempoExpiracao: '4',
  redistribuicaoRaio: '5',
  tempoQuaseDisponivel: '75',
  etapaQuaseDisponivel: '4',
};

function useConfiguracoesFilaAtribuicao() {
  return useQuery({
    queryKey: ['configuracoes-fila-atribuicao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [...CONFIG_KEYS]);

      if (error) {
        console.warn('[useConfiguracoesFilaAtribuicao] Erro:', error);
        return DEFAULTS;
      }

      const config = { ...DEFAULTS };
      const map: Record<string, keyof FilaConfig> = {
        fila_raio_proximidade_metros: 'raioProximidade',
        fila_raio_quase_disponivel_metros: 'raioQuaseDisponivel',
        fila_max_por_profissional: 'maxPorProfissional',
        fila_tempo_expiracao_horas: 'tempoExpiracao',
        redistribuicao_raio_km: 'redistribuicaoRaio',
      };

      data?.forEach((item) => {
        const key = map[item.chave];
        if (key && item.valor) config[key] = item.valor;
      });

      return config;
    },
    staleTime: 1000 * 60 * 5,
  });
}

const FIELDS: {
  key: keyof FilaConfig;
  dbKey: string;
  label: string;
  tooltip: string;
  unit: string;
  min: number;
  max: number;
  hint: string;
}[] = [
  {
    key: 'raioProximidade',
    dbKey: 'fila_raio_proximidade_metros',
    label: 'Raio de proximidade',
    tooltip: 'Distância máxima em metros para enfileirar um serviço pendente em um profissional ocupado que esteja próximo.',
    unit: 'metros',
    min: 100,
    max: 5000,
    hint: 'Recomendado: 300-800m para áreas urbanas.',
  },
  {
    key: 'raioQuaseDisponivel',
    dbKey: 'fila_raio_quase_disponivel_metros',
    label: 'Raio "quase disponível"',
    tooltip: 'Raio ampliado quando o profissional está há 75+ minutos na tarefa atual (quase terminando).',
    unit: 'metros',
    min: 500,
    max: 10000,
    hint: 'Deve ser maior que o raio de proximidade.',
  },
  {
    key: 'maxPorProfissional',
    dbKey: 'fila_max_por_profissional',
    label: 'Máx. na fila por profissional',
    tooltip: 'Quantidade máxima de serviços que podem ser enfileirados para um profissional ocupado.',
    unit: 'serviços',
    min: 1,
    max: 10,
    hint: 'Recomendado: 2-5 serviços.',
  },
  {
    key: 'tempoExpiracao',
    dbKey: 'fila_tempo_expiracao_horas',
    label: 'Expiração da fila',
    tooltip: 'Tempo em horas até um item da fila expirar automaticamente se não for consumido.',
    unit: 'horas',
    min: 1,
    max: 24,
    hint: 'Recomendado: 3-6 horas.',
  },
  {
    key: 'redistribuicaoRaio',
    dbKey: 'redistribuicao_raio_km',
    label: 'Raio de redistribuição',
    tooltip: 'Distância máxima em km para buscar um profissional substituto quando um instalador reporta imprevisto.',
    unit: 'km',
    min: 1,
    max: 50,
    hint: 'Recomendado: 3-10 km.',
  },
];

export function ConfiguracoesFilaAtribuicao() {
  const { data: config, isLoading } = useConfiguracoesFilaAtribuicao();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [values, setValues] = useState<FilaConfig>(DEFAULTS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) setValues(config);
  }, [config]);

  useEffect(() => {
    if (config) {
      const changed = FIELDS.some((f) => config[f.key] !== values[f.key]);
      setHasChanges(changed);
    }
  }, [values, config]);

  const mutation = useMutation({
    mutationFn: async (updates: { chave: string; valor: string }[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from('configuracoes')
          .update({ valor: u.valor, updated_at: new Date().toISOString(), updated_by: profile?.id })
          .eq('chave', u.chave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracoes-fila-atribuicao'] });
      toast.success('Configurações de atribuição atualizadas');
      setHasChanges(false);
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  });

  const handleSave = () => {
    if (!config) return;
    const updates = FIELDS
      .filter((f) => config[f.key] !== values[f.key])
      .map((f) => ({ chave: f.dbKey, valor: values[f.key] }));
    if (updates.length) mutation.mutate(updates);
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-5 w-5" />
          Atribuição Automática de Tarefas
        </CardTitle>
        <CardDescription>
          Parâmetros que controlam o enfileiramento inteligente e a redistribuição automática de
          serviços entre profissionais.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{field.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id={field.key}
                type="number"
                min={field.min}
                max={field.max}
                value={values[field.key]}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">{field.unit}</span>
            </div>
            <p className="text-xs text-muted-foreground">{field.hint}</p>
          </div>
        ))}

        {hasChanges && (
          <Button onClick={handleSave} disabled={mutation.isPending} className="w-full sm:w-auto">
            <Save className="mr-2 h-4 w-4" />
            {mutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

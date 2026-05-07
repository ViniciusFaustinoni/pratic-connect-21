import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, AlertTriangle, Clock, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface TrocaSga {
  id: string;
  status: string;
  sga_status: string | null;
  sga_erro: string | null;
  associado_antigo?: { nome: string } | null;
  novo_titular_dados?: { nome: string } | null;
  veiculo?: { placa: string } | null;
}

export function SaudeSgaTrocas() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<'todos' | 'erro' | 'pendente'>('todos');

  const { data, isLoading } = useQuery({
    queryKey: ['saude-sga-trocas'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('solicitacoes_troca_titularidade')
        .select(`
          id, status, sga_status, sga_erro,
          associado_antigo:associados!associado_antigo_id(nome),
          veiculo:veiculos!veiculo_id(placa),
          novo_titular_dados
        `)
        .in('status', ['liberada_para_assinatura', 'efetivada'])
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as TrocaSga[];
    },
    refetchInterval: 30000,
  });

  const counts = useMemo(() => {
    const list = data || [];
    return {
      ok: list.filter(t => t.sga_status === 'sincronizado').length,
      pendente: list.filter(t => !t.sga_status || t.sga_status === 'pendente').length,
      erro: list.filter(t => t.sga_status === 'falha').length,
    };
  }, [data]);

  const retry = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('efetivar-troca-titularidade', {
        body: { solicitacao_id: id, retry_sga: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saude-sga-trocas'] });
      toast.success('Sincronização reexecutada');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = data || [];
    if (filtro === 'erro') return list.filter(t => t.sga_status === 'falha');
    if (filtro === 'pendente') return list.filter(t => !t.sga_status || t.sga_status === 'pendente');
    return [];
  }, [data, filtro]);

  if (isLoading) return null;

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-sm font-semibold">Saúde do SGA — trocas</h4>
          <Button size="sm" variant="ghost" asChild>
            <a href="/cadastro/sga-fila" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" /> Fila completa do SGA
            </a>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setFiltro('todos')}
            className={`rounded border p-3 text-left transition ${filtro === 'todos' ? 'ring-2 ring-primary' : ''}`}
          >
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-medium">Sincronizadas</span>
            </div>
            <p className="text-xl font-bold mt-1">{counts.ok}</p>
          </button>
          <button
            onClick={() => setFiltro(f => f === 'pendente' ? 'todos' : 'pendente')}
            className={`rounded border p-3 text-left transition ${filtro === 'pendente' ? 'ring-2 ring-primary' : ''}`}
          >
            <div className="flex items-center gap-2 text-amber-600">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Pendentes</span>
            </div>
            <p className="text-xl font-bold mt-1">{counts.pendente}</p>
          </button>
          <button
            onClick={() => setFiltro(f => f === 'erro' ? 'todos' : 'erro')}
            className={`rounded border p-3 text-left transition ${filtro === 'erro' ? 'ring-2 ring-primary' : ''}`}
          >
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Erros</span>
            </div>
            <p className="text-xl font-bold mt-1">{counts.erro}</p>
          </button>
        </div>

        {filtro !== 'todos' && filtered.length > 0 && (
          <div className="space-y-1.5 max-h-60 overflow-auto">
            {filtered.map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2 text-xs border rounded p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium">{t.associado_antigo?.nome}</span>
                    {' → '}
                    <span className="font-medium">{t.novo_titular_dados?.nome}</span>
                    {' • '}
                    <span className="text-muted-foreground">{t.veiculo?.placa}</span>
                  </p>
                  {t.sga_erro && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-destructive truncate cursor-help">{t.sga_erro}</p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-md">{t.sga_erro}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <Badge variant={t.sga_status === 'falha' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {t.sga_status || 'pendente'}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => retry.mutate(t.id)}
                  disabled={retry.isPending}
                >
                  {retry.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

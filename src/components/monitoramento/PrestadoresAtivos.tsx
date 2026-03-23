import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ArrowRight, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function PrestadoresAtivos() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['prestadores-ativos-dashboard'],
    queryFn: async () => {
      const { data: links, error } = await (supabase as any)
        .from('instalacao_prestador_links')
        .select('id, prestador_id, status, created_at, instalacoes:instalacao_id(cidade, associado_nome)')
        .in('status', ['aguardando', 'em_execucao'])
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;

      // Buscar nomes dos prestadores
      const prestadorIds = [...new Set((links || []).map((l: any) => l.prestador_id))];
      let prestadorMap: Record<string, string> = {};
      if (prestadorIds.length > 0) {
        const { data: prestadores } = await (supabase as any)
          .from('prestadores_assistencia')
          .select('id, nome_fantasia, razao_social')
          .in('id', prestadorIds);
        (prestadores || []).forEach((p: any) => {
          prestadorMap[p.id] = p.nome_fantasia || p.razao_social || 'Prestador';
        });
      }

      const aguardando = (links || []).filter((l: any) => l.status === 'aguardando').length;
      const emExecucao = (links || []).filter((l: any) => l.status === 'em_execucao').length;
      const distinctPrestadores = prestadorIds.length;

      return {
        links: (links || []).slice(0, 5).map((l: any) => ({
          ...l,
          prestadorNome: prestadorMap[l.prestador_id] || 'Prestador',
        })),
        aguardando,
        emExecucao,
        distinctPrestadores,
      };
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || (data.aguardando === 0 && data.emExecucao === 0)) return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-orange-500" />
            Prestadores Ativos
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/monitoramento/prestadores-parceiros')}>
            Ver todos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-foreground">{data.distinctPrestadores}</span>
            <span className="text-sm text-muted-foreground">prestadores</span>
          </div>
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            {data.aguardando} aguardando
          </Badge>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            {data.emExecucao} em execução
          </Badge>
        </div>

        <div className="space-y-2">
          {data.links.map((link: any) => (
            <div key={link.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-md p-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground truncate">{link.prestadorNome}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground truncate">{link.instalacoes?.cidade || '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                {link.status === 'aguardando' ? (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Aguardando</Badge>
                ) : (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Em execução</Badge>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {link.created_at ? formatDistanceToNow(new Date(link.created_at), { addSuffix: false, locale: ptBR }) : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Search, Scale, ChevronDown, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RESULTADO_SINDICANCIA_LABELS } from '@/types/sinistros';

interface Props {
  sinistroId: string;
}

export function SecaoSindicanciasJuridico({ sinistroId }: Props) {
  // Histórico de sindicâncias
  const { data: sindicancias = [] } = useQuery({
    queryKey: ['sindicancias-evento', sinistroId],
    queryFn: async () => {
      const { data } = await supabase
        .from('sinistro_historico')
        .select('*, usuario:profiles!sinistro_historico_usuario_id_fkey(nome)')
        .eq('sinistro_id', sinistroId)
        .in('status_novo', ['em_sindicancia', 'em_pericia'])
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Consultas jurídicas
  const { data: consultas = [] } = useQuery({
    queryKey: ['consultas-juridicas-evento', sinistroId],
    queryFn: async () => {
      const { data } = await supabase
        .from('consultas_juridicas')
        .select('id, assunto, status, prioridade, created_at, decisao, respondido_por')
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Processos
  const { data: processos = [] } = useQuery({
    queryKey: ['processos-evento-secao', sinistroId],
    queryFn: async () => {
      const { data } = await supabase
        .from('processos')
        .select('id, numero, tipo, status, criado_por, advogado:advogados(nome)')
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Dados do sinistro para resultado
  const { data: sinistroData } = useQuery({
    queryKey: ['sinistro-sindicancia-info', sinistroId],
    queryFn: async () => {
      const { data } = await supabase
        .from('sinistros')
        .select('resultado_sindicancia, motivo_analise_interna, sindicancia_prazo_fim, sindicante_id, sindicante:profiles!sinistros_sindicante_id_fkey(nome)')
        .eq('id', sinistroId)
        .maybeSingle();
      return data;
    },
  });

  const temDados = sindicancias.length > 0 || consultas.length > 0 || processos.length > 0;

  return (
    <Collapsible defaultOpen={temDados}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg hover:bg-muted/50 transition-colors text-left">
        <Search className="h-4 w-4" />
        <Scale className="h-4 w-4" />
        <span className="font-semibold text-sm flex-1">Sindicâncias e Jurídico</span>
        {temDados && (
          <Badge variant="secondary" className="text-xs">
            {sindicancias.length + consultas.length + processos.length}
          </Badge>
        )}
        <ChevronDown className="h-4 w-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        {!temDados && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma sindicância ou caso jurídico vinculado.
          </p>
        )}

        {/* Sindicâncias */}
        {sindicancias.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sindicâncias</p>
            {sindicancias.map((s: any) => (
              <Card key={s.id} className="border-rose-200/50">
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {s.status_novo === 'em_pericia' ? 'Perícia' : 'Sindicância'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(s.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  {s.usuario?.nome && (
                    <p className="text-xs text-muted-foreground">Por: {s.usuario.nome}</p>
                  )}
                  {sinistroData?.resultado_sindicancia && (
                    <Badge className="text-xs bg-slate-100 text-slate-700">
                      {RESULTADO_SINDICANCIA_LABELS[sinistroData.resultado_sindicancia as keyof typeof RESULTADO_SINDICANCIA_LABELS] || sinistroData.resultado_sindicancia}
                    </Badge>
                  )}
                  <Link to={`/eventos/sindicancias/${sinistroId}`}>
                    <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                      <ExternalLink className="h-3 w-3 mr-1" /> Ver sindicância
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Consultas Jurídicas */}
        {consultas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Casos Jurídicos (Consultas)</p>
            {consultas.map((c: any) => (
              <Card key={c.id} className="border-purple-200/50">
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate max-w-[200px]">{c.assunto}</span>
                    <Badge variant="outline" className="text-xs">{c.status}</Badge>
                  </div>
                  {c.decisao && <p className="text-xs text-muted-foreground">Decisão: {c.decisao}</p>}
                  <Link to={`/juridico/casos/${c.id}`}>
                    <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                      <ExternalLink className="h-3 w-3 mr-1" /> Ver caso
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Processos */}
        {processos.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Processos</p>
            {processos.map((p: any) => (
              <Card key={p.id} className="border-purple-200/50">
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{p.numero || p.tipo}</span>
                    <Badge variant="outline" className="text-xs">{p.status}</Badge>
                  </div>
                  {(p.advogado as any)?.nome && <p className="text-xs text-muted-foreground">Advogado: {(p.advogado as any).nome}</p>}
                  <Link to={`/juridico/processos/${p.id}`}>
                    <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                      <ExternalLink className="h-3 w-3 mr-1" /> Ver processo
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

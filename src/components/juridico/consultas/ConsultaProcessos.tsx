import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TIPO_PROCESSO_LABELS, STATUS_PROCESSO_LABELS } from '@/types/juridico';

interface Props {
  termo: string;
}

export default function ConsultaProcessos({ termo }: Props) {
  const navigate = useNavigate();

  const { data: processos = [], isLoading } = useQuery({
    queryKey: ['consulta-processos-busca', termo],
    queryFn: async () => {
      if (!termo || termo.length < 2) return [];
      
      // Busca por número
      let query = supabase
        .from('processos')
        .select('id, numero, tipo, status, parte_contraria_nome, valor_causa, advogado:advogados(nome)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (/^\d+\/\d{4}$/.test(termo)) {
        query = query.ilike('numero', `%${termo}%`);
      } else {
        query = query.or(`numero.ilike.%${termo}%,parte_contraria_nome.ilike.%${termo}%,objeto.ilike.%${termo}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!termo && termo.length >= 2,
  });

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  if (!termo || termo.length < 2) {
    return <p className="text-muted-foreground text-center py-8">Digite ao menos 2 caracteres para buscar processos.</p>;
  }

  if (processos.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Nenhum processo encontrado para "{termo}".</p>;
  }

  return (
    <div className="space-y-3">
      {processos.map((p: any) => (
        <Card key={p.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/juridico/processos/${p.id}`)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{p.numero}</p>
                  <p className="text-sm text-muted-foreground">
                    Pratic Car x {p.parte_contraria_nome}
                    {p.advogado?.nome && <span> — Adv: {p.advogado.nome}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{TIPO_PROCESSO_LABELS[p.tipo as keyof typeof TIPO_PROCESSO_LABELS] || p.tipo}</Badge>
                <Badge variant="outline">{STATUS_PROCESSO_LABELS[p.status as keyof typeof STATUS_PROCESSO_LABELS] || p.status}</Badge>
                {p.valor_causa && <span className="text-sm text-muted-foreground">R$ {Number(p.valor_causa).toLocaleString('pt-BR')}</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

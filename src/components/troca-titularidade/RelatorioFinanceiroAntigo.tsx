import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
  associadoId: string;
}

export function RelatorioFinanceiroAntigo({ associadoId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['relatorio-financeiro-antigo', associadoId],
    queryFn: async () => {
      const { data: cobrancas } = await supabase
        .from('cobrancas')
        .select('id, status, valor, valor_final, data_vencimento, data_pagamento, descricao')
        .eq('associado_id', associadoId)
        .order('data_vencimento', { ascending: false })
        .limit(50);
      return cobrancas || [];
    },
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data) return null;

  const vencidas = data.filter(c => c.status === 'vencido' || (c.status === 'aguardando_pagamento' && c.data_vencimento && new Date(c.data_vencimento) < new Date()));
  const pagas = data.filter(c => c.status === 'pago');
  const aguardando = data.filter(c => c.status === 'aguardando_pagamento' && (!c.data_vencimento || new Date(c.data_vencimento) >= new Date()));
  const totalVencido = vencidas.reduce((s, c) => s + Number(c.valor_final || c.valor || 0), 0);
  const adimplente = vencidas.length === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {adimplente ? (
            <><CheckCircle2 className="h-5 w-5 text-green-600" /> Associado ADIMPLENTE</>
          ) : (
            <><AlertTriangle className="h-5 w-5 text-destructive" /> Associado INADIMPLENTE</>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded border p-2">
            <p className="text-xs text-muted-foreground">Vencidas</p>
            <p className="text-lg font-bold text-destructive">{vencidas.length}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-xs text-muted-foreground">A vencer</p>
            <p className="text-lg font-bold">{aguardando.length}</p>
          </div>
          <div className="rounded border p-2">
            <p className="text-xs text-muted-foreground">Pagas</p>
            <p className="text-lg font-bold text-green-600">{pagas.length}</p>
          </div>
        </div>
        {totalVencido > 0 && (
          <div className="rounded bg-destructive/10 p-2 text-sm text-destructive">
            Total em atraso: <strong>R$ {totalVencido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
          </div>
        )}
        {vencidas.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-auto">
            {vencidas.slice(0, 10).map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs border-b py-1">
                <span>{c.descricao || 'Cobrança'} — venc. {c.data_vencimento ? new Date(c.data_vencimento).toLocaleDateString('pt-BR') : '-'}</span>
                <Badge variant="destructive">R$ {Number(c.valor_final || c.valor || 0).toFixed(2)}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

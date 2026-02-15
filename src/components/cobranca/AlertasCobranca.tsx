import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export function AlertasCobranca() {
  const { data: alertas, isLoading } = useQuery({
    queryKey: ['alertas-cobranca'],
    queryFn: async () => {
      const hoje = new Date();
      const hojeStr = hoje.toISOString().split('T')[0];
      const results: { tipo: 'vermelho' | 'amarelo'; titulo: string; descricao: string }[] = [];

      // Vermelho: 90+ dias sem contato
      const { data: vencidos90 } = await supabase
        .from('cobrancas')
        .select('associado_id, data_vencimento')
        .eq('status', 'vencido');

      const assoc90 = new Set<string>();
      vencidos90?.forEach(c => {
        const dias = differenceInDays(hoje, new Date(c.data_vencimento));
        if (dias >= 90) assoc90.add(c.associado_id);
      });

      if (assoc90.size > 0) {
        // Check which of these have NO contacts
        const { data: contatosRecentes } = await supabase
          .from('cobranca_contatos')
          .select('associado_id')
          .in('associado_id', Array.from(assoc90));

        const contatados = new Set(contatosRecentes?.map(c => c.associado_id) || []);
        const semContato = Array.from(assoc90).filter(id => !contatados.has(id));
        if (semContato.length > 0) {
          results.push({
            tipo: 'vermelho',
            titulo: `${semContato.length} devedor(es) 90+ dias SEM contato`,
            descricao: 'Associados com mais de 90 dias em atraso e nenhum contato registrado. Ação urgente necessária.'
          });
        }
      }

      // Vermelho: Acordos quebrados
      const { count: acordosQuebrados } = await supabase
        .from('acordos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'quebrado');

      if (acordosQuebrados && acordosQuebrados > 0) {
        results.push({
          tipo: 'vermelho',
          titulo: `${acordosQuebrados} acordo(s) quebrado(s)`,
          descricao: 'Acordos que foram quebrados por falta de pagamento. Necessário retomar cobrança.'
        });
      }

      // Amarelo: completando 30 dias (candidatos SPC)
      const assoc30 = new Set<string>();
      vencidos90?.forEach(c => {
        const dias = differenceInDays(hoje, new Date(c.data_vencimento));
        if (dias >= 25 && dias <= 35) assoc30.add(c.associado_id);
      });
      if (assoc30.size > 0) {
        results.push({
          tipo: 'amarelo',
          titulo: `${assoc30.size} associado(s) completando 30 dias`,
          descricao: 'Candidatos a negativação no SPC/Serasa. Verificar pré-requisitos.'
        });
      }

      // Amarelo: parcelas vencendo hoje
      const { count: parcelasHoje } = await supabase
        .from('acordo_parcelas')
        .select('*', { count: 'exact', head: true })
        .eq('data_vencimento', hojeStr)
        .eq('status', 'pendente');

      if (parcelasHoje && parcelasHoje > 0) {
        results.push({
          tipo: 'amarelo',
          titulo: `${parcelasHoje} parcela(s) de acordo vencendo hoje`,
          descricao: 'Acompanhar o pagamento para evitar quebra de acordo.'
        });
      }

      return results;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-24" />;
  if (!alertas || alertas.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alertas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alertas.map((alerta, i) => (
          <Alert key={i} variant={alerta.tipo === 'vermelho' ? 'destructive' : 'default'}
            className={alerta.tipo === 'amarelo' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : ''}>
            {alerta.tipo === 'vermelho' ? <AlertCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4 text-yellow-600" />}
            <AlertTitle className={alerta.tipo === 'amarelo' ? 'text-yellow-800 dark:text-yellow-400' : ''}>
              {alerta.titulo}
            </AlertTitle>
            <AlertDescription className={alerta.tipo === 'amarelo' ? 'text-yellow-700 dark:text-yellow-500' : ''}>
              {alerta.descricao}
            </AlertDescription>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}

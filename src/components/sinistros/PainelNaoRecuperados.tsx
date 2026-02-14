import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays } from 'date-fns';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Eye, AlertTriangle, Clock } from 'lucide-react';

export function PainelNaoRecuperados() {
  const navigate = useNavigate();

  const { data: sinistros = [], isLoading } = useQuery({
    queryKey: ['sinistros-em-recuperacao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          id, protocolo, tipo, data_ocorrencia, status, valor_fipe,
          associado:associados(nome),
          veiculo:veiculos(placa, marca, modelo)
        `)
        .eq('status', 'em_recuperacao' as any)
        .in('tipo', ['roubo', 'furto'] as any)
        .order('data_ocorrencia', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading || sinistros.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-5 w-5 text-red-500" />
          Veículos Não Recuperados
          <Badge variant="destructive" className="ml-auto">{sinistros.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sinistros.map((sinistro) => {
          const dias = differenceInCalendarDays(new Date(), new Date(sinistro.data_ocorrencia));
          const prazoEsgotado = dias >= 30;

          return (
            <div
              key={sinistro.id}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                prazoEsgotado ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 'border-border'
              }`}
              onClick={() => navigate(`/eventos/sinistros/${sinistro.id}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-medium truncate">{sinistro.protocolo}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {sinistro.tipo === 'roubo' ? 'Roubo' : 'Furto'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {(sinistro.veiculo as any)?.placa} • {(sinistro.associado as any)?.nome}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(sinistro.data_ocorrencia), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-3">
                <div className="text-right">
                  <p className={`text-lg font-bold ${prazoEsgotado ? 'text-red-600' : 'text-amber-600'}`}>
                    {dias}d
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {prazoEsgotado ? 'Prazo esgotado' : `${30 - dias}d restantes`}
                  </p>
                </div>
                {prazoEsgotado && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

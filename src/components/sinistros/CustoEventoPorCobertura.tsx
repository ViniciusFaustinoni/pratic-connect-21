import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign } from 'lucide-react';

interface Props {
  sinistroId: string;
}

interface CustoRow {
  sinistro_id: string;
  cobertura_id: string | null;
  cobertura_codigo: string | null;
  cobertura_nome: string | null;
  valor_pecas_os: number;
  valor_cotacoes_aprovadas: number;
  valor_contas_pagar: number;
  valor_total: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));

export function CustoEventoPorCobertura({ sinistroId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['custo-evento-cobertura', sinistroId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('vw_custo_evento_por_cobertura')
        .select('*')
        .eq('sinistro_id', sinistroId);
      if (error) throw error;
      return (data || []) as CustoRow[];
    },
    enabled: !!sinistroId,
  });

  const total = (data ?? []).reduce((s, r) => s + Number(r.valor_total || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="h-5 w-5 text-primary" /> Custo por Cobertura
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum custo registrado para este evento ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cobertura</TableHead>
                <TableHead className="text-right">Peças/OS</TableHead>
                <TableHead className="text-right">Cotações</TableHead>
                <TableHead className="text-right">Contas a Pagar</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r, i) => (
                <TableRow key={`${r.cobertura_id ?? 'sem'}-${i}`}>
                  <TableCell className="font-medium">
                    {r.cobertura_nome ?? <span className="text-muted-foreground italic">Sem cobertura</span>}
                    {r.cobertura_codigo && <span className="text-xs text-muted-foreground ml-1">({r.cobertura_codigo})</span>}
                  </TableCell>
                  <TableCell className="text-right">{fmt(r.valor_pecas_os)}</TableCell>
                  <TableCell className="text-right">{fmt(r.valor_cotacoes_aprovadas)}</TableCell>
                  <TableCell className="text-right">{fmt(r.valor_contas_pagar)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(r.valor_total)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40">
                <TableCell colSpan={4} className="font-semibold text-right">Total geral</TableCell>
                <TableCell className="text-right font-bold">{fmt(total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

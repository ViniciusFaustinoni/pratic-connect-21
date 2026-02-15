import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Eye, MessageSquare, Handshake } from 'lucide-react';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function TopDevedores() {
  const navigate = useNavigate();

  const { data: devedores, isLoading } = useQuery({
    queryKey: ['top-devedores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cobrancas')
        .select(`
          associado_id, valor_final, data_vencimento,
          associado:associados!inner(id, nome, cpf, telefone, whatsapp)
        `)
        .eq('status', 'vencido')
        .lt('data_vencimento', new Date().toISOString().split('T')[0]);

      const agrupado = new Map<string, any>();
      data?.forEach((c: any) => {
        const id = c.associado.id;
        if (!agrupado.has(id)) {
          agrupado.set(id, { ...c.associado, valorTotal: 0, diasMax: 0 });
        }
        const a = agrupado.get(id);
        a.valorTotal += c.valor_final || 0;
        const dias = Math.floor((Date.now() - new Date(c.data_vencimento).getTime()) / 86400000);
        if (dias > a.diasMax) a.diasMax = dias;
      });

      return Array.from(agrupado.values())
        .sort((a, b) => b.valorTotal - a.valorTotal)
        .slice(0, 10);
    },
    staleTime: 5 * 60 * 1000,
  });

  const openWhatsApp = (numero: string) => {
    const limpo = numero?.replace(/\D/g, '') || '';
    window.open(`https://wa.me/55${limpo}`, '_blank');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top 10 Maiores Devedores</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : devedores && devedores.length > 0 ? (
          <div className="space-y-2">
            {devedores.map((d, i) => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <span className="text-lg font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{d.nome}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-destructive">{formatCurrency(d.valorTotal)}</span>
                    <Badge variant="secondary" className="text-xs">{d.diasMax}d</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cobranca/inadimplentes/${d.id}`)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openWhatsApp(d.whatsapp || d.telefone)}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/cobranca/acordos/novo?associado=${d.id}`)}>
                    <Handshake className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-6">Nenhum devedor encontrado</p>
        )}
      </CardContent>
    </Card>
  );
}

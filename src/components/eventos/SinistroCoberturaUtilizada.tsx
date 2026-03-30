import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Gift, Loader2 } from 'lucide-react';

interface CoberturaUtilizada {
  id: string;
  sinistro_id: string;
  tipo: string;
  nome: string;
  valor: number;
  observacao: string | null;
}

interface Props {
  sinistroId: string;
}

export function SinistroCoberturaUtilizada({ sinistroId }: Props) {
  const { data: itens, isLoading } = useQuery({
    queryKey: ['sinistro-coberturas-utilizadas', sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_coberturas_utilizadas' as any)
        .select('*')
        .eq('sinistro_id', sinistroId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as unknown as CoberturaUtilizada[];
    },
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin mx-auto" />;
  if (!itens?.length) return null;

  const total = itens.reduce((sum, i) => sum + Number(i.valor || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-5 w-5 text-primary" />
          Coberturas / Benefícios Utilizados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {itens.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                {item.tipo === 'cobertura' ? (
                  <Shield className="h-4 w-4 text-primary" />
                ) : (
                  <Gift className="h-4 w-4 text-accent-foreground" />
                )}
                <span className="text-sm font-medium">{item.nome}</span>
                <Badge variant="outline" className="text-xs">
                  {item.tipo === 'cobertura' ? 'Cobertura' : 'Benefício'}
                </Badge>
              </div>
              <span className="text-sm font-semibold">
                {Number(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          ))}
          <div className="flex justify-between pt-2 font-bold text-sm border-t">
            <span>Total</span>
            <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

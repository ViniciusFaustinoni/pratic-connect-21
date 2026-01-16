import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X } from 'lucide-react';
import { usePlans, useProductLines } from '@/hooks/usePlans';
import { Skeleton } from '@/components/ui/skeleton';

interface ComparadorNiveisProps {
  linhaFiltro: string;
  titulo: string;
  descricao?: string;
}

function ComparadorNiveisGeneric({ linhaFiltro, titulo, descricao }: ComparadorNiveisProps) {
  const { data: plans, isLoading: loadingPlans } = usePlans();
  const { data: productLines, isLoading: loadingLines } = useProductLines();

  const isLoading = loadingPlans || loadingLines;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Encontrar a linha de produto correspondente
  const linha = productLines?.find(l => 
    l.slug?.toLowerCase().includes(linhaFiltro.toLowerCase()) ||
    l.name?.toLowerCase().includes(linhaFiltro.toLowerCase())
  );

  // Filtrar planos da linha
  const planosLinha = plans?.filter(p => 
    p.product_line_id === linha?.id ||
    p.slug?.toLowerCase().includes(linhaFiltro.toLowerCase())
  ) || [];

  if (planosLinha.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
          <CardDescription>Nenhum plano disponível para comparação</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Extrair benefícios únicos de todos os planos
  const todosBeneficios = new Map<string, string>();
  planosLinha.forEach(plano => {
    if (Array.isArray(plano.plan_benefits)) {
      plano.plan_benefits.forEach(pb => {
        if (pb.benefits?.name) {
          todosBeneficios.set(pb.benefits.id, pb.benefits.name);
        }
      });
    }
  });

  const beneficiosArray = Array.from(todosBeneficios.entries());

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Benefício</th>
                {planosLinha.map(plano => (
                  <th key={plano.id} className="text-center py-2 px-3">
                    <Badge variant={plano.badge_text ? 'default' : 'outline'}>
                      {plano.name}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {beneficiosArray.map(([beneficioId, beneficioNome]) => (
                <tr key={beneficioId} className="border-b hover:bg-muted/50">
                  <td className="py-2 px-3">{beneficioNome}</td>
                  {planosLinha.map(plano => {
                    const temBeneficio = Array.isArray(plano.plan_benefits) && 
                      plano.plan_benefits.some(pb => pb.benefit_id === beneficioId);
                    return (
                      <td key={plano.id} className="text-center py-2 px-3">
                        {temBeneficio ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComparadorNiveisSelect() {
  return (
    <ComparadorNiveisGeneric 
      linhaFiltro="select" 
      titulo="Comparativo de Níveis - Linha Select"
      descricao="Compare os benefícios entre os níveis Basic, Premium e Exclusive"
    />
  );
}

export function ComparadorNiveisMotos() {
  return (
    <ComparadorNiveisGeneric 
      linhaFiltro="advanced" 
      titulo="Comparativo de Níveis - Linha Advanced (Motos)"
      descricao="Compare os benefícios entre os níveis para motos"
    />
  );
}

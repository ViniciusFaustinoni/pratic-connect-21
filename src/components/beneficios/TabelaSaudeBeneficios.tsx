import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { IndicadorSaude, BadgeIndicador } from './IndicadorSaude';
import { type CustoBeneficio } from '@/hooks/useCustoBeneficios';
import { Shield, Wrench, Plus } from 'lucide-react';
import { formatarMoeda } from '@/utils/format';

interface TabelaSaudeBeneficiosProps {
  beneficios: CustoBeneficio[];
  isLoading?: boolean;
  onEdit?: (beneficio: CustoBeneficio) => void;
}

function getCategoriaIcon(categoria: string) {
  switch (categoria?.toLowerCase()) {
    case 'cobertura':
    case 'coverage':
      return <Shield className="w-4 h-4" />;
    case 'assistencia':
    case 'assistance':
      return <Wrench className="w-4 h-4" />;
    default:
      return <Plus className="w-4 h-4" />;
  }
}

function getCategoriaLabel(categoria: string): string {
  const labels: Record<string, string> = {
    'cobertura': 'Cobertura',
    'coverage': 'Cobertura',
    'assistencia': 'Assistência',
    'assistance': 'Assistência',
    'adicional': 'Adicional',
    'additional': 'Adicional'
  };
  return labels[categoria?.toLowerCase()] || categoria || 'Outro';
}

export function TabelaSaudeBeneficios({ 
  beneficios, 
  isLoading = false,
  onEdit 
}: TabelaSaudeBeneficiosProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Benefícios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!beneficios.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Benefícios</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Nenhum benefício encontrado
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Ordenar: prejuízos primeiro, depois por categoria
  const beneficiosOrdenados = [...beneficios].sort((a, b) => {
    const ordemIndicador: Record<string, number> = {
      prejuizo: 0,
      equilibrio: 1,
      superavit: 2,
      sem_dados: 3
    };
    
    const diffIndicador = ordemIndicador[a.indicador] - ordemIndicador[b.indicador];
    if (diffIndicador !== 0) return diffIndicador;
    
    return a.categoria.localeCompare(b.categoria);
  });
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Benefícios</span>
          <Badge variant="secondary">{beneficios.length} total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Benefício</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Custo Real</TableHead>
                <TableHead className="text-right">Indicador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beneficiosOrdenados.map((beneficio) => (
                <TableRow 
                  key={`${beneficio.tipo_beneficio}-${beneficio.beneficio_id}`}
                  className={onEdit ? 'cursor-pointer hover:bg-muted/50' : ''}
                  onClick={() => onEdit?.(beneficio)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{beneficio.nome}</span>
                      {beneficio.tipo_beneficio === 'adicional' && (
                        <Badge variant="outline" className="text-xs">Adicional</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{beneficio.codigo}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      {getCategoriaIcon(beneficio.categoria)}
                      <span className="text-sm">{getCategoriaLabel(beneficio.categoria)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatarMoeda(beneficio.preco_sugerido)}
                  </TableCell>
                  <TableCell className="text-right">
                    {beneficio.total_cotas > 0 ? (
                      formatarMoeda(beneficio.custo_real)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <IndicadorSaude
                      precoSugerido={beneficio.preco_sugerido}
                      custoReal={beneficio.custo_real}
                      gastoTotal={beneficio.gasto_total_60d}
                      totalCotas={beneficio.total_cotas}
                      size="sm"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default TabelaSaudeBeneficios;

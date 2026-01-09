import { Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BENEFICIOS_NIVEL, ADICIONAL_NIVEL, BENEFICIOS_MOTOS } from '@/data/planosPrecos';

const formatCurrency = (value: number) => {
  if (value === 0) return '—';
  return `+R$ ${value}`;
};

export function ComparadorNiveisSelect() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Comparativo de Níveis - Linha Select</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold min-w-[200px]">Benefício</TableHead>
              <TableHead className="text-center font-semibold">
                <div className="flex flex-col items-center gap-1">
                  <span>Basic</span>
                  <Badge variant="outline" className="text-xs">{formatCurrency(ADICIONAL_NIVEL.basic)}</Badge>
                </div>
              </TableHead>
              <TableHead className="text-center font-semibold">
                <div className="flex flex-col items-center gap-1">
                  <span>Premium</span>
                  <Badge variant="secondary" className="text-xs">{formatCurrency(ADICIONAL_NIVEL.premium)}</Badge>
                </div>
              </TableHead>
              <TableHead className="text-center font-semibold">
                <div className="flex flex-col items-center gap-1">
                  <span>Exclusive</span>
                  <Badge className="text-xs bg-primary">{formatCurrency(ADICIONAL_NIVEL.exclusive)}</Badge>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {BENEFICIOS_NIVEL.map((beneficio, index) => (
              <TableRow 
                key={index}
                className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
              >
                <TableCell className="font-medium text-sm">{beneficio.nome}</TableCell>
                <TableCell className="text-center">
                  {beneficio.basic ? (
                    <Check className="h-5 w-5 text-green-500 mx-auto" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {beneficio.premium ? (
                    <Check className="h-5 w-5 text-green-500 mx-auto" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {beneficio.exclusive ? (
                    <Check className="h-5 w-5 text-green-500 mx-auto" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ComparadorNiveisMotos() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Comparativo - Linha Advanced (Motos)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold min-w-[200px]">Benefício</TableHead>
              <TableHead className="text-center font-semibold">Advanced</TableHead>
              <TableHead className="text-center font-semibold">Advanced+</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {BENEFICIOS_MOTOS.map((beneficio, index) => (
              <TableRow 
                key={index}
                className={index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}
              >
                <TableCell className="font-medium text-sm">{beneficio.nome}</TableCell>
                <TableCell className="text-center">
                  {beneficio.advanced ? (
                    <Check className="h-5 w-5 text-green-500 mx-auto" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {beneficio.advancedPlus ? (
                    <Check className="h-5 w-5 text-green-500 mx-auto" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground/40 mx-auto" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        <div className="p-4 border-t bg-muted/30">
          <p className="text-sm text-muted-foreground">
            <strong>Cotas Advanced+:</strong> Colisão: 10% FIPE | Danos a Terceiros: R$750 fixo
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

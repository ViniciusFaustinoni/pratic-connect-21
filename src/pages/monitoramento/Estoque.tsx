import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Plus } from 'lucide-react';
import { EstoqueMetricas } from '@/components/monitoramento/estoque/EstoqueMetricas';

export default function Estoque() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground">
            Controle o estoque de rastreadores e equipamentos
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Entrada de Estoque
        </Button>
      </div>

      <EstoqueMetricas />

      <Card>
        <CardHeader>
          <CardTitle>Inventário</CardTitle>
          <CardDescription>
            Lista completa de equipamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <Package className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Estoque vazio</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Cadastre rastreadores para começar
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

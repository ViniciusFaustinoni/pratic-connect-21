import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { EstoqueMetricas } from '@/components/monitoramento/estoque/EstoqueMetricas';
import { EntradaEstoqueDialog } from '@/components/monitoramento/estoque/EntradaEstoqueDialog';
import { HistoricoMovimentacoes } from '@/components/monitoramento/estoque/HistoricoMovimentacoes';

export default function Estoque() {
  const [modalEntradaAberto, setModalEntradaAberto] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
          <p className="text-muted-foreground">
            Controle o estoque de rastreadores e equipamentos
          </p>
        </div>
        <Button onClick={() => setModalEntradaAberto(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Entrada de Estoque
        </Button>
      </div>

      <EstoqueMetricas />

      <HistoricoMovimentacoes />

      <EntradaEstoqueDialog
        open={modalEntradaAberto}
        onOpenChange={setModalEntradaAberto}
      />
    </div>
  );
}

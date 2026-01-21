import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Upload, Package, Search, Clock } from 'lucide-react';
import { EstoqueMetricas } from '@/components/monitoramento/estoque/EstoqueMetricas';
import { EntradaEstoqueDialog } from '@/components/monitoramento/estoque/EntradaEstoqueDialog';
import { ImportarRastreadoresDialog } from '@/components/monitoramento/estoque/ImportarRastreadoresDialog';
import { ListaRastreadores } from '@/components/monitoramento/estoque/ListaRastreadores';
import { ConsultaRastreador } from '@/components/monitoramento/estoque/ConsultaRastreador';
import { HistoricoMovimentacoes } from '@/components/monitoramento/estoque/HistoricoMovimentacoes';

export default function Estoque() {
  const [modalEntradaAberto, setModalEntradaAberto] = useState(false);
  const [modalImportarAberto, setModalImportarAberto] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estoque de Rastreadores</h1>
          <p className="text-muted-foreground">
            Gerencie o estoque, consulte disponibilidade e acompanhe movimentações
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setModalImportarAberto(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Lote
          </Button>
          <Button onClick={() => setModalEntradaAberto(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Entrada Manual
          </Button>
        </div>
      </div>

      <EstoqueMetricas />

      <Tabs defaultValue="rastreadores" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="rastreadores" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Rastreadores</span>
          </TabsTrigger>
          <TabsTrigger value="consulta" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Consulta</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Histórico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rastreadores" className="mt-4">
          <ListaRastreadores />
        </TabsContent>

        <TabsContent value="consulta" className="mt-4">
          <ConsultaRastreador />
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoMovimentacoes />
        </TabsContent>
      </Tabs>

      <EntradaEstoqueDialog
        open={modalEntradaAberto}
        onOpenChange={setModalEntradaAberto}
      />

      <ImportarRastreadoresDialog
        open={modalImportarAberto}
        onOpenChange={setModalImportarAberto}
      />
    </div>
  );
}

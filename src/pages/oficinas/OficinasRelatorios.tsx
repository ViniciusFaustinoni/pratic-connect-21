import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TabVisaoGeral from './relatorios/TabVisaoGeral';
import TabOficinas from './relatorios/TabOficinas';
import TabAutoCenters from './relatorios/TabAutoCenters';
import TabPrestadores from './relatorios/TabPrestadores';

export default function OficinasRelatorios() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios de Fornecedores</h1>
        <p className="text-muted-foreground">Oficinas, Auto Centers e Prestadores — serviços, peças e assistências</p>
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="oficinas">Oficinas</TabsTrigger>
          <TabsTrigger value="autocenters">Auto Centers</TabsTrigger>
          <TabsTrigger value="prestadores">Prestadores</TabsTrigger>
        </TabsList>
        <TabsContent value="geral"><TabVisaoGeral /></TabsContent>
        <TabsContent value="oficinas"><TabOficinas /></TabsContent>
        <TabsContent value="autocenters"><TabAutoCenters /></TabsContent>
        <TabsContent value="prestadores"><TabPrestadores /></TabsContent>
      </Tabs>
    </div>
  );
}

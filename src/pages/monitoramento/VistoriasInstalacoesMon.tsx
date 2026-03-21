import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wrench, ClipboardCheck } from 'lucide-react';
import Instalacoes from './Instalacoes';
import Vistorias from './Vistorias';

export default function VistoriasInstalacoesMon() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vistorias e Instalações</h1>
        <p className="text-muted-foreground">
          Gerencie vistorias e instalações em um único painel
        </p>
      </div>

      <Tabs defaultValue="instalacoes" className="w-full">
        <TabsList>
          <TabsTrigger value="instalacoes" className="gap-2">
            <Wrench className="h-4 w-4" />
            Instalações
          </TabsTrigger>
          <TabsTrigger value="vistorias" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Vistorias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instalacoes">
          <Instalacoes />
        </TabsContent>

        <TabsContent value="vistorias">
          <Vistorias />
        </TabsContent>
      </Tabs>
    </div>
  );
}

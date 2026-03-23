import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wrench, ClipboardCheck, Puzzle, Truck } from 'lucide-react';
import Instalacoes from './Instalacoes';
import Vistorias from './Vistorias';
import MonitoramentoEncaixes from './Encaixes';
import ViagensTab from './ViagensTab';

export default function VistoriasInstalacoesMon() {
  return (
    <div className="container mx-auto py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Instalações e Vistorias</h1>
        <p className="text-muted-foreground">
          Acompanhe instalações, vistorias e encaixes em um único painel
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
          <TabsTrigger value="encaixes" className="gap-2">
            <Puzzle className="h-4 w-4" />
            Encaixes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instalacoes">
          <Instalacoes />
        </TabsContent>

        <TabsContent value="vistorias">
          <Vistorias />
        </TabsContent>

        <TabsContent value="encaixes">
          <MonitoramentoEncaixes embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

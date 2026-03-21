import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wrench, ClipboardCheck } from 'lucide-react';
import Instalacoes from './Instalacoes';
import Vistorias from './Vistorias';

export default function VistoriasInstalacoesMon() {
  return (
    <div className="container mx-auto py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Instalações e Vistorias</h1>
        <p className="text-muted-foreground">
          Acompanhe instalações e vistorias em um único painel
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
          <InstalacoesList />
        </TabsContent>

        <TabsContent value="vistorias">
          <VistoriasContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Inline wrappers to avoid duplicate headers/containers
function InstalacoesList() {
  return <Instalacoes />;
}

function VistoriasContent() {
  return <Vistorias />;
}

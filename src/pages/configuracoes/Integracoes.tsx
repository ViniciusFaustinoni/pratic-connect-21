import { Plug, Globe, Inbox, Key } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ServicosTab } from '@/components/integracoes/ServicosTab';
import { ApisLeadsTab } from '@/components/integracoes/ApisLeadsTab';
import { ChavesApiTab } from '@/components/integracoes/ChavesApiTab';

export default function Integracoes() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Plug className="h-6 w-6 text-primary" />
          Integrações
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie APIs, webhooks e serviços conectados
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="servicos" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="servicos" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Serviços</span>
          </TabsTrigger>
          <TabsTrigger value="apis-leads" className="gap-2">
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">APIs de Leads</span>
          </TabsTrigger>
          <TabsTrigger value="chaves-api" className="gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">Chaves de API</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servicos">
          <ServicosTab />
        </TabsContent>

        <TabsContent value="apis-leads">
          <ApisLeadsTab />
        </TabsContent>

        <TabsContent value="chaves-api">
          <ChavesApiTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

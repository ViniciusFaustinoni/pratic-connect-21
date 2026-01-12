import { Plug, Globe, Inbox, Key, CheckCircle, XCircle, TrendingUp, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ServicosTab } from '@/components/integracoes/ServicosTab';
import { ApisLeadsTab } from '@/components/integracoes/ApisLeadsTab';
import { ChavesApiTab } from '@/components/integracoes/ChavesApiTab';
import { useApiLeadsLogStats } from '@/hooks/useApiLeadsLogs';

// Mock data for connection status - in production this would come from a real check
const servicosConectados = 1; // n8n only
const servicosDesconectados = 4;

export default function Integracoes() {
  const { data: stats } = useApiLeadsLogStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Plug className="h-6 w-6 text-primary" />
          Integrações
        </h1>
        <p className="text-sm text-muted-foreground">
          Conecte serviços externos e gerencie suas APIs
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{servicosConectados}</p>
                <p className="text-xs text-muted-foreground">Conectados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{servicosDesconectados}</p>
                <p className="text-xs text-muted-foreground">Desconectados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Leads (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats?.errors || 0}</p>
                <p className="text-xs text-muted-foreground">Erros (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="servicos" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="servicos" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Serviços</span>
          </TabsTrigger>
          <TabsTrigger value="fontes-leads" className="gap-2">
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">Fontes Leads</span>
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="gap-2">
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">API Keys</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servicos">
          <ServicosTab />
        </TabsContent>

        <TabsContent value="fontes-leads">
          <ApisLeadsTab />
        </TabsContent>

        <TabsContent value="api-keys">
          <ChavesApiTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

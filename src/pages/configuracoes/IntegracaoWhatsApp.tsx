import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageCircle, Wifi, Bot, FileText, Settings, FlaskConical, HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WhatsAppProvedorSelector } from '@/components/integracoes/WhatsAppProvedorSelector';
import { ConfiguracaoEvolutionURL } from '@/components/whatsapp/ConfiguracaoEvolutionURL';
import { WhatsAppStatusCard } from '@/components/whatsapp/WhatsAppStatusCard';
import { WhatsAppIAConfig } from '@/components/integracoes/WhatsAppIAConfig';
import { WhatsAppStats } from '@/components/integracoes/WhatsAppStats';
import { WhatsAppMetaTemplates } from '@/components/integracoes/WhatsAppMetaTemplates';
import { WhatsAppConversasPainel } from '@/components/integracoes/WhatsAppConversasPainel';
import { WhatsAppTestChat } from '@/components/whatsapp/WhatsAppTestChat';
import { IntegracaoHealthPanel } from '@/components/integracoes/IntegracaoHealthPanel';

export default function IntegracaoWhatsApp() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Header com voltar */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/configuracoes/integracoes')}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">WhatsApp Business</h1>
            <p className="text-sm text-muted-foreground">
              Conecte via Evolution API ou API Oficial da Meta
            </p>
          </div>
        </div>
      </div>

      {/* Tabs organizadas */}
      <Tabs defaultValue="conexao" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="conexao" className="gap-2">
            <Wifi className="h-4 w-4" />
            <span className="hidden sm:inline">Conexão</span>
          </TabsTrigger>
          <TabsTrigger value="ia" className="gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">IA & Respostas</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Templates Meta</span>
          </TabsTrigger>
          <TabsTrigger value="testes" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">Testes</span>
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-2">
            <HeartPulse className="h-4 w-4" />
            <span className="hidden sm:inline">Health</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Tab Conexão ── */}
        <TabsContent value="conexao" className="space-y-6">
          <WhatsAppProvedorSelector />
          <Separator />
          <div className="grid gap-6 md:grid-cols-2">
            <ConfiguracaoEvolutionURL />
            <WhatsAppStatusCard />
          </div>
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertDescription>
              <strong>Webhook automático:</strong> Ao conectar o WhatsApp, o sistema configura automaticamente 
              o webhook para receber mensagens. A IA responderá associados cadastrados usando o mesmo 
              assistente do App.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* ── Tab IA & Respostas ── */}
        <TabsContent value="ia" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <WhatsAppIAConfig />
            <WhatsAppStats />
          </div>
          <WhatsAppConversasPainel />
        </TabsContent>

        {/* ── Tab Templates Meta ── */}
        <TabsContent value="templates" className="space-y-6">
          <WhatsAppMetaTemplates />
        </TabsContent>

        {/* ── Tab Testes ── */}
        <TabsContent value="testes" className="space-y-6">
          <WhatsAppTestChat />
        </TabsContent>
      </Tabs>
    </div>
  );
}

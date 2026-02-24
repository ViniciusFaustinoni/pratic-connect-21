import { MessageCircle, Settings } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ConfiguracaoEvolutionURL } from '@/components/whatsapp/ConfiguracaoEvolutionURL';
import { WhatsAppStatusCard } from '@/components/whatsapp/WhatsAppStatusCard';
import { WhatsAppIAConfig } from './WhatsAppIAConfig';
import { WhatsAppStats } from './WhatsAppStats';
import { WhatsAppProvedorSelector } from './WhatsAppProvedorSelector';
import { WhatsAppMetaTemplates } from './WhatsAppMetaTemplates';

export function WhatsAppTab() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
          <MessageCircle className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">WhatsApp Business</h2>
          <p className="text-sm text-muted-foreground">
            Conecte via Evolution API ou API Oficial da Meta e habilite atendimento automático com IA
          </p>
        </div>
      </div>

      {/* Seletor de Provedor */}
      <WhatsAppProvedorSelector />

      <Separator />

      {/* Cards de configuração Evolution */}
      <div className="grid gap-6 md:grid-cols-2">
        <ConfiguracaoEvolutionURL />
        <WhatsAppStatusCard />
      </div>

      <Separator />

      {/* IA e Estatísticas */}
      <div className="grid gap-6 md:grid-cols-2">
        <WhatsAppIAConfig />
        <WhatsAppStats />
      </div>

      <Separator />

      {/* Templates Meta */}
      <WhatsAppMetaTemplates />

      {/* Info sobre webhook */}
      <Alert>
        <Settings className="h-4 w-4" />
        <AlertDescription>
          <strong>Webhook automático:</strong> Ao conectar o WhatsApp, o sistema configura automaticamente 
          o webhook para receber mensagens. A IA responderá associados cadastrados usando o mesmo 
          assistente do App (boletos, sinistros, assistência 24h, etc.).
        </AlertDescription>
      </Alert>
    </div>
  );
}

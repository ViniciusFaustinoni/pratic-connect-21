import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Settings2, ScanText, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIModelConfigCard } from '@/components/integracoes/AIModelConfigCard';
import { OcrEngineConfigCard } from '@/components/integracoes/OcrEngineConfigCard';
import OcrLogsTab from '@/components/diretoria/OcrLogsTab';
import OcrTestesTab from '@/components/diretoria/OcrTestesTab';

export default function IntegracaoIA() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
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
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Inteligência Artificial</h1>
            <p className="text-sm text-muted-foreground">
              Provedor e modelo usados em todo o sistema (OCR, chat, análise de risco, WhatsApp, automações)
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ScanText className="h-4 w-4" />
            Logs de OCR
          </TabsTrigger>
          <TabsTrigger value="testes" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Testes de OCR
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-6">
          <AIModelConfigCard />
          <OcrEngineConfigCard />

          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>
              A escolha aqui se aplica <strong>globalmente</strong>: leitura de documentos (CNH/CRLV),
              assistentes Maya e Vinicius, análise de risco de sinistros, geração de mensagens de WhatsApp,
              formatação de texto e demais automações que usam IA.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="logs">
          <OcrLogsTab />
        </TabsContent>

        <TabsContent value="testes">
          <OcrTestesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

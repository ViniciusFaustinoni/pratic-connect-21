import { useEffect, useState } from 'react';
import { Bot, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDER_MODELS,
  AIProvider,
  useAIModelConfig,
  useUpdateAIModelConfig,
} from '@/hooks/useAIModelConfig';
import { usePermissions } from '@/hooks/usePermissions';

export function AIModelConfigCard() {
  const { data, isLoading } = useAIModelConfig();
  const update = useUpdateAIModelConfig();
  const { isDiretor, isDesenvolvedor } = usePermissions();
  const canEdit = isDiretor || isDesenvolvedor;

  const [provider, setProvider] = useState<AIProvider>('lovable');
  const [model, setModel] = useState<string>('google/gemini-3-flash-preview');

  useEffect(() => {
    if (data) {
      setProvider(data.provider);
      setModel(data.model);
    }
  }, [data]);

  const models = AI_PROVIDER_MODELS[provider];
  const requiresKey = provider === 'openai' || provider === 'anthropic';
  const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';

  const handleProviderChange = (next: AIProvider) => {
    setProvider(next);
    // Seleciona o primeiro modelo do novo provedor
    setModel(AI_PROVIDER_MODELS[next][0].value);
  };

  const dirty = data ? data.provider !== provider || data.model !== model : true;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Modelo de IA do Sistema</CardTitle>
          </div>
          <Badge variant="secondary">{AI_PROVIDER_LABELS[provider]}</Badge>
        </div>
        <CardDescription>
          Configuração global aplicada a <strong>todas</strong> as funcionalidades de IA:
          leitura de documentos (OCR), Maya/Vinicius, chat, análise de risco, WhatsApp e demais automações.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-provider">Provedor</Label>
            <Select
              value={provider}
              onValueChange={(v) => handleProviderChange(v as AIProvider)}
              disabled={!canEdit || update.isPending}
            >
              <SelectTrigger id="ai-provider"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable">{AI_PROVIDER_LABELS.lovable}</SelectItem>
                <SelectItem value="openai">{AI_PROVIDER_LABELS.openai}</SelectItem>
                <SelectItem value="anthropic">{AI_PROVIDER_LABELS.anthropic}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-model">Modelo</Label>
            <Select
              value={model}
              onValueChange={setModel}
              disabled={!canEdit || update.isPending}
            >
              <SelectTrigger id="ai-model"><SelectValue /></SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {requiresKey && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Este provedor exige a secret <code className="text-xs px-1 py-0.5 rounded bg-muted">{keyName}</code> configurada
              em <strong>Cloud → Settings → Functions → Secrets</strong>. Sem ela, o sistema cairá automaticamente para o
              Lovable AI Gateway com Gemini.
            </AlertDescription>
          </Alert>
        )}

        {provider === 'lovable' && (
          <Alert>
            <Bot className="h-4 w-4" />
            <AlertDescription>
              Lovable AI Gateway usa cota inclusa do workspace (sem chave externa). Recomendado para a maioria dos casos.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          {!canEdit && (
            <p className="text-xs text-muted-foreground mr-auto">
              Apenas Diretor ou Desenvolvedor pode alterar.
            </p>
          )}
          <Button
            onClick={() => update.mutate({ provider, model })}
            disabled={!canEdit || !dirty || update.isPending}
          >
            {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

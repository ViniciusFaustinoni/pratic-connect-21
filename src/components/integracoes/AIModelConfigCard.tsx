import { useEffect, useState } from 'react';
import { Bot, Loader2, AlertCircle, Sparkles, Eye, EyeOff, KeyRound, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  useAIProviderKeysStatus,
  useSetAIProviderKey,
  useRemoveAIProviderKey,
} from '@/hooks/useAIProviderKeys';
import { usePermissions } from '@/hooks/usePermissions';

export function AIModelConfigCard() {
  const { data, isLoading } = useAIModelConfig();
  const update = useUpdateAIModelConfig();
  const keysStatus = useAIProviderKeysStatus();
  const setKey = useSetAIProviderKey();
  const removeKey = useRemoveAIProviderKey();
  const { isDiretor, isDesenvolvedor } = usePermissions();
  const canEdit = isDiretor || isDesenvolvedor;

  const [provider, setProvider] = useState<AIProvider>('lovable');
  const [model, setModel] = useState<string>('google/gemini-3-flash-preview');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (data) {
      setProvider(data.provider);
      setModel(data.model);
    }
  }, [data]);

  // Reset campo de chave ao trocar provedor
  useEffect(() => {
    setApiKeyInput('');
    setShowKey(false);
  }, [provider]);

  const models = AI_PROVIDER_MODELS[provider];
  const requiresKey = provider === 'openai' || provider === 'anthropic';
  const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
  const keyConfigured =
    provider === 'openai'
      ? !!keysStatus.data?.openai
      : provider === 'anthropic'
      ? !!keysStatus.data?.anthropic
      : false;

  const handleProviderChange = (next: AIProvider) => {
    setProvider(next);
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
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Chave de API — {AI_PROVIDER_LABELS[provider]}
                </span>
              </div>
              {keyConfigured ? (
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" /> Configurada
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <X className="h-3 w-3" /> Não configurada
                </Badge>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    keyConfigured
                      ? '•••••••• (digite para substituir)'
                      : provider === 'openai'
                      ? 'sk-...'
                      : 'sk-ant-...'
                  }
                  disabled={!canEdit || setKey.isPending}
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                onClick={() =>
                  setKey.mutate(
                    { provider: provider as 'openai' | 'anthropic', value: apiKeyInput },
                    { onSuccess: () => setApiKeyInput('') },
                  )
                }
                disabled={!canEdit || setKey.isPending || apiKeyInput.trim().length < 10}
              >
                {setKey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar chave
              </Button>
              {keyConfigured && (
                <Button
                  variant="outline"
                  onClick={() => removeKey.mutate(provider as 'openai' | 'anthropic')}
                  disabled={!canEdit || removeKey.isPending}
                >
                  Remover
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              A chave é armazenada com segurança no backend e usada apenas em chamadas server-side.
              Nome interno: <code className="text-xs px-1 py-0.5 rounded bg-muted">{keyName}</code>.
              Sem chave configurada, o sistema cai automaticamente para o Lovable AI Gateway com Gemini.
            </p>
          </div>
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

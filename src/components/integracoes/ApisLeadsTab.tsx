import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Key,
  Link,
  BookOpen,
  Loader2,
  TrendingUp,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApiKeys, useCreateApiKey } from '@/hooks/useApiKeys';
import { useApiLeadsConfig, useToggleApiIntegration, ApiLeadsConfig } from '@/hooks/useApiLeadsConfig';
import { useApiLeadsLogStats } from '@/hooks/useApiLeadsLogs';
import { ApiIntegrationCard } from '@/components/leads/ApiIntegrationCard';
import { ApiTutorialModal } from '@/components/leads/ApiTutorialModal';
import { ApiLogsModal } from '@/components/leads/ApiLogsModal';

const SUPABASE_URL = 'https://iyxdgmukrrdkffraptsx.supabase.co';
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/leads-webhook`;

export function ApisLeadsTab() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ApiLeadsConfig | null>(null);
  const [currentApiKey, setCurrentApiKey] = useState<string | null>(null);

  const { data: apiKeys } = useApiKeys();
  const { data: integrations, isLoading: loadingIntegrations } = useApiLeadsConfig();
  const { data: stats } = useApiLeadsLogStats();
  const createApiKey = useCreateApiKey();
  const toggleIntegration = useToggleApiIntegration();

  // Get the first active API key for display
  const activeApiKey = apiKeys?.find(k => k.ativa);
  const displayKey = showApiKey 
    ? (currentApiKey || activeApiKey?.key_prefix || 'Nenhuma chave ativa')
    : '••••••••••••••••••••••••••••••••';

  const copyToClipboard = async (text: string, type: 'url' | 'key') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'url') {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      }
      toast.success('Copiado!');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const handleGenerateKey = async () => {
    try {
      const result = await createApiKey.mutateAsync('API Leads');
      setCurrentApiKey(result.fullKey);
      setShowApiKey(true);
      toast.success('API Key gerada! Copie agora, ela não será exibida novamente.');
    } catch {
      toast.error('Erro ao gerar API Key');
    }
  };

  const handleToggleIntegration = (id: string, ativo: boolean) => {
    toggleIntegration.mutate({ id, ativo });
  };

  const handleOpenTutorial = (config: ApiLeadsConfig) => {
    setSelectedConfig(config);
    setTutorialOpen(true);
  };

  const handleOpenLogs = (config: ApiLeadsConfig) => {
    setSelectedConfig(config);
    setLogsOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads (24h)</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sucesso</p>
                <p className="text-2xl font-bold">{stats?.success || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Erros</p>
                <p className="text-2xl font-bold">{stats?.errors || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Webhook URL & API Key */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5" />
            Credenciais da API
          </CardTitle>
          <CardDescription>
            Use estas credenciais para integrar suas fontes de leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Webhook URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Link className="h-4 w-4" />
              URL do Webhook
            </label>
            <div className="flex gap-2">
              <Input
                value={WEBHOOK_URL}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(WEBHOOK_URL, 'url')}
              >
                {copiedUrl ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Separator />

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Key (mantenha em segredo)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={displayKey}
                  readOnly
                  className="font-mono text-sm pr-10"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(currentApiKey || activeApiKey?.key_prefix || '', 'key')}
                disabled={!activeApiKey && !currentApiKey}
              >
                {copiedKey ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            {!activeApiKey && !currentApiKey && (
              <p className="text-xs text-yellow-600">
                ⚠️ Nenhuma API Key ativa. Gere uma para começar a receber leads.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={handleGenerateKey}
              disabled={createApiKey.isPending}
            >
              {createApiKey.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Gerar Nova API Key
            </Button>
            <Button 
              variant="ghost"
              onClick={() => {
                setSelectedConfig(null);
                setTutorialOpen(true);
              }}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Ver Tutorial
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg">
              📊 Fontes de Leads
            </span>
            <Badge variant="secondary">
              {integrations?.filter(i => i.ativo).length || 0} ativas
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingIntegrations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {integrations?.map((config) => (
                <ApiIntegrationCard
                  key={config.id}
                  config={config}
                  onToggle={handleToggleIntegration}
                  onOpenLogs={handleOpenLogs}
                  onOpenTutorial={handleOpenTutorial}
                  isToggling={toggleIntegration.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <ApiTutorialModal
        open={tutorialOpen}
        onOpenChange={setTutorialOpen}
        config={selectedConfig}
        apiKey={currentApiKey || activeApiKey?.key_prefix || null}
      />

      <ApiLogsModal
        open={logsOpen}
        onOpenChange={setLogsOpen}
        config={selectedConfig}
      />
    </div>
  );
}

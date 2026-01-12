import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Settings,
  FileText,
  Clock,
  Search,
  Facebook,
  Instagram,
  Globe,
  MessageCircle,
  Zap,
  Lock,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApiKeys, useCreateApiKey } from '@/hooks/useApiKeys';
import { useApiLeadsConfig, useToggleApiIntegration, ApiLeadsConfig } from '@/hooks/useApiLeadsConfig';
import { ApiTutorialModal } from '@/components/leads/ApiTutorialModal';
import { ApiLogsModal } from '@/components/leads/ApiLogsModal';
import { cn } from '@/lib/utils';

const SUPABASE_URL = 'https://iyxdgmukrrdkffraptsx.supabase.co';
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/leads-webhook`;

const ICON_MAP: Record<string, React.ElementType> = {
  'search': Search,
  'google': Search,
  'facebook': Facebook,
  'instagram': Instagram,
  'globe': Globe,
  'message-circle': MessageCircle,
  'zap': Zap,
  'link': Link,
};

function FonteLeadCard({
  config,
  onToggle,
  onOpenLogs,
  onOpenTutorial,
  isToggling,
}: {
  config: ApiLeadsConfig;
  onToggle: (id: string, ativo: boolean) => void;
  onOpenLogs: (config: ApiLeadsConfig) => void;
  onOpenTutorial: (config: ApiLeadsConfig) => void;
  isToggling?: boolean;
}) {
  const Icon = ICON_MAP[config.icone] || Link;

  const formatLastLead = (date: string | null) => {
    if (!date) return null;
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
    } catch {
      return null;
    }
  };

  const lastLead = formatLastLead(config.ultimo_lead_em);
  const isLowActivity = config.ultimo_lead_em && 
    new Date(config.ultimo_lead_em) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  // Determine status color
  const getStatusColor = () => {
    if (!config.ativo) return 'bg-muted-foreground';
    if (isLowActivity) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Card className={cn(
      "border-border/50 transition-all duration-200 hover:shadow-md",
      !config.ativo && "opacity-60"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Status + Icon + Info */}
          <div className="flex items-start gap-3 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn(
                "h-2.5 w-2.5 rounded-full flex-shrink-0",
                getStatusColor(),
                config.ativo && !isLowActivity && "animate-pulse"
              )} />
              <div 
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${config.cor}20` }}
              >
                <Icon className="h-5 w-5" style={{ color: config.cor }} />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{config.nome}</h3>
                {isLowActivity && config.ativo && (
                  <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30 bg-yellow-500/10">
                    Baixa atividade
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {config.leads_recebidos} leads
                </span>
                {lastLead && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {lastLead}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Toggle */}
          <Switch
            checked={config.ativo}
            onCheckedChange={(checked) => onToggle(config.id, checked)}
            disabled={isToggling}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onOpenTutorial(config)}
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Configurar
          </Button>
          
          {config.leads_recebidos > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onOpenLogs(config)}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Logs
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

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

  const activeIntegrations = integrations?.filter(i => i.ativo).length || 0;

  return (
    <div className="space-y-6">
      {/* Credentials Card - Highlighted */}
      <Card className="border-border/50 bg-muted/30">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" />
            Credenciais do Webhook
          </CardTitle>
          <CardDescription>
            Use estas credenciais para integrar suas fontes de leads
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Webhook URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Link className="h-4 w-4 text-muted-foreground" />
              URL do Webhook
            </label>
            <div className="flex gap-2">
              <Input
                value={WEBHOOK_URL}
                readOnly
                className="font-mono text-sm bg-background"
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
              <Key className="h-4 w-4 text-muted-foreground" />
              API Key
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={displayKey}
                  readOnly
                  className="font-mono text-sm pr-10 bg-background"
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
              <p className="text-xs text-yellow-600 flex items-center gap-1">
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

      {/* Lead Sources */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                📥 Fontes de Leads
              </CardTitle>
              <CardDescription>
                Configure de onde seus leads serão recebidos
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {activeIntegrations} ativas
              </Badge>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Fonte
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingIntegrations ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !integrations?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground">Nenhuma fonte configurada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Adicione fontes de leads para começar a receber dados
              </p>
              <Button className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Fonte
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {integrations.map((config) => (
                <FonteLeadCard
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

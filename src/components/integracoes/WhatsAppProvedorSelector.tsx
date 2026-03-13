import { useState, useEffect } from 'react';
import { Server, Smartphone, Check, Loader2, Eye, EyeOff, Copy, ChevronDown, Wifi, WifiOff, Shield, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useMetaConfig, useSalvarMetaConfig, useTestarMetaConexao, useTrocarProvedor } from '@/hooks/useWhatsAppMeta';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { toast } from 'sonner';

const WEBHOOK_URL = `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/whatsapp-meta-webhook`;

interface EvoInstanciaInfo {
  api_url?: string;
  instance_name?: string;
}

export function WhatsAppProvedorSelector() {
  const { data: metaConfig, isLoading: loadingConfig } = useMetaConfig();
  const { status: evoStatus, instancia } = useWhatsAppStatus();
  const salvarConfig = useSalvarMetaConfig();
  const testarConexao = useTestarMetaConexao();
  const trocarProvedor = useTrocarProvedor();
  const [evoInfo, setEvoInfo] = useState<EvoInstanciaInfo>({});

  // Fetch extra instancia info (api_url, instance_name) from DB
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('whatsapp_instancias')
        .select('api_url, instance_name')
        .eq('principal', true)
        .maybeSingle();
      if (data) setEvoInfo(data);
    }
    load();
  }, []);

  const [phoneId, setPhoneId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<'evolution' | 'meta_oficial' | null>(null);
  const [instrOpen, setInstrOpen] = useState(false);

  // Sync form with loaded data
  const effectivePhoneId = phoneId || metaConfig?.phone_number_id || '';
  const effectiveWabaId = wabaId || metaConfig?.waba_id || '';
  const effectiveToken = accessToken || (metaConfig as any)?.access_token || '';

  const metaAtivo = metaConfig?.ativo === true;
  const evolutionAtivo = !metaAtivo;
  const evoConectado = evoStatus === 'open';
  const metaTestado = metaConfig?.testado === true;

  const handleSalvarMeta = () => {
    if (!effectivePhoneId || !effectiveWabaId) {
      toast.error('Preencha Phone Number ID e WABA ID');
      return;
    }
    salvarConfig.mutate({ phone_number_id: effectivePhoneId, waba_id: effectiveWabaId, access_token: effectiveToken || undefined });
  };

  const handleTestarMeta = () => {
    if (!effectivePhoneId) {
      toast.error('Salve a configuração primeiro');
      return;
    }
    testarConexao.mutate(effectivePhoneId);
  };

  const handleConfirmarTroca = (provedor: 'evolution' | 'meta_oficial') => {
    trocarProvedor.mutate(provedor);
    setConfirmDialog(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Provedor de WhatsApp
        </h3>
        <p className="text-sm text-muted-foreground">
          Apenas um provedor pode estar ativo por vez. O provedor ativo é responsável por todos os envios de WhatsApp do sistema.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Card Evolution API */}
        <Card className={`border-2 transition-colors ${evolutionAtivo ? 'border-green-500' : 'border-border'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Server className="h-4 w-4" />
                Evolution API / Baileys
              </CardTitle>
              <div className="flex gap-1">
                {evoConectado && <Badge className="bg-green-500 text-xs">CONECTADO</Badge>}
                {evolutionAtivo && <Badge variant="outline" className="text-xs border-green-500 text-green-600">ATIVO</Badge>}
              </div>
            </div>
            <CardDescription className="text-xs">Conexão via QR Code / Pairing Code</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">URL:</span>
                <span className="font-mono text-xs truncate max-w-[180px]">{evoInfo.api_url || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Instância:</span>
                <span className="font-mono text-xs">{evoInfo.instance_name || instancia?.instance_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant={evoConectado ? 'default' : 'secondary'} className="text-xs">
                  {evoConectado ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                  {evoStatus || 'desconhecido'}
                </Badge>
              </div>
            </div>
            <Button
              variant={evolutionAtivo ? 'secondary' : 'default'}
              size="sm"
              className="w-full"
              disabled={evolutionAtivo || trocarProvedor.isPending}
              onClick={() => setConfirmDialog('evolution')}
            >
              {evolutionAtivo ? (
                <><Check className="h-4 w-4 mr-1" /> Provedor ativo</>
              ) : (
                'Usar este provedor'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Card Meta API */}
        <Card className={`border-2 transition-colors ${metaAtivo ? 'border-blue-500' : 'border-border'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                API Oficial da Meta
              </CardTitle>
              <div className="flex gap-1">
                {metaTestado && <Badge className="bg-green-500 text-xs">TESTADO</Badge>}
                {metaAtivo && <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">ATIVO</Badge>}
              </div>
            </div>
            <CardDescription className="text-xs">Cloud API com templates aprovados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Phone Number ID *</Label>
                <Input
                  placeholder="Ex: 123456789012345"
                  className="h-8 text-xs"
                  value={effectivePhoneId}
                  onChange={(e) => setPhoneId(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">WABA ID *</Label>
                <Input
                  placeholder="Ex: 987654321098765"
                  className="h-8 text-xs"
                  value={effectiveWabaId}
                  onChange={(e) => setWabaId(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Access Token *</Label>
                <div className="flex gap-1">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    placeholder="Cole o token permanente aqui"
                    className="h-8 text-xs"
                    value={effectiveToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowToken(!showToken)}>
                    {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Token permanente do sistema (System User Token)</p>
              </div>

              <Separator />

              <div>
                <Label className="text-xs">Verify Token (somente leitura)</Label>
                <div className="flex gap-1">
                  <Input className="h-8 text-xs font-mono" value="sga_pratic_meta_webhook" readOnly />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard('sga_pratic_meta_webhook')}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs">URL do Webhook</Label>
                <div className="flex gap-1">
                  <Input className="h-8 text-xs font-mono" value={WEBHOOK_URL} readOnly />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyToClipboard(WEBHOOK_URL)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleSalvarMeta} disabled={salvarConfig.isPending}>
                {salvarConfig.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Salvar
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleTestarMeta} disabled={testarConexao.isPending || !metaConfig}>
                {testarConexao.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Testar
              </Button>
            </div>

            <Button
              variant={metaAtivo ? 'secondary' : 'default'}
              size="sm"
              className="w-full"
              disabled={metaAtivo || !metaTestado || trocarProvedor.isPending}
              onClick={() => setConfirmDialog('meta_oficial')}
            >
              {metaAtivo ? (
                <><Check className="h-4 w-4 mr-1" /> Provedor ativo</>
              ) : !metaTestado ? (
                'Teste a conexão primeiro'
              ) : (
                'Usar este provedor'
              )}
            </Button>

            {/* Instruções colapsáveis */}
            <Collapsible open={instrOpen} onOpenChange={setInstrOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                  <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${instrOpen ? 'rotate-180' : ''}`} />
                  Como configurar
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ol className="text-xs text-muted-foreground space-y-1.5 mt-2 pl-4 list-decimal">
                  <li>Acesse <strong>developers.facebook.com</strong> e crie um app do tipo Business</li>
                  <li>Adicione o produto "WhatsApp Business API"</li>
                  <li>Copie o <strong>Phone Number ID</strong> e o <strong>WABA ID</strong> do painel</li>
                  <li>Gere um <strong>Access Token de sistema permanente</strong> (não use token temporário)</li>
                  <li>No painel da Meta, configure o webhook:
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">
                      <li>URL: a URL do Webhook acima</li>
                      <li>Verify Token: <code>sga_pratic_meta_webhook</code></li>
                      <li>Eventos: messages, message_deliveries, message_reads, message_template_status_update</li>
                    </ul>
                  </li>
                  <li>Salve, teste a conexão e ative o provedor</li>
                </ol>
              </CollapsibleContent>
            </Collapsible>

            {/* Telemetria do webhook */}
            {metaAtivo && metaConfig && (
              <WebhookTelemetry config={metaConfig} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog confirmação de troca */}
      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar provedor de WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os envios de WhatsApp do sistema passarão a usar{' '}
              <strong>{confirmDialog === 'meta_oficial' ? 'API Oficial da Meta' : 'Evolution API'}</strong>.
              Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDialog && handleConfirmarTroca(confirmDialog)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WebhookTelemetry({ config }: { config: any }) {
  const lastAt = config.last_webhook_at;
  const error = config.last_webhook_error;
  const msgs = config.last_webhook_messages_count || 0;
  const sts = config.last_webhook_statuses_count || 0;

  const isStale = lastAt
    ? (Date.now() - new Date(lastAt).getTime()) > 24 * 60 * 60 * 1000
    : true;

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return d; }
  };

  return (
    <div className="space-y-2 pt-2 border-t">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Telemetria Webhook</p>
      
      {isStale && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-xs">
            {lastAt
              ? `Nenhum webhook recebido desde ${formatDate(lastAt)}. Verifique a configuração no painel da Meta.`
              : 'Nenhum webhook recebido ainda. Verifique se o callback está configurado corretamente no painel da Meta.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-1 text-[11px]">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          Último:
        </div>
        <span className="font-mono">{lastAt ? formatDate(lastAt) : '—'}</span>

        <span className="text-muted-foreground">Mensagens:</span>
        <span className="font-mono">{msgs}</span>

        <span className="text-muted-foreground">Statuses:</span>
        <span className="font-mono">{sts}</span>
      </div>

      {error && (
        <p className="text-[10px] text-destructive bg-destructive/10 rounded px-2 py-1">
          Último erro: {error}
        </p>
      )}
    </div>
  );
}

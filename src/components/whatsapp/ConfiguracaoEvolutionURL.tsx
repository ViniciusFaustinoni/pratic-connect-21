import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Server, Check, AlertCircle, Loader2, Webhook, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FormData {
  api_url: string;
  instance_name: string;
}

interface WebhookStatus {
  enabled: boolean;
  url: string | null;
}

export function ConfiguracaoEvolutionURL() {
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingWebhook, setLoadingWebhook] = useState(false);
  const [urlAtual, setUrlAtual] = useState('');
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus>({ enabled: false, url: null });
  const [instanciaId, setInstanciaId] = useState<string | null>(null);
  
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      api_url: '',
      instance_name: 'sga-pratic',
    }
  });

  useEffect(() => {
    async function carregarConfig() {
      try {
        const { data } = await supabase
          .from('whatsapp_instancias')
          .select('id, api_url, instance_name, webhook_enabled, webhook_url')
          .eq('principal', true)
          .maybeSingle();
        
        if (data) {
          setValue('api_url', data.api_url || '');
          setValue('instance_name', data.instance_name || 'sga-pratic');
          setUrlAtual(data.api_url || '');
          setInstanciaId(data.id);
          setWebhookStatus({
            enabled: data.webhook_enabled || false,
            url: data.webhook_url || null
          });
        }
      } catch (error) {
        console.error('Erro ao carregar config:', error);
      } finally {
        setLoadingConfig(false);
      }
    }
    carregarConfig();
  }, [setValue]);

  const onSubmit = async (values: FormData) => {
    setLoading(true);
    try {
      if (!values.api_url.startsWith('http')) {
        throw new Error('URL inválida. Deve começar com http:// ou https://');
      }

      const urlLimpa = values.api_url.replace(/\/$/, '');

      const { data: existente } = await supabase
        .from('whatsapp_instancias')
        .select('id')
        .eq('principal', true)
        .maybeSingle();

      if (existente) {
        const { error } = await supabase
          .from('whatsapp_instancias')
          .update({ 
            api_url: urlLimpa,
            instance_name: values.instance_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existente.id);
        
        if (error) throw error;
        setInstanciaId(existente.id);
      } else {
        const { data: newData, error } = await supabase
          .from('whatsapp_instancias')
          .insert({
            nome: 'Principal',
            instance_name: values.instance_name,
            api_url: urlLimpa,
            principal: true,
            ativa: true,
            status: 'disconnected',
            webhook_enabled: false,
            webhook_events: [],
          })
          .select('id')
          .single();
        
        if (error) throw error;
        if (newData) setInstanciaId(newData.id);
      }

      setUrlAtual(urlLimpa);
      toast.success('Configuração salva com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const configurarWebhook = async () => {
    if (!instanciaId) {
      toast.error('Configure a URL da Evolution API primeiro');
      return;
    }

    setLoadingWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-set-webhook', {
        body: { instancia_id: instanciaId }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao configurar webhook');

      setWebhookStatus({
        enabled: true,
        url: data.webhook_url
      });

      toast.success('Webhook configurado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao configurar webhook:', error);
      toast.error(error.message || 'Erro ao configurar webhook');
    } finally {
      setLoadingWebhook(false);
    }
  };

  if (loadingConfig) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="h-5 w-5" />
          Configuração Evolution API
        </CardTitle>
        <CardDescription>
          Configure a URL da sua instância Evolution API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api_url">URL da Evolution API *</Label>
            <Input
              id="api_url"
              {...register('api_url', { required: 'URL é obrigatória' })}
              placeholder="https://evolution.seudominio.com"
            />
            <p className="text-xs text-muted-foreground">
              Ex: https://evolution.seudominio.com ou https://api.evolution.com
            </p>
            {errors.api_url && (
              <p className="text-xs text-destructive">{errors.api_url.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="instance_name">Nome da Instância *</Label>
            <Input
              id="instance_name"
              {...register('instance_name', { required: 'Nome da instância é obrigatório' })}
              placeholder="sga-pratic"
            />
            <p className="text-xs text-muted-foreground">
              Nome da instância criada na Evolution API
            </p>
            {errors.instance_name && (
              <p className="text-xs text-destructive">{errors.instance_name.message}</p>
            )}
          </div>

          {urlAtual && (
            <Alert className="border-primary/50 bg-primary/10">
              <Check className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                URL configurada: {urlAtual}
              </AlertDescription>
            </Alert>
          )}

          {!urlAtual && (
            <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                URL não configurada. Configure para habilitar o WhatsApp.
              </AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {loading ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </form>

        {urlAtual && (
          <>
            <Separator />

            {/* Seção do Webhook */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Status do Webhook</span>
                </div>
                <Badge variant={webhookStatus.enabled ? 'default' : 'secondary'}>
                  {webhookStatus.enabled ? 'Configurado' : 'Não Configurado'}
                </Badge>
              </div>

              {webhookStatus.enabled && webhookStatus.url && (
                <div className="p-3 rounded-md bg-muted/50 space-y-1">
                  <p className="text-xs text-muted-foreground">URL do Webhook:</p>
                  <p className="text-xs font-mono break-all">{webhookStatus.url}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant={webhookStatus.enabled ? 'outline' : 'default'}
                  size="sm"
                  onClick={configurarWebhook}
                  disabled={loadingWebhook}
                >
                  {loadingWebhook ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {webhookStatus.enabled ? 'Reconfigurar Webhook' : 'Configurar Webhook'}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                O webhook é configurado automaticamente ao conectar o WhatsApp. 
                Use o botão acima caso precise reconfigurar manualmente.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

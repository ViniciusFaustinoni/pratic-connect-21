import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Server, Check, AlertCircle, Loader2 } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FormData {
  api_url: string;
  instance_name: string;
}

export function ConfiguracaoEvolutionURL() {
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [urlAtual, setUrlAtual] = useState('');
  
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
          .select('api_url, instance_name')
          .eq('principal', true)
          .maybeSingle();
        
        if (data) {
          setValue('api_url', data.api_url || '');
          setValue('instance_name', data.instance_name || 'sga-pratic');
          setUrlAtual(data.api_url || '');
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
      } else {
        const { error } = await supabase
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
          });
        
        if (error) throw error;
      }

      setUrlAtual(urlLimpa);
      toast.success('Configuração salva com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar configuração');
    } finally {
      setLoading(false);
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
      <CardContent>
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
            <Alert className="border-green-500/50 bg-green-500/10">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                URL configurada: {urlAtual}
              </AlertDescription>
            </Alert>
          )}

          {!urlAtual && (
            <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 dark:text-amber-400">
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
      </CardContent>
    </Card>
  );
}

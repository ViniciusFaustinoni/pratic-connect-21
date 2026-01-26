import { useState, useEffect } from 'react';
import { Bot, Loader2, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function WhatsAppIAConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iaHabilitada, setIaHabilitada] = useState(true);
  const [instanciaId, setInstanciaId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const { data } = await supabase
          .from('whatsapp_instancias')
          .select('id, ia_habilitada, status')
          .eq('principal', true)
          .maybeSingle();

        if (data) {
          setInstanciaId(data.id);
          setIaHabilitada(data.ia_habilitada ?? true);
          setConnected(data.status === 'open');
        }
      } catch (error) {
        console.error('Erro ao carregar config IA:', error);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleToggle = async (enabled: boolean) => {
    if (!instanciaId) {
      toast.error('Configure a instância Evolution API primeiro');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_instancias')
        .update({ ia_habilitada: enabled })
        .eq('id', instanciaId);

      if (error) throw error;

      setIaHabilitada(enabled);
      toast.success(enabled ? 'IA do WhatsApp ativada!' : 'IA do WhatsApp desativada');
    } catch (error: any) {
      toast.error('Erro ao salvar configuração');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Assistente IA WhatsApp</CardTitle>
          </div>
          <Badge variant={iaHabilitada && connected ? 'default' : 'secondary'}>
            {iaHabilitada && connected ? 'Ativo' : iaHabilitada ? 'Aguardando conexão' : 'Desativado'}
          </Badge>
        </div>
        <CardDescription>
          Responde automaticamente mensagens de associados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="ia-toggle" className="text-sm font-medium">
              Ativar Assistente IA
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando ativo, responde consultas de boletos, sinistros, etc.
            </p>
          </div>
          <Switch
            id="ia-toggle"
            checked={iaHabilitada}
            onCheckedChange={handleToggle}
            disabled={saving || !instanciaId}
          />
        </div>

        {/* Info das capacidades */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Capacidades da IA
          </p>
          <ul className="text-sm space-y-1.5">
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-green-500" />
              Consultar boletos pendentes
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-green-500" />
              Ver histórico de pagamentos
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-green-500" />
              Registrar sinistros (via aprovação)
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-green-500" />
              Solicitar assistência 24h
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-green-500" />
              Consultar status de veículos
            </li>
          </ul>
        </div>

        {!instanciaId && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-500/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            Configure a URL da Evolution API primeiro
          </div>
        )}
      </CardContent>
    </Card>
  );
}

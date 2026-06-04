import { useState, useEffect } from 'react';
import { Bot, Loader2, AlertCircle, ShieldOff, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  useIAHabilidades,
  useToggleIAHabilidade,
  type IAHabilidade,
} from '@/hooks/useIAHabilidades';

/**
 * Painel admin de IA WhatsApp.
 *
 * Hierarquia canônica (04/06/26):
 *  1. KILL-SWITCH GERAL (`whatsapp_instancias.ia_habilitada`):
 *     enquanto desligado, NENHUMA habilidade atende — independente do switch
 *     individual. Não apaga o estado das habilidades; apenas bloqueia em runtime.
 *  2. Switch POR HABILIDADE (`ia_habilidades.ativa`):
 *     liga/desliga cada habilidade de forma independente. Sem efeito cruzado:
 *     desligar 'vendas' não afeta 'relacionamento' e vice-versa.
 *
 * O mesmo switch da habilidade `relacionamento` também aparece em
 * /relacionamento/config-ia (tela do time de relacionamento).
 */
export function WhatsAppIAConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [iaHabilitada, setIaHabilitada] = useState(true);
  const [instanciaId, setInstanciaId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const { data: habilidades = [], isLoading: loadingHab } = useIAHabilidades();
  const toggleHab = useToggleIAHabilidade();

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

  const handleKillSwitch = async (enabled: boolean) => {
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
      toast.success(
        enabled
          ? 'IA religada. Habilidades voltam ao estado em que foram deixadas.'
          : 'IA desligada por completo. Estado de cada habilidade foi preservado.'
      );
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
            {!iaHabilitada
              ? 'Desligada (geral)'
              : connected
              ? 'Ativa'
              : 'Aguardando conexão'}
          </Badge>
        </div>
        <CardDescription>
          Desligamento geral prevalece. Quando religado, cada habilidade volta ao estado individual.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Kill-switch geral */}
        <div className="flex items-start justify-between gap-3 p-3 bg-muted/50 rounded-lg border">
          <div className="space-y-0.5 flex-1">
            <div className="flex items-center gap-2">
              <ShieldOff className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="ia-killswitch" className="text-sm font-medium">
                Desligar IA por completo
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Bloqueia todas as habilidades enquanto ativo, sem apagar o estado individual de cada uma.
            </p>
          </div>
          <Switch
            id="ia-killswitch"
            checked={iaHabilitada}
            onCheckedChange={handleKillSwitch}
            disabled={saving || !instanciaId}
          />
        </div>

        <Separator />

        {/* Switches por habilidade */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Habilidades
            </p>
          </div>

          {loadingHab ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : habilidades.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">
              Nenhuma habilidade cadastrada.
            </p>
          ) : (
            <ul className="space-y-2">
              {habilidades.map((h: IAHabilidade) => (
                <li
                  key={h.slug}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {h.nome_exibicao}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {h.slug}
                      </Badge>
                      {!iaHabilitada && h.ativa && (
                        <Badge variant="secondary" className="text-[10px]">
                          Bloqueada pelo desligamento geral
                        </Badge>
                      )}
                    </div>
                    {h.descricao && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {h.descricao}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={h.ativa}
                    disabled={toggleHab.isPending}
                    onCheckedChange={(ativa) =>
                      toggleHab.mutate({ slug: h.slug, ativa })
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted-foreground px-1">
            Editar regras/conhecimento/exemplos de cada habilidade em{' '}
            <code className="bg-muted px-1 py-0.5 rounded">/relacionamento/config-ia</code>.
          </p>
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

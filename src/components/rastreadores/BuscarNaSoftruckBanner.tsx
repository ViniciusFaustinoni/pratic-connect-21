import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Loader2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface BuscarNaSoftruckBannerProps {
  termo: string;
  onEncontrado?: (rastreadorId: string) => void;
}

type Plataforma = {
  key: 'softruck' | 'rede_veiculos';
  label: string;
  fn: string;
};

const PLATAFORMAS: Plataforma[] = [
  { key: 'softruck', label: 'Softruck', fn: 'softruck-buscar-dispositivo' },
  { key: 'rede_veiculos', label: 'Rede Veículos', fn: 'rede-veiculos-buscar-dispositivo' },
];

/**
 * Aparece quando o filtro local não encontra resultados.
 * Permite fazer um lookup direto na API da Softruck e/ou da Rede Veículos por
 * placa OU IMEI. Quando encontrado, o backend faz upsert local e a listagem
 * é recarregada — o operador não precisa saber em qual plataforma o
 * dispositivo estava cadastrado.
 */
export function BuscarNaSoftruckBanner({ termo, onEncontrado }: BuscarNaSoftruckBannerProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);

  const termoLimpo = termo.trim().toUpperCase();
  const digitos = termoLimpo.replace(/\D/g, '');
  const isCpf = digitos.length === 11 && digitos === termoLimpo.replace(/[.\-\s]/g, '');
  const isCnpj = digitos.length === 14 && /[./-]/.test(termoLimpo);
  const isImei = !isCpf && !isCnpj && /^\d{14,16}$/.test(termoLimpo);
  const tipoBusca = isCpf ? 'CPF' : isCnpj ? 'CNPJ' : isImei ? 'IMEI' : 'placa';

  if (!termoLimpo || termoLimpo.length < 3) return null;

  const handleBuscar = async (plat: Plataforma) => {
    setLoading(plat.key);
    try {
      const { data, error } = await supabase.functions.invoke(plat.fn, {
        body: { busca: termoLimpo },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || `Falha ao consultar ${plat.label}`);
        return;
      }
      if (!data.found) {
        toast.warning(data.message || `Não encontrado na ${plat.label}.`);
        return;
      }
      toast.success(data.message || `Dispositivo encontrado na ${plat.label}.`, {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      await queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      await queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      if (data.rastreador_id) onEncontrado?.(data.rastreador_id);
    } catch (err: any) {
      toast.error(`Erro ${plat.label}: ${err?.message || 'desconhecido'}`);
    } finally {
      setLoading(null);
    }
  };

  const handleBuscarTodas = async () => {
    setLoading('all');
    try {
      const results = await Promise.allSettled(
        PLATAFORMAS.map((p) =>
          supabase.functions.invoke(p.fn, { body: { busca: termoLimpo } }).then((r) => ({ p, r })),
        ),
      );
      let achouEm: string | null = null;
      let rastreadorId: string | null = null;
      const naoAchadas: string[] = [];
      const errosFalhas: string[] = [];

      for (const res of results) {
        if (res.status !== 'fulfilled') {
          errosFalhas.push('exception');
          continue;
        }
        const { p, r } = res.value;
        if (r.error || !r.data?.success) {
          errosFalhas.push(`${p.label}: ${r.error?.message || r.data?.error || 'erro'}`);
          continue;
        }
        if (r.data.found) {
          if (!achouEm) {
            achouEm = p.label;
            rastreadorId = r.data.rastreador_id;
          }
        } else {
          naoAchadas.push(p.label);
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      await queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });

      if (achouEm) {
        toast.success(`Dispositivo importado da ${achouEm}.`, {
          icon: <CheckCircle2 className="h-4 w-4" />,
        });
        if (rastreadorId) onEncontrado?.(rastreadorId);
      } else if (naoAchadas.length === PLATAFORMAS.length) {
        toast.warning(`Não encontrado em nenhuma plataforma (${tipoBusca}: ${termoLimpo}).`);
      } else {
        toast.error(`Falha ao consultar: ${errosFalhas.join(' | ')}`);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
      <Search className="h-4 w-4 text-blue-600" />
      <AlertDescription className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <strong className="font-mono">{termoLimpo}</strong> não está cadastrado localmente.
            Consultar nas integrações por {tipoBusca}?
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="default"
              onClick={handleBuscarTodas}
              disabled={!!loading}
              className="gap-2"
            >
              {loading === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar em todas
            </Button>
            {PLATAFORMAS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant="outline"
                onClick={() => handleBuscar(p)}
                disabled={!!loading}
                className="gap-2"
              >
                {loading === p.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

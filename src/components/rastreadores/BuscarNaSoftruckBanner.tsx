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

/**
 * Aparece quando o filtro local não encontra resultados.
 * Permite fazer um lookup direto na API Softruck por placa OU IMEI.
 * Se encontrado, faz upsert local (via edge function) e atualiza a listagem.
 */
export function BuscarNaSoftruckBanner({ termo, onEncontrado }: BuscarNaSoftruckBannerProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const termoLimpo = termo.trim().toUpperCase();
  const isImei = /^\d{10,}$/.test(termoLimpo);
  const tipoBusca = isImei ? 'IMEI' : 'placa';

  if (!termoLimpo || termoLimpo.length < 3) return null;

  const handleBuscar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('softruck-buscar-dispositivo', {
        body: { busca: termoLimpo },
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.error || 'Falha ao consultar Softruck');
        return;
      }
      if (!data.found) {
        toast.warning(data.message || 'Não encontrado na Softruck.');
        return;
      }
      toast.success(data.message || 'Dispositivo encontrado na Softruck.', {
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      // Recarregar listagem
      await queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      await queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      if (data.rastreador_id) onEncontrado?.(data.rastreador_id);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || 'desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Alert className="border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
      <Search className="h-4 w-4 text-blue-600" />
      <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          Não encontramos <strong className="font-mono">{termoLimpo}</strong> localmente.
          Quer verificar na <strong>Softruck</strong> por {tipoBusca}?
        </div>
        <Button size="sm" variant="outline" onClick={handleBuscar} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          Buscar na Softruck
        </Button>
      </AlertDescription>
    </Alert>
  );
}

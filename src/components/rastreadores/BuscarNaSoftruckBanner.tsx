import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Loader2, ExternalLink, CheckCircle2, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { usePlataformasOptions } from '@/hooks/usePlataformasCRUD';

interface BuscarNaSoftruckBannerProps {
  termo: string;
  onEncontrado?: (rastreadorId: string) => void;
}

/**
 * Aparece quando o filtro local não encontra resultados.
 * Permite fazer um lookup direto na API Softruck por placa OU IMEI.
 * Se encontrado, faz upsert local (via edge function) e atualiza a listagem.
 *
 * Outras plataformas (Rede Veículos, Pratic Master, etc.) ainda não têm
 * endpoint público de busca por IMEI — para elas, o banner orienta o
 * operador a usar a entrada de estoque manual.
 */
export function BuscarNaSoftruckBanner({ termo, onEncontrado }: BuscarNaSoftruckBannerProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const { data: plataformas } = usePlataformasOptions();

  const termoLimpo = termo.trim().toUpperCase();
  const isImei = /^\d{14,16}$/.test(termoLimpo);
  const tipoBusca = isImei ? 'IMEI' : 'placa';

  if (!termoLimpo || termoLimpo.length < 3) return null;

  // Outras plataformas ativas além da Softruck (apenas para informar o operador)
  const outrasPlataformas = (plataformas || []).filter(
    (p) => p.codigo !== 'softruck'
  );

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
      <AlertDescription className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <strong className="font-mono">{termoLimpo}</strong> não está cadastrado no estoque do
            Praticcar. Quer verificar na <strong>Softruck</strong> por {tipoBusca}?
          </div>
          <Button size="sm" variant="outline" onClick={handleBuscar} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Buscar na Softruck
          </Button>
        </div>
        {isImei && outrasPlataformas.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground border-t border-blue-200/50 pt-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Se o IMEI for de outra plataforma (
              {outrasPlataformas.map((p) => p.nome).join(', ')}
              ), use <strong>Estoque → Entrada de Estoque</strong> para cadastrá-lo manualmente.
            </span>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

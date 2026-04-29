import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ShieldOff, AlertTriangle } from 'lucide-react';
import { SuspenderPorNaoInstalacaoDialog } from '@/components/veiculos/SuspenderPorNaoInstalacaoDialog';

interface Props {
  associadoId: string;
  contratoId?: string;
}

const ROLES_PERMITIDOS = ['diretoria', 'analista_monitoramento', 'coordenador_monitoramento'];

/**
 * Fallback manual: quando o cron de suspensão automática por não-instalação não pegou
 * (ou quando o operador quer marcar antes do prazo total), Analista/Coordenador de
 * Monitoramento ou Diretoria pode suspender a cobertura aqui.
 *
 * Aparece apenas quando o estado é elegível: contrato assinado/ativo, prazo vencido,
 * sem instalação concluída/dispensada e cobertura ainda não suspensa.
 */
export function AlertSuspensaoNaoInstalacao({ associadoId, contratoId }: Props) {
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  const podeOperar = ROLES_PERMITIDOS.some((r) => hasRole(r as any));

  const { data: contexto } = useQuery({
    queryKey: ['fallback-suspensao-instalacao', contratoId, associadoId],
    enabled: !!contratoId && podeOperar,
    queryFn: async () => {
      // Carrega prazos
      const { data: cfgs } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'prazo_instalacao_autovistoria_horas',
          'prazo_instalacao_horas_rj',
          'prazo_instalacao_horas_sp',
        ]);
      const cfgMap = Object.fromEntries((cfgs ?? []).map((c) => [c.chave, c.valor]));
      const prazoDefault = parseInt(cfgMap['prazo_instalacao_autovistoria_horas'] ?? '72', 10) || 72;
      const prazoRJ = parseInt(cfgMap['prazo_instalacao_horas_rj'] ?? '48', 10) || 48;
      const prazoSP = parseInt(cfgMap['prazo_instalacao_horas_sp'] ?? '72', 10) || 72;

      const { data: contrato } = await supabase
        .from('contratos')
        .select('id, veiculo_id, status, data_assinatura, liberado_reagendamento_em')
        .eq('id', contratoId!)
        .maybeSingle();
      if (!contrato || !contrato.veiculo_id) return null;
      if (!['assinado', 'ativo'].includes(contrato.status)) return null;
      if (!contrato.data_assinatura) return null;

      const { data: assoc } = await supabase
        .from('associados')
        .select('uf')
        .eq('id', associadoId)
        .maybeSingle();
      const uf = ((assoc as any)?.uf || '').toUpperCase();
      const prazoHoras = uf === 'RJ' ? prazoRJ : uf === 'SP' ? prazoSP : prazoDefault;

      const assinadoEm = new Date(contrato.data_assinatura).getTime();
      const expiraEm = assinadoEm + prazoHoras * 60 * 60 * 1000;
      const horasDesdeExpiracao = (Date.now() - expiraEm) / (1000 * 60 * 60);

      // Estado elegível: prazo vencido OU faltando menos de 12h (permitir antecipação manual já não — só após vencer)
      const prazoVencido = horasDesdeExpiracao >= 0;

      const { data: veiculo } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, cobertura_suspensa')
        .eq('id', contrato.veiculo_id)
        .maybeSingle();
      if (!veiculo || veiculo.cobertura_suspensa) return null;

      // Já existe instalação concluída/dispensada? -> não exibir
      const { data: instalacaoConcluida } = await supabase
        .from('instalacoes')
        .select('id')
        .eq('contrato_id', contrato.id)
        .or('status.eq.concluida,concluida_em.not.is.null,dispensa_rastreador.eq.true')
        .limit(1);
      if ((instalacaoConcluida?.length ?? 0) > 0) return null;

      const { data: servicoConcluido } = await supabase
        .from('servicos')
        .select('id')
        .eq('veiculo_id', contrato.veiculo_id)
        .eq('tipo', 'instalacao')
        .eq('status', 'concluida')
        .limit(1);
      if ((servicoConcluido?.length ?? 0) > 0) return null;

      if (!prazoVencido) return null;

      return {
        contratoId: contrato.id,
        veiculoId: contrato.veiculo_id,
        placa: veiculo.placa as string | null,
        prazoHoras,
        uf: uf || null,
        horasAtraso: Math.floor(horasDesdeExpiracao),
      };
    },
    staleTime: 60_000,
  });

  if (!podeOperar || !contexto) return null;

  return (
    <>
      <Alert className="border-amber-500/40 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-300">
          Prazo de instalação vencido — cobertura ainda não suspensa
        </AlertTitle>
        <AlertDescription className="text-sm space-y-2">
          <p>
            Faz <strong>{contexto.horasAtraso}h</strong> que o prazo de instalação ({contexto.prazoHoras}h
            {contexto.uf ? ` para ${contexto.uf}` : ''}) venceu para o veículo{' '}
            <strong>{contexto.placa ?? contexto.veiculoId.slice(0, 8)}</strong>, mas o cron automático ainda não
            aplicou a suspensão. Você pode marcar manualmente como suspenso por não instalação.
          </p>
          <Button size="sm" variant="destructive" onClick={() => setDialogOpen(true)}>
            <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
            Suspender por não instalação
          </Button>
        </AlertDescription>
      </Alert>

      <SuspenderPorNaoInstalacaoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contratoId={contexto.contratoId}
        placa={contexto.placa}
      />
    </>
  );
}

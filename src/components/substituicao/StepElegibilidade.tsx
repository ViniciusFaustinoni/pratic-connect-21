import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, AlertTriangle, Clock, Loader2, ExternalLink, ShieldAlert, Receipt, Copy, RefreshCw, Link2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useVerificarElegibilidade } from '@/hooks/useSubstituicaoVeiculo';
import { useBoletosSgaPorAssociado } from '@/hooks/useBoletosSgaPorAssociado';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface AssumirDebitoPayload {
  assumiuDebito: boolean;
  justificativa?: string;
}

interface StepElegibilidadeProps {
  associadoId: string;
  onNext: (
    hasEventoProprio: boolean,
    evento?: { id: string; tipo: string },
    debitoCtx?: AssumirDebitoPayload,
  ) => void;
}

export function StepElegibilidade({ associadoId, onNext }: StepElegibilidadeProps) {
  const queryClient = useQueryClient();
  const { data: elegibilidade, isLoading, error } = useVerificarElegibilidade(associadoId);
  const [assumirDebito, setAssumirDebito] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [mostrarCobranca, setMostrarCobranca] = useState(false);

  // Dados do associado p/ consultar SGA (codigo_hinova + cpf)
  const { data: associadoSga } = useQuery({
    queryKey: ['associado-sga-keys', associadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associados')
        .select('codigo_hinova, cpf')
        .eq('id', associadoId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!associadoId,
    staleTime: 60_000,
  });

  const codigoHinova = associadoSga?.codigo_hinova ?? null;
  const cpfAssociado = associadoSga?.cpf ?? null;

  const {
    data: sgaBoletos,
    isFetching: isFetchingBoletos,
    refetch: refetchBoletos,
  } = useBoletosSgaPorAssociado(codigoHinova, cpfAssociado, mostrarCobranca);

  const copiar = async (texto: string, label: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(`${label} copiado`);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const recarregarStatus = async () => {
    await Promise.all([
      refetchBoletos(),
      queryClient.invalidateQueries({ queryKey: ['substituicoes', 'elegibilidade', associadoId] }),
    ]);
    toast.info('Status recarregado');
  };

  const boletosAbertos = (sgaBoletos?.veiculos ?? []).flatMap((v) =>
    (v.boletos_abertos ?? []).map((b) => ({ ...b, placa: v.placa })),
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Verificando elegibilidade...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Erro ao verificar elegibilidade: {(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  if (!elegibilidade) return null;

  const { adimplente, rastreador_devolvido, evento_ativo } = elegibilidade;
  const hasEventoProprio = evento_ativo.tem && evento_ativo.tipo === 'proprio';
  const hasEventoTerceiros = evento_ativo.tem && evento_ativo.tipo === 'terceiros';
  const semEvento = !evento_ativo.tem;

  const justificativaOk = justificativa.trim().length >= 10;
  const debitoLiberado = adimplente || (assumirDebito && justificativaOk);
  const canProceed = debitoLiberado && rastreador_devolvido && (semEvento || hasEventoTerceiros || hasEventoProprio);

  const handleNext = () => {
    const debitoCtx: AssumirDebitoPayload | undefined = !adimplente
      ? { assumiuDebito: assumirDebito, justificativa: justificativa.trim() || undefined }
      : undefined;

    if (hasEventoProprio && evento_ativo.evento_id) {
      onNext(true, { id: evento_ativo.evento_id, tipo: evento_ativo.tipo! }, debitoCtx);
    } else {
      onNext(false, undefined, debitoCtx);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Verificação de Elegibilidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Adimplência */}
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-lg border',
            adimplente ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
          )}>
            {adimplente ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">
                {adimplente ? 'Associado está adimplente' : 'Associado possui cobranças em aberto'}
              </p>
              {!adimplente && (
                <div className="mt-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/financeiro/cobrancas?associado=${associadoId}`}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      Ver financeiro
                    </a>
                  </Button>
                </div>
              )}
            </div>
            <Badge variant={adimplente ? 'default' : 'destructive'} className={cn(adimplente && 'bg-green-600')}>
              {adimplente ? 'OK' : 'Pendente'}
            </Badge>
          </div>

          {/* Assumir responsabilidade pelo débito — destrava sem cancelar a análise */}
          {!adimplente && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    Assumir responsabilidade e seguir com a substituição
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-1">
                    O consultor pode prosseguir mesmo com débitos em aberto. Esta substituição
                    será enviada ao Relacionamento como uma análise pendente para verificar
                    boletos e decidir entre cobrança ou ciência. O fluxo canônico segue
                    normalmente até a ativação.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="assumir-debito"
                  checked={assumirDebito}
                  onCheckedChange={(v) => setAssumirDebito(v === true)}
                />
                <Label htmlFor="assumir-debito" className="text-sm leading-snug cursor-pointer">
                  Estou ciente das cobranças em aberto deste associado e assumo a
                  responsabilidade por prosseguir com esta substituição.
                </Label>
              </div>

              {assumirDebito && (
                <div className="space-y-1.5">
                  <Label htmlFor="just-debito" className="text-xs">
                    Justificativa <span className="text-muted-foreground">(mín. 10 caracteres)</span>
                  </Label>
                  <Textarea
                    id="just-debito"
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Ex.: associado negociou pagamento na renovação, encaminhar p/ análise do Relacionamento…"
                    rows={3}
                  />
                  {!justificativaOk && justificativa.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Justificativa muito curta.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Rastreador */}
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-lg border',
            rastreador_devolvido ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
          )}>
            {rastreador_devolvido ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">
                {rastreador_devolvido
                  ? 'Rastreador do veículo antigo foi devolvido'
                  : 'Rastreador ainda vinculado ao veículo'}
              </p>
              {!rastreador_devolvido && (
                <div className="mt-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="/monitoramento/retiradas">
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      Agendar retirada
                    </a>
                  </Button>
                </div>
              )}
            </div>
            <Badge variant={rastreador_devolvido ? 'default' : 'destructive'} className={cn(rastreador_devolvido && 'bg-green-600')}>
              {rastreador_devolvido ? 'OK' : 'Pendente'}
            </Badge>
          </div>

          {/* Eventos */}
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-lg border',
            semEvento
              ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
              : hasEventoTerceiros
              ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30'
              : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
          )}>
            {semEvento ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : hasEventoTerceiros ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">
                {semEvento
                  ? 'Nenhum evento ativo no veículo'
                  : hasEventoTerceiros
                  ? `Evento de terceiros em andamento (#${evento_ativo.evento_id?.slice(0, 8)}) — pode prosseguir`
                  : `Evento do próprio veículo em andamento (#${evento_ativo.evento_id?.slice(0, 8)}) — requer tratamento`}
              </p>
              {hasEventoProprio && (
                <p className="text-xs text-muted-foreground mt-1">
                  Você precisará escolher como tratar o evento no próximo passo.
                </p>
              )}
            </div>
            <Badge
              variant={semEvento ? 'default' : hasEventoTerceiros ? 'secondary' : 'destructive'}
              className={cn(semEvento && 'bg-green-600', hasEventoTerceiros && 'bg-yellow-600 text-white')}
            >
              {semEvento ? 'OK' : hasEventoTerceiros ? 'Atenção' : 'Bloqueio'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!canProceed}>
          Próximo
        </Button>
      </div>
    </div>
  );
}

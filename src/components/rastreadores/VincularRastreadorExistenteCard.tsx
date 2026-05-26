import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Search, Loader2, Link2, AlertTriangle, CheckCircle2, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBuscarRastreadorPorImei, type OrigemRastreador } from '@/hooks/useBuscarRastreadorPorImei';
import { useAuditLog } from '@/hooks/useAuditLog';

interface Props {
  veiculoId: string;
  associadoId: string;
  associadoEmail?: string | null;
  /** Quando true, mostra alerta amarelo + bloqueia colapso. Quando false, vira seção opcional. */
  exigeRastreador: boolean;
  /** Quando true, esconde tudo (já vinculado) ou some o alerta. */
  jaTemRastreador?: boolean;
  /** Contexto para o log de auditoria. */
  origemContexto: 'troca_titularidade' | 'aprovacao_associados';
  origemRefId?: string | null;
  /** Disparado após vínculo OK — usado para invalidar queries do modal pai. */
  onVinculado?: () => void;
}

const ORIGEM_LABEL: Record<OrigemRastreador, string> = {
  estoque: 'Estoque local',
  softruck: 'Softruck',
  rede_veiculos: 'Rede Veículos',
};

/**
 * Card isolado para vincular um rastreador físico já instalado ao veículo
 * no momento da aprovação do Monitoramento (Troca de Titularidade +
 * Aprovação de Associados). Não bloqueia, não decide pela tela — apenas
 * resolve o vínculo lógico (`rastreadores.veiculo_id`).
 *
 * Ver `mem://logic/operations/vincular-rastreador-existente-monitoramento`.
 */
export function VincularRastreadorExistenteCard({
  veiculoId,
  associadoId,
  associadoEmail,
  exigeRastreador,
  jaTemRastreador,
  origemContexto,
  origemRefId,
  onVinculado,
}: Props) {
  const qc = useQueryClient();
  const { registrarLog } = useAuditLog();
  const { buscar, reset, loading, erro, resultado } = useBuscarRastreadorPorImei();
  const [imei, setImei] = useState('');
  const [aberto, setAberto] = useState(exigeRastreador);
  const [vinculando, setVinculando] = useState(false);

  // Já vinculado: o card desaparece (a tela mostra outro bloco verde do rastreador).
  if (jaTemRastreador) return null;

  const handleBuscar = async () => {
    await buscar(imei, veiculoId);
  };

  const handleVincular = async () => {
    if (!resultado || resultado.conflito) return;
    const r = resultado.rastreador;
    setVinculando(true);
    try {
      // Plataformas com integração: usa edges canônicas para manter sincronização.
      const plat = (r.plataforma || '').toLowerCase();

      if (plat === 'softruck') {
        const { data, error } = await supabase.functions.invoke('softruck-ativar-dispositivo', {
          body: { imei: r.imei, veiculoId, associadoId, associadoEmail: associadoEmail || undefined },
        });
        if (error || !data?.success) {
          throw new Error(data?.error || error?.message || 'Falha ao ativar na Softruck');
        }
      } else if (plat === 'rede_veiculos') {
        const { data, error } = await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
          body: { imei: r.imei, veiculoId, associadoId },
        });
        if (error || !data?.success) {
          let msg: string | undefined;
          try {
            const ctx = (error as any)?.context;
            if (ctx && typeof ctx.json === 'function') {
              const body = await ctx.json();
              msg = body?.error || body?.message;
            }
          } catch { /* ignore */ }
          throw new Error(msg || data?.error || error?.message || 'Falha ao vincular na Rede Veículos');
        }
      } else {
        // Plataforma sem integração ou estoque comum: update local direto.
        const { error } = await supabase
          .from('rastreadores')
          .update({
            veiculo_id: veiculoId,
            associado_id: associadoId,
            associado_email: associadoEmail || null,
            status: 'instalado',
            updated_at: new Date().toISOString(),
          })
          .eq('id', r.id);
        if (error) throw error;
      }

      await registrarLog({
        acao: 'editar',
        modulo: 'monitoramento',
        tabela: 'rastreadores',
        entidade_id: r.id,
        descricao: `[VINCULO_MONITORAMENTO_${origemContexto.toUpperCase()}] IMEI ${r.imei} vinculado ao veículo ${veiculoId}${origemRefId ? ` (ref ${origemRefId})` : ''}`,
      });

      toast.success('Rastreador vinculado ao veículo com sucesso!');
      await qc.invalidateQueries({ queryKey: ['rastreadores'] });
      await qc.invalidateQueries({ queryKey: ['veiculo-completo', veiculoId] });
      await qc.invalidateQueries({ queryKey: ['view_rastreadores_posicao'] });
      reset();
      setImei('');
      onVinculado?.();
    } catch (e: any) {
      console.error('[VincularRastreador] erro', e);
      toast.error(e?.message || 'Falha ao vincular rastreador');
    } finally {
      setVinculando(false);
    }
  };

  return (
    <div className="rounded border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold flex items-center gap-2 text-sm">
          <Cpu className="h-4 w-4" />
          {exigeRastreador ? 'Rastreador exigido para este veículo' : 'Vincular rastreador existente (opcional)'}
        </h4>
        {!exigeRastreador && (
          <Button size="sm" variant="ghost" onClick={() => setAberto((v) => !v)}>
            {aberto ? 'Ocultar' : 'Mostrar'}
          </Button>
        )}
      </div>

      {exigeRastreador && (
        <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">Veículo exige rastreador para ser ativado</AlertTitle>
          <AlertDescription className="text-xs">
            Diesel / Carro FIPE ≥ R$ 30.000 / Moto FIPE ≥ R$ 9.000. Se o rastreador físico já está
            instalado, informe o IMEI abaixo para vincular. Caso contrário, use “Solicitar vistoria”
            ou “Agendar manutenção”.
          </AlertDescription>
        </Alert>
      )}

      {(aberto || exigeRastreador) && (
        <>
          <div className="flex gap-2">
            <Input
              placeholder="IMEI (14–16 dígitos)"
              value={imei}
              onChange={(e) => setImei(e.target.value.replace(/\D/g, ''))}
              maxLength={16}
              className="font-mono"
            />
            <Button onClick={handleBuscar} disabled={!imei || loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1">Buscar</span>
            </Button>
          </div>

          {erro && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{erro}</AlertDescription>
            </Alert>
          )}

          {resultado && (
            <div className="rounded border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-mono font-medium">{resultado.rastreador.imei}</span>
                  <Badge variant="outline" className="text-[10px]">{ORIGEM_LABEL[resultado.origem]}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {resultado.rastreador.codigo && <span>Código: {resultado.rastreador.codigo}</span>}
                  {resultado.rastreador.plataforma && (
                    <Badge variant="secondary" className="text-[10px]">{resultado.rastreador.plataforma}</Badge>
                  )}
                  {resultado.rastreador.status && (
                    <Badge variant="outline" className="text-[10px]">{resultado.rastreador.status}</Badge>
                  )}
                </div>
              </div>

              {resultado.conflito ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm">Rastreador já instalado em outro veículo</AlertTitle>
                  <AlertDescription className="text-xs">
                    Placa <strong>{resultado.conflito.placa || '—'}</strong>
                    {resultado.conflito.associado_nome && <> · Associado <strong>{resultado.conflito.associado_nome}</strong></>}.
                    Faça a retirada/desvínculo do veículo atual antes de reaproveitar este IMEI.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button
                  onClick={handleVincular}
                  disabled={vinculando}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  {vinculando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                  Vincular ao veículo
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

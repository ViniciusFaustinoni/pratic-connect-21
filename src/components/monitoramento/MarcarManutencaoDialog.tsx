import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Wifi, AlertTriangle, CheckCircle2, Wrench, Link2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useRastreadoresEmEstoqueBusca, useUpdateRastreadorStatus } from '@/hooks/useRastreadores';
import { BuscarNaSoftruckBanner } from '@/components/rastreadores/BuscarNaSoftruckBanner';
import { useConverterParaManutencao } from '@/hooks/useConverterParaManutencao';

interface MarcarManutencaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicoId: string;
  veiculoId: string;
  veiculoPlaca?: string;
  onSuccess?: () => void;
}

type EstadoBusca =
  | { kind: 'vazio' }
  | { kind: 'buscando' }
  | { kind: 'estoque_livre'; rastreadorId: string; codigo: string; imei: string | null; plataforma: string }
  | { kind: 'mesmo_veiculo'; rastreadorId: string; codigo: string; imei: string | null; plataforma: string }
  | { kind: 'outro_veiculo'; rastreadorId: string; codigo: string; imei: string | null; placaOutra: string | null; statusOutra: string | null }
  | { kind: 'manutencao_ou_terminal'; rastreadorId: string; codigo: string; imei: string | null; status: string }
  | { kind: 'nao_encontrado' };

/**
 * Diálogo "Tratar como Manutenção" (fallback do Monitoramento).
 * Reaproveita motor de busca da aba Rastreadores: local + tri-fonte
 * (Softruck / Rede Veículos). Vincula imediatamente quando o rastreador
 * está em estoque, ou registra apenas a intenção quando não encontrado.
 */
export function MarcarManutencaoDialog({
  open, onOpenChange, servicoId, veiculoId, veiculoPlaca, onSuccess,
}: MarcarManutencaoDialogProps) {
  const [imei, setImei] = useState('');
  const [debounced, setDebounced] = useState('');
  const [observacao, setObservacao] = useState('');
  const [estado, setEstado] = useState<EstadoBusca>({ kind: 'vazio' });
  const [resolvendo, setResolvendo] = useState(false);

  const { data: locais, isLoading: localBusy } = useRastreadoresEmEstoqueBusca(debounced);
  const updateStatus = useUpdateRastreadorStatus();
  const converter = useConverterParaManutencao();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(imei.trim()), 350);
    return () => clearTimeout(t);
  }, [imei]);

  // Reseta estado quando o dialog fecha
  useEffect(() => {
    if (!open) {
      setImei(''); setDebounced(''); setObservacao(''); setEstado({ kind: 'vazio' });
    }
  }, [open]);

  // Resolve estado a partir do termo: faz lookup em rastreadores (qualquer status)
  // para identificar conflitos antes de mostrar opções.
  useEffect(() => {
    let cancel = false;
    async function resolver() {
      if (!debounced || debounced.length < 4) {
        setEstado({ kind: 'vazio' });
        return;
      }
      setResolvendo(true);
      try {
        const { data: rasts } = await supabase
          .from('rastreadores')
          .select('id, codigo, imei, plataforma, status, veiculo_id, veiculos:veiculo_id(placa, status)')
          .or(`imei.eq.${debounced},codigo.ilike.%${debounced}%,numero_serie.ilike.%${debounced}%`)
          .limit(5);
        if (cancel) return;
        const r = (rasts || [])[0] as any;
        if (!r) {
          setEstado({ kind: 'nao_encontrado' });
          return;
        }
        if (r.status === 'estoque' && !r.veiculo_id) {
          setEstado({ kind: 'estoque_livre', rastreadorId: r.id, codigo: r.codigo, imei: r.imei, plataforma: r.plataforma });
          return;
        }
        if (r.status === 'instalado' && r.veiculo_id === veiculoId) {
          setEstado({ kind: 'mesmo_veiculo', rastreadorId: r.id, codigo: r.codigo, imei: r.imei, plataforma: r.plataforma });
          return;
        }
        if (r.status === 'instalado' && r.veiculo_id && r.veiculo_id !== veiculoId) {
          setEstado({
            kind: 'outro_veiculo',
            rastreadorId: r.id, codigo: r.codigo, imei: r.imei,
            placaOutra: r.veiculos?.placa ?? null,
            statusOutra: r.veiculos?.status ?? null,
          });
          return;
        }
        setEstado({
          kind: 'manutencao_ou_terminal',
          rastreadorId: r.id, codigo: r.codigo, imei: r.imei, status: r.status,
        });
      } finally {
        if (!cancel) setResolvendo(false);
      }
    }
    resolver();
    return () => { cancel = true; };
  }, [debounced, veiculoId, locais]);

  const podeConfirmar = useMemo(() => {
    if (estado.kind === 'vazio' || estado.kind === 'buscando') return false;
    if (estado.kind === 'outro_veiculo') return false;
    if (debounced.length < 4) return false;
    return true;
  }, [estado, debounced]);

  const handleConfirmar = async () => {
    let rastreadorId: string | null = null;
    let imeiFinal = debounced;

    if (estado.kind === 'estoque_livre') {
      // Vincula primeiro (mesma chamada do VincularRastreadorForm), depois converte serviço
      await new Promise<void>((resolve, reject) => {
        updateStatus.mutate(
          { id: estado.rastreadorId, status: 'instalado', veiculo_id: veiculoId },
          { onSuccess: () => resolve(), onError: (e) => reject(e) },
        );
      });
      rastreadorId = estado.rastreadorId;
      imeiFinal = estado.imei ?? debounced;
    } else if (estado.kind === 'mesmo_veiculo') {
      rastreadorId = estado.rastreadorId;
      imeiFinal = estado.imei ?? debounced;
    } else if (estado.kind === 'manutencao_ou_terminal') {
      rastreadorId = estado.rastreadorId;
      imeiFinal = estado.imei ?? debounced;
    }

    converter.mutate(
      { servicoId, imei: imeiFinal, rastreadorId, observacaoOperador: observacao || undefined },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-indigo-500" />
            Tratar como Manutenção
          </DialogTitle>
          <DialogDescription>
            Converte este atendimento em uma <strong>Vistoria de Manutenção</strong> (badge indigo).
            O técnico vai apenas validar/reparar o rastreador existente, sem cadastrar um novo. Usado quando o
            rastreador já está no veículo mas não estava aparecendo no Monitoramento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">IMEI, código ou nº de série</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ex.: 868999050123456"
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                className="pl-9 font-mono"
                inputMode="numeric"
                maxLength={32}
              />
            </div>
            {(localBusy || resolvendo) && debounced.length >= 4 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Consultando estoque local…
              </div>
            )}
          </div>

          {/* Resultado da resolução */}
          {estado.kind === 'estoque_livre' && (
            <Alert className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription className="space-y-1">
                <p className="text-sm">
                  Encontrado em estoque local — <strong className="font-mono">{estado.codigo}</strong>{' '}
                  <Badge variant="outline" className="text-[10px]">{estado.plataforma}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  Ao confirmar, será vinculado ao veículo <strong className="font-mono">{veiculoPlaca || veiculoId.slice(0, 8)}</strong> e a manutenção será agendada.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {estado.kind === 'mesmo_veiculo' && (
            <Alert className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <Link2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription>
                <p className="text-sm">
                  Já vinculado a este veículo — <strong className="font-mono">{estado.codigo}</strong>{' '}
                  <Badge variant="outline" className="text-[10px]">{estado.plataforma}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">Apenas registraremos a manutenção agendada (sem novo vínculo).</p>
              </AlertDescription>
            </Alert>
          )}

          {estado.kind === 'outro_veiculo' && (
            <Alert className="border-destructive/40 bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription>
                <p className="text-sm">
                  Este IMEI está instalado em <strong className="font-mono">{estado.placaOutra ?? 'outro veículo'}</strong>
                  {estado.statusOutra ? ` (${estado.statusOutra})` : ''}.
                </p>
                <p className="text-xs">
                  Resolva o vínculo na aba Rastreadores antes de marcar manutenção aqui.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {estado.kind === 'manutencao_ou_terminal' && (
            <Alert>
              <Wifi className="h-4 w-4" />
              <AlertDescription>
                <p className="text-sm">
                  Encontrado — <strong className="font-mono">{estado.codigo}</strong> · status atual: <strong>{estado.status}</strong>.
                </p>
                <p className="text-xs text-muted-foreground">
                  Vamos registrar a intenção de manutenção; o técnico revalida em campo.
                </p>
              </AlertDescription>
            </Alert>
          )}

          {estado.kind === 'nao_encontrado' && (
            <div className="space-y-2">
              <Alert className="border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  IMEI não encontrado localmente. Você pode consultar nas plataformas — quando importado,
                  o resultado vira estoque local e pode ser vinculado.
                </AlertDescription>
              </Alert>
              <BuscarNaSoftruckBanner termo={debounced} />
              <p className="text-xs text-muted-foreground">
                Se nada for encontrado, ainda assim podemos seguir: o técnico cadastra o rastreador em campo e a
                manutenção fica com o IMEI esperado já gravado.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Observação (opcional)</label>
            <Textarea
              placeholder="Ex.: rastreador já estava no carro, só não estava aparecendo."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="min-h-[64px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={converter.isPending || updateStatus.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={!podeConfirmar || converter.isPending || updateStatus.isPending}
            className="bg-indigo-600 hover:bg-indigo-600/90 text-white"
          >
            {(converter.isPending || updateStatus.isPending) ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Wrench className="h-4 w-4 mr-2" />
            )}
            Confirmar manutenção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

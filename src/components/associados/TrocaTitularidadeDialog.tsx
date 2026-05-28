import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TelefoneInput } from '@/components/inputs/MaskedInputs';
import { Loader2, Users, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCriarSolicitacaoTroca } from '@/hooks/useSolicitacoesTroca';
import { useBoletosSgaPorAssociado } from '@/hooks/useBoletosSgaPorAssociado';
import { useTrocaTitularidadeFallbackLocal } from '@/hooks/useTrocaTitularidadeFallbackLocal';
import { useQuery } from '@tanstack/react-query';
import { SgaTransientAlert } from '@/components/cotacao/SgaTransientAlert';

interface TrocaTitularidadeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associadoId: string;
  associadoNome: string;
  associadoCpf?: string | null;
  /** codigo_hinova do mirror local — quando disponível, evita round-trip extra */
  codigoHinova?: number | null;
}

interface VeiculoOpcao {
  id: string;
  descricao: string;
  placa: string;
}

export function TrocaTitularidadeDialog({
  open, onOpenChange, associadoId, associadoNome, associadoCpf, codigoHinova,
}: TrocaTitularidadeDialogProps) {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  // CPF do novo titular é capturado depois via OCR da CNH no link público
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [syncErro, setSyncErro] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressDone, setProgressDone] = useState(false);
  const criar = useCriarSolicitacaoTroca();

  // Animação de progresso enquanto a criação está em andamento.
  // Sobe suavemente até ~90% e trava ali até a resposta chegar; depois vai a 100%.
  useEffect(() => {
    if (!criar.isPending) return;
    setProgress((p) => (p < 5 ? 5 : p));
    const id = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return Math.min(90, prev + Math.max(1, (90 - prev) * 0.08));
      });
    }, 200);
    return () => window.clearInterval(id);
  }, [criar.isPending]);

  const progressLabel =
    progressDone ? 'Solicitação criada com sucesso!'
    : progress < 30 ? 'Validando dados…'
    : progress < 60 ? 'Sincronizando com o SGA…'
    : progress < 90 ? 'Gerando cotação do novo titular…'
    : 'Finalizando…';

  // 1) Busca o registro local para obter codigo_hinova + cpf canônicos
  const { data: assocLocal, refetch: refetchLocal } = useQuery({
    queryKey: ['troca-tit-associado-local', associadoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('associados')
        .select('id, cpf, codigo_hinova')
        .eq('id', associadoId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!associadoId,
  });

  const codigoHinovaFinal = codigoHinova ?? (assocLocal as any)?.codigo_hinova ?? null;
  const cpfAntigo = (associadoCpf || (assocLocal as any)?.cpf || '').replace(/\D/g, '');

  // 2) Lista veículos + boletos via codigo_hinova (com cpf como apoio para enumerar veículos)
  const sga = useBoletosSgaPorAssociado(
    codigoHinovaFinal,
    cpfAntigo,
    open && !!codigoHinovaFinal,
  );

  const sgaPayload = sga.data;
  const sgaTransitorio = !!sgaPayload?.erro_transitorio;
  const sgaMotivo = sgaPayload?.motivo ?? null;

  // 3) Mapeia placas SGA → UUID local (necessário para o backend de criação)
  const normPlaca = (p?: string | null) => (p || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const placas = (sgaPayload?.veiculos || []).map((v) => normPlaca(v.placa)).filter(Boolean);

  // Fallback local serve TAMBÉM como fonte canônica de placa→UUID, pois
  // roda via edge function `troca-titularidade-detalhe-associado` (service role)
  // e enxerga o veículo mesmo quando RLS o esconde do vendedor.
  const fallback = useTrocaTitularidadeFallbackLocal(associadoId, open);
  const fallbackPayload = fallback.data?.payload;
  const placaParaIdSvc = fallback.data?.placaParaId;
  const refetchLocais = fallback.refetch;

  const veiculosSgaMapeados: VeiculoOpcao[] = [];
  for (const v of (sgaPayload?.veiculos || [])) {
    const placaNorm = normPlaca(v.placa);
    const id = placaParaIdSvc?.get(placaNorm);
    if (!id) continue;
    veiculosSgaMapeados.push({
      id,
      placa: v.placa,
      descricao: `${v.marca || ''} ${v.modelo || ''} ${v.ano || ''} - ${v.placa}`.trim(),
    });
  }

  // Lista de fallback derivada do mesmo payload local (edge function bypassa RLS)
  const veiculosFallback: VeiculoOpcao[] = (fallbackPayload?.veiculos || [])
    .map((v) => {
      const id = placaParaIdSvc?.get(normPlaca(v.placa));
      if (!id) return null;
      return {
        id,
        placa: v.placa,
        descricao: `${v.marca || ''} ${v.modelo || ''} ${v.ano || ''} - ${v.placa}`.trim(),
      };
    })
    .filter((x): x is VeiculoOpcao => !!x);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setVeiculoId(null);
      setNome(''); setEmail(''); setTelefone('');
      setSyncErro(null);
      setSincronizando(false);
      setProgress(0);
      setProgressDone(false);
    }
  }, [open]);

  const carregando = sga.isLoading || sga.isFetching;
  const semCodigoHinova = !!assocLocal && !codigoHinovaFinal;
  const sgaTransitorioVisivel = !sga.isLoading && sgaTransitorio;
  const semVeiculosSGA =
    !sga.isLoading && !sgaTransitorio && !semCodigoHinova &&
    !!sgaPayload && (!sgaPayload.encontrado || (sgaPayload?.veiculos || []).length === 0);
  const semEspelhoLocal =
    !carregando && !sgaTransitorio &&
    (sgaPayload?.veiculos || []).length > 0 && veiculosSgaMapeados.length === 0;

  // Decide se devemos cair no fallback local (mostra dados nossos quando SGA falha)
  const sgaIndisponivel =
    sgaTransitorioVisivel || semCodigoHinova || semVeiculosSGA || semEspelhoLocal;
  const usandoFallback = sgaIndisponivel && veiculosFallback.length > 0;

  // Fonte final dos veículos exibidos no select
  const veiculos: VeiculoOpcao[] = usandoFallback ? veiculosFallback : veiculosSgaMapeados;

  // (Removido) Consulta de situação financeira por veículo e listagem de boletos.
  // O fluxo de troca não exige mais que o antigo titular esteja adimplente — basta
  // que o associado exista (espelho local + SGA) para listar os veículos.


  // Auto-seleciona se só houver 1
  useEffect(() => {
    if (open && veiculos.length === 1 && !veiculoId) {
      setVeiculoId(veiculos[0].id);
    }
  }, [open, veiculos, veiculoId]);

  const handleRetrySga = async () => {
    setSyncErro(null);
    await sga.refetch();
    await refetchLocais();
  };

  const handleSincronizarHinova = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!cpfAntigo || cpfAntigo.length !== 11) {
      if (!silent) toast.error('CPF do associado indisponível para sincronizar com o SGA');
      return;
    }
    try {
      setSincronizando(true);
      setSyncErro(null);
      const { data, error } = await supabase.functions.invoke('importar-associado-sga', {
        body: { cpf: cpfAntigo },
      });
      if (error) {
        let msgAmigavel: string | undefined;
        try {
          const anyErr = error as any;
          if (anyErr?.context && typeof anyErr.context.json === 'function') {
            const body = await anyErr.context.json();
            msgAmigavel = body?.error;
          }
        } catch { /* ignore */ }
        throw new Error(msgAmigavel || error.message);
      }
      const msgAmigavel = (data as any)?.error;
      if (msgAmigavel) throw new Error(msgAmigavel);
      await refetchLocal();
      await sga.refetch();
      await refetchLocais();
      if (!silent) toast.success('Associado sincronizado com o SGA');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao sincronizar com o SGA';
      setSyncErro(msg);
      // Em modo silencioso (auto-sync), não mostra toast — vamos cair no fallback local
      if (!silent) toast.error(msg);
    } finally {
      setSincronizando(false);
    }
  };

  // Auto-sincronização com SGA ao abrir o modal (sem botão manual, silenciosa)
  const autoSyncRanRef = useRef(false);
  useEffect(() => {
    if (!open) { autoSyncRanRef.current = false; return; }
    if (autoSyncRanRef.current) return;
    if (sincronizando || sga.isLoading) return;
    if (!cpfAntigo || cpfAntigo.length !== 11) return;
    if (semCodigoHinova || semEspelhoLocal) {
      autoSyncRanRef.current = true;
      handleSincronizarHinova({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cpfAntigo, semCodigoHinova, semEspelhoLocal, sga.isLoading, sincronizando]);

  const handleSubmit = async () => {
    if (!nome.trim() || !veiculoId) {
      toast.error('Preencha o nome do novo titular e selecione o veículo');
      return;
    }
    try {
      const fresh = await refetchLocais();
      const veiculoSelecionado = veiculos.find(v => v.id === veiculoId);
      const freshVeiculos = (fresh.data as any)?.payload?.veiculos as Array<{ placa: string }> | undefined;
      const placaFallback = veiculoSelecionado?.placa
        || freshVeiculos?.find((v) => placaParaIdSvc?.get(normPlaca(v.placa)) === veiculoId)?.placa
        || null;
      const result = await criar.mutateAsync({
        associado_antigo_id: associadoId,
        veiculo_id: veiculoId,
        veiculo_placa: placaFallback || undefined,
        novo_titular: { nome: nome.trim(), email: email.trim() || undefined, telefone: telefone.trim() || undefined },
      });
      const termoFlag = (result as any)?.termo_enviado_automaticamente;
      if (termoFlag === false) {
        toast.warning('Solicitação criada, mas o envio automático do termo de cancelamento falhou. Reenvie pelo modal de detalhes da solicitação.');
      } else if (termoFlag === 'agendado') {
        toast.success('Solicitação criada. O termo de cancelamento será enviado em instantes.');
      } else {
        toast.success('Solicitação criada! Termo de cancelamento enviado ao titular antigo.');
      }
      // Trava a barra em 100% e segura ~600ms para o operador enxergar a conclusão
      setProgress(100);
      setProgressDone(true);
      await new Promise((r) => setTimeout(r, 600));
      onOpenChange(false);
      if (result?.cotacao_id) {
        navigate(`/vendas/cotacoes/${result.cotacao_id}`);
      }
    } catch (e) {
      setProgress(0);
      setProgressDone(false);
      toast.error(e instanceof Error ? e.message : 'Erro ao criar solicitação');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Troca de Titularidade
          </DialogTitle>
          <DialogDescription>
            Transferir o veículo de <strong>{associadoNome}</strong> para um novo titular.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Veículos buscados no SGA usando o código Hinova do associado local. Será criada uma cotação para o novo titular — após preenchida, gere o link público; a solicitação passará por aprovação do Cadastro e do Monitoramento antes da assinatura.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Veículo a transferir *</Label>
            {(() => {
              // Se já temos veículos para escolher (de qualquer fonte: SGA mapeado ou fallback local),
              // renderiza UM ÚNICO select. Caso contrário, mostra o estado correspondente.
              if (veiculos.length > 0) {
                return (
                  <select
                    className="w-full border rounded h-10 px-3 bg-background"
                    value={veiculoId || ''}
                    onChange={(e) => setVeiculoId(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {veiculos.map(v => (
                      <option key={v.id} value={v.id}>{v.descricao}</option>
                    ))}
                  </select>
                );
              }
              if (semCodigoHinova) {
                return syncErro ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm space-y-2">
                      <div>Falha ao sincronizar com o SGA: {syncErro}</div>
                      <Button size="sm" variant="outline" onClick={() => handleSincronizarHinova()}>
                        Tentar novamente
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sincronizando associado com o SGA…
                  </div>
                );
              }
              if (carregando || fallback.isLoading) {
                return (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando veículos…
                  </div>
                );
              }
              if (sgaTransitorioVisivel) {
                return (
                  <SgaTransientAlert
                    motivo={sgaMotivo}
                    onRetry={handleRetrySga}
                    loading={sga.isFetching}
                    titulo="Não foi possível consultar o SGA agora"
                    descricao="A API do Hinova respondeu com erro temporário. Tente novamente em instantes."
                  />
                );
              }
              return (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Nenhum veículo encontrado para este associado.
                  </AlertDescription>
                </Alert>
              );
            })()}
          </div>

          {/* (Removido) Badge de situação financeira e listagem de boletos do veículo selecionado.
              A troca de titularidade não exige mais que o antigo titular esteja adimplente. */}

          <div className="space-y-2">
            <Label htmlFor="novo-titular-nome">Nome completo do novo titular *</Label>
            <Input id="novo-titular-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
          </div>


          <div className="space-y-2">
            <Label htmlFor="novo-titular-email">Email (opcional)</Label>
            <Input id="novo-titular-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="novo-titular-telefone">Telefone / WhatsApp</Label>
            <TelefoneInput value={telefone} onChange={setTelefone} id="novo-titular-telefone" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={criar.isPending}>Cancelar</Button>
          {(() => {
            const motivoDisable = criar.isPending
              ? 'Enviando…'
              : !nome.trim()
              ? 'Informe o nome do novo titular'
              : !veiculoId
              ? 'Selecione o veículo a transferir'
              : null;
            const btn = (
              <Button onClick={handleSubmit} disabled={!!motivoDisable}>
                {criar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
                Criar Solicitação
              </Button>
            );
            return motivoDisable ? (
              <span title={motivoDisable}>{btn}</span>
            ) : btn;
          })()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

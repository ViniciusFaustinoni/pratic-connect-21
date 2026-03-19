import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Camera, CheckCircle2, Clock, FileText, Loader2, AlertTriangle,
  ExternalLink, ArrowLeft, ArrowRight, ShieldCheck, Smartphone, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EscolhaLocalVistoria } from '@/components/cotacao-publica/EscolhaLocalVistoria';
import { AgendamentoBase } from '@/components/cotacao-publica/AgendamentoBase';
import { AgendamentoCotacao } from '@/components/cotacao-publica/AgendamentoCotacao';
import { motion, AnimatePresence } from 'framer-motion';

interface StepVistoriaProps {
  associadoId: string;
  veiculoNovoId: string | null;
  substituicaoId: string | null;
  dadosNovoVeiculo: { placa?: string; modelo?: string; ano_modelo?: number };
  onNext: () => void;
  onBack: () => void;
  onIniciarSubstituicao: () => Promise<string>;
}

type VistoriaStatus = 'pendente' | 'agendada' | 'em_analise' | 'aprovada' | 'reprovada';
type ModoVistoria = 'escolha' | 'autovistoria' | 'escolha-local' | 'agendada-cliente' | 'agendada-base';

export function StepVistoria({
  associadoId,
  veiculoNovoId,
  substituicaoId,
  dadosNovoVeiculo,
  onNext,
  onBack,
  onIniciarSubstituicao,
}: StepVistoriaProps) {
  const queryClient = useQueryClient();
  const [dispensaConfirmada, setDispensaConfirmada] = useState(false);
  const [dispensaSolicitada, setDispensaSolicitada] = useState(false);
  const [modo, setModo] = useState<ModoVistoria>('escolha');

  // Fetch dispensa config
  const { data: dispensaConfig } = useQuery({
    queryKey: ['config-dispensa-vistoria-substituicao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', [
          'substituicao_dispensa_vistoria_0km_ativa',
          'substituicao_dispensa_vistoria_0km_prazo_nf_dias',
          'substituicao_dispensa_vistoria_0km_prazo_crv_dias',
        ]);
      if (error) throw error;

      const map: Record<string, string> = {};
      data?.forEach((c) => { map[c.chave] = c.valor; });
      return {
        dispensaAtiva: map['substituicao_dispensa_vistoria_0km_ativa'] === 'true',
        prazoNfDias: parseInt(map['substituicao_dispensa_vistoria_0km_prazo_nf_dias'] || '15', 10),
        prazoCrvDias: parseInt(map['substituicao_dispensa_vistoria_0km_prazo_crv_dias'] || '30', 10),
      };
    },
  });

  // Check if vistoria already exists
  const { data: vistoriaExistente, isLoading: loadingVistoria } = useQuery({
    queryKey: ['vistoria-substituicao', veiculoNovoId],
    queryFn: async () => {
      if (!veiculoNovoId) return null;
      const { data, error } = await supabase
        .from('vistorias')
        .select('id, status, modalidade, created_at')
        .eq('veiculo_id', veiculoNovoId)
        .eq('tipo', 'entrada')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!veiculoNovoId,
    refetchInterval: (query) => {
      const status = query.state.data?.status as VistoriaStatus | undefined;
      if (!status || status === 'aprovada' || status === 'reprovada') return false;
      return 10_000;
    },
  });

  // Create vistoria (autovistoria)
  const criarVistoriaAutovistoria = useMutation({
    mutationFn: async () => {
      const subId = substituicaoId || await onIniciarSubstituicao();
      if (!veiculoNovoId) throw new Error('Veículo novo não encontrado');

      const { data, error } = await supabase
        .from('vistorias')
        .insert({
          veiculo_id: veiculoNovoId,
          associado_id: associadoId,
          tipo: 'entrada',
          modalidade: 'autovistoria',
          status: 'pendente' as const,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-substituicao', veiculoNovoId] });
      toast.success('Link de autovistoria criado! Aguardando envio das fotos pelo associado.');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar vistoria: ${err.message}`);
    },
  });

  // Create vistoria (presencial) — used after scheduling
  const criarVistoriaPresencial = useMutation({
    mutationFn: async () => {
      const subId = substituicaoId || await onIniciarSubstituicao();
      if (!veiculoNovoId) throw new Error('Veículo novo não encontrado');

      const { data, error } = await supabase
        .from('vistorias')
        .insert({
          veiculo_id: veiculoNovoId,
          associado_id: associadoId,
          tipo: 'entrada',
          modalidade: 'presencial',
          status: 'agendada' as const,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-substituicao', veiculoNovoId] });
      toast.success('Vistoria presencial agendada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error(`Erro ao criar vistoria: ${err.message}`);
    },
  });

  // Handle dispensa
  const handleDispensa = async () => {
    setDispensaSolicitada(true);
    toast.success('Vistoria dispensada — veículo 0km com documentação válida.');
  };

  // Handle agendamento confirmado (base ou cliente)
  const handleAgendamentoConfirmado = async () => {
    await criarVistoriaPresencial.mutateAsync();
  };

  const vistoriaStatus = vistoriaExistente?.status as VistoriaStatus | undefined;
  const vistoriaModalidade = vistoriaExistente?.modalidade as string | undefined;
  const vistoriaAprovada = vistoriaStatus === 'aprovada';
  const vistoriaReprovada = vistoriaStatus === 'reprovada';
  const vistoriaEmAndamento = vistoriaStatus === 'pendente' || vistoriaStatus === 'agendada' || vistoriaStatus === 'em_analise';

  const podeAvancar = vistoriaAprovada || dispensaSolicitada;

  const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    pendente: { label: 'Pendente', color: 'bg-amber-500/15 text-amber-500 border-amber-500/30', icon: Clock },
    agendada: { label: 'Agendada', color: 'bg-blue-500/15 text-blue-500 border-blue-500/30', icon: Clock },
    em_analise: { label: 'Em análise', color: 'bg-purple-500/15 text-purple-500 border-purple-500/30', icon: Camera },
    aprovada: { label: 'Aprovada', color: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', icon: CheckCircle2 },
    reprovada: { label: 'Reprovada', color: 'bg-destructive/15 text-destructive border-destructive/30', icon: AlertTriangle },
  };

  const getModalidadeLabel = (modalidade?: string) => {
    if (modalidade === 'autovistoria') return 'Autovistoria — 15 fotos';
    if (modalidade === 'presencial') return 'Presencial — 31 fotos';
    return 'Vistoria';
  };

  if (loadingVistoria) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Vistoria do Novo Veículo
          </CardTitle>
          <CardDescription>
            A vistoria de entrada é obrigatória. Escolha entre autovistoria (fotos pelo celular) ou vistoria presencial com agendamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status da vistoria existente */}
          {vistoriaExistente && vistoriaStatus && (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              {(() => {
                const cfg = statusConfig[vistoriaStatus];
                const Icon = cfg?.icon || Clock;
                return (
                  <>
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{getModalidadeLabel(vistoriaModalidade)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(vistoriaExistente.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="outline" className={cfg?.color}>
                      {cfg?.label}
                    </Badge>
                  </>
                );
              })()}
            </div>
          )}

          {/* Polling indicator */}
          {vistoriaEmAndamento && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Aguardando conclusão</AlertTitle>
              <AlertDescription>
                O status da vistoria é verificado automaticamente a cada 10 segundos.
              </AlertDescription>
            </Alert>
          )}

          {/* Reprovada */}
          {vistoriaReprovada && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Vistoria reprovada</AlertTitle>
              <AlertDescription>
                A vistoria do veículo foi reprovada. Solicite uma nova vistoria após corrigir os itens apontados.
              </AlertDescription>
            </Alert>
          )}

          {/* Aprovada */}
          {vistoriaAprovada && (
            <Alert className="border-emerald-500/50 bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <AlertTitle className="text-emerald-600">Vistoria aprovada</AlertTitle>
              <AlertDescription className="text-emerald-600/80">
                A vistoria de entrada foi aprovada. Você pode avançar para a próxima etapa.
              </AlertDescription>
            </Alert>
          )}

          {/* Dispensada */}
          {dispensaSolicitada && (
            <Alert className="border-emerald-500/50 bg-emerald-500/10">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <AlertTitle className="text-emerald-600">Vistoria dispensada</AlertTitle>
              <AlertDescription className="text-emerald-600/80">
                Veículo 0km com documentação válida — vistoria dispensada conforme regra operacional.
              </AlertDescription>
            </Alert>
          )}

          {/* Fluxo de escolha — somente quando não existe vistoria e não dispensada */}
          {!vistoriaExistente && !dispensaSolicitada && (
            <AnimatePresence mode="wait">
              {modo === 'escolha' && (
                <motion.div
                  key="escolha"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  {/* Opção Autovistoria */}
                  <button
                    onClick={() => {
                      criarVistoriaAutovistoria.mutate();
                    }}
                    disabled={criarVistoriaAutovistoria.isPending || !veiculoNovoId}
                    className="w-full p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left disabled:opacity-50"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        {criarVistoriaAutovistoria.isPending ? (
                          <Loader2 className="h-6 w-6 text-primary animate-spin" />
                        ) : (
                          <Camera className="h-6 w-6 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">Autovistoria</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                            Recomendado
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Envie o link para o associado tirar as fotos pelo celular
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Smartphone className="h-3 w-3" />
                            Pelo celular
                          </span>
                          <span className="flex items-center gap-1">
                            <Camera className="h-3 w-3" />
                            15 fotos
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Opção Presencial */}
                  <button
                    onClick={() => setModo('escolha-local')}
                    className="w-full p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                        <Calendar className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground mb-1">Agendar Vistoria Presencial</h3>
                        <p className="text-sm text-muted-foreground">
                          Agende uma data e horário para realizar a vistoria
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Horários flexíveis
                          </span>
                          <span className="flex items-center gap-1">
                            <Camera className="h-3 w-3" />
                            31 fotos
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              )}

              {/* Escolha do local (base vs cliente) */}
              {modo === 'escolha-local' && (
                <motion.div
                  key="escolha-local"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                >
                  <div className="mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModo('escolha')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  </div>
                  <EscolhaLocalVistoria
                    onEscolher={(local) => {
                      if (local === 'cliente') {
                        setModo('agendada-cliente');
                      } else {
                        setModo('agendada-base');
                      }
                    }}
                  />
                </motion.div>
              )}

              {/* Agendamento na base */}
              {modo === 'agendada-base' && (
                <motion.div
                  key="agendada-base"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                >
                  <AgendamentoBase
                    cotacaoId={substituicaoId || ''}
                    clienteNome={dadosNovoVeiculo.modelo || ''}
                    veiculoPlaca={dadosNovoVeiculo.placa}
                    veiculoDescricao={dadosNovoVeiculo.modelo ? `${dadosNovoVeiculo.modelo} ${dadosNovoVeiculo.ano_modelo || ''}` : undefined}
                    onAgendado={handleAgendamentoConfirmado}
                    onVoltar={() => setModo('escolha-local')}
                  />
                </motion.div>
              )}

              {/* Agendamento no cliente */}
              {modo === 'agendada-cliente' && (
                <motion.div
                  key="agendada-cliente"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                >
                  <div className="mb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setModo('escolha-local')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                  </div>
                  <AgendamentoCotacao
                    cotacaoId={substituicaoId || ''}
                    onConfirmar={handleAgendamentoConfirmado}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* Reprovada - retry */}
          {vistoriaReprovada && (
            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={() => criarVistoriaAutovistoria.mutate()}
                disabled={criarVistoriaAutovistoria.isPending || !veiculoNovoId}
              >
                {criarVistoriaAutovistoria.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 mr-2" />
                )}
                Nova autovistoria
              </Button>
              <Button
                variant="outline"
                onClick={() => setModo('escolha-local')}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Agendar presencial
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dispensa 0km */}
      {dispensaConfig?.dispensaAtiva && !vistoriaAprovada && !dispensaSolicitada && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Dispensa de vistoria — Veículo 0km
            </CardTitle>
            <CardDescription>
              Veículos zero quilômetro com nota fiscal e CRV dentro do prazo podem ter a vistoria dispensada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Checkbox
                id="confirmar-dispensa"
                checked={dispensaConfirmada}
                onCheckedChange={(checked) => setDispensaConfirmada(checked === true)}
              />
              <Label htmlFor="confirmar-dispensa" className="text-sm cursor-pointer leading-relaxed">
                Confirmo que o veículo é 0km, possuo a nota fiscal emitida há no máximo{' '}
                <strong>{dispensaConfig.prazoNfDias} dias</strong> e o CRV emitido há no máximo{' '}
                <strong>{dispensaConfig.prazoCrvDias} dias</strong>.
              </Label>
            </div>

            <Button
              variant="secondary"
              onClick={handleDispensa}
              disabled={!dispensaConfirmada}
              className="gap-1.5"
            >
              <ShieldCheck className="h-4 w-4" />
              Dispensar vistoria
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          onClick={onNext}
          disabled={!podeAvancar}
          className="gap-1.5"
        >
          Próximo
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

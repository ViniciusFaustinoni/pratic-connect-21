import { useState, useMemo, useCallback } from 'react';
import { getFotosVistoriaSubFipe } from '@/data/vistoriaSubFipeAdapter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Camera,
  Calendar,
  Home,
  Building2,
  MapPin,
  Clock,
  Smartphone,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Info,
} from 'lucide-react';
import { AutovistoriaCotacao } from './AutovistoriaCotacao';
import { AgendamentoCotacao } from './AgendamentoCotacao';
import { EscolhaBase } from './EscolhaBase';
import { AgendamentoBase } from './AgendamentoBase';
import { useConfiguracaoBase } from '@/hooks/useAgendamentoBase';
import type { TipoVeiculo } from '@/data/autovistoriaConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { publicSupabase } from '@/integrations/supabase/publicClient';

interface EtapaVistoriaProps {
  cotacaoId: string;
  tipoVeiculo: TipoVeiculo;
  tipoInstalacao?: 'rota' | 'base' | null;
  clienteNome?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  veiculoPlaca?: string;
  veiculoDescricao?: string;
  enderecoInicial?: {
    cep?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  };
  onComplete: () => void;
  onAgendar?: (data: string, horario: string) => void;
  readOnly?: boolean;
  tipoVistoriaRealizada?: 'autovistoria' | 'agendada' | 'agendada_base';
  /**
   * Veículo sub-FIPE (carro <30k / moto <9k não-Diesel) — dispensa rastreador.
   * Quando true, renderiza o chooser de 3 vias canônico do sub-FIPE
   * (Completa pelo celular | R&F pelo celular + presencial | Sem fotos + presencial).
   */
  subFipe?: boolean;
  /**
   * created_at da cotação. Usado pelo flag de roteiro v2 do checklist sub-FIPE.
   * Sem este valor, o helper assume "novo" e cai em v2 — pode quebrar cotações antigas.
   */
  criadoEm?: string;
}

type ModoVistoria =
  | 'escolha'
  | 'autovistoria'
  | 'agendada'
  | 'escolha-base'
  | 'agendada-base'
  | 'sub_fipe_presencial_chooser';

type ViaSubFipe = 'completa_celular' | 'rf_celular' | 'sem_fotos';

export function EtapaVistoria({
  cotacaoId,
  tipoVeiculo,
  tipoInstalacao,
  clienteNome = '',
  clienteTelefone,
  clienteEmail,
  veiculoPlaca,
  veiculoDescricao,
  enderecoInicial,
  onComplete,
  onAgendar,
  readOnly = false,
  tipoVistoriaRealizada,
  subFipe = false,
  criadoEm,
}: EtapaVistoriaProps) {
  const [modo, setModo] = useState<ModoVistoria>('escolha');
  const [oficinaIdSelecionada, setOficinaIdSelecionada] = useState<string>('');
  const [viaSubFipe, setViaSubFipe] = useState<ViaSubFipe | null>(null);
  const { data: configBase } = useConfiguracaoBase();

  const fotosSubFipeCompleta = useMemo(
    () => getFotosVistoriaSubFipe(tipoVeiculo, criadoEm),
    [tipoVeiculo, criadoEm],
  );

  const enderecoBase = configBase?.base_logradouro
    ? `${configBase.base_logradouro}${configBase.base_numero ? `, ${configBase.base_numero}` : ''} - ${configBase.base_bairro || ''} - ${configBase.base_cidade || ''}/${configBase.base_uf || ''}`
    : null;
  const horarioBase = configBase?.base_horario_inicio && configBase?.base_horario_fim
    ? `${configBase.base_horario_inicio} às ${configBase.base_horario_fim}`
    : null;

  /**
   * Persiste a via escolhida em `cotacoes.dados_extras.via_vistoria_sub_fipe`.
   * Fonte única para o backend (aprovar-proposta) saber qual proteção liberar
   * e se há presencial pendente. Fire-and-forget — falha não bloqueia UI.
   */
  const persistirViaSubFipe = useCallback(async (via: ViaSubFipe) => {
    try {
      const { data: cot } = await publicSupabase
        .from('cotacoes')
        .select('dados_extras')
        .eq('id', cotacaoId)
        .maybeSingle();
      const dadosExtras = { ...(cot?.dados_extras as any || {}), via_vistoria_sub_fipe: via };
      await publicSupabase
        .from('cotacoes')
        .update({ dados_extras: dadosExtras } as any)
        .eq('id', cotacaoId);
    } catch (err) {
      console.error('[EtapaVistoria] falha persistindo via_vistoria_sub_fipe', err);
    }
  }, [cotacaoId]);

  const escolherVia = useCallback((via: ViaSubFipe) => {
    setViaSubFipe(via);
    void persistirViaSubFipe(via);
    if (via === 'completa_celular' || via === 'rf_celular') {
      setModo('autovistoria');
    } else {
      setModo('sub_fipe_presencial_chooser');
    }
  }, [persistirViaSubFipe]);

  const handleAutovistoriaConcluida = () => {
    // Via 2 (R&F) precisa seguir para presencial; Via 1 (Completa) encerra aqui.
    if (subFipe && viaSubFipe === 'rf_celular') {
      setModo('sub_fipe_presencial_chooser');
    } else {
      onComplete();
    }
  };

  const handleVoltarEscolha = () => {
    setModo('escolha');
  };

  const handleAgendamentoConfirmado = (data: string, horario: string) => {
    onAgendar?.(data, horario);
    onComplete();
  };

  // Modo read-only: mostrar resumo da vistoria realizada
  if (readOnly) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <Card className="border-success/30 bg-card/80 backdrop-blur-xl">
          <CardContent className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">Vistoria Concluída</h3>
            <p className="text-muted-foreground mb-4">
              {tipoVistoriaRealizada === 'autovistoria'
                ? 'Autovistoria - Roubo & Furto realizada com sucesso'
                : tipoVistoriaRealizada === 'agendada'
                ? 'Vistoria presencial agendada'
                : tipoVistoriaRealizada === 'agendada_base'
                ? 'Agendamento na Base confirmado'
                : 'Vistoria do veículo concluída'}
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success text-sm">
              {tipoVistoriaRealizada === 'autovistoria' ? (
                <>
                  <Camera className="h-4 w-4" />
                  Fotos enviadas
                </>
              ) : tipoVistoriaRealizada === 'agendada_base' ? (
                <>
                  <Building2 className="h-4 w-4" />
                  Agendamento na Base
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  Agendamento confirmado
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Sub-FIPE: chooser de 3 vias canônico
  // ──────────────────────────────────────────────────────────────
  const renderChooserSubFipe = () => (
    <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">Vistoria do Veículo</CardTitle>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha como deseja realizar a vistoria do seu veículo
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Via 1 — Vistoria Completa pelo celular */}
        <button
          onClick={() => escolherVia('completa_celular')}
          className="w-full p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center shrink-0 group-hover:bg-success/20 transition-colors">
              <ShieldCheck className="h-6 w-6 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground">Vistoria Completa pelo celular</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">
                  Recomendado
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Tire todas as fotos do veículo agora pelo celular, seguindo um roteiro guiado.
              </p>
              <div className="mt-2 text-xs text-success-foreground bg-success/10 rounded-md px-2 py-1.5 inline-flex items-start gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>Se aprovada, você fica com a <strong>proteção completa</strong>.</span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  Pelo celular
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Sem etapa presencial
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Via 2 — Roubo e Furto pelo celular */}
        <button
          onClick={() => escolherVia('rf_celular')}
          className="w-full p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground mb-1">Roubo &amp; Furto pelo celular</h3>
              <p className="text-sm text-muted-foreground">
                Tire algumas fotos rápidas agora (motor, chassi e vídeo 360°). Em seguida, escolha onde realizar a vistoria presencial com o técnico.
              </p>
              <div className="mt-2 text-xs text-primary bg-primary/10 rounded-md px-2 py-1.5 flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Assim que suas fotos forem aprovadas, você fica com <strong>proteção contra roubo e furto</strong>. Para ter a proteção completa, é necessário concluir a vistoria presencial com o técnico (na base ou na rota).
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Via 3 — Sem fotos */}
        <button
          onClick={() => escolherVia('sem_fotos')}
          className="w-full p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
              <Home className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground mb-1">Sem fotos — vistoria só com o técnico</h3>
              <p className="text-sm text-muted-foreground">
                Pular as fotos pelo celular e agendar diretamente a vistoria presencial com o técnico.
              </p>
              <div className="mt-2 text-xs text-destructive bg-destructive/10 rounded-md px-2 py-1.5 flex items-start gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Você <strong>não terá nenhuma proteção</strong> até concluir a vistoria presencial com o técnico (na base ou na rota).
                </span>
              </div>
            </div>
          </div>
        </button>
      </CardContent>
    </Card>
  );

  // ──────────────────────────────────────────────────────────────
  // Acima-FIPE: chooser atual (autovistoria opcional + técnico + base)
  // ──────────────────────────────────────────────────────────────
  const renderChooserAcimaFipe = () => (
    <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">Vistoria do Veículo</CardTitle>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha como deseja realizar a vistoria
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Card 1: Autovistoria - Roubo & Furto */}
        <button
          onClick={() => setModo('autovistoria')}
          className="w-full p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground">Autovistoria - Roubo &amp; Furto</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">
                  Recomendado
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Tire fotos do veículo agora pelo celular. Disponível para planos com cobertura de Roubo &amp; Furto.
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  Pelo celular
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Rápido e prático
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Card 2: Técnico vai até o cliente — escondido quando cenário é Base */}
        {tipoInstalacao !== 'base' && (
          <button
            onClick={() => setModo('agendada')}
            className="w-full p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                <Home className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground mb-1">Quero que o técnico venha até mim</h3>
                <p className="text-sm text-muted-foreground">
                  Um técnico vai ao seu endereço realizar a vistoria/instalação.
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Agendamento em até 48h
                  </span>
                </div>
              </div>
            </div>
          </button>
        )}

        {/* Card 3: Cliente leva à Base — escondido quando cenário é Rota */}
        {tipoInstalacao !== 'rota' && (
          <button
            onClick={() => setModo('escolha-base')}
            className="w-full p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
                <Building2 className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground mb-1">Quero levar meu veículo à Base</h3>
                <p className="text-sm text-muted-foreground">
                  Leve o veículo a uma unidade Praticcar para realizar a vistoria/instalação.
                </p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {enderecoBase && (
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span className="truncate">{enderecoBase}</span>
                    </div>
                  )}
                  {horarioBase && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span>Horário: {horarioBase}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        )}
      </CardContent>
    </Card>
  );

  // Sub-chooser presencial sub-FIPE (Vias 2 e 3): técnico OU base
  const renderPresencialChooserSubFipe = () => (
    <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl">Onde fazer a vistoria presencial?</CardTitle>
        <p className="text-muted-foreground text-sm mt-1">
          Para finalizar, escolha onde nosso técnico realizará a vistoria do veículo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {viaSubFipe === 'sem_fotos' && (
          <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              Você não terá nenhuma proteção até concluir a vistoria presencial com o técnico.
            </AlertDescription>
          </Alert>
        )}
        {viaSubFipe === 'rf_celular' && (
          <Alert className="border-primary/40 bg-primary/10">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription>
              Suas fotos foram enviadas. Para liberar a proteção completa, conclua a vistoria presencial com o técnico.
            </AlertDescription>
          </Alert>
        )}

        {tipoInstalacao !== 'base' && (
          <button
            onClick={() => setModo('agendada')}
            className="w-full p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                <Home className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground mb-1">Quero que o técnico venha até mim (Rota)</h3>
                <p className="text-sm text-muted-foreground">
                  Um técnico vai ao seu endereço realizar a vistoria.
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Agendamento em até 48h
                  </span>
                </div>
              </div>
            </div>
          </button>
        )}

        {tipoInstalacao !== 'rota' && (
          <button
            onClick={() => setModo('escolha-base')}
            className="w-full p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
                <Building2 className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground mb-1">Quero levar meu veículo à Base</h3>
                <p className="text-sm text-muted-foreground">
                  Leve o veículo a uma unidade Praticcar para realizar a vistoria.
                </p>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {enderecoBase && (
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span className="truncate">{enderecoBase}</span>
                    </div>
                  )}
                  {horarioBase && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span>Horário: {horarioBase}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setViaSubFipe(null);
            setModo('escolha');
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <AnimatePresence mode="wait">
      {modo === 'escolha' && (
        <motion.div
          key="escolha"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {subFipe ? renderChooserSubFipe() : renderChooserAcimaFipe()}
        </motion.div>
      )}

      {modo === 'sub_fipe_presencial_chooser' && (
        <motion.div
          key="sub_fipe_presencial_chooser"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          {renderPresencialChooserSubFipe()}
        </motion.div>
      )}

      {/* Escolha da base */}
      {modo === 'escolha-base' && (
        <motion.div
          key="escolha-base"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <EscolhaBase
            onEscolher={(oficinaId) => {
              setOficinaIdSelecionada(oficinaId);
              setModo('agendada-base');
            }}
            onVoltar={() => setModo(subFipe && viaSubFipe ? 'sub_fipe_presencial_chooser' : 'escolha')}
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
          transition={{ duration: 0.3 }}
        >
          <AgendamentoBase
            cotacaoId={cotacaoId}
            oficinaId={oficinaIdSelecionada}
            clienteNome={clienteNome}
            clienteTelefone={clienteTelefone}
            clienteEmail={clienteEmail}
            veiculoPlaca={veiculoPlaca}
            veiculoDescricao={veiculoDescricao}
            onAgendado={onComplete}
            onVoltar={() => setModo('escolha-base')}
          />
        </motion.div>
      )}

      {modo === 'autovistoria' && (
        <motion.div
          key="autovistoria"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (subFipe) {
                  setViaSubFipe(null);
                }
                setModo('escolha');
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
          {subFipe && viaSubFipe === 'completa_celular' && (
            <Card className="mb-4 border-success/30 bg-success/5">
              <CardContent className="py-4 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Vistoria Completa pelo celular</p>
                  <p className="text-muted-foreground mt-1">
                    Siga o roteiro completo de fotos. Se aprovada, você fica com a proteção completa, sem precisar de etapa presencial.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {subFipe && viaSubFipe === 'rf_celular' && (
            <Card className="mb-4 border-primary/30 bg-primary/5">
              <CardContent className="py-4 flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">Roubo &amp; Furto pelo celular</p>
                  <p className="text-muted-foreground mt-1">
                    Fotos rápidas de motor, chassi e vídeo 360°. Após o envio, escolha onde fazer a vistoria presencial para liberar a proteção completa.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          <AutovistoriaCotacao
            cotacaoId={cotacaoId}
            tipoVeiculo={tipoVeiculo}
            onComplete={handleAutovistoriaConcluida}
            fotosOverride={subFipe && viaSubFipe === 'completa_celular' ? fotosSubFipeCompleta : undefined}
            titulo={subFipe ? 'Vistoria do Veículo' : undefined}
          />
        </motion.div>
      )}

      {modo === 'agendada' && (
        <motion.div
          key="agendada"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModo(subFipe && viaSubFipe ? 'sub_fipe_presencial_chooser' : 'escolha')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
          <AgendamentoCotacao
            cotacaoId={cotacaoId}
            onConfirmar={handleAgendamentoConfirmado}
            enderecoInicial={enderecoInicial}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

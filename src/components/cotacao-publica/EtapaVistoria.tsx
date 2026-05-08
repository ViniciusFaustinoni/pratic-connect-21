import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Calendar, Home, Building2, MapPin, Clock, Smartphone, CheckCircle2, ArrowLeft } from 'lucide-react';
import { AutovistoriaCotacao } from './AutovistoriaCotacao';
import { AgendamentoCotacao } from './AgendamentoCotacao';

import { EscolhaBase } from './EscolhaBase';
import { AgendamentoBase } from './AgendamentoBase';
import { useConfiguracaoBase } from '@/hooks/useAgendamentoBase';
import type { TipoVeiculo } from '@/data/autovistoriaConfig';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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
}

type ModoVistoria = 'escolha' | 'autovistoria' | 'agendada' | 'escolha-base' | 'agendada-base';

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
  tipoVistoriaRealizada 
}: EtapaVistoriaProps) {
  const [modo, setModo] = useState<ModoVistoria>('escolha');
  const [oficinaIdSelecionada, setOficinaIdSelecionada] = useState<string>('');
  const { data: configBase } = useConfiguracaoBase();

  const enderecoBase = configBase?.base_logradouro
    ? `${configBase.base_logradouro}${configBase.base_numero ? `, ${configBase.base_numero}` : ''} - ${configBase.base_bairro || ''} - ${configBase.base_cidade || ''}/${configBase.base_uf || ''}`
    : null;
  const horarioBase = configBase?.base_horario_inicio && configBase?.base_horario_fim
    ? `${configBase.base_horario_inicio} às ${configBase.base_horario_fim}`
    : null;

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

              {/* Card 2: Técnico vai até o cliente */}
              <button
                onClick={() => setModo('agendada')}
                className={cn(
                  "w-full p-4 rounded-xl border bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left",
                  tipoInstalacao === 'rota' ? "border-primary/40" : "border-border/50"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                    <Home className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">Quero que o técnico venha até mim</h3>
                      {tipoInstalacao === 'rota' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          Sugerido
                        </span>
                      )}
                    </div>
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

              {/* Card 3: Cliente leva à Base */}
              <button
                onClick={() => setModo('escolha-base')}
                className={cn(
                  "w-full p-4 rounded-xl border bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left",
                  tipoInstalacao === 'base' ? "border-primary/40" : "border-border/50"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 group-hover:bg-orange-500/20 transition-colors">
                    <Building2 className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">Quero levar meu veículo à Base</h3>
                      {tipoInstalacao === 'base' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          Sugerido
                        </span>
                      )}
                    </div>
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
            </CardContent>
          </Card>
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
            onVoltar={() => setModo('escolha')}
          />
        </motion.div>
      )}

      {/* NOVA TELA: Agendamento na base */}
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
              onClick={() => setModo('escolha')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
          <AutovistoriaCotacao
            cotacaoId={cotacaoId}
            tipoVeiculo={tipoVeiculo}
            onComplete={onComplete}
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
              onClick={handleVoltarEscolha}
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

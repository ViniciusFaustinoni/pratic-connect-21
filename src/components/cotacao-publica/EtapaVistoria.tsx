import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Calendar, Smartphone, CheckCircle2, ArrowLeft } from 'lucide-react';
import { AutovistoriaCotacao } from './AutovistoriaCotacao';
import { AgendamentoCotacao } from './AgendamentoCotacao';
import type { TipoVeiculo } from '@/data/autovistoriaConfig';
import { motion, AnimatePresence } from 'framer-motion';

interface EtapaVistoriaProps {
  cotacaoId: string;
  tipoVeiculo: TipoVeiculo;
  onComplete: () => void;
  onAgendar?: (data: string, horario: string) => void;
}

type ModoVistoria = 'escolha' | 'autovistoria' | 'agendada';

export function EtapaVistoria({ cotacaoId, tipoVeiculo, onComplete, onAgendar }: EtapaVistoriaProps) {
  const [modo, setModo] = useState<ModoVistoria>('escolha');

  const handleVoltarEscolha = () => {
    setModo('escolha');
  };

  const handleAgendamentoConfirmado = (data: string, horario: string) => {
    onAgendar?.(data, horario);
    onComplete();
  };

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
              {/* Opção Autovistoria */}
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
                      <h3 className="font-semibold text-foreground">Autovistoria</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Tire {tipoVeiculo === 'moto' ? '10' : '15'} fotos do veículo agora mesmo usando seu celular
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

              {/* Opção Agendar */}
              <button
                onClick={() => setModo('agendada')}
                className="w-full p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 transition-all group text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors">
                    <Calendar className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-1">Agendar Vistoria Presencial</h3>
                    <p className="text-sm text-muted-foreground">
                      Agende uma data e horário para um vistoriador ir até você
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Em até 48h
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </CardContent>
          </Card>
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
              onClick={handleVoltarEscolha}
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
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

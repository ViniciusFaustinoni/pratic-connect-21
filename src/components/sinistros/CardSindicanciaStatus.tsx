import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, AlertTriangle, Clock, CheckCircle, PauseCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { usePermissions } from '@/hooks/usePermissions';
import { RESULTADO_SINDICANCIA_LABELS } from '@/types/sinistros';
import type { ResultadoSindicancia } from '@/types/sinistros';
import { ConcluirSindicanciaModal } from './ConcluirSindicanciaModal';

interface CardSindicanciaStatusProps {
  sinistroId: string;
  protocolo: string;
  sindicanteId?: string | null;
  prazoFim?: string | null;
  resultadoSindicancia?: string | null;
  status: string;
  associadoId?: string | null;
  associadoNome?: string | null;
}

export function CardSindicanciaStatus({
  sinistroId, protocolo, sindicanteId, prazoFim, resultadoSindicancia, status, associadoId, associadoNome,
}: CardSindicanciaStatusProps) {
  const { isDiretor, isGerente } = usePermissions();
  const [modalConcluirOpen, setModalConcluirOpen] = useState(false);

  const { data: sindicante } = useQuery({
    queryKey: ['sindicante-profile', sindicanteId],
    queryFn: async () => {
      if (!sindicanteId) return null;
      const { data } = await supabase.from('profiles').select('id, nome').eq('id', sindicanteId).maybeSingle();
      return data;
    },
    enabled: !!sindicanteId,
  });

  const emSindicancia = status === 'em_sindicancia' || status === 'em_pericia';
  const jaConcluida = !!resultadoSindicancia;

  // Cálculos de prazo
  const hoje = new Date();
  const prazoDate = prazoFim ? new Date(prazoFim) : null;
  const diasRestantes = prazoDate ? differenceInDays(prazoDate, hoje) : null;
  const prazoTotal = 30;
  const diasUsados = prazoDate ? prazoTotal - (diasRestantes ?? 0) : 0;
  const progressoPct = Math.min(100, Math.max(0, (diasUsados / prazoTotal) * 100));

  // Só mostra se está em sindicância ou tem resultado
  if (!emSindicancia && !jaConcluida) return null;

  return (
    <>
      <Card className={`border-rose-300 dark:border-rose-800 ${diasRestantes !== null && diasRestantes < 0 ? 'border-red-500' : ''}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-5 w-5 text-rose-600" />
            {status === 'em_pericia' ? 'Perícia Técnica' : 'Sindicância'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Badge de status */}
          {emSindicancia && !jaConcluida && (
            <Badge className="bg-rose-100 text-rose-800">
              <Clock className="h-3 w-3 mr-1" />
              Em andamento
            </Badge>
          )}

          {jaConcluida && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              {RESULTADO_SINDICANCIA_LABELS[resultadoSindicancia as ResultadoSindicancia] || resultadoSindicancia}
            </Badge>
          )}

          {/* Sindicante */}
          {sindicante && (
            <div>
              <p className="text-xs text-muted-foreground">Responsável</p>
              <p className="text-sm font-medium">{sindicante.nome}</p>
            </div>
          )}

          {/* Prazo com contagem regressiva */}
          {emSindicancia && !jaConcluida && prazoDate && diasRestantes !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Prazo</span>
                <span className={`font-medium ${diasRestantes < 0 ? 'text-red-600' : diasRestantes <= 7 ? 'text-amber-600' : ''}`}>
                  {diasRestantes < 0
                    ? `Vencido há ${Math.abs(diasRestantes)} dias`
                    : `${diasRestantes} dias restantes`}
                </span>
              </div>
              <Progress
                value={progressoPct}
                className={`h-2 ${diasRestantes < 0 ? '[&>div]:bg-red-500' : diasRestantes <= 7 ? '[&>div]:bg-amber-500' : '[&>div]:bg-rose-500'}`}
              />
              <p className="text-xs text-muted-foreground">
                Vencimento: {format(prazoDate, "dd/MM/yyyy", { locale: ptBR })}
              </p>

              {diasRestantes <= 7 && diasRestantes >= 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">Prazo vencendo em breve!</p>
                </div>
              )}

              {diasRestantes < 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                  <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                  <p className="text-xs text-red-800 dark:text-red-200">Prazo vencido! Ação urgente necessária.</p>
                </div>
              )}
            </div>
          )}

          {/* Alerta de prazo suspenso */}
          {emSindicancia && !jaConcluida && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <PauseCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <p className="text-xs text-rose-800 dark:text-rose-200">
                Prazo de 60 dias úteis para ressarcimento <strong>SUSPENSO</strong> durante a {status === 'em_pericia' ? 'perícia' : 'sindicância'}.
              </p>
            </div>
          )}

          {/* Botão concluir */}
          {emSindicancia && !jaConcluida && (isDiretor || isGerente) && (
            <Button
              className="w-full bg-rose-600 hover:bg-rose-700"
              onClick={() => setModalConcluirOpen(true)}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Concluir {status === 'em_pericia' ? 'Perícia' : 'Sindicância'}
            </Button>
          )}
        </CardContent>
      </Card>

      <ConcluirSindicanciaModal
        open={modalConcluirOpen}
        onClose={() => setModalConcluirOpen(false)}
        sinistroId={sinistroId}
        protocolo={protocolo}
        associadoId={associadoId}
        associadoNome={associadoNome}
      />
    </>
  );
}

import { useState, useEffect } from 'react';
import { Coffee, Clock } from 'lucide-react';
import { useJornadaTrabalho, formatarMinutos } from '@/hooks/useJornadaTrabalho';

/**
 * Overlay que aparece durante o horário de almoço obrigatório
 * Bloqueia a interface e mostra contador regressivo
 */
export function AlmocoBloqueioOverlay() {
  const { emAlmoco, minutosAlmocoRestantes, turno } = useJornadaTrabalho();
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  // Calcular segundos restantes em tempo real
  useEffect(() => {
    if (!emAlmoco || !turno?.inicio_almoco) {
      setSegundosRestantes(0);
      return;
    }

    const calcularSegundos = () => {
      const inicioAlmoco = new Date(turno.inicio_almoco!);
      const fimPrevisto = new Date(inicioAlmoco.getTime() + 60 * 60 * 1000); // 1 hora
      const agora = new Date();
      const diff = Math.max(0, Math.floor((fimPrevisto.getTime() - agora.getTime()) / 1000));
      setSegundosRestantes(diff);
    };

    calcularSegundos();
    const interval = setInterval(calcularSegundos, 1000);

    return () => clearInterval(interval);
  }, [emAlmoco, turno?.inicio_almoco]);

  if (!emAlmoco) {
    return null;
  }

  const minutosDisplay = Math.floor(segundosRestantes / 60);
  const segundosDisplay = segundosRestantes % 60;
  const tempoFormatado = `${String(minutosDisplay).padStart(2, '0')}:${String(segundosDisplay).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-6">
        {/* Ícone animado */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-amber-600/20 flex items-center justify-center animate-pulse">
              <Coffee className="h-12 w-12 text-amber-400" />
            </div>
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center animate-bounce">
              <Clock className="h-4 w-4 text-amber-900" />
            </div>
          </div>
        </div>

        {/* Título */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">
            🍽️ Horário de Almoço
          </h2>
          <p className="text-slate-400">
            Você completou 4 horas de trabalho.
          </p>
          <p className="text-slate-400">
            Nenhuma tarefa será atribuída agora.
          </p>
        </div>

        {/* Contador */}
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <p className="text-slate-400 text-sm mb-2">Retorno em:</p>
          <div className="text-5xl font-mono font-bold text-amber-400">
            {tempoFormatado}
          </div>
        </div>

        {/* Mensagem motivacional */}
        <div className="space-y-3">
          <p className="text-slate-300">
            Aproveite sua pausa para descansar! ☕
          </p>
          <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
            <p className="text-xs text-slate-500">
              Após 1 hora, você voltará a receber tarefas automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { CheckCircle, Car, FileText, MessageCircle } from 'lucide-react';

interface EventoStepperProps {
  etapaAtual: number;
}

const etapas = [
  { numero: 1, titulo: 'Auto Vistoria', icon: Car },
  { numero: 2, titulo: 'B.O.', icon: FileText },
  { numero: 3, titulo: 'Relato', icon: MessageCircle },
];

export default function EventoStepper({ etapaAtual }: EventoStepperProps) {
  return (
    <div className="flex items-center justify-between px-2">
      {etapas.map((etapa, idx) => {
        const completada = etapaAtual >= etapa.numero;
        const atual = etapaAtual === etapa.numero - 1;
        const Icon = etapa.icon;

        return (
          <div key={etapa.numero} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`flex items-center justify-center h-10 w-10 rounded-full border-2 transition-colors ${
                  completada
                    ? 'bg-green-500 border-green-500 text-white'
                    : atual
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-muted border-border text-muted-foreground'
                }`}
              >
                {completada ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span className={`text-xs mt-1 font-medium ${
                completada ? 'text-green-600' : atual ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {etapa.titulo}
              </span>
            </div>
            {idx < etapas.length - 1 && (
              <div className={`h-0.5 w-full mx-1 mt-[-16px] ${
                etapaAtual > etapa.numero ? 'bg-green-500' : 'bg-border'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

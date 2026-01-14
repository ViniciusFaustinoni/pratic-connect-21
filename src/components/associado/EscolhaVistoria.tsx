import { Calendar, Camera, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSelecionarTipoVistoria } from '@/hooks/useContratoLink';

interface EscolhaVistoriaProps {
  contratoId: string;
  onEscolher: (tipo: 'agendada' | 'autovistoria') => void;
}

export function EscolhaVistoria({ contratoId, onEscolher }: EscolhaVistoriaProps) {
  const selecionarTipo = useSelecionarTipoVistoria();

  const handleEscolher = async (tipo: 'agendada' | 'autovistoria') => {
    await selecionarTipo.mutateAsync({ contratoId, tipoVistoria: tipo });
    onEscolher(tipo);
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Como deseja realizar a vistoria?</CardTitle>
        <CardDescription>
          Escolha a opção que melhor se adapta à sua disponibilidade
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Opção: Agendar Vistoria */}
        <button
          onClick={() => handleEscolher('agendada')}
          disabled={selecionarTipo.isPending}
          className="w-full p-6 rounded-xl border-2 border-muted hover:border-primary transition-colors text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="bg-primary/10 p-3 rounded-lg group-hover:bg-primary/20 transition-colors">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Agendar Vistoria</h3>
              <p className="text-sm text-muted-foreground">
                Escolha data e horário para uma vistoria presencial com nosso técnico.
                Ideal se você prefere acompanhamento profissional.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </button>

        {/* Opção: Autovistoria */}
        <button
          onClick={() => handleEscolher('autovistoria')}
          disabled={selecionarTipo.isPending}
          className="w-full p-6 rounded-xl border-2 border-muted hover:border-primary transition-colors text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="bg-green-500/10 p-3 rounded-lg group-hover:bg-green-500/20 transition-colors">
              <Camera className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">Autovistoria</h3>
              <p className="text-sm text-muted-foreground">
                Envie as fotos do seu veículo pelo celular, sem precisar se deslocar.
                Rápido e prático - faça de onde estiver.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </button>

        {/* Info */}
        <p className="text-xs text-center text-muted-foreground pt-4">
          Em ambas as opções, você precisará pagar a taxa de filiação para confirmar.
        </p>
      </CardContent>
    </Card>
  );
}

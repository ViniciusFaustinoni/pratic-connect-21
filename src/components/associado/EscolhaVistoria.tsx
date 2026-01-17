import { Calendar, Camera, ArrowRight, CheckCircle, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSelecionarTipoVistoria } from '@/hooks/useContratoLink';

interface EscolhaVistoriaProps {
  contratoId: string;
  onEscolher: (tipo: 'agendada' | 'autovistoria') => void;
  disabled?: boolean;
  tipoSelecionado?: 'agendada' | 'autovistoria' | null;
}

export function EscolhaVistoria({ contratoId, onEscolher, disabled, tipoSelecionado }: EscolhaVistoriaProps) {
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
          onClick={() => !disabled && handleEscolher('agendada')}
          disabled={selecionarTipo.isPending || disabled}
          className={`w-full p-6 rounded-xl border-2 transition-colors text-left group ${
            disabled 
              ? 'border-muted cursor-not-allowed opacity-60' 
              : tipoSelecionado === 'agendada'
              ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
              : 'border-muted hover:border-primary'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg transition-colors ${
              tipoSelecionado === 'agendada' 
                ? 'bg-green-500/20' 
                : 'bg-primary/10 group-hover:bg-primary/20'
            }`}>
              <Calendar className={`h-6 w-6 ${tipoSelecionado === 'agendada' ? 'text-green-600' : 'text-primary'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg mb-1">Agendar Vistoria</h3>
                {tipoSelecionado === 'agendada' && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle className="h-3 w-3 mr-1" /> Selecionado
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Escolha data e horário para uma vistoria presencial com nosso técnico.
                Ideal se você prefere acompanhamento profissional.
              </p>
            </div>
            {!disabled && !tipoSelecionado && (
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
            {disabled && <Lock className="h-5 w-5 text-muted-foreground" />}
          </div>
        </button>

        {/* Opção: Autovistoria */}
        <button
          onClick={() => !disabled && handleEscolher('autovistoria')}
          disabled={selecionarTipo.isPending || disabled}
          className={`w-full p-6 rounded-xl border-2 transition-colors text-left group ${
            disabled 
              ? 'border-muted cursor-not-allowed opacity-60' 
              : tipoSelecionado === 'autovistoria'
              ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
              : 'border-muted hover:border-primary'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg transition-colors ${
              tipoSelecionado === 'autovistoria' 
                ? 'bg-green-500/20' 
                : 'bg-green-500/10 group-hover:bg-green-500/20'
            }`}>
              <Camera className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg mb-1">Autovistoria</h3>
                {tipoSelecionado === 'autovistoria' && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle className="h-3 w-3 mr-1" /> Selecionado
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Envie as fotos do seu veículo pelo celular, sem precisar se deslocar.
                Rápido e prático - faça de onde estiver.
              </p>
            </div>
            {!disabled && !tipoSelecionado && (
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
            {disabled && <Lock className="h-5 w-5 text-muted-foreground" />}
          </div>
        </button>

        {/* Info */}
        {!disabled && (
          <p className="text-xs text-center text-muted-foreground pt-4">
            Em ambas as opções, você precisará pagar a taxa de filiação para confirmar.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

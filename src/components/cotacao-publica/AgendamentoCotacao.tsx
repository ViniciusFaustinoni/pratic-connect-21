import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { useFinalizarVistoriaCotacao } from '@/hooks/useCotacaoVistoria';
import { HORARIOS_DISPONIVEIS } from '@/data/autovistoriaConfig';
import { cn } from '@/lib/utils';
import { format, addDays, isWeekend, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AgendamentoCotacaoProps {
  cotacaoId: string;
  onConfirmar: (data: string, horario: string) => void;
}

export function AgendamentoCotacao({ cotacaoId, onConfirmar }: AgendamentoCotacaoProps) {
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  
  const finalizarMutation = useFinalizarVistoriaCotacao();
  
  // Gerar próximos 7 dias úteis
  const hoje = new Date();
  const datasDisponiveis: Date[] = [];
  let dia = addDays(hoje, 1); // Começar de amanhã
  
  while (datasDisponiveis.length < 7) {
    if (!isWeekend(dia)) {
      datasDisponiveis.push(dia);
    }
    dia = addDays(dia, 1);
  }
  
  const handleConfirmar = async () => {
    if (!dataSelecionada || !horarioSelecionado) return;
    
    try {
      await finalizarMutation.mutateAsync({
        cotacaoId,
        tipoVistoria: 'agendada'
      });
      
      const dataFormatada = format(dataSelecionada, 'yyyy-MM-dd');
      onConfirmar(dataFormatada, horarioSelecionado);
    } catch (error) {
      console.error('Erro ao agendar:', error);
    }
  };
  
  const podeConfirmar = dataSelecionada && horarioSelecionado && !finalizarMutation.isPending;
  
  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Agendar Vistoria Presencial</CardTitle>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha uma data e horário para o vistoriador ir até você
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Seleção de data */}
        <div>
          <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-primary" />
            Data
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {datasDisponiveis.map((data) => {
              const selecionada = dataSelecionada && 
                format(dataSelecionada, 'yyyy-MM-dd') === format(data, 'yyyy-MM-dd');
              
              return (
                <button
                  key={data.toISOString()}
                  onClick={() => setDataSelecionada(data)}
                  className={cn(
                    "p-3 rounded-lg border text-center transition-all",
                    selecionada
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                      : "border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50"
                  )}
                >
                  <div className="text-xs text-muted-foreground">
                    {format(data, 'EEE', { locale: ptBR })}
                  </div>
                  <div className="font-semibold text-lg text-foreground">
                    {format(data, 'd')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(data, 'MMM', { locale: ptBR })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Seleção de horário */}
        <div>
          <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-primary" />
            Horário
          </label>
          <div className="grid grid-cols-4 gap-2">
            {HORARIOS_DISPONIVEIS.map((horario) => {
              const selecionado = horarioSelecionado === horario;
              
              return (
                <button
                  key={horario}
                  onClick={() => setHorarioSelecionado(horario)}
                  className={cn(
                    "p-2.5 rounded-lg border text-center font-medium transition-all",
                    selecionado
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20 text-primary"
                      : "border-border/50 bg-card/50 hover:bg-accent/10 hover:border-primary/50 text-foreground"
                  )}
                >
                  {horario}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Resumo */}
        {dataSelecionada && horarioSelecionado && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">Resumo do agendamento</h4>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">
                {format(dataSelecionada, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </strong>
              {' '}às{' '}
              <strong className="text-foreground">{horarioSelecionado}</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Um vistoriador irá ao endereço informado para realizar a vistoria do veículo.
            </p>
          </div>
        )}
        
        {/* Botão confirmar */}
        <Button
          onClick={handleConfirmar}
          disabled={!podeConfirmar}
          className="w-full bg-primary hover:bg-primary/90"
          size="lg"
        >
          {finalizarMutation.isPending ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5 mr-2" />
          )}
          Confirmar Agendamento
        </Button>
      </CardContent>
    </Card>
  );
}

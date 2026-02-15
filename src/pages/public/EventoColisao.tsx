import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EventoStepper from '@/components/evento/EventoStepper';
import EventoEtapa1Vistoria from '@/components/evento/EventoEtapa1Vistoria';
import EventoEtapa2BO from '@/components/evento/EventoEtapa2BO';
import EventoEtapa3Relato from '@/components/evento/EventoEtapa3Relato';
import EventoSucesso from '@/components/evento/EventoSucesso';
import EventoAgendamento from '@/components/evento/EventoAgendamento';

interface EventoData {
  valid: boolean;
  reason?: string;
  link?: {
    id: string;
    etapa_atual: number;
    expira_em: string;
    dados_etapa1: any;
    dados_etapa2: any;
    dados_etapa3: any;
    etapa4_completada_em: string | null;
  };
  sinistro?: {
    id: string;
    protocolo: string;
    tipo: string;
    data_ocorrencia: string;
    descricao: string;
    associado: { id: string; nome: string };
    veiculo: { placa: string; marca: string; modelo: string; ano_modelo: string; cor: string };
  };
}

export default function EventoColisao() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EventoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [etapaAtual, setEtapaAtual] = useState(0);

  const validar = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await publicSupabase.functions.invoke('validar-link-evento', {
        body: { token },
      });
      if (response.error) throw response.error;
      setData(response.data);
      setEtapaAtual(response.data?.link?.etapa_atual || 0);
    } catch (err: any) {
      setError(err.message || 'Erro ao validar link');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { validar(); }, [validar]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Validando link...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.valid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-semibold">
              {data?.reason === 'expirado' ? 'Link Expirado' : 'Link Inválido'}
            </h2>
            <p className="text-muted-foreground">
              Este link expirou ou não é mais válido. Entre em contato com a Pratic Car pelo WhatsApp
              (21) 3175-2131 para solicitar um novo link.
            </p>
            <Separator />
            <div className="text-sm text-muted-foreground">
              <p>📞 Central de Atendimento</p>
              <p className="font-medium">(21) 3175-2131</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { link, sinistro } = data;
  const isCompleted = etapaAtual >= 3;
  const isAgendado = !!link?.etapa4_completada_em;

  const handleStepComplete = () => {
    setEtapaAtual((prev) => prev + 1);
    validar(); // Refresh data from server
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-4 px-4">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-lg font-bold">Pratic Car</h1>
          <p className="text-xs opacity-90 mt-0.5">Evento — {sinistro?.protocolo}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Info card */}
        <Card>
          <CardContent className="pt-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Associado</span>
              <span className="text-sm font-medium">{sinistro?.associado?.nome}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Veículo</span>
              <span className="text-sm font-medium">
                {sinistro?.veiculo?.marca} {sinistro?.veiculo?.modelo} — {sinistro?.veiculo?.placa}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tipo</span>
              <Badge variant="outline" className="text-xs capitalize">
                {sinistro?.tipo?.replace(/_/g, ' ') || 'Evento'}
              </Badge>
            </div>
            {sinistro?.data_ocorrencia && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Data do Evento</span>
                <span className="text-xs">
                  {format(new Date(sinistro.data_ocorrencia), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stepper */}
        <EventoStepper etapaAtual={isAgendado ? 4 : etapaAtual} />

        {/* Step content */}
        <Card>
          <CardContent className="pt-4">
            {isCompleted ? (
              isAgendado ? (
                <EventoSucesso
                  dadosEtapa1={link?.dados_etapa1}
                  dadosEtapa2={link?.dados_etapa2}
                  dadosEtapa3={link?.dados_etapa3}
                />
              ) : (
                <EventoAgendamento token={token!} onAgendado={validar} />
              )
            ) : etapaAtual === 0 ? (
              <EventoEtapa1Vistoria token={token!} onComplete={handleStepComplete} />
            ) : etapaAtual === 1 ? (
              <EventoEtapa2BO token={token!} onComplete={handleStepComplete} />
            ) : etapaAtual === 2 ? (
              <EventoEtapa3Relato token={token!} onComplete={handleStepComplete} />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

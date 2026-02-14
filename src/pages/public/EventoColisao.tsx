import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, Clock, AlertTriangle, Car, FileText, MessageCircle, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

const etapas = [
  { numero: 1, titulo: 'Auto Vistoria', descricao: 'Tire fotos dos danos do veículo', icon: Car },
  { numero: 2, titulo: 'Boletim de Ocorrência', descricao: 'Envie o B.O. do evento', icon: FileText },
  { numero: 3, titulo: 'Relato do Ocorrido', descricao: 'Descreva o que aconteceu', icon: MessageCircle },
];

export default function EventoColisao() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EventoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const validar = async () => {
      try {
        const response = await publicSupabase.functions.invoke('validar-link-evento', {
          body: { token },
        });

        if (response.error) throw response.error;
        setData(response.data);
      } catch (err: any) {
        setError(err.message || 'Erro ao validar link');
      } finally {
        setLoading(false);
      }
    };

    validar();
  }, [token]);

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
    const reason = data?.reason;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 mx-auto text-amber-500" />
            <h2 className="text-xl font-semibold">
              {reason === 'expirado' ? 'Link Expirado' : 'Link Inválido'}
            </h2>
            <p className="text-muted-foreground">
              {reason === 'expirado'
                ? 'Este link expirou. Entre em contato com a Pratic Car para solicitar um novo link.'
                : reason === 'completado'
                  ? 'Todas as etapas já foram concluídas. Obrigado!'
                  : 'Este link não é válido. Verifique se o endereço está correto ou entre em contato com a Pratic Car.'}
            </p>
            <Separator />
            <div className="text-sm text-muted-foreground">
              <p>📞 Central de Atendimento</p>
              <p className="font-medium">Fale conosco pelo WhatsApp</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { link, sinistro } = data;
  const etapaAtual = link?.etapa_atual || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-6 px-4">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-xl font-bold">Pratic Car</h1>
          <p className="text-sm opacity-90 mt-1">Etapas do Evento - {sinistro?.protocolo}</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Info do sinistro */}
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Protocolo</span>
              <Badge variant="outline">{sinistro?.protocolo}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Veículo</span>
              <span className="text-sm font-medium">
                {sinistro?.veiculo?.marca} {sinistro?.veiculo?.modelo} - {sinistro?.veiculo?.placa}
              </span>
            </div>
            {sinistro?.data_ocorrencia && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Data do Evento</span>
                <span className="text-sm">
                  {format(new Date(sinistro.data_ocorrencia), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
            )}
            {link?.expira_em && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Link válido até</span>
                <span className="text-sm text-amber-600 font-medium">
                  {format(new Date(link.expira_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stepper */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Etapas Obrigatórias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {etapas.map((etapa) => {
              const completada = etapaAtual >= etapa.numero;
              const atual = etapaAtual === etapa.numero - 1;
              const Icon = etapa.icon;

              return (
                <div
                  key={etapa.numero}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    completada
                      ? 'bg-green-50 border-green-200'
                      : atual
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-muted/30 border-border'
                  }`}
                >
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${
                    completada
                      ? 'bg-green-500 text-white'
                      : atual
                        ? 'bg-blue-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {completada ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <span className="text-sm font-bold">{etapa.numero}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <p className="font-medium text-sm">{etapa.titulo}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{etapa.descricao}</p>
                    {completada && (
                      <Badge className="mt-1 bg-green-100 text-green-800 text-xs">Concluída</Badge>
                    )}
                    {atual && (
                      <Badge className="mt-1 bg-blue-100 text-blue-800 text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Etapa atual
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Placeholder para etapas futuras */}
        {etapaAtual < 3 && (
          <Card>
            <CardContent className="pt-4 text-center">
              <AlertTriangle className="h-6 w-6 mx-auto text-amber-500 mb-2" />
              <p className="text-sm text-muted-foreground">
                As funcionalidades de cada etapa serão implementadas em breve.
              </p>
            </CardContent>
          </Card>
        )}

        {etapaAtual >= 3 && (
          <Card className="border-green-500/50">
            <CardContent className="pt-4 text-center">
              <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
              <p className="font-semibold">Todas as etapas foram concluídas!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Obrigado por completar as informações. Nossa equipe dará sequência ao processo.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import EventoPagamentoCota from '@/components/evento/EventoPagamentoCota';
import EventoAguardandoTermo from '@/components/evento/EventoAguardandoTermo';

interface EventoAprovadoData {
  valid: boolean;
  reason?: string;
  ja_pagou?: boolean;
  ja_assinou_termo?: boolean;
  autentique_documento_id?: string | null;
  sinistro?: {
    id: string;
    protocolo: string;
    tipo: string;
    data_ocorrencia: string;
    bo_numero?: string;
  };
  associado?: { nome: string; cpf: string };
  veiculo?: { placa: string; marca: string; modelo: string };
  cota?: {
    valor_fipe: number;
    percentual: number;
    cota_minima: number;
    valor_cota: number;
    plano_nome: string;
  };
}

export default function EventoPosAprovacao() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EventoAprovadoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<'pagamento' | 'aguardando_termo' | 'sucesso'>('pagamento');

  const validar = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const response = await publicSupabase.functions.invoke('processar-termo-evento', {
        body: { acao: 'validar', token },
      });
      if (response.error) throw response.error;
      const d = response.data;
      setData(d);
      if (d?.valid) {
        if (d.ja_pagou && d.ja_assinou_termo) setEtapa('sucesso');
        else if (d.ja_pagou) setEtapa('aguardando_termo');
        else setEtapa('pagamento');
      }
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
              Este link expirou ou não é mais válido. Entre em contato com a Pratic Car pelo WhatsApp (21) 3175-2131 para solicitar um novo link.
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

  const { sinistro, associado, veiculo, cota } = data;

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
        {/* Mensagem de aprovação */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          <span className="text-sm font-semibold">Seu evento foi aprovado!</span>
        </div>

        {/* Info card */}
        <Card>
          <CardContent className="pt-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Associado</span>
              <span className="text-sm font-medium">{associado?.nome}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Veículo</span>
              <span className="text-sm font-medium">
                {veiculo?.marca} {veiculo?.modelo} — {veiculo?.placa}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Tipo</span>
              <Badge variant="outline" className="text-xs capitalize">{sinistro?.tipo}</Badge>
            </div>
            {sinistro?.data_ocorrencia && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Data do Evento</span>
                <span className="text-sm font-medium">
                  {new Date(sinistro.data_ocorrencia).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs ${etapa === 'pagamento' ? 'text-primary font-semibold' : 'text-green-600'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${etapa === 'pagamento' ? 'bg-primary text-primary-foreground' : 'bg-green-600 text-white'}`}>
              {etapa === 'pagamento' ? '1' : '✓'}
            </div>
            Pagamento
          </div>
          <div className="w-8 h-px bg-border" />
          <div className={`flex items-center gap-1.5 text-xs ${etapa === 'aguardando_termo' ? 'text-primary font-semibold' : etapa === 'sucesso' ? 'text-green-600' : 'text-muted-foreground'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${etapa === 'aguardando_termo' ? 'bg-primary text-primary-foreground' : etapa === 'sucesso' ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'}`}>
              {etapa === 'sucesso' ? '✓' : '2'}
            </div>
            Termo
          </div>
        </div>

        {/* Content */}
        {etapa === 'pagamento' && (
          <EventoPagamentoCota
            token={token!}
            sinistro={sinistro!}
            associado={associado!}
            cota={cota!}
            onPago={() => {
              setEtapa('aguardando_termo');
              validar();
            }}
          />
        )}

        {etapa === 'aguardando_termo' && (
          <EventoAguardandoTermo
            token={token!}
            associado={associado!}
            autentiqueDocumentoId={data.autentique_documento_id}
            onAssinado={() => setEtapa('sucesso')}
          />
        )}

        {etapa === 'sucesso' && (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 mx-auto text-green-600" />
              <h2 className="text-xl font-bold text-green-700">Tudo Certo!</h2>
              <p className="text-muted-foreground">
                Pagamento confirmado e Termo assinado. O reparo do seu veículo será agendado em breve. Você receberá todas as atualizações pelo WhatsApp.
              </p>
              <Separator />
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Valor:</span> <span className="font-medium">R$ {cota?.valor_cota?.toFixed(2)}</span></p>
                <p><span className="text-muted-foreground">Protocolo:</span> <span className="font-medium">{sinistro?.protocolo}</span></p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

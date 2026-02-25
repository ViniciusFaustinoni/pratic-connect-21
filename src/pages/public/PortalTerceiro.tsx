import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, Car } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { TerceiroDocumentos } from '@/components/terceiro/TerceiroDocumentos';
import { TerceiroTermo } from '@/components/terceiro/TerceiroTermo';
import { TerceiroOficina } from '@/components/terceiro/TerceiroOficina';
import { TerceiroAcordo } from '@/components/terceiro/TerceiroAcordo';
import { TerceiroAcompanhamento } from '@/components/terceiro/TerceiroAcompanhamento';
import { TerceiroEntrega } from '@/components/terceiro/TerceiroEntrega';

interface TerceiroData {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  veiculo_placa: string;
  veiculo_marca: string;
  veiculo_modelo: string;
  veiculo_ano: string;
  veiculo_cor: string;
  status: string;
  culpa: string;
  oficina_tipo?: string;
  oficina_nome?: string;
  oficina_endereco?: string;
  oficina_telefone?: string;
  acordo_valor?: number;
  acordo_justificativa?: string;
  acordo_status?: string;
  termo_assinado_em?: string;
  reparo_concluido_em?: string;
  entrega_em?: string;
}

interface DocumentoData {
  id: string;
  tipo: string;
  nome: string;
  url: string;
  status: string;
  motivo_rejeicao?: string;
  created_at: string;
}

interface PortalData {
  valid: boolean;
  reason?: string;
  terceiro?: TerceiroData;
  sinistro?: { protocolo: string; data_ocorrencia: string };
  documentos?: DocumentoData[];
  etapaAtual?: number;
}

export default function PortalTerceiro() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validar = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const { data: result, error: fnError } = await supabase.functions.invoke('validar-link-terceiro', {
        body: { token },
      });
      if (fnError) throw fnError;
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao validar link');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { validar(); }, [validar]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">{data?.reason || error || 'Link inválido'}</h2>
            <p className="text-sm text-muted-foreground">
              Se acredita que isso é um erro, entre em contato com a Pratic Car.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { terceiro, sinistro, documentos, etapaAtual } = data!;
  if (!terceiro) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-md">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-bold">Pratic Car</h1>
          <p className="text-sm opacity-90">Portal do Terceiro</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Info Card */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">{terceiro.nome}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {terceiro.veiculo_marca} {terceiro.veiculo_modelo} — {terceiro.veiculo_placa}
            </div>
            {sinistro && (
              <div className="text-xs text-muted-foreground">
                Protocolo: {sinistro.protocolo}
              </div>
            )}
            <Badge variant="outline" className="text-xs">
              {getStatusLabel(terceiro.status)}
            </Badge>
          </CardContent>
        </Card>

        <Separator />

        {/* Etapas condicionais */}
        {(etapaAtual === 1 || terceiro.status === 'cadastrado' || terceiro.status === 'documentacao_pendente') && (
          <TerceiroDocumentos
            token={token!}
            documentos={documentos || []}
            onRefresh={validar}
          />
        )}

        {(etapaAtual === 2 || terceiro.status === 'documentacao_enviada' || terceiro.status === 'termo_pendente') && (
          <TerceiroTermo
            token={token!}
            terceiro={terceiro}
            onRefresh={validar}
          />
        )}

        {(etapaAtual === 3 || terceiro.status === 'termo_assinado' || terceiro.status === 'oficina_pendente') && (
          <TerceiroOficina
            token={token!}
            terceiro={terceiro}
            onRefresh={validar}
          />
        )}

        {etapaAtual === 4 && terceiro.acordo_status === 'proposto' && (
          <TerceiroAcordo
            token={token!}
            terceiro={terceiro}
            onRefresh={validar}
          />
        )}

        {etapaAtual === 5 && (
          <TerceiroAcompanhamento terceiro={terceiro} />
        )}

        {(etapaAtual === 6 || terceiro.status === 'concluido') && (
          <TerceiroEntrega terceiro={terceiro} />
        )}

        {terceiro.status === 'acordo_aceito' && (
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <ShieldCheck className="h-10 w-10 mx-auto text-green-600" />
              <h3 className="font-semibold text-lg">Acordo Aceito</h3>
              <p className="text-sm text-muted-foreground">
                Você aceitou o acordo de R$ {terceiro.acordo_valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.
                O pagamento será realizado conforme os termos informados.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-xs text-muted-foreground">
            Pratic Car — Associação de Proteção Veicular
          </p>
        </div>
      </div>
    </div>
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    cadastrado: 'Aguardando documentos',
    documentacao_pendente: 'Documentação em andamento',
    documentacao_enviada: 'Documentação enviada',
    termo_pendente: 'Aguardando assinatura do termo',
    termo_assinado: 'Termo assinado',
    oficina_pendente: 'Escolha de oficina pendente',
    oficina_definida: 'Oficina definida',
    acordo_proposto: 'Proposta de acordo disponível',
    acordo_aceito: 'Acordo aceito',
    acordo_recusado: 'Seguindo para reparo',
    regulagem: 'Em regulagem',
    orcamento: 'Em orçamento',
    pecas: 'Aguardando peças',
    em_reparo: 'Em reparo',
    concluido: 'Reparo concluído',
    arquivado: 'Processo encerrado',
  };
  return labels[status] || status;
}

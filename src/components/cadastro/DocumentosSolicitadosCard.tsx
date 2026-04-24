import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Eye, FileText, Calendar, MessageSquare, AlertCircle, Clock, X, XCircle, Copy, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCancelarDocumentosSolicitados } from '@/hooks/useCancelarDocumentosSolicitados';
import { toast } from 'sonner';

// Labels para tipos de documentos (cobre cadastrais e fotos de vistoria)
const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  'cnh': 'CNH',
  'crlv': 'CRLV',
  'comprovante_residencia': 'Comprovante de Residência',
  'foto_frontal_veiculo': 'Foto Frontal',
  'foto_traseira_veiculo': 'Foto Traseira',
  'foto_lateral_esquerda': 'Lateral Esquerda',
  'foto_lateral_direita': 'Lateral Direita',
  'foto_painel': 'Foto do Painel',
  'foto_hodometro': 'Foto do Hodômetro',
  'pneu_dianteiro_esquerdo': 'Pneu Dianteiro Esquerdo',
  'pneu_dianteiro_direito': 'Pneu Dianteiro Direito',
  'pneu_traseiro_esquerdo': 'Pneu Traseiro Esquerdo',
  'pneu_traseiro_direito': 'Pneu Traseiro Direito',
  'chassi': 'Foto do Chassi',
  'motor': 'Foto do Motor',
  'odometro': 'Foto do Odômetro',
  'painel': 'Foto do Painel',
  'frente': 'Foto Frontal',
  'traseira': 'Foto Traseira',
  'lateral_esquerda': 'Lateral Esquerda',
  'lateral_direita': 'Lateral Direita',
  'banco_dianteiro': 'Foto do Banco Dianteiro',
  'banco_traseiro': 'Foto do Banco Traseiro',
  'selfie_veiculo': 'Selfie com Veículo',
  'nota_fiscal_veiculo': 'Nota Fiscal do Veículo',
  'outro': 'Documento',
};

export interface DocumentoSolicitadoEnviado {
  id: string;
  tipo_documento: string;
  descricao: string | null;
  enviado_em: string | null;
  observacao_solicitacao: string | null;
  observacao_cliente: string | null;
  documento: {
    id: string;
    arquivo_url: string;
    nome_arquivo: string | null;
    status: string | null;
  } | null;
}

export interface DocumentoSolicitadoPendente {
  id: string;
  tipo_documento: string;
  descricao: string | null;
  observacao_solicitacao: string | null;
  solicitado_em: string | null;
  created_at: string | null;
}

interface DocumentosSolicitadosCardProps {
  documentosSolicitados: DocumentoSolicitadoEnviado[];
  documentosPendentes?: DocumentoSolicitadoPendente[];
  contratoId?: string;
  contratoLinkToken?: string | null;
  associadoId?: string;
}

export function DocumentosSolicitadosCard({
  documentosSolicitados,
  documentosPendentes = [],
  contratoId,
  contratoLinkToken,
  associadoId,
}: DocumentosSolicitadosCardProps) {
  const cancelarMutation = useCancelarDocumentosSolicitados();
  const temEnviados = documentosSolicitados && documentosSolicitados.length > 0;
  const temPendentes = documentosPendentes && documentosPendentes.length > 0;
  const linkPublico = contratoLinkToken ? `https://app.praticcar.org/acompanhar/${contratoLinkToken}` : null;

  if (!temEnviados && !temPendentes) {
    return null;
  }

  const formatTipo = (tipo: string, descricao?: string | null) => {
    if (descricao) return descricao;
    return TIPO_DOCUMENTO_LABELS[tipo] || tipo;
  };

  const handleVisualizar = (url: string) => {
    window.open(url, '_blank');
  };

  const handleCancelarUm = (id: string) => {
    cancelarMutation.mutate({ ids: [id], associadoId, contratoId });
  };

  const handleCancelarTodos = () => {
    if (!documentosPendentes || documentosPendentes.length === 0) return;
    cancelarMutation.mutate({
      ids: documentosPendentes.map((d) => d.id),
      associadoId,
      contratoId,
    });
  };

  const handleCopiarLink = async () => {
    if (!linkPublico) return;
    await navigator.clipboard.writeText(linkPublico);
    toast.success('Link público copiado');
  };

  // Cor base depende do que existe: pendentes (warning) tem prioridade visual sobre reanálise
  const corBase = temPendentes ? 'border-warning bg-warning/10 shadow-warning/10' : 'border-amber-500 bg-amber-500/10 shadow-amber-500/10';

  return (
    <Card className={`border-2 shadow-lg ${corBase}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${temPendentes ? 'bg-warning/20' : 'bg-amber-500/20'}`}>
              {temPendentes ? (
                <Clock className="h-5 w-5 text-warning" />
              ) : (
                <RefreshCw className="h-5 w-5 text-amber-500" />
              )}
            </div>
            <div>
              <CardTitle className="text-foreground text-base">
                {temPendentes ? 'Solicitações de Documentos' : 'Documentos da Reanálise'}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {temPendentes && temEnviados
                  ? 'Pendentes do cliente e itens já reenviados'
                  : temPendentes
                  ? 'Pedidos abertos ainda não enviados pelo cliente'
                  : 'Documentos enviados pelo cliente após solicitação'}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {temPendentes && (
              <Badge className="bg-warning text-white border-0 font-semibold">
                {documentosPendentes.length} aguardando cliente
              </Badge>
            )}
            {temEnviados && (
              <Badge className="bg-amber-500 text-white border-0 font-semibold">
                {documentosSolicitados.length} reenviado(s)
              </Badge>
            )}
          </div>
        </div>

        {/* Alerta visual */}
        {temPendentes && (
          <div className="mt-3 flex items-start gap-2 text-warning bg-warning/15 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold">
                Aprovação bloqueada: {documentosPendentes.length} documento(s) ainda não enviado(s) pelo cliente.
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cancele as solicitações abaixo se não forem mais necessárias para liberar a aprovação.
              </p>
            </div>
            {documentosPendentes.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                className="border-warning/50 text-warning hover:bg-warning/10 flex-shrink-0"
                onClick={handleCancelarTodos}
                disabled={cancelarMutation.isPending}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Cancelar todas
              </Button>
            )}
          </div>
        )}

        {temPendentes && linkPublico && (
          <div className="mt-3 rounded-lg border border-warning/30 bg-card p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">Link público para envio das pendências</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                {linkPublico}
              </div>
              <Button size="sm" variant="outline" className="border-warning/50 text-warning hover:bg-warning/10" onClick={handleCopiarLink}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copiar link
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(linkPublico, '_blank')}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Abrir
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              O Cadastro também pode enviar este link manualmente para o associado anexar os itens pendentes.
            </p>
          </div>
        )}

        {temEnviados && !temPendentes && (
          <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-xs font-medium">
              Revise os documentos abaixo antes de aprovar ou reprovar a proposta
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Seção: PENDENTES (não enviados pelo cliente) */}
        {temPendentes && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-warning">
              Aguardando envio pelo cliente
            </p>
            {documentosPendentes.map((doc) => (
              <div
                key={doc.id}
                className="border-l-4 border-warning pl-4 pr-3 py-3 bg-card rounded-r-lg shadow-sm flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-warning flex-shrink-0" />
                    <p className="font-medium text-sm text-foreground">
                      {formatTipo(doc.tipo_documento, doc.descricao)}
                    </p>
                  </div>
                  {(doc.solicitado_em || doc.created_at) && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Solicitado em: {format(new Date((doc.solicitado_em || doc.created_at) as string), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  )}
                  {doc.observacao_solicitacao && (
                    <div className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded p-2 border-l-2 border-muted-foreground/30">
                      <span className="font-medium">Motivo:</span> {doc.observacao_solicitacao}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-warning/50 text-warning hover:bg-warning/10 flex-shrink-0"
                  onClick={() => handleCancelarUm(doc.id)}
                  disabled={cancelarMutation.isPending}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancelar
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Seção: ENVIADOS (reanálise) */}
        {temEnviados && (
          <div className="space-y-2">
            {temPendentes && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 pt-2">
                Já reenviados pelo cliente
              </p>
            )}
            {documentosSolicitados.map((doc) => (
              <div
                key={doc.id}
                className="border-l-4 border-amber-500 pl-4 py-3 bg-card rounded-r-lg shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      <p className="font-medium text-sm text-foreground">
                        {formatTipo(doc.tipo_documento, doc.descricao)}
                      </p>
                    </div>

                    {doc.enviado_em && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Calendar className="h-3 w-3" />
                        Enviado em: {format(new Date(doc.enviado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    )}

                    {doc.observacao_solicitacao && (
                      <div className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded p-2 border-l-2 border-muted-foreground/30">
                        <span className="font-medium">Motivo da solicitação:</span> {doc.observacao_solicitacao}
                      </div>
                    )}

                    {doc.observacao_cliente && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-2 bg-primary/5 rounded p-2 border-l-2 border-primary/30">
                        <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>
                          <span className="font-medium">Obs. do cliente:</span> {doc.observacao_cliente}
                        </span>
                      </div>
                    )}
                  </div>

                  {doc.documento?.arquivo_url && (
                    <Button
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-white flex-shrink-0"
                      onClick={() => handleVisualizar(doc.documento!.arquivo_url)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Visualizar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

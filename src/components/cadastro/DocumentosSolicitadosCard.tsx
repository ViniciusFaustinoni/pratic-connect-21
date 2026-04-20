import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Eye, FileText, Calendar, MessageSquare, AlertCircle, Clock, X, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCancelarDocumentosSolicitados } from '@/hooks/useCancelarDocumentosSolicitados';

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
  associadoId?: string;
}

export function DocumentosSolicitadosCard({
  documentosSolicitados,
  documentosPendentes = [],
  contratoId,
  associadoId,
}: DocumentosSolicitadosCardProps) {
  const cancelarMutation = useCancelarDocumentosSolicitados();
  const temEnviados = documentosSolicitados && documentosSolicitados.length > 0;
  const temPendentes = documentosPendentes && documentosPendentes.length > 0;

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

  return (
    <Card className="border-2 border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <RefreshCw className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-foreground text-base">
                Documentos da Reanálise
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Documentos enviados pelo cliente após solicitação
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-amber-500 text-white border-0 font-semibold">
            {documentosSolicitados.length} novo(s)
          </Badge>
        </div>
        
        {/* Alerta visual */}
        <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <p className="text-xs font-medium">
            Revise os documentos abaixo antes de aprovar ou reprovar a proposta
          </p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
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
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Eye, FileText, Calendar, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Labels para tipos de documentos
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

interface DocumentosSolicitadosCardProps {
  documentosSolicitados: DocumentoSolicitadoEnviado[];
}

export function DocumentosSolicitadosCard({ documentosSolicitados }: DocumentosSolicitadosCardProps) {
  if (!documentosSolicitados || documentosSolicitados.length === 0) {
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
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-foreground text-base">
          <RefreshCw className="h-5 w-5 text-amber-500" />
          Documentos Solicitados
          <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 text-xs">
            Pendência Resolvida
          </Badge>
        </CardTitle>
        <CardDescription>
          Documentos enviados pelo cliente após solicitação de pendência
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {documentosSolicitados.map((doc) => (
          <div 
            key={doc.id} 
            className="border-l-4 border-amber-500 pl-4 py-3 bg-card/50 rounded-r-lg"
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
                  <div className="text-xs text-muted-foreground mt-2 bg-muted/30 rounded p-2">
                    <span className="font-medium">Solicitação:</span> {doc.observacao_solicitacao}
                  </div>
                )}
                
                {doc.observacao_cliente && (
                  <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-2 bg-primary/5 rounded p-2">
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
                  variant="outline"
                  className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 flex-shrink-0"
                  onClick={() => handleVisualizar(doc.documento!.arquivo_url)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

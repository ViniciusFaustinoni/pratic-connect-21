import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  CreditCard,
  Car,
  Home,
  Camera,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DocumentoAnexado } from '@/hooks/usePropostasPendentes';

// Labels para tipos de documento
const TIPO_DOC_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  cnh: { label: 'CNH', icon: CreditCard },
  crlv: { label: 'CRLV', icon: Car },
  comprovante_residencia: { label: 'Comprovante de Residência', icon: Home },
  selfie_documento: { label: 'Selfie com Documento', icon: Camera },
  foto_veiculo_frente: { label: 'Foto Veículo - Frente', icon: Car },
  foto_veiculo_traseira: { label: 'Foto Veículo - Traseira', icon: Car },
  foto_veiculo_lateral_esquerda: { label: 'Foto Veículo - Lateral Esq.', icon: Car },
  foto_veiculo_lateral_direita: { label: 'Foto Veículo - Lateral Dir.', icon: Car },
  foto_veiculo_hodometro: { label: 'Foto Hodômetro', icon: Car },
  foto_veiculo_chassi: { label: 'Foto Chassi', icon: Car },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  aprovado: { label: 'Aprovado', icon: CheckCircle, className: 'bg-success/20 text-success border-success' },
  pendente: { label: 'Pendente', icon: Clock, className: 'bg-warning/20 text-warning border-warning' },
  em_analise: { label: 'Em Análise', icon: AlertCircle, className: 'bg-info/20 text-info border-info' },
  reprovado: { label: 'Reprovado', icon: XCircle, className: 'bg-destructive/20 text-destructive border-destructive' },
};

interface DocumentosAnexadosCardProps {
  documentos: DocumentoAnexado[];
}

export function DocumentosAnexadosCard({ documentos }: DocumentosAnexadosCardProps) {
  const [selectedDoc, setSelectedDoc] = useState<DocumentoAnexado | null>(null);

  if (!documentos || documentos.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-purple-500" />
            Documentos Anexados
          </CardTitle>
          <CardDescription>Documentos enviados pelo associado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum documento anexado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getDocConfig = (tipo: string) => {
    return TIPO_DOC_CONFIG[tipo] || { label: tipo, icon: FileText };
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
  };

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5 text-purple-500" />
            Documentos Anexados
            <Badge variant="secondary" className="ml-2">
              {documentos.length}
            </Badge>
          </CardTitle>
          <CardDescription>Clique para visualizar cada documento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {documentos.map((doc) => {
            const docConfig = getDocConfig(doc.tipo);
            const statusConfig = getStatusConfig(doc.status);
            const DocIcon = docConfig.icon;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-background">
                    <DocIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground text-sm">{docConfig.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(doc.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn('text-xs', statusConfig.className)}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConfig.label}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Dialog de Visualização */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle>
                {selectedDoc && getDocConfig(selectedDoc.tipo).label}
              </DialogTitle>
              {selectedDoc && (
                <Badge className={cn('text-xs', getStatusConfig(selectedDoc.status).className)}>
                  {getStatusConfig(selectedDoc.status).label}
                </Badge>
              )}
            </div>
          </DialogHeader>

          {selectedDoc && (
            <div className="flex flex-col items-center py-4">
              {selectedDoc.arquivo_url.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={selectedDoc.arquivo_url}
                  className="w-full h-[60vh] rounded-lg border"
                  title="Documento PDF"
                />
              ) : (
                <img
                  src={selectedDoc.arquivo_url}
                  alt={getDocConfig(selectedDoc.tipo).label}
                  className="max-h-[60vh] max-w-full object-contain rounded-lg"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

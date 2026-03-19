import { useState } from 'react';
import { 
  FileText, Download, CheckCircle, Shield, X,
  FileSignature, Calendar, User, ExternalLink,
  XCircle, Loader2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { DocumentoAnexadoCompleto, TipoDocumentoAnexo } from '@/types/documentos';
import type { StatusDocumento } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VisualizadorDocumentoModalProps {
  documento: DocumentoAnexadoCompleto | null;
  open: boolean;
  onClose: () => void;
  onAprovar?: (docId: string) => Promise<void>;
  onReprovar?: (docId: string, motivo: string) => Promise<void>;
}

function formatDateTime(dateString: string): string {
  return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

const tipoLabels: Record<TipoDocumentoAnexo, string> = {
  cnh: 'CNH',
  crlv: 'CRLV',
  comprovante_residencia: 'Comprovante de Residência',
  selfie_documento: 'Selfie com Documento',
  contrato_assinado: 'Contrato Assinado',
  laudo_vistoria: 'Laudo de Vistoria',
  foto_veiculo_frente: 'Foto Frente',
  foto_veiculo_traseira: 'Foto Traseira',
  foto_veiculo_lateral_esquerda: 'Foto Lateral Esquerda',
  foto_veiculo_lateral_direita: 'Foto Lateral Direita',
  foto_hodometro: 'Hodômetro',
  foto_chassi: 'Chassi',
  outro: 'Outro',
};

const statusConfig: Record<StatusDocumento, { className: string; label: string }> = {
  pendente: { className: 'bg-warning/20 text-warning', label: 'Pendente' },
  em_analise: { className: 'bg-info/20 text-info', label: 'Em Análise' },
  aprovado: { className: 'bg-success/20 text-success', label: 'Aprovado' },
  reprovado: { className: 'bg-destructive/20 text-destructive', label: 'Reprovado' },
  expirado: { className: 'bg-muted text-muted-foreground', label: 'Expirado' },
};

export function VisualizadorDocumentoModal({ documento, open, onClose, onAprovar, onReprovar }: VisualizadorDocumentoModalProps) {
  const [showReprovarForm, setShowReprovarForm] = useState(false);
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [loading, setLoading] = useState(false);

  if (!documento) return null;

  const isContrato = documento.tipo === 'contrato_assinado';
  const isPdf = documento.arquivo_url?.toLowerCase().endsWith('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(documento.arquivo_url || '');
  const status = statusConfig[documento.status] || statusConfig.pendente;

  const podeAnalisar = (documento.status === 'pendente' || documento.status === 'em_analise') && (onAprovar || onReprovar);

  const handleAprovar = async () => {
    if (!onAprovar) return;
    setLoading(true);
    try {
      await onAprovar(documento.id);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleReprovar = async () => {
    if (!onReprovar || !motivoReprovacao.trim()) return;
    setLoading(true);
    try {
      await onReprovar(documento.id, motivoReprovacao.trim());
      setShowReprovarForm(false);
      setMotivoReprovacao('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setShowReprovarForm(false);
        setMotivoReprovacao('');
        onClose();
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {isContrato ? (
              <>
                <FileSignature className="h-5 w-5 text-emerald-600" />
                <span>Contrato Assinado</span>
              </>
            ) : (
              <>
                <FileText className="h-5 w-5" />
                <span>{tipoLabels[documento.tipo] || documento.tipo}</span>
              </>
            )}
            
            <Badge className={cn('text-xs border-0', status.className)}>
              {status.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Informações do Contrato Assinado */}
        {isContrato && (documento.assinado_em || documento.validado_autentique) && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-4">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium mb-3">
              <Shield className="h-4 w-4" />
              <span>Documento assinado digitalmente</span>
            </div>
            
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              {documento.assinado_por && (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <User className="h-4 w-4" />
                  <span>Assinado por: <strong>{documento.assinado_por}</strong></span>
                </div>
              )}
              
              {documento.assinado_em && (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Calendar className="h-4 w-4" />
                  <span>Data: <strong>{formatDateTime(documento.assinado_em)}</strong></span>
                </div>
              )}
              
              {documento.validado_autentique && (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 sm:col-span-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>Validado via plataforma Autentique</span>
                  {documento.autentique_id && (
                    <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-600">
                      ID: {documento.autentique_id}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Informações do documento */}
        <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
          {documento.nome_arquivo && (
            <span>Arquivo: <strong className="text-foreground">{documento.nome_arquivo}</strong></span>
          )}
          <span>Enviado em: <strong className="text-foreground">{formatDateTime(documento.created_at)}</strong></span>
        </div>

        <Separator />

        {/* Visualizador do documento */}
        <div className="flex-1 min-h-0 overflow-auto bg-muted/50 rounded-lg">
          {isPdf ? (
            <object
              data={documento.arquivo_url}
              type="application/pdf"
              className="w-full h-[500px] rounded-lg"
            >
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(documento.arquivo_url)}&embedded=true`}
                className="w-full h-[500px] rounded-lg border-0"
                title={tipoLabels[documento.tipo] || 'Documento'}
              />
            </object>
          ) : isImage ? (
            <div className="flex items-center justify-center p-4">
              <img 
                src={documento.arquivo_url}
                alt={documento.nome_arquivo || tipoLabels[documento.tipo]}
                className="max-w-full max-h-[500px] object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-16 w-16 mb-4 opacity-50" />
              <p className="font-medium">Não é possível visualizar este tipo de arquivo</p>
              <p className="text-sm">Faça o download para abrir</p>
            </div>
          )}
        </div>

        {/* Form de reprovação */}
        {showReprovarForm && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <p className="text-sm font-medium text-destructive">Motivo da reprovação:</p>
            <Textarea
              value={motivoReprovacao}
              onChange={(e) => setMotivoReprovacao(e.target.value)}
              placeholder="Descreva o motivo da reprovação..."
              className="min-h-[80px]"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowReprovarForm(false); setMotivoReprovacao(''); }} disabled={loading}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={handleReprovar} disabled={loading || !motivoReprovacao.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                Confirmar Reprovação
              </Button>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex justify-between items-center pt-4 border-t flex-wrap gap-2">
          <div className="text-xs text-muted-foreground">
            {documento.analisado_por && documento.analisado_em && (
              <span>
                Analisado por {documento.analisado_por} em {formatDateTime(documento.analisado_em)}
              </span>
            )}
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {/* Botões de análise */}
            {podeAnalisar && !showReprovarForm && (
              <>
                {onReprovar && (
                  <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setShowReprovarForm(true)} disabled={loading}>
                    <XCircle className="h-4 w-4 mr-1" />
                    Reprovar
                  </Button>
                )}
                {onAprovar && (
                  <Button className="bg-success hover:bg-success/90 text-white" onClick={handleAprovar} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                    Aprovar
                  </Button>
                )}
              </>
            )}

            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-1" />
              Fechar
            </Button>
            
            <Button variant="outline" asChild>
              <a href={documento.arquivo_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir em nova aba
              </a>
            </Button>
            
            <Button asChild>
              <a href={documento.arquivo_url} download={documento.nome_arquivo || 'documento'}>
                <Download className="h-4 w-4 mr-1" />
                Baixar
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

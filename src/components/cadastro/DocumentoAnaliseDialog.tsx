import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, ExternalLink, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAnaliseDocumento, useDocumento } from '@/hooks/useDocumentos';
import { useDocumentoOCR, type OCRResult } from '@/hooks/useDocumentoOCR';
import { TIPO_DOCUMENTO_LABELS, STATUS_DOCUMENTO_LABELS, type TipoDocumento, type StatusDocumento } from '@/types/database';
import { toast } from 'sonner';

interface DocumentoAnaliseDialogProps {
  documentoId: string;
  open: boolean;
  onClose: () => void;
}

export function DocumentoAnaliseDialog({
  documentoId,
  open,
  onClose,
}: DocumentoAnaliseDialogProps) {
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [action, setAction] = useState<'aprovar' | 'reprovar' | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);

  const { data: documento, isLoading } = useDocumento(documentoId);
  const analise = useAnaliseDocumento();
  const ocr = useDocumentoOCR();

  const handleAnalise = async (status: 'aprovado' | 'reprovado') => {
    if (status === 'reprovado' && !motivoReprovacao.trim()) {
      toast.error('Informe o motivo da reprovação');
      return;
    }

    setAction(status === 'aprovado' ? 'aprovar' : 'reprovar');

    try {
      await analise.mutateAsync({
        id: documentoId,
        status,
        motivo_reprovacao: status === 'reprovado' ? motivoReprovacao : undefined,
      });

      toast.success(
        status === 'aprovado' 
          ? 'Documento aprovado com sucesso' 
          : 'Documento reprovado'
      );
      handleClose();
    } catch (error) {
      toast.error('Erro ao analisar documento');
    } finally {
      setAction(null);
    }
  };

  const handleOCR = async () => {
    if (!documento?.arquivo_url) {
      toast.error('URL do documento não disponível');
      return;
    }

    try {
      const result = await ocr.mutateAsync({
        url: documento.arquivo_url,
        tipoEsperado: documento.tipo,
        cpfEsperado: documento.associados?.cpf,
        nomeEsperado: documento.associados?.nome,
      });

      setOcrResult(result);

      // Pré-preencher motivo se a IA sugerir reprovação
      if (result.sugestao === 'reprovar' && result.motivo) {
        setMotivoReprovacao(result.motivo);
      }

      toast.success('Análise de IA concluída');
    } catch (error) {
      console.error('OCR error:', error);
      toast.error('Erro ao analisar documento com IA');
    }
  };

  const handleClose = () => {
    setOcrResult(null);
    setMotivoReprovacao('');
    onClose();
  };

  const statusColors: Record<StatusDocumento, string> = {
    pendente: 'bg-yellow-500 text-white',
    em_analise: 'bg-blue-500 text-white',
    aprovado: 'bg-green-500 text-white',
    reprovado: 'bg-destructive text-destructive-foreground',
    expirado: 'bg-gray-500 text-white',
  };

  const getSugestaoColor = (sugestao: string) => {
    switch (sugestao) {
      case 'aprovar':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'reprovar':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getSugestaoIcon = (sugestao: string) => {
    switch (sugestao) {
      case 'aprovar':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'reprovar':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Analisar Documento</DialogTitle>
          <DialogDescription>
            Revise o documento e aprove ou reprove conforme necessário.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : documento ? (
          <div className="space-y-4">
            {/* Info do documento */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <Badge variant="outline">
                  {TIPO_DOCUMENTO_LABELS[documento.tipo as TipoDocumento]}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Status Atual</p>
                <Badge className={statusColors[documento.status as StatusDocumento]}>
                  {STATUS_DOCUMENTO_LABELS[documento.status as StatusDocumento]}
                </Badge>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Arquivo</p>
                <p className="font-mono text-xs">{documento.nome_arquivo}</p>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => window.open(documento.arquivo_url, '_blank')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Visualizar
              </Button>
              <Button 
                variant="secondary"
                className="flex-1"
                onClick={handleOCR}
                disabled={ocr.isPending}
              >
                {ocr.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Analisar com IA
              </Button>
            </div>

            {/* Resultado do OCR */}
            {ocrResult && (
              <Card className={`border-2 ${getSugestaoColor(ocrResult.sugestao)}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    {getSugestaoIcon(ocrResult.sugestao)}
                    Análise de IA - Sugestão: {ocrResult.sugestao.toUpperCase()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Tipo detectado:</span>
                      <p className="font-medium">{ocrResult.tipo}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Confiança:</span>
                      <p className="font-medium">{ocrResult.confianca}%</p>
                    </div>
                    {ocrResult.nome && (
                      <div>
                        <span className="text-muted-foreground">Nome:</span>
                        <p className="font-medium">{ocrResult.nome}</p>
                      </div>
                    )}
                    {ocrResult.cpf && (
                      <div>
                        <span className="text-muted-foreground">CPF:</span>
                        <p className="font-medium">{ocrResult.cpf}</p>
                      </div>
                    )}
                    {ocrResult.validade && (
                      <div>
                        <span className="text-muted-foreground">Validade:</span>
                        <p className="font-medium">{ocrResult.validade}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Badge variant={ocrResult.legivel ? 'default' : 'destructive'}>
                      {ocrResult.legivel ? 'Legível' : 'Ilegível'}
                    </Badge>
                    <Badge variant={ocrResult.valido ? 'default' : 'destructive'}>
                      {ocrResult.valido ? 'Válido' : 'Inválido'}
                    </Badge>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <span className="text-muted-foreground">Motivo:</span>
                    <p className="font-medium">{ocrResult.motivo}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Motivo de reprovação */}
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da reprovação (obrigatório se reprovar)</Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo da reprovação..."
                value={motivoReprovacao}
                onChange={(e) => setMotivoReprovacao(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Documento não encontrado
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleAnalise('reprovado')}
            disabled={analise.isPending || !documento}
          >
            {action === 'reprovar' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <XCircle className="mr-2 h-4 w-4" />
            Reprovar
          </Button>
          <Button
            onClick={() => handleAnalise('aprovado')}
            disabled={analise.isPending || !documento}
          >
            {action === 'aprovar' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckCircle className="mr-2 h-4 w-4" />
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

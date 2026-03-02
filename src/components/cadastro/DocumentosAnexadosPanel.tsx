import { Paperclip, FileSignature, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DocumentoAnexadoCard } from './DocumentoAnexadoCard';
import type { DocumentoAnexadoCompleto } from '@/types/documentos';
import type { StatusDocumento } from '@/types/database';

interface DocumentosAnexadosPanelProps {
  documentos: DocumentoAnexadoCompleto[];
  onViewDocumento: (documento: DocumentoAnexadoCompleto) => void;
  onAprovarDocumento?: (docId: string) => Promise<void>;
  onReprovarDocumento?: (docId: string, motivo: string) => Promise<void>;
}

export function DocumentosAnexadosPanel({ documentos, onViewDocumento, onAprovarDocumento, onReprovarDocumento }: DocumentosAnexadosPanelProps) {
  // Verificar se tem contrato assinado
  const contratoAssinado = documentos.find(d => d.tipo === 'contrato_assinado');
  const temContratoAprovado = contratoAssinado?.status === 'aprovado';
  
  // Ordenar: Contrato primeiro, depois por status (pendentes primeiro)
  const statusOrder: Record<StatusDocumento, number> = { 
    pendente: 0, 
    em_analise: 1, 
    reprovado: 2, 
    aprovado: 3,
    expirado: 4
  };
  
  const documentosOrdenados = [...documentos].sort((a, b) => {
    // Contrato sempre primeiro
    if (a.tipo === 'contrato_assinado') return -1;
    if (b.tipo === 'contrato_assinado') return 1;
    
    // Pendentes antes de aprovados
    return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
  });

  // Contadores
  const pendentes = documentos.filter(d => d.status === 'pendente').length;
  const aprovados = documentos.filter(d => d.status === 'aprovado').length;
  const reprovados = documentos.filter(d => d.status === 'reprovado').length;
  const emAnalise = documentos.filter(d => d.status === 'em_analise').length;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg text-foreground">
            <Paperclip className="h-5 w-5 text-primary" />
            Documentações Anexadas
            <Badge variant="secondary" className="ml-1">
              {documentos.length}
            </Badge>
          </CardTitle>
          
          {/* Resumo de status */}
          <div className="flex items-center gap-2 text-xs">
            {pendentes > 0 && (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                {pendentes} pendente(s)
              </Badge>
            )}
            {emAnalise > 0 && (
              <Badge variant="outline" className="bg-info/10 text-info border-info/30">
                {emAnalise} em análise
              </Badge>
            )}
            {aprovados > 0 && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                {aprovados} aprovado(s)
              </Badge>
            )}
            {reprovados > 0 && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                {reprovados} reprovado(s)
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Alerta se tem contrato assinado e aprovado */}
        {temContratoAprovado && (
          <Alert className="border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30">
            <FileSignature className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-800 dark:text-emerald-300">
              <span className="font-medium">Contrato assinado e validado.</span> Este documento foi assinado 
              digitalmente via Autentique e não requer aprovação manual.
            </AlertDescription>
          </Alert>
        )}

        {/* Alerta se não tem contrato */}
        {!contratoAssinado && documentos.length > 0 && (
          <Alert className="border-warning/50 bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              <span className="font-medium">Contrato não localizado.</span> O contrato assinado ainda não 
              foi recebido ou processado pelo sistema.
            </AlertDescription>
          </Alert>
        )}

        {/* Grid de documentos */}
        {documentos.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {documentosOrdenados.map((doc) => (
              <DocumentoAnexadoCard
                key={doc.id}
                documento={doc}
                onView={onViewDocumento}
                onAprovar={onAprovarDocumento}
                onReprovar={onReprovarDocumento}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Paperclip className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum documento anexado</p>
            <p className="text-sm">Os documentos enviados aparecerão aqui</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

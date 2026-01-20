import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertTriangle, Upload, FileCheck, Loader2, FileText, CheckCircle2, Clock } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { motion } from 'framer-motion';
import type { DocumentoPendentePublico } from '@/hooks/useCotacaoContratacao';

// Labels para tipos de documentos
const TIPO_DOCUMENTO_LABELS: Record<string, string> = {
  'cnh': 'CNH - Carteira Nacional de Habilitação',
  'crlv': 'CRLV - Documento do Veículo',
  'comprovante_residencia': 'Comprovante de Residência',
  'foto_frontal_veiculo': 'Foto do Veículo - Frente',
  'foto_traseira_veiculo': 'Foto do Veículo - Traseira',
  'foto_lateral_esquerda': 'Foto do Veículo - Lateral Esquerda',
  'foto_lateral_direita': 'Foto do Veículo - Lateral Direita',
  'foto_painel': 'Foto do Painel',
  'foto_hodometro': 'Foto do Hodômetro',
  'outro': 'Documento Solicitado',
};

interface DocumentosPendentesPublicoProps {
  associadoId: string;
  docsPendentes: DocumentoPendentePublico[];
  onTodosEnviados: () => void;
}

interface DocUploadState {
  file: File | null;
  observacao: string;
  uploading: boolean;
  enviado: boolean;
}

export function DocumentosPendentesPublico({ 
  associadoId, 
  docsPendentes,
  onTodosEnviados 
}: DocumentosPendentesPublicoProps) {
  const [uploadStates, setUploadStates] = useState<Record<string, DocUploadState>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const formatTipoDocumento = (tipo: string, descricao?: string | null) => {
    if (descricao) return descricao;
    return TIPO_DOCUMENTO_LABELS[tipo] || tipo;
  };

  const handleFileSelect = (docId: string, file: File | null) => {
    setUploadStates(prev => ({
      ...prev,
      [docId]: {
        ...prev[docId],
        file,
        observacao: prev[docId]?.observacao || '',
        uploading: false,
        enviado: prev[docId]?.enviado || false,
      }
    }));
  };

  const handleObservacaoChange = (docId: string, observacao: string) => {
    setUploadStates(prev => ({
      ...prev,
      [docId]: {
        ...prev[docId],
        file: prev[docId]?.file || null,
        observacao,
        uploading: prev[docId]?.uploading || false,
        enviado: prev[docId]?.enviado || false,
      }
    }));
  };

  const handleEnviarDocumento = async (doc: DocumentoPendentePublico) => {
    const state = uploadStates[doc.id];
    if (!state?.file) {
      toast.error('Selecione um arquivo para enviar');
      return;
    }

    setUploadStates(prev => ({
      ...prev,
      [doc.id]: { ...prev[doc.id], uploading: true }
    }));

    try {
      const file = state.file;
      const fileExt = file.name.split('.').pop();
      const fileName = `${associadoId}/${doc.tipo_documento}_${Date.now()}.${fileExt}`;

      // 1. Upload do arquivo para o Storage (bucket cotacoes-docs que aceita anônimos)
      const { error: uploadError } = await publicSupabase.storage
        .from('cotacoes-docs')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw new Error('Erro ao enviar arquivo. Tente novamente.');
      }

      // 2. Pegar URL pública
      const { data: { publicUrl } } = publicSupabase.storage
        .from('cotacoes-docs')
        .getPublicUrl(fileName);

      // 3. Criar registro na tabela documentos
      const { data: novoDoc, error: docError } = await publicSupabase
        .from('documentos')
        .insert({
          associado_id: associadoId,
          tipo: doc.tipo_documento as 'cnh' | 'crlv' | 'comprovante_residencia' | 'foto_frontal_veiculo' | 'foto_traseira_veiculo' | 'foto_lateral_esquerda' | 'foto_lateral_direita' | 'foto_painel' | 'foto_hodometro' | 'outro',
          arquivo_url: publicUrl,
          nome_arquivo: file.name,
          tamanho_bytes: file.size,
          status: 'pendente',
        })
        .select('id')
        .single();

      if (docError) {
        console.error('Erro ao criar documento:', docError);
        throw new Error('Erro ao registrar documento. Tente novamente.');
      }

      // 4. Atualizar documento_solicitado
      const { error: updateError } = await publicSupabase
        .from('documentos_solicitados')
        .update({
          status: 'enviado',
          enviado_em: new Date().toISOString(),
          documento_id: novoDoc.id,
          observacao_cliente: state.observacao || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', doc.id);

      if (updateError) {
        console.error('Erro ao atualizar doc solicitado:', updateError);
        throw updateError;
      }

      // Marcar como enviado
      setUploadStates(prev => ({
        ...prev,
        [doc.id]: { ...prev[doc.id], uploading: false, enviado: true }
      }));

      toast.success('Documento enviado com sucesso!');

      // Verificar se todos foram enviados
      const docsEnviados = docsPendentes.filter(d => 
        d.id === doc.id || uploadStates[d.id]?.enviado
      );
      
      if (docsEnviados.length === docsPendentes.length) {
        // Todos enviados - atualizar status do associado para em_analise
        await publicSupabase
          .from('associados')
          .update({
            status: 'em_analise',
            updated_at: new Date().toISOString(),
          })
          .eq('id', associadoId);

        toast.success('Todos os documentos foram enviados! Aguarde a análise.');
        
        // Aguardar um pouco e chamar callback
        setTimeout(() => {
          onTodosEnviados();
        }, 1500);
      }

    } catch (error) {
      console.error('Erro ao enviar documento:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar documento');
      setUploadStates(prev => ({
        ...prev,
        [doc.id]: { ...prev[doc.id], uploading: false }
      }));
    }
  };

  // Verificar quantos já foram enviados nesta sessão
  const enviados = docsPendentes.filter(d => uploadStates[d.id]?.enviado).length;
  const pendentes = docsPendentes.length - enviados;

  return (
    <Card className="border-amber-500/30 bg-card/80 backdrop-blur-xl">
      <CardHeader className="text-center pb-4">
        <motion.div 
          className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-4"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        >
          <AlertTriangle className="h-8 w-8 text-amber-500" />
        </motion.div>
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-2 w-fit mx-auto">
          Documentos Pendentes
        </Badge>
        <CardTitle className="text-xl">Documentos Solicitados</CardTitle>
        <p className="text-muted-foreground text-sm mt-2">
          O setor de cadastro solicitou os documentos abaixo. Por favor, envie-os para continuar a análise.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Contador */}
        <div className="flex items-center justify-center gap-4 text-sm mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            <span className="text-muted-foreground">
              {pendentes} pendente{pendentes !== 1 ? 's' : ''}
            </span>
          </div>
          {enviados > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-muted-foreground">
                {enviados} enviado{enviados !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Lista de documentos */}
        <div className="space-y-4">
          {docsPendentes.map((doc, index) => {
            const state = uploadStates[doc.id] || { file: null, observacao: '', uploading: false, enviado: false };
            const isEnviado = state.enviado;

            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`
                  border rounded-lg p-4 transition-colors
                  ${isEnviado 
                    ? 'bg-success/5 border-success/30' 
                    : 'bg-muted/30 border-border/50 hover:border-primary/30'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    p-2 rounded-lg
                    ${isEnviado ? 'bg-success/10' : 'bg-primary/10'}
                  `}>
                    {isEnviado ? (
                      <FileCheck className="h-5 w-5 text-success" />
                    ) : (
                      <FileText className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">
                        {formatTipoDocumento(doc.tipo_documento, doc.descricao)}
                      </h4>
                      {isEnviado && (
                        <Badge variant="outline" className="text-xs border-success/30 text-success">
                          Enviado
                        </Badge>
                      )}
                    </div>
                    
                    {doc.observacao_solicitacao && (
                      <p className="text-xs text-muted-foreground mb-3">
                        <strong>Observação:</strong> {doc.observacao_solicitacao}
                      </p>
                    )}

                    {!isEnviado && (
                      <div className="space-y-3 mt-3">
                        {/* Input de arquivo */}
                        <div>
                          <input
                            ref={el => fileInputRefs.current[doc.id] = el}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => handleFileSelect(doc.id, e.target.files?.[0] || null)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full justify-start text-left"
                            onClick={() => fileInputRefs.current[doc.id]?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {state.file ? state.file.name : 'Selecionar arquivo'}
                          </Button>
                        </div>

                        {/* Observação opcional */}
                        {state.file && (
                          <>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Observação (opcional)
                              </Label>
                              <Textarea
                                placeholder="Adicione uma observação se necessário..."
                                value={state.observacao}
                                onChange={(e) => handleObservacaoChange(doc.id, e.target.value)}
                                className="mt-1 text-sm resize-none"
                                rows={2}
                              />
                            </div>

                            {/* Botão enviar */}
                            <Button
                              onClick={() => handleEnviarDocumento(doc)}
                              disabled={state.uploading}
                              className="w-full"
                              size="sm"
                            >
                              {state.uploading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Enviar Documento
                                </>
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Aviso */}
        <div className="flex items-start gap-2 bg-muted/30 rounded-lg p-3 mt-4">
          <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Após enviar todos os documentos, sua proposta voltará para análise automática.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
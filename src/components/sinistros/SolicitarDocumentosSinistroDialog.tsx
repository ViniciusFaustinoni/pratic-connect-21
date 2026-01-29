import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Camera, FileCheck, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Tipos de documentos para sinistros
export const TIPOS_DOCUMENTOS_SINISTRO = [
  { id: 'bo', label: 'Boletim de Ocorrência (B.O.)', icon: FileText, categoria: 'documentos' },
  { id: 'cnh', label: 'CNH do Condutor', icon: FileCheck, categoria: 'documentos' },
  { id: 'crlv', label: 'CRLV do Veículo', icon: FileCheck, categoria: 'documentos' },
  { id: 'laudo_tecnico', label: 'Laudo Técnico', icon: FileText, categoria: 'documentos' },
  { id: 'orcamento_reparo', label: 'Orçamento de Reparo', icon: FileText, categoria: 'documentos' },
  { id: 'comprovante_bancario', label: 'Comprovante Bancário', icon: FileText, categoria: 'documentos' },
  { id: 'foto_dano_frontal', label: 'Foto do Dano - Frontal', icon: Camera, categoria: 'fotos' },
  { id: 'foto_dano_traseiro', label: 'Foto do Dano - Traseiro', icon: Camera, categoria: 'fotos' },
  { id: 'foto_dano_lateral_esquerda', label: 'Foto do Dano - Lateral Esquerda', icon: Camera, categoria: 'fotos' },
  { id: 'foto_dano_lateral_direita', label: 'Foto do Dano - Lateral Direita', icon: Camera, categoria: 'fotos' },
  { id: 'foto_local', label: 'Foto do Local do Acidente', icon: Camera, categoria: 'fotos' },
  { id: 'foto_painel', label: 'Foto do Painel (Hodômetro)', icon: Camera, categoria: 'fotos' },
  { id: 'outros', label: 'Outros (especificar)', icon: FileText, categoria: 'outros' },
];

interface SolicitarDocumentosSinistroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistroId: string;
  protocolo: string;
  statusAtual: string;
  associadoId?: string;
}

export function SolicitarDocumentosSinistroDialog({
  open,
  onOpenChange,
  sinistroId,
  protocolo,
  statusAtual,
  associadoId,
}: SolicitarDocumentosSinistroDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [documentosSelecionados, setDocumentosSelecionados] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState('');

  // Buscar dados do associado para enviar WhatsApp
  const { data: associado } = useQuery({
    queryKey: ['associado-sinistro', associadoId],
    queryFn: async () => {
      if (!associadoId) return null;
      const { data } = await supabase
        .from('associados')
        .select('id, nome, telefone, whatsapp')
        .eq('id', associadoId)
        .single();
      return data;
    },
    enabled: !!associadoId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (documentosSelecionados.length === 0) {
        throw new Error('Selecione pelo menos um documento');
      }

      // 1. Inserir documentos pendentes
      const docsToInsert = documentosSelecionados.map(tipo => ({
        sinistro_id: sinistroId,
        tipo,
        nome_arquivo: TIPOS_DOCUMENTOS_SINISTRO.find(d => d.id === tipo)?.label || tipo,
        arquivo_url: '', // Vazio até o associado enviar
        status: 'pendente',
      }));

      const { error: docsError } = await supabase
        .from('sinistro_documentos')
        .insert(docsToInsert);

      if (docsError) throw docsError;

      // 2. Atualizar status do sinistro para documentacao_pendente
      const { error: statusError } = await supabase
        .from('sinistros')
        .update({ 
          status: 'documentacao_pendente',
          updated_at: new Date().toISOString()
        })
        .eq('id', sinistroId);

      if (statusError) throw statusError;

      // 3. Registrar no histórico
      const tiposLabels = documentosSelecionados
        .map(id => TIPOS_DOCUMENTOS_SINISTRO.find(d => d.id === id)?.label || id)
        .join(', ');

      const { error: histError } = await supabase
        .from('sinistro_historico')
        .insert({
          sinistro_id: sinistroId,
          status_anterior: statusAtual,
          status_novo: 'documentacao_pendente',
          usuario_id: user?.id,
          observacao: `Documentos solicitados: ${tiposLabels}${observacoes ? `. Obs: ${observacoes}` : ''}`,
        });

      if (histError) console.error('Erro ao registrar histórico:', histError);

      // 4. ENVIAR WHATSAPP COM LISTA DE DOCUMENTOS
      const telefone = associado?.whatsapp || associado?.telefone;
      if (telefone) {
        const documentosFormatados = documentosSelecionados
          .map(id => TIPOS_DOCUMENTOS_SINISTRO.find(d => d.id === id)?.label || id)
          .join('\n• ');

        const mensagem = `📄 *Documentos Solicitados*\n\nPara dar continuidade ao seu sinistro *${protocolo}*, precisamos dos seguintes documentos:\n\n• ${documentosFormatados}${observacoes ? `\n\n📝 *Observação:* ${observacoes}` : ''}\n\n⏰ *Prazo:* 48 horas\n\nEnvie pelo app ou responda esta mensagem com as fotos.`;

        try {
          await supabase.functions.invoke('whatsapp-send-text', {
            body: {
              telefone: telefone.replace(/\D/g, ''),
              mensagem,
            },
          });
          console.log('[SolicitarDocumentos] WhatsApp enviado com sucesso');
        } catch (whatsErr) {
          console.error('[SolicitarDocumentos] Erro ao enviar WhatsApp:', whatsErr);
          // Não falhar a operação por erro de WhatsApp
        }
      }
    },
    onSuccess: () => {
      toast.success('Documentos solicitados com sucesso!', {
        description: 'O associado foi notificado via WhatsApp sobre a pendência.',
      });
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-documentos', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      handleClose();
    },
    onError: (error) => {
      console.error('Erro ao solicitar documentos:', error);
      toast.error('Erro ao solicitar documentos');
    },
  });

  const handleClose = () => {
    setDocumentosSelecionados([]);
    setObservacoes('');
    onOpenChange(false);
  };

  const toggleDocumento = (id: string) => {
    setDocumentosSelecionados(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const documentosPorCategoria = {
    documentos: TIPOS_DOCUMENTOS_SINISTRO.filter(d => d.categoria === 'documentos'),
    fotos: TIPOS_DOCUMENTOS_SINISTRO.filter(d => d.categoria === 'fotos'),
    outros: TIPOS_DOCUMENTOS_SINISTRO.filter(d => d.categoria === 'outros'),
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Solicitar Documentos
          </DialogTitle>
          <DialogDescription>
            Selecione os documentos que o associado deve enviar para o sinistro {protocolo}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-6 py-4">
            {/* Documentos */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Documentos
              </h4>
              <div className="space-y-2">
                {documentosPorCategoria.documentos.map(doc => {
                  const DocIcon = doc.icon;
                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        documentosSelecionados.includes(doc.id)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleDocumento(doc.id)}
                    >
                      <Checkbox
                        id={doc.id}
                        checked={documentosSelecionados.includes(doc.id)}
                        onCheckedChange={() => toggleDocumento(doc.id)}
                      />
                      <DocIcon className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={doc.id} className="flex-1 cursor-pointer">
                        {doc.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fotos */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2 text-sm">
                <Camera className="h-4 w-4" />
                Fotos do Veículo/Local
              </h4>
              <div className="space-y-2">
                {documentosPorCategoria.fotos.map(doc => {
                  const DocIcon = doc.icon;
                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        documentosSelecionados.includes(doc.id)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleDocumento(doc.id)}
                    >
                      <Checkbox
                        id={doc.id}
                        checked={documentosSelecionados.includes(doc.id)}
                        onCheckedChange={() => toggleDocumento(doc.id)}
                      />
                      <DocIcon className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={doc.id} className="flex-1 cursor-pointer">
                        {doc.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Outros */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Outros
              </h4>
              <div className="space-y-2">
                {documentosPorCategoria.outros.map(doc => {
                  const DocIcon = doc.icon;
                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        documentosSelecionados.includes(doc.id)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleDocumento(doc.id)}
                    >
                      <Checkbox
                        id={doc.id}
                        checked={documentosSelecionados.includes(doc.id)}
                        onCheckedChange={() => toggleDocumento(doc.id)}
                      />
                      <DocIcon className="h-4 w-4 text-muted-foreground" />
                      <Label htmlFor={doc.id} className="flex-1 cursor-pointer">
                        {doc.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Observações */}
            <div>
              <Label htmlFor="observacoes" className="text-sm font-medium">
                Observações (opcional)
              </Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Instruções adicionais para o associado..."
                className="mt-2"
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={documentosSelecionados.length === 0 || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Solicitando...
              </>
            ) : (
              <>
                Solicitar {documentosSelecionados.length} documento(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

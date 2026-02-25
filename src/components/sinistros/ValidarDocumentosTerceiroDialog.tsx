import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, FileText, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TIPO_DOCUMENTO_LABELS } from '@/types/terceiros';
import type { SinistroTerceiro, SinistroTerceiroDocumento } from '@/types/terceiros';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terceiro: SinistroTerceiro;
  documentos: SinistroTerceiroDocumento[];
}

export function ValidarDocumentosTerceiroDialog({ open, onOpenChange, terceiro, documentos }: Props) {
  const queryClient = useQueryClient();
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [docSelecionado, setDocSelecionado] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const handleAprovar = async (docId: string) => {
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('sinistro_terceiro_documentos')
        .update({ status: 'aprovado', aprovado_em: new Date().toISOString() } as any)
        .eq('id', docId);
      if (error) throw error;
      toast.success('Documento aprovado');
      queryClient.invalidateQueries({ queryKey: ['terceiro-documentos', terceiro.id] });
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleRejeitar = async (docId: string) => {
    if (!motivoRejeicao.trim()) {
      toast.error('Informe o motivo da rejeição');
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('sinistro_terceiro_documentos')
        .update({ status: 'rejeitado', motivo_rejeicao: motivoRejeicao } as any)
        .eq('id', docId);
      if (error) throw error;
      toast.success('Documento rejeitado');
      setMotivoRejeicao('');
      setDocSelecionado(null);
      queryClient.invalidateQueries({ queryKey: ['terceiro-documentos', terceiro.id] });
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos — {terceiro.nome}
          </DialogTitle>
        </DialogHeader>

        {documentos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum documento enviado pelo terceiro.
          </p>
        ) : (
          <div className="space-y-3">
            {documentos.map((doc) => {
              const label = TIPO_DOCUMENTO_LABELS[doc.tipo as keyof typeof TIPO_DOCUMENTO_LABELS] || doc.tipo;
              return (
                <div key={doc.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">{doc.nome}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge className={`text-xs ${
                        doc.status === 'aprovado' ? 'bg-green-100 text-green-800' :
                        doc.status === 'rejeitado' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {doc.status === 'aprovado' ? 'Aprovado' : doc.status === 'rejeitado' ? 'Rejeitado' : 'Pendente'}
                      </Badge>
                      <Button variant="ghost" size="icon" asChild>
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  {doc.status === 'pendente' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600"
                        disabled={salvando}
                        onClick={() => handleAprovar(doc.id)}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Aprovar
                      </Button>
                      {docSelecionado === doc.id ? (
                        <div className="flex-1 flex gap-2">
                          <Input
                            placeholder="Motivo da rejeição"
                            value={motivoRejeicao}
                            onChange={(e) => setMotivoRejeicao(e.target.value)}
                            className="text-sm"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={salvando}
                            onClick={() => handleRejeitar(doc.id)}
                          >
                            {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Rejeitar'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => setDocSelecionado(doc.id)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Rejeitar
                        </Button>
                      )}
                    </div>
                  )}

                  {doc.status === 'rejeitado' && doc.motivo_rejeicao && (
                    <p className="text-xs text-red-600">Motivo: {doc.motivo_rejeicao}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

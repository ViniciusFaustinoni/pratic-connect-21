import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface RegistrarAcaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultaId?: string;
  processoId?: string;
  casoId: string;
}

export function RegistrarAcaoModal({ open, onOpenChange, consultaId, processoId, casoId }: RegistrarAcaoModalProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);

  const { mutate: registrar, isPending } = useMutation({
    mutationFn: async () => {
      if (!descricao.trim()) throw new Error('Descrição obrigatória');

      let arquivoUrl: string | null = null;
      let arquivoNome: string | null = null;

      // Upload se tiver arquivo
      if (arquivo) {
        const ext = arquivo.name.split('.').pop();
        const path = `juridico/${casoId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('sinistros')
          .upload(path, arquivo);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('sinistros').getPublicUrl(path);
        arquivoUrl = urlData.publicUrl;
        arquivoNome = arquivo.name;
      }

      // Inserir no histórico
      const { error: histError } = await supabase.from('caso_juridico_historico').insert({
        consulta_id: consultaId || null,
        processo_id: processoId || null,
        tipo: 'acao_registrada',
        titulo: 'Ação registrada manualmente',
        descricao: descricao.trim(),
        usuario_id: profile?.id,
      });
      if (histError) throw histError;

      // Se tem arquivo, inserir como documento
      if (arquivoUrl) {
        const { error: docError } = await supabase.from('caso_juridico_documentos').insert({
          consulta_id: consultaId || null,
          processo_id: processoId || null,
          titulo: arquivoNome || 'Documento',
          arquivo_url: arquivoUrl,
          arquivo_nome: arquivoNome,
          tipo: 'outro',
          registrado_por: profile?.id,
        });
        if (docError) throw docError;
      }
    },
    onSuccess: () => {
      toast.success('Ação registrada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['caso-historico'] });
      queryClient.invalidateQueries({ queryKey: ['caso-documentos'] });
      setDescricao('');
      setArquivo(null);
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao registrar ação'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Ação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Descrição *</Label>
            <Textarea
              placeholder="Descreva a ação realizada..."
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={5}
            />
          </div>
          <div>
            <Label>Arquivo (opcional)</Label>
            <div className="mt-1">
              <Input
                type="file"
                onChange={e => setArquivo(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              {arquivo && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Upload className="h-3 w-3" /> {arquivo.name}
                </p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => registrar()} disabled={isPending || !descricao.trim()}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

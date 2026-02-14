import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Upload, X, FileText, Image, Video, Mic, Search, Radio, File } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const TIPOS_EVIDENCIA = [
  { value: 'documento', label: 'Documento', icon: FileText },
  { value: 'foto', label: 'Foto', icon: Image },
  { value: 'video', label: 'Vídeo', icon: Video },
  { value: 'depoimento', label: 'Depoimento de Testemunha', icon: Mic },
  { value: 'laudo_tecnico', label: 'Laudo Técnico', icon: FileText },
  { value: 'relatorio_rastreador', label: 'Relatório do Rastreador', icon: Radio },
  { value: 'pesquisa_externa', label: 'Pesquisa Externa', icon: Search },
  { value: 'outro', label: 'Outro', icon: File },
] as const;

interface NovaEvidenciaModalProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
}

export function NovaEvidenciaModal({ open, onClose, sinistroId }: NovaEvidenciaModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tipo, setTipo] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) setArquivo(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    accept: {
      'image/*': [],
      'video/*': [],
      'application/pdf': [],
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tipo || !titulo.trim()) throw new Error('Preencha tipo e título');

      let arquivoUrl: string | null = null;
      let arquivoNome: string | null = null;

      if (arquivo) {
        const ts = Date.now();
        const path = `${sinistroId}/evidencias/${ts}_${arquivo.name}`;
        const { error: upErr } = await supabase.storage
          .from('sinistros')
          .upload(path, arquivo);
        if (upErr) throw new Error('Erro ao fazer upload: ' + upErr.message);

        const { data: urlData } = supabase.storage
          .from('sinistros')
          .getPublicUrl(path);
        arquivoUrl = urlData.publicUrl;
        arquivoNome = arquivo.name;
      }

      const { error } = await supabase
        .from('sindicancia_evidencias' as any)
        .insert({
          sinistro_id: sinistroId,
          tipo,
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          arquivo_url: arquivoUrl,
          arquivo_nome: arquivoNome,
          registrado_por: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Evidência registrada!');
      queryClient.invalidateQueries({ queryKey: ['sindicancia-evidencias', sinistroId] });
      handleClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleClose = () => {
    setTipo('');
    setTitulo('');
    setDescricao('');
    setArquivo(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Evidência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                {TIPOS_EVIDENCIA.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <t.icon className="h-4 w-4" /> {t.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Laudo do rastreador GPS" />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes sobre a evidência..." rows={3} />
          </div>

          <div className="space-y-2">
            <Label>Arquivo (imagem, vídeo ou PDF, até 50MB)</Label>
            {arquivo ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-sm truncate">{arquivo.name}</span>
                <span className="text-xs text-muted-foreground">{(arquivo.size / 1024 / 1024).toFixed(1)} MB</span>
                <Button variant="ghost" size="icon" onClick={() => setArquivo(null)}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
              >
                <input {...getInputProps()} />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Arraste ou clique para enviar</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !tipo || !titulo.trim()}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar Evidência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

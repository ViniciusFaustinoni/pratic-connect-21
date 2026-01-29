import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCampanhas } from '@/hooks/useMarketing';
import { Upload, X } from 'lucide-react';

interface UploadMaterialModalProps {
  open: boolean;
  onClose: () => void;
}

export function UploadMaterialModal({ open, onClose }: UploadMaterialModalProps) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('imagem');
  const [arquivoUrl, setArquivoUrl] = useState('');
  const [largura, setLargura] = useState('');
  const [altura, setAltura] = useState('');
  const [campanhaId, setCampanhaId] = useState('');

  const { data: campanhas } = useCampanhas();
  const queryClient = useQueryClient();

  const resetForm = () => {
    setNome('');
    setTipo('imagem');
    setArquivoUrl('');
    setLargura('');
    setAltura('');
    setCampanhaId('');
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('materiais_marketing')
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiais-marketing'] });
      toast.success('Material adicionado com sucesso!');
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    },
  });

  const handleSubmit = () => {
    if (!nome) {
      toast.error('Nome é obrigatório');
      return;
    }

    const data = {
      nome,
      tipo,
      arquivo_url: arquivoUrl || null,
      thumbnail_url: arquivoUrl || null,
      largura: largura ? parseInt(largura) : null,
      altura: altura ? parseInt(altura) : null,
      campanha_id: campanhaId || null,
      status: 'ativo',
      downloads: 0,
    };

    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Material</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Material *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Banner Black Friday"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="imagem">Imagem</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="documento">Documento</SelectItem>
                <SelectItem value="banner">Banner</SelectItem>
                <SelectItem value="post">Post Social</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="arquivoUrl">URL do Arquivo</Label>
            <Input
              id="arquivoUrl"
              value={arquivoUrl}
              onChange={(e) => setArquivoUrl(e.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">
              Cole a URL do arquivo já hospedado
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="largura">Largura (px)</Label>
              <Input
                id="largura"
                type="number"
                value={largura}
                onChange={(e) => setLargura(e.target.value)}
                placeholder="1200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="altura">Altura (px)</Label>
              <Input
                id="altura"
                type="number"
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                placeholder="628"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campanha">Campanha Vinculada</Label>
            <Select value={campanhaId} onValueChange={setCampanhaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma campanha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma</SelectItem>
                {campanhas?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            <Upload className="mr-2 h-4 w-4" />
            Adicionar Material
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

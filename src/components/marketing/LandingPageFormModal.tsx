import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCampanhas } from '@/hooks/useMarketing';

interface LandingPage {
  id: string;
  nome: string;
  slug: string;
  url: string;
  descricao?: string;
  titulo_seo?: string;
  descricao_seo?: string;
  status: string;
  campanha_id?: string;
}

interface LandingPageFormModalProps {
  open: boolean;
  onClose: () => void;
  landingPage?: LandingPage | null;
  onSuccess?: () => void;
}

export function LandingPageFormModal({ open, onClose, landingPage, onSuccess }: LandingPageFormModalProps) {
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [url, setUrl] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tituloSeo, setTituloSeo] = useState('');
  const [descricaoSeo, setDescricaoSeo] = useState('');
  const [status, setStatus] = useState('rascunho');
  const [campanhaId, setCampanhaId] = useState('');

  const { data: campanhas } = useCampanhas();
  const queryClient = useQueryClient();
  const isEditing = !!landingPage;

  useEffect(() => {
    if (landingPage) {
      setNome(landingPage.nome || '');
      setSlug(landingPage.slug || '');
      setUrl(landingPage.url || '');
      setDescricao(landingPage.descricao || '');
      setTituloSeo(landingPage.titulo_seo || '');
      setDescricaoSeo(landingPage.descricao_seo || '');
      setStatus(landingPage.status || 'rascunho');
      setAtivo(landingPage.ativo ?? true);
      setCampanhaId(landingPage.campanha_id || '');
    } else {
      resetForm();
    }
  }, [landingPage, open]);

  const resetForm = () => {
    setNome('');
    setSlug('');
    setUrl('');
    setDescricao('');
    setTituloSeo('');
    setDescricaoSeo('');
    setStatus('rascunho');
    setAtivo(true);
    setCampanhaId('');
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        const { error } = await supabase
          .from('landing_pages')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', landingPage.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('landing_pages')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      toast.success(isEditing ? 'Landing page atualizada!' : 'Landing page criada!');
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    },
  });

  const handleSubmit = () => {
    if (!nome || !url) {
      toast.error('Nome e URL são obrigatórios');
      return;
    }

    const data = {
      nome,
      slug: slug || nome.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      url,
      descricao: descricao || null,
      titulo_seo: tituloSeo || null,
      descricao_seo: descricaoSeo || null,
      status,
      ativo,
      campanha_id: campanhaId || null,
      publicada_em: status === 'publicada' ? new Date().toISOString() : null,
    };

    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Landing Page' : 'Nova Landing Page'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Página de Cotação"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="pagina-cotacao"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">URL *</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://seusite.com/lp/cotacao"
              />
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

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="publicada">Publicada</SelectItem>
                  <SelectItem value="pausada">Pausada</SelectItem>
                  <SelectItem value="arquivada">Arquivada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição interna da landing page..."
                rows={2}
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">SEO</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tituloSeo">Título SEO</Label>
                <Input
                  id="tituloSeo"
                  value={tituloSeo}
                  onChange={(e) => setTituloSeo(e.target.value)}
                  placeholder="Título para mecanismos de busca"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricaoSeo">Descrição SEO</Label>
                <Input
                  id="descricaoSeo"
                  value={descricaoSeo}
                  onChange={(e) => setDescricaoSeo(e.target.value)}
                  placeholder="Meta description"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label htmlFor="ativo">Página Ativa</Label>
            <Switch
              id="ativo"
              checked={ativo}
              onCheckedChange={setAtivo}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            {isEditing ? 'Salvar' : 'Criar Landing Page'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

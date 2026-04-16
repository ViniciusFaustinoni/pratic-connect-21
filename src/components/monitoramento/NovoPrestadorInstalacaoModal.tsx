import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { MunicipiosPicker } from '@/components/monitoramento/MunicipiosPicker';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prestador?: any;
}

export function NovoPrestadorInstalacaoModal({ open, onClose, onSuccess, prestador }: Props) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [municipiosSelecionados, setMunicipiosSelecionados] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (prestador) {
      setNome(prestador.nome || '');
      setWhatsapp(prestador.whatsapp || '');
      setMunicipiosSelecionados(prestador.municipios_atuacao || []);
      setAtivo(prestador.ativo ?? true);
    } else {
      setNome('');
      setWhatsapp('');
      setMunicipiosSelecionados([]);
      setAtivo(true);
    }
  }, [prestador, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome,
        whatsapp: whatsapp || null,
        municipios_atuacao: municipiosSelecionados,
        ativo,
        updated_at: new Date().toISOString(),
      };

      if (prestador?.id) {
        const { error } = await (supabase as any)
          .from('prestadores_instalacao')
          .update(payload)
          .eq('id', prestador.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('prestadores_instalacao')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestadores-parceiros'] });
      toast.success(prestador ? 'Prestador atualizado' : 'Prestador cadastrado');
      onSuccess();
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{prestador ? 'Editar Prestador' : 'Novo Prestador de Instalação'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome / Razão Social *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do prestador" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(21) 99999-9999" />
          </div>

          <MunicipiosPicker
            value={municipiosSelecionados}
            onChange={setMunicipiosSelecionados}
          />

          <div className="flex items-center justify-between">
            <Label htmlFor="ativo">Ativo</Label>
            <Switch id="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={!nome.trim() || mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

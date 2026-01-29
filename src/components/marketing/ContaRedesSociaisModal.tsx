import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Facebook, Instagram, Linkedin, Youtube, Twitter, MessageCircle } from 'lucide-react';

interface ContaRedesSociaisModalProps {
  open: boolean;
  onClose: () => void;
}

const plataformas = [
  { value: 'facebook', label: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'bg-blue-700' },
  { value: 'youtube', label: 'YouTube', icon: Youtube, color: 'bg-red-600' },
  { value: 'twitter', label: 'Twitter/X', icon: Twitter, color: 'bg-sky-500' },
  { value: 'tiktok', label: 'TikTok', icon: MessageCircle, color: 'bg-black' },
];

export function ContaRedesSociaisModal({ open, onClose }: ContaRedesSociaisModalProps) {
  const [plataforma, setPlataforma] = useState('');
  const [nomeConta, setNomeConta] = useState('');
  const [username, setUsername] = useState('');
  const [seguidores, setSeguidores] = useState('');

  const queryClient = useQueryClient();

  const resetForm = () => {
    setPlataforma('');
    setNomeConta('');
    setUsername('');
    setSeguidores('');
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('redes_sociais_contas')
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redes-sociais-contas'] });
      toast.success('Conta adicionada com sucesso!');
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Erro: ' + error.message);
    },
  });

  const handleSubmit = () => {
    if (!plataforma || !nomeConta) {
      toast.error('Selecione a plataforma e informe o nome da conta');
      return;
    }

    const data = {
      plataforma,
      nome_conta: nomeConta,
      username: username || null,
      seguidores: seguidores ? parseInt(seguidores) : 0,
      status: 'conectado',
    };

    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conectar Conta de Rede Social</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Selecione a Plataforma *</Label>
            <div className="grid grid-cols-3 gap-2">
              {plataformas.map((p) => {
                const Icon = p.icon;
                return (
                  <Button
                    key={p.value}
                    type="button"
                    variant={plataforma === p.value ? 'default' : 'outline'}
                    className={`flex flex-col items-center gap-1 h-auto py-3 ${
                      plataforma === p.value ? p.color + ' text-white border-0' : ''
                    }`}
                    onClick={() => setPlataforma(p.value)}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs">{p.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nomeConta">Nome da Conta/Página *</Label>
            <Input
              id="nomeConta"
              value={nomeConta}
              onChange={(e) => setNomeConta(e.target.value)}
              placeholder="Ex: SGA Pratic Oficial"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username/@</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@sgapratic"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="seguidores">Número de Seguidores</Label>
            <Input
              id="seguidores"
              type="number"
              value={seguidores}
              onChange={(e) => setSeguidores(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
            <p className="font-medium mb-1">💡 Dica</p>
            <p>
              Por enquanto, as métricas precisam ser inseridas manualmente. 
              Em breve teremos integração direta com as APIs das redes sociais.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={mutation.isPending}>
            Adicionar Conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

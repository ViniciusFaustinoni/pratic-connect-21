import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

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

  // Buscar municípios tipo prestador
  const { data: municipios = [] } = useQuery({
    queryKey: ['municipios-tipo-prestador'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('municipios_atendimento')
        .select('nome, uf')
        .eq('tipo_atendimento', 'prestador')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });

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

  const toggleMunicipio = (nome: string) => {
    setMunicipiosSelecionados(prev =>
      prev.includes(nome) ? prev.filter(m => m !== nome) : [...prev, nome]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
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

          <div className="space-y-2">
            <Label>Municípios de Atuação</Label>
            {municipiosSelecionados.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {municipiosSelecionados.map(m => (
                  <Badge key={m} variant="secondary" className="text-xs cursor-pointer" onClick={() => toggleMunicipio(m)}>
                    {m} ×
                  </Badge>
                ))}
              </div>
            )}
            <ScrollArea className="h-40 border rounded-md p-2">
              {municipios.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum município tipo "Prestador" cadastrado.</p>
              ) : (
                <div className="space-y-2">
                  {municipios.map((mun: any) => (
                    <div key={mun.nome} className="flex items-center gap-2">
                      <Checkbox
                        checked={municipiosSelecionados.includes(mun.nome)}
                        onCheckedChange={() => toggleMunicipio(mun.nome)}
                      />
                      <span className="text-sm">{mun.nome} - {mun.uf}</span>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

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

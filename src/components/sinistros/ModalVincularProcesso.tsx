import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  sinistroId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModalVincularProcesso({ sinistroId, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('existente');
  const [processoSelecionado, setProcessoSelecionado] = useState('');
  const [loading, setLoading] = useState(false);

  // Buscar processos sem sinistro vinculado
  const { data: processosDisponiveis = [], isLoading: isLoadingProcessos } = useQuery({
    queryKey: ['processos-disponiveis-vincular'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select('id, numero, numero_processo, tipo, vara')
        .is('sinistro_id', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const vincularExistente = async () => {
    if (!processoSelecionado) {
      toast.error('Selecione um processo');
      return;
    }
    setLoading(true);

    const { error } = await supabase
      .from('processos')
      .update({ sinistro_id: sinistroId })
      .eq('id', processoSelecionado);

    setLoading(false);
    if (!error) {
      toast.success('Processo vinculado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['processos-sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['processos-disponiveis-vincular'] });
      setProcessoSelecionado('');
      onOpenChange(false);
    } else {
      toast.error('Erro ao vincular processo: ' + error.message);
    }
  };

  const handleCriarNovo = () => {
    onOpenChange(false);
    navigate(`/juridico/processos/novo?sinistro_id=${sinistroId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Vincular Processo Jurídico
          </DialogTitle>
          <DialogDescription>
            Vincule um processo existente ou crie um novo processo para este sinistro.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existente">Processo Existente</TabsTrigger>
            <TabsTrigger value="novo">Criar Novo</TabsTrigger>
          </TabsList>

          <TabsContent value="existente" className="space-y-4 mt-4">
            {processosDisponiveis.length === 0 && !isLoadingProcessos ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum processo disponível para vincular
              </p>
            ) : (
              <Select value={processoSelecionado} onValueChange={setProcessoSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um processo..." />
                </SelectTrigger>
                <SelectContent>
                  {processosDisponiveis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.numero_processo || p.numero || 'Sem número'} - {p.tipo} ({p.vara || 'Sem vara'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </TabsContent>

          <TabsContent value="novo" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Você será redirecionado para criar um novo processo já vinculado a este sinistro.
            </p>
            <Button onClick={handleCriarNovo} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Criar Novo Processo
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {tab === 'existente' && (
            <Button
              onClick={vincularExistente}
              disabled={loading || !processoSelecionado}
            >
              {loading ? 'Vinculando...' : 'Vincular'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useForm, Controller } from 'react-hook-form';
import { TelefoneInput } from '@/components/inputs/MaskedInputs';

interface CandidatoFormData {
  nome: string;
  email: string;
  telefone: string;
  linkedin_url: string;
  curriculo_url: string;
  avaliacao_rh: string;
}

interface CandidatoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vagaId: string | null;
}

export function CandidatoFormModal({ open, onOpenChange, vagaId }: CandidatoFormModalProps) {
  const queryClient = useQueryClient();

  const { control, handleSubmit, reset } = useForm<CandidatoFormData>({
    defaultValues: {
      nome: '',
      email: '',
      telefone: '',
      linkedin_url: '',
      curriculo_url: '',
      avaliacao_rh: '',
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: CandidatoFormData) => {
      if (!vagaId) throw new Error('Vaga não selecionada');

      const { error } = await supabase
        .from('candidatos')
        .insert({
          ...data,
          vaga_id: vagaId,
          etapa: 'triagem',
          status: 'ativo',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidatos-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['vagas'] });
      queryClient.invalidateQueries({ queryKey: ['recrutamento-stats'] });
      toast.success('Candidato adicionado!');
      onOpenChange(false);
      reset();
    },
    onError: (error: Error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const onSubmit = (data: CandidatoFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Candidato</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome Completo *</Label>
            <Controller
              name="nome"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <Input placeholder="Nome do candidato" {...field} />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>E-mail</Label>
            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <Input type="email" placeholder="email@exemplo.com" {...field} />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Controller
              name="telefone"
              control={control}
              render={({ field }) => (
                <TelefoneInput value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>LinkedIn</Label>
            <Controller
              name="linkedin_url"
              control={control}
              render={({ field }) => (
                <Input placeholder="https://linkedin.com/in/..." {...field} />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Link do Currículo</Label>
            <Controller
              name="curriculo_url"
              control={control}
              render={({ field }) => (
                <Input placeholder="https://..." {...field} />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações Iniciais</Label>
            <Controller
              name="avaliacao_rh"
              control={control}
              render={({ field }) => (
                <Textarea 
                  placeholder="Notas sobre o candidato..."
                  rows={3}
                  {...field}
                />
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useForm, Controller } from 'react-hook-form';
import { CurrencyInput } from '@/components/inputs/MaskedInputs';

interface TreinamentoFormData {
  nome: string;
  tipo: string;
  modalidade: string;
  data_inicio: string;
  data_fim: string;
  carga_horaria: number;
  instrutor_nome: string;
  instrutor_tipo: string;
  local: string;
  link_online: string;
  conteudo: string;
  valor_investimento: number;
}

interface TreinamentoFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  treinamento?: any;
}

export function TreinamentoFormModal({ open, onOpenChange, treinamento }: TreinamentoFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!treinamento;

  const { control, handleSubmit, reset, watch } = useForm<TreinamentoFormData>({
    defaultValues: {
      nome: '',
      tipo: 'capacitacao',
      modalidade: 'presencial',
      data_inicio: '',
      data_fim: '',
      carga_horaria: 0,
      instrutor_nome: '',
      instrutor_tipo: 'interno',
      local: '',
      link_online: '',
      conteudo: '',
      valor_investimento: 0,
    }
  });

  const modalidade = watch('modalidade');

  useEffect(() => {
    if (treinamento) {
      reset({
        nome: treinamento.nome || '',
        tipo: treinamento.tipo || 'capacitacao',
        modalidade: treinamento.modalidade || 'presencial',
        data_inicio: treinamento.data_inicio || '',
        data_fim: treinamento.data_fim || '',
        carga_horaria: treinamento.carga_horaria || 0,
        instrutor_nome: treinamento.instrutor_nome || '',
        instrutor_tipo: treinamento.instrutor_tipo || 'interno',
        local: treinamento.local || '',
        link_online: treinamento.link_online || '',
        conteudo: treinamento.conteudo || '',
        valor_investimento: treinamento.valor_investimento || 0,
      });
    } else {
      reset({
        nome: '',
        tipo: 'capacitacao',
        modalidade: 'presencial',
        data_inicio: '',
        data_fim: '',
        carga_horaria: 0,
        instrutor_nome: '',
        instrutor_tipo: 'interno',
        local: '',
        link_online: '',
        conteudo: '',
        valor_investimento: 0,
      });
    }
  }, [treinamento, reset]);

  const saveMutation = useMutation({
    mutationFn: async (data: TreinamentoFormData) => {
      const payload = {
        ...data,
        carga_horaria: Number(data.carga_horaria) || null,
        valor_investimento: Number(data.valor_investimento) || null,
        status: 'planejado',
      };

      if (isEditing) {
        const { error } = await supabase
          .from('treinamentos')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', treinamento.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('treinamentos')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treinamentos'] });
      queryClient.invalidateQueries({ queryKey: ['treinamentos-stats'] });
      toast.success(isEditing ? 'Treinamento atualizado!' : 'Treinamento criado!');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const onSubmit = (data: TreinamentoFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Treinamento' : 'Novo Treinamento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Nome do Treinamento *</Label>
              <Controller
                name="nome"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Input placeholder="Nome do treinamento" {...field} />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Controller
                name="tipo"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="obrigatorio">Obrigatório</SelectItem>
                      <SelectItem value="capacitacao">Capacitação</SelectItem>
                      <SelectItem value="desenvolvimento">Desenvolvimento</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Modalidade *</Label>
              <Controller
                name="modalidade"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="presencial">Presencial</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="hibrido">Híbrido</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Controller
                name="data_inicio"
                control={control}
                render={({ field }) => (
                  <Input type="date" {...field} />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Controller
                name="data_fim"
                control={control}
                render={({ field }) => (
                  <Input type="date" {...field} />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Carga Horária (horas)</Label>
              <Controller
                name="carga_horaria"
                control={control}
                render={({ field }) => (
                  <Input 
                    type="number" 
                    min="0" 
                    {...field} 
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Valor do Investimento</Label>
              <Controller
                name="valor_investimento"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Nome do Instrutor</Label>
              <Controller
                name="instrutor_nome"
                control={control}
                render={({ field }) => (
                  <Input placeholder="Nome do instrutor" {...field} />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Instrutor</Label>
              <Controller
                name="instrutor_tipo"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interno">Interno</SelectItem>
                      <SelectItem value="externo">Externo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {(modalidade === 'presencial' || modalidade === 'hibrido') && (
              <div className="space-y-2">
                <Label>Local</Label>
                <Controller
                  name="local"
                  control={control}
                  render={({ field }) => (
                    <Input placeholder="Endereço ou sala" {...field} />
                  )}
                />
              </div>
            )}

            {(modalidade === 'online' || modalidade === 'hibrido') && (
              <div className="space-y-2">
                <Label>Link Online</Label>
                <Controller
                  name="link_online"
                  control={control}
                  render={({ field }) => (
                    <Input placeholder="https://..." {...field} />
                  )}
                />
              </div>
            )}

            <div className="md:col-span-2 space-y-2">
              <Label>Conteúdo Programático</Label>
              <Controller
                name="conteudo"
                control={control}
                render={({ field }) => (
                  <Textarea 
                    placeholder="Descreva o conteúdo do treinamento..."
                    rows={4}
                    {...field}
                  />
                )}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

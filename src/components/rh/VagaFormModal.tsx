import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useForm, Controller } from 'react-hook-form';
import { CurrencyInput } from '@/components/inputs/MaskedInputs';

interface VagaFormData {
  titulo: string;
  departamento_id: string;
  cargo_id: string;
  quantidade: number;
  tipo_contrato: string;
  salario_min: number;
  salario_max: number;
  requisitos: string;
  atividades: string;
  beneficios: string;
  urgencia: string;
}

interface VagaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vaga?: any;
}

export function VagaFormModal({ open, onOpenChange, vaga }: VagaFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!vaga;

  const { control, handleSubmit, reset } = useForm<VagaFormData>({
    defaultValues: {
      titulo: '',
      departamento_id: '',
      cargo_id: '',
      quantidade: 1,
      tipo_contrato: 'clt',
      salario_min: 0,
      salario_max: 0,
      requisitos: '',
      atividades: '',
      beneficios: '',
      urgencia: 'normal',
    }
  });

  const { data: departamentos } = useQuery({
    queryKey: ['departamentos-select'],
    queryFn: async () => {
      const { data } = await supabase.from('departamentos').select('id, nome').eq('ativo', true).order('nome');
      return data || [];
    }
  });

  const { data: cargos } = useQuery({
    queryKey: ['cargos-select'],
    queryFn: async () => {
      const { data } = await supabase.from('cargos').select('id, nome').eq('ativo', true).order('nome');
      return data || [];
    }
  });

  useEffect(() => {
    if (vaga) {
      reset({
        titulo: vaga.titulo || '',
        departamento_id: vaga.departamento_id || '',
        cargo_id: vaga.cargo_id || '',
        quantidade: vaga.quantidade || 1,
        tipo_contrato: vaga.tipo_contrato || 'clt',
        salario_min: vaga.salario_min || 0,
        salario_max: vaga.salario_max || 0,
        requisitos: vaga.requisitos || '',
        atividades: vaga.atividades || '',
        beneficios: vaga.beneficios || '',
        urgencia: vaga.urgencia || 'normal',
      });
    } else {
      reset({
        titulo: '',
        departamento_id: '',
        cargo_id: '',
        quantidade: 1,
        tipo_contrato: 'clt',
        salario_min: 0,
        salario_max: 0,
        requisitos: '',
        atividades: '',
        beneficios: '',
        urgencia: 'normal',
      });
    }
  }, [vaga, reset]);

  const saveMutation = useMutation({
    mutationFn: async (data: VagaFormData) => {
      const payload = {
        ...data,
        quantidade: Number(data.quantidade) || 1,
        salario_min: Number(data.salario_min) || null,
        salario_max: Number(data.salario_max) || null,
        departamento_id: data.departamento_id || null,
        cargo_id: data.cargo_id || null,
        status: 'aberta',
      };

      if (isEditing) {
        const { error } = await supabase
          .from('vagas')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', vaga.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('vagas')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vagas'] });
      queryClient.invalidateQueries({ queryKey: ['recrutamento-stats'] });
      toast.success(isEditing ? 'Vaga atualizada!' : 'Vaga criada!');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const onSubmit = (data: VagaFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Vaga' : 'Nova Vaga'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Título da Vaga *</Label>
              <Controller
                name="titulo"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <Input placeholder="Ex: Analista de RH Pleno" {...field} />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Departamento</Label>
              <Controller
                name="departamento_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {departamentos?.map(dep => (
                        <SelectItem key={dep.id} value={dep.id}>{dep.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Cargo</Label>
              <Controller
                name="cargo_id"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {cargos?.map(cargo => (
                        <SelectItem key={cargo.id} value={cargo.id}>{cargo.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Quantidade de Vagas</Label>
              <Controller
                name="quantidade"
                control={control}
                render={({ field }) => (
                  <Input 
                    type="number" 
                    min="1" 
                    {...field} 
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Contrato</Label>
              <Controller
                name="tipo_contrato"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="clt">CLT</SelectItem>
                      <SelectItem value="pj">PJ</SelectItem>
                      <SelectItem value="estagio">Estágio</SelectItem>
                      <SelectItem value="temporario">Temporário</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Salário Mínimo</Label>
              <Controller
                name="salario_min"
                control={control}
                render={({ field }) => (
                  <CurrencyInput value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Salário Máximo</Label>
              <Controller
                name="salario_max"
                control={control}
                render={({ field }) => (
                  <CurrencyInput value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Urgência</Label>
              <Controller
                name="urgencia"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Requisitos</Label>
              <Controller
                name="requisitos"
                control={control}
                render={({ field }) => (
                  <Textarea 
                    placeholder="Formação, experiência, habilidades..."
                    rows={3}
                    {...field}
                  />
                )}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Atividades</Label>
              <Controller
                name="atividades"
                control={control}
                render={({ field }) => (
                  <Textarea 
                    placeholder="Principais responsabilidades..."
                    rows={3}
                    {...field}
                  />
                )}
              />
            </div>

            <div className="md:col-span-2 space-y-2">
              <Label>Benefícios</Label>
              <Controller
                name="beneficios"
                control={control}
                render={({ field }) => (
                  <Textarea 
                    placeholder="VT, VR, Plano de Saúde..."
                    rows={2}
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

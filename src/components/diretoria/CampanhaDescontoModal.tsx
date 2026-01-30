import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Percent, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import type { CampanhaDesconto, CampanhaDescontoFormData, TipoBeneficio } from '@/types/campanha-desconto';
import { useCreateCampanhaDesconto, useUpdateCampanhaDesconto } from '@/hooks/useCampanhasDesconto';

const schema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  descricao: z.string().optional(),
  tipo_beneficio: z.enum(['percentual', 'valor_fixo']),
  valor_beneficio: z.number().min(0.01, 'Valor deve ser maior que zero'),
  data_inicio: z.date({ required_error: 'Data de início obrigatória' }),
  data_fim: z.date({ required_error: 'Data de término obrigatória' }),
  meses_aplicacao: z.number().min(1, 'Mínimo 1 mês').max(24, 'Máximo 24 meses'),
  status: z.enum(['ativa', 'inativa']),
}).refine((data) => data.data_fim >= data.data_inicio, {
  message: 'Data de término deve ser posterior à data de início',
  path: ['data_fim'],
});

type FormValues = z.infer<typeof schema>;

interface CampanhaDescontoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campanha?: CampanhaDesconto | null;
}

export function CampanhaDescontoModal({
  open,
  onOpenChange,
  campanha,
}: CampanhaDescontoModalProps) {
  const isEditing = !!campanha;
  
  const createMutation = useCreateCampanhaDesconto();
  const updateMutation = useUpdateCampanhaDesconto();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: '',
      descricao: '',
      tipo_beneficio: 'percentual',
      valor_beneficio: 5,
      data_inicio: new Date(),
      data_fim: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      meses_aplicacao: 3,
      status: 'ativa',
    },
  });

  const tipoBeneficio = form.watch('tipo_beneficio');

  // Preencher form quando editando
  useEffect(() => {
    if (campanha) {
      form.reset({
        nome: campanha.nome,
        descricao: campanha.descricao || '',
        tipo_beneficio: campanha.tipo_beneficio,
        valor_beneficio: campanha.valor_beneficio,
        data_inicio: new Date(campanha.data_inicio),
        data_fim: new Date(campanha.data_fim),
        meses_aplicacao: campanha.meses_aplicacao,
        status: campanha.status,
      });
    } else {
      form.reset({
        nome: '',
        descricao: '',
        tipo_beneficio: 'percentual',
        valor_beneficio: 5,
        data_inicio: new Date(),
        data_fim: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        meses_aplicacao: 3,
        status: 'ativa',
      });
    }
  }, [campanha, form, open]);

  const onSubmit = async (values: FormValues) => {
    const payload: CampanhaDescontoFormData = {
      nome: values.nome,
      descricao: values.descricao,
      tipo_beneficio: values.tipo_beneficio,
      valor_beneficio: values.valor_beneficio,
      data_inicio: format(values.data_inicio, 'yyyy-MM-dd'),
      data_fim: format(values.data_fim, 'yyyy-MM-dd'),
      meses_aplicacao: values.meses_aplicacao,
      status: values.status,
    };

    try {
      if (isEditing && campanha) {
        await updateMutation.mutateAsync({ id: campanha.id, dados: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      // Erro tratado pelo hook
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Campanha' : 'Nova Campanha de Desconto'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados da campanha promocional'
              : 'Configure uma nova campanha de desconto para cotações'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Nome */}
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Campanha</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Black Friday 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descrição */}
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva a campanha..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo e Valor do Benefício */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_beneficio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Desconto</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="percentual">
                          <div className="flex items-center gap-2">
                            <Percent className="h-4 w-4" />
                            Percentual
                          </div>
                        </SelectItem>
                        <SelectItem value="valor_fixo">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Valor Fixo
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor_beneficio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Valor do Desconto {tipoBeneficio === 'percentual' ? '(%)' : '(R$)'}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {tipoBeneficio === 'percentual' ? '%' : 'R$'}
                        </span>
                        <Input
                          type="number"
                          step={tipoBeneficio === 'percentual' ? '1' : '0.01'}
                          min="0.01"
                          max={tipoBeneficio === 'percentual' ? '100' : '10000'}
                          className="pl-10"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_inicio"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Início</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                            ) : (
                              <span>Selecione</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_fim"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Término</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                            ) : (
                              <span>Selecione</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          locale={ptBR}
                          disabled={(date) => date < form.getValues('data_inicio')}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Meses de Aplicação */}
            <FormField
              control={form.control}
              name="meses_aplicacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Meses de Aplicação do Desconto</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormDescription>
                    Quantidade de meses que o associado terá o desconto aplicado
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Campanha Ativa</FormLabel>
                    <FormDescription>
                      Campanhas inativas não aparecem na cotação
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value === 'ativa'}
                      onCheckedChange={(checked) =>
                        field.onChange(checked ? 'ativa' : 'inativa')
                      }
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? 'Salvando...'
                  : isEditing
                  ? 'Salvar Alterações'
                  : 'Criar Campanha'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

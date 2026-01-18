import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCreateRota, useUpdateRota, useInstaladores, type Rota } from '@/hooks/useRotas';
import { toast } from 'sonner';
import { useEffect } from 'react';

const rotaSchema = z.object({
  data_rota: z.date({ required_error: 'Data é obrigatória' }),
  instalador_id: z.string().min(1, 'Selecione um instalador'),
  coordenador_id: z.string().optional().nullable(),
  cidade: z.string().optional(),
  regiao: z.string().optional(),
});

type RotaFormData = z.infer<typeof rotaSchema>;

interface RotaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rota?: Rota | null;
}

export function RotaFormDialog({ open, onOpenChange, rota }: RotaFormDialogProps) {
  const { data: instaladores } = useInstaladores();
  const createRota = useCreateRota();
  const updateRota = useUpdateRota();
  const isEditing = !!rota;

  const form = useForm<RotaFormData>({
    resolver: zodResolver(rotaSchema),
    defaultValues: {
      data_rota: new Date(),
      instalador_id: '',
      coordenador_id: null,
      cidade: '',
      regiao: '',
    },
  });

  // Reset form when dialog opens or rota changes
  useEffect(() => {
    if (open) {
      form.reset({
        data_rota: rota?.data_rota ? parseISO(rota.data_rota) : new Date(),
        instalador_id: rota?.instalador_id || '',
        coordenador_id: rota?.coordenador_id || null,
        cidade: rota?.cidade || '',
        regiao: rota?.regiao || '',
      });
    }
  }, [open, rota, form]);

  const onSubmit = async (data: RotaFormData) => {
    try {
      const rotaData = {
        data_rota: format(data.data_rota, 'yyyy-MM-dd'),
        instalador_id: data.instalador_id,
        coordenador_id: data.coordenador_id || null,
        cidade: data.cidade || null,
        regiao: data.regiao || null,
      };

      if (isEditing && rota) {
        await updateRota.mutateAsync({ id: rota.id, ...rotaData });
        toast.success('Rota atualizada com sucesso!');
      } else {
        await createRota.mutateAsync(rotaData);
        toast.success('Rota criada com sucesso!');
      }
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error('Erro ao salvar rota');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Rota' : 'Nova Rota'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="data_rota"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data da Rota</FormLabel>
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
                            format(field.value, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          ) : (
                            <span>Selecione a data</span>
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
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
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
              name="instalador_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instalador</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o instalador" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {instaladores?.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Rio de Janeiro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="regiao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Região</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Zona Sul" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createRota.isPending || updateRota.isPending}>
                {isEditing ? 'Salvar' : 'Criar Rota'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

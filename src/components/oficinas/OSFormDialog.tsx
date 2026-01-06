import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useOficinas } from '@/hooks/useOficinas';
import { useAssociados } from '@/hooks/useAssociados';
import { useVeiculos } from '@/hooks/useVeiculos';
import { useCreateOrdemServico } from '@/hooks/useOrdensServico';

const formSchema = z.object({
  oficina_id: z.string().min(1, 'Selecione uma oficina'),
  associado_id: z.string().min(1, 'Selecione um associado'),
  veiculo_id: z.string().min(1, 'Selecione um veículo'),
  data_entrada: z.string().optional(),
  data_previsao: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistroId?: string;
  defaultValues?: Partial<FormData>;
}

export function OSFormDialog({ open, onOpenChange, sinistroId, defaultValues }: Props) {
  const createOS = useCreateOrdemServico();
  const { data: oficinas } = useOficinas({ status: 'ativo' });
  const { data: associadosData } = useAssociados();
  const associados = associadosData?.associados;
  const { data: veiculos } = useVeiculos();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      oficina_id: defaultValues?.oficina_id || '',
      associado_id: defaultValues?.associado_id || '',
      veiculo_id: defaultValues?.veiculo_id || '',
      data_entrada: defaultValues?.data_entrada || '',
      data_previsao: defaultValues?.data_previsao || '',
      observacoes: defaultValues?.observacoes || '',
    },
  });

  const selectedAssociadoId = form.watch('associado_id');
  const filteredVeiculos = veiculos?.filter(v => v.associado_id === selectedAssociadoId);

  const onSubmit = async (data: FormData) => {
    await createOS.mutateAsync({
      oficina_id: data.oficina_id,
      veiculo_id: data.veiculo_id,
      associado_id: data.associado_id,
      sinistro_id: sinistroId,
      data_entrada: data.data_entrada || undefined,
      data_previsao: data.data_previsao || undefined,
      observacoes: data.observacoes || undefined,
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Serviço</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="oficina_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Oficina *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a oficina" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {oficinas?.map((oficina) => (
                        <SelectItem key={oficina.id} value={oficina.id}>
                          {oficina.nome_fantasia || oficina.razao_social}
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
              name="associado_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Associado *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o associado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {associados?.map((associado) => (
                        <SelectItem key={associado.id} value={associado.id}>
                          {associado.nome}
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
              name="veiculo_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Veículo *</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={!selectedAssociadoId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedAssociadoId ? "Selecione o veículo" : "Selecione o associado primeiro"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredVeiculos?.map((veiculo) => (
                        <SelectItem key={veiculo.id} value={veiculo.id}>
                          {veiculo.placa} - {veiculo.modelo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="data_entrada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Entrada</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data_previsao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previsão de Conclusão</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createOS.isPending}>
                Criar OS
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import {
  useCreateRastreador,
  useUpdateRastreador,
  useRastreador,
  useVeiculosSemRastreador,
  type StatusRastreador,
} from '@/hooks/useRastreadores';
import { STATUS_RASTREADOR_LABELS, PLATAFORMA_RASTREADOR_LABELS } from '@/types/database';

const rastreadorSchema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório').max(50),
  numero_serie: z.string().max(100).optional().nullable(),
  imei: z.string().max(15).optional().nullable(),
  chip_iccid: z.string().max(20).optional().nullable(),
  plataforma: z.string().min(1, 'Plataforma é obrigatória'),
  id_plataforma: z.string().max(100).optional().nullable(),
  status: z.enum(['estoque', 'instalado', 'manutencao', 'baixado'] as const),
  veiculo_id: z.string().uuid().optional().nullable(),
}).refine(
  (data) => {
    if (data.status === 'instalado' && !data.veiculo_id) {
      return false;
    }
    return true;
  },
  {
    message: 'Selecione um veículo para rastreadores instalados',
    path: ['veiculo_id'],
  }
);

type RastreadorFormData = z.infer<typeof rastreadorSchema>;

interface RastreadorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreadorId?: string | null;
}

export function RastreadorFormDialog({
  open,
  onOpenChange,
  rastreadorId,
}: RastreadorFormDialogProps) {
  const { data: rastreador, isLoading: isLoadingRastreador } = useRastreador(
    rastreadorId || undefined
  );
  const { data: veiculos } = useVeiculosSemRastreador();
  const createRastreador = useCreateRastreador();
  const updateRastreador = useUpdateRastreador();

  const isEditing = !!rastreadorId;
  const isLoading = createRastreador.isPending || updateRastreador.isPending;

  const form = useForm<RastreadorFormData>({
    resolver: zodResolver(rastreadorSchema),
    defaultValues: {
      codigo: '',
      numero_serie: '',
      imei: '',
      chip_iccid: '',
      plataforma: 'rede_veiculos',
      id_plataforma: '',
      status: 'estoque',
      veiculo_id: null,
    },
  });

  const watchStatus = form.watch('status');

  // Reset form when dialog opens/closes or rastreador changes
  useEffect(() => {
    if (open) {
      if (rastreador) {
        form.reset({
          codigo: rastreador.codigo,
          numero_serie: rastreador.numero_serie || '',
          imei: rastreador.imei || '',
          chip_iccid: rastreador.chip_iccid || '',
          plataforma: rastreador.plataforma,
          id_plataforma: rastreador.id_plataforma || '',
          status: rastreador.status,
          veiculo_id: rastreador.veiculo_id,
        });
      } else {
        form.reset({
          codigo: '',
          numero_serie: '',
          imei: '',
          chip_iccid: '',
          plataforma: 'rede_veiculos',
          id_plataforma: '',
          status: 'estoque',
          veiculo_id: null,
        });
      }
    }
  }, [open, rastreador, form]);

  // Clear veiculo_id when status changes from 'instalado' to something else
  useEffect(() => {
    if (watchStatus !== 'instalado') {
      form.setValue('veiculo_id', null);
    }
  }, [watchStatus, form]);

  const onSubmit = async (data: RastreadorFormData) => {
    try {
      const payload = {
        codigo: data.codigo,
        plataforma: data.plataforma,
        status: data.status,
        numero_serie: data.numero_serie || null,
        imei: data.imei || null,
        chip_iccid: data.chip_iccid || null,
        id_plataforma: data.id_plataforma || null,
        veiculo_id: data.status === 'instalado' ? data.veiculo_id : null,
      };

      if (isEditing && rastreadorId) {
        await updateRastreador.mutateAsync({ id: rastreadorId, ...payload });
      } else {
        await createRastreador.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving rastreador:', error);
    }
  };

  // Get available vehicles (include current vehicle if editing)
  const availableVeiculos = veiculos || [];
  const currentVeiculo = rastreador?.veiculos;
  const veiculoOptions = currentVeiculo
    ? [currentVeiculo, ...availableVeiculos.filter(v => v.id !== currentVeiculo.id)]
    : availableVeiculos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Rastreador' : 'Novo Rastreador'}
          </DialogTitle>
        </DialogHeader>

        {isLoadingRastreador && rastreadorId ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="codigo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código *</FormLabel>
                      <FormControl>
                        <Input placeholder="RAT-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="numero_serie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Série</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="SN123456"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="imei"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IMEI</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="123456789012345"
                          maxLength={15}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="chip_iccid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ICCID do Chip</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="89550534..."
                          maxLength={20}
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="plataforma"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plataforma *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PLATAFORMA_RASTREADOR_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="id_plataforma"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID na Plataforma</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ID externo"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(STATUS_RASTREADOR_LABELS).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchStatus === 'instalado' && (
                <FormField
                  control={form.control}
                  name="veiculo_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Veículo *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um veículo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {veiculoOptions.length === 0 && (
                            <SelectItem value="none" disabled>
                              Nenhum veículo disponível
                            </SelectItem>
                          )}
                          {veiculoOptions.map((veiculo) => (
                            <SelectItem key={veiculo.id} value={veiculo.id}>
                              {veiculo.placa} - {veiculo.marca} {veiculo.modelo}
                              {'associados' in veiculo && veiculo.associados && ` (${(veiculo.associados as { nome: string }).nome})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEditing ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

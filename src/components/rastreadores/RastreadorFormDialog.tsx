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
import { usePlataformasOptions } from '@/hooks/usePlataformasCRUD';
import { useProfissionaisEquipe } from '@/hooks/useEquipe';
import { STATUS_RASTREADOR_LABELS } from '@/types/database';

// Schema para criação (simplificado)
const createRastreadorSchema = z.object({
  imei: z.string()
    .min(15, 'IMEI deve ter pelo menos 15 dígitos')
    .max(17, 'IMEI deve ter no máximo 17 dígitos')
    .refine((val) => /^\d{15,17}$/.test(val), {
      message: 'IMEI deve conter apenas dígitos numéricos',
    }),
  plataforma: z.string().min(1, 'Plataforma é obrigatória'),
  status: z.enum(['estoque', 'manutencao', 'baixado'] as const).default('estoque'),
  portador_id: z.string().uuid().optional().nullable(),
});

// Schema para edição (completo)
const editRastreadorSchema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório').max(50),
  numero_serie: z.string().max(100).optional().nullable(),
  imei: z.string().max(17).optional().nullable().refine(
    (val) => !val || /^\d{15,17}$/.test(val),
    { message: 'IMEI deve ter entre 15 e 17 dígitos numéricos' }
  ),
  chip_iccid: z.string().max(20).optional().nullable(),
  plataforma: z.string().min(1, 'Plataforma é obrigatória'),
  id_plataforma: z.string().max(100).optional().nullable(),
  status: z.enum(['estoque', 'instalado', 'manutencao', 'baixado'] as const),
  veiculo_id: z.string().uuid().optional().nullable(),
  portador_id: z.string().uuid().optional().nullable(),
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

type CreateRastreadorFormData = z.infer<typeof createRastreadorSchema>;
type EditRastreadorFormData = z.infer<typeof editRastreadorSchema>;
type RastreadorFormData = CreateRastreadorFormData | EditRastreadorFormData;

interface RastreadorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreadorId?: string | null;
}

// Status disponíveis para criação (sem "instalado")
const STATUS_CRIACAO = {
  estoque: 'Em Estoque',
  manutencao: 'Manutenção',
  baixado: 'Baixado',
} as const;

export function RastreadorFormDialog({
  open,
  onOpenChange,
  rastreadorId,
}: RastreadorFormDialogProps) {
  const { data: rastreador, isLoading: isLoadingRastreador } = useRastreador(
    rastreadorId || undefined
  );
  const { data: veiculos } = useVeiculosSemRastreador();
  const { data: plataformas, isLoading: loadingPlataformas } = usePlataformasOptions();
  const { data: profissionais, isLoading: loadingProfissionais } = useProfissionaisEquipe();
  const createRastreador = useCreateRastreador();
  const updateRastreador = useUpdateRastreador();

  const isEditing = !!rastreadorId;
  const defaultPlataforma = plataformas?.[0]?.codigo || 'softruck';
  const isLoading = createRastreador.isPending || updateRastreador.isPending;

  // Use schema diferente para criar vs editar
  const form = useForm<EditRastreadorFormData>({
    resolver: zodResolver(isEditing ? editRastreadorSchema : createRastreadorSchema as any),
    defaultValues: {
      codigo: '',
      numero_serie: '',
      imei: '',
      chip_iccid: '',
      plataforma: defaultPlataforma,
      id_plataforma: '',
      status: 'estoque',
      veiculo_id: null,
      portador_id: null,
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
          portador_id: rastreador.portador_id || null,
        });
      } else {
        form.reset({
          codigo: '',
          numero_serie: '',
          imei: '',
          chip_iccid: '',
          plataforma: defaultPlataforma,
          id_plataforma: '',
          status: 'estoque',
          veiculo_id: null,
          portador_id: null,
        });
      }
    }
  }, [open, rastreador, form, defaultPlataforma]);

  // Clear veiculo_id when status changes from 'instalado' to something else
  useEffect(() => {
    if (watchStatus !== 'instalado') {
      form.setValue('veiculo_id', null);
    }
  }, [watchStatus, form]);

  // Clear portador_id when status changes from 'estoque' to something else
  useEffect(() => {
    if (watchStatus !== 'estoque') {
      form.setValue('portador_id', null);
    }
  }, [watchStatus, form]);

  const onSubmit = async (data: EditRastreadorFormData) => {
    try {
      if (isEditing && rastreadorId) {
        // Edição: manter estrutura completa
        const payload = {
          codigo: data.codigo,
          plataforma: data.plataforma,
          status: data.status,
          numero_serie: data.numero_serie || null,
          imei: data.imei || null,
          chip_iccid: data.chip_iccid || null,
          id_plataforma: data.id_plataforma || null,
          veiculo_id: data.status === 'instalado' ? data.veiculo_id : null,
          portador_id: data.status === 'estoque' ? (data.portador_id || null) : null,
        };
        await updateRastreador.mutateAsync({ id: rastreadorId, ...payload });
      } else {
        // Criação: gerar código automaticamente a partir do IMEI
        const payload = {
          codigo: `RAT-${data.imei}`,
          imei: data.imei,
          plataforma: data.plataforma,
          status: data.status || 'estoque',
          portador_id: data.status === 'estoque' ? (data.portador_id || null) : null,
          numero_serie: null,
          chip_iccid: null,
          id_plataforma: null,
          veiculo_id: null,
        };
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
              {/* ===== FORMULÁRIO DE CRIAÇÃO (SIMPLIFICADO) ===== */}
              {!isEditing && (
                <>
                  {/* IMEI - Obrigatório */}
                  <FormField
                    control={form.control}
                    name="imei"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IMEI *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000000000000000"
                            maxLength={17}
                            inputMode="numeric"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              field.onChange(value);
                            }}
                            className="font-mono"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Plataforma - Obrigatório */}
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
                            {loadingPlataformas ? (
                              <SelectItem value="" disabled>Carregando...</SelectItem>
                            ) : plataformas?.map((p) => (
                              <SelectItem key={p.codigo} value={p.codigo}>
                                {p.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Status - Opcional (sem "instalado") */}
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Em Estoque" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(STATUS_CRIACAO).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Portador - Apenas quando status = estoque */}
                  {watchStatus === 'estoque' && (
                    <FormField
                      control={form.control}
                      name="portador_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Atribuir a Vistoriador (Porte)</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === 'none' ? null : val)}
                            value={field.value || 'none'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Nenhum portador" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nenhum portador</SelectItem>
                              {loadingProfissionais ? (
                                <SelectItem value="loading" disabled>Carregando...</SelectItem>
                              ) : (
                                profissionais?.filter(p => p.ativo).map((prof) => (
                                  <SelectItem key={prof.id} value={prof.id}>
                                    {prof.nome}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              {/* ===== FORMULÁRIO DE EDIÇÃO (COMPLETO) ===== */}
              {isEditing && (
                <>
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
                              placeholder="000000000000000"
                              maxLength={17}
                              inputMode="numeric"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                field.onChange(value);
                              }}
                              className="font-mono"
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
                              {loadingPlataformas ? (
                                <SelectItem value="" disabled>Carregando...</SelectItem>
                              ) : plataformas?.map((p) => (
                                <SelectItem key={p.codigo} value={p.codigo}>
                                  {p.nome}
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

                  {watchStatus === 'estoque' && (
                    <FormField
                      control={form.control}
                      name="portador_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Portador (Profissional Responsável)</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === 'none' ? null : val)}
                            value={field.value || 'none'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Nenhum portador atribuído" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Nenhum portador</SelectItem>
                              {loadingProfissionais ? (
                                <SelectItem value="loading" disabled>Carregando...</SelectItem>
                              ) : (
                                profissionais?.filter(p => p.ativo).map((prof) => (
                                  <SelectItem key={prof.id} value={prof.id}>
                                    {prof.nome}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
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

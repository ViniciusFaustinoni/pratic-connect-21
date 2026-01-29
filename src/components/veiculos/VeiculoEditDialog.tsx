import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Car, AlertTriangle, RefreshCw } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUpdateVeiculo } from '@/hooks/useVeiculos';
import { toast } from 'sonner';

// Lista de cores padrão para veículos
const CORES_VEICULO = [
  'BRANCO',
  'PRETO',
  'PRATA',
  'CINZA',
  'VERMELHO',
  'AZUL',
  'VERDE',
  'AMARELO',
  'LARANJA',
  'MARROM',
  'BEGE',
  'DOURADO',
  'VINHO',
  'ROSA',
  'OUTRO',
];

const TIPOS_VEICULO = [
  { value: 'carro', label: 'Carro' },
  { value: 'moto', label: 'Moto' },
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'van', label: 'Van' },
  { value: 'onibus', label: 'Ônibus' },
];

// Schema de validação
const veiculoEditSchema = z.object({
  cor: z.string().min(1, 'Cor é obrigatória'),
  placa: z.string().min(7, 'Placa inválida').max(8, 'Placa inválida'),
  chassi: z.string().optional(),
  renavam: z.string().optional(),
  valor_fipe: z.number().min(0, 'Valor inválido').optional(),
  codigo_fipe: z.string().optional(),
  tipo: z.string().optional(),
  permitir_edicao_placa: z.boolean().default(false),
  permitir_edicao_chassi: z.boolean().default(false),
});

type VeiculoEditFormData = z.infer<typeof veiculoEditSchema>;

interface Veiculo {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  ano_fabricacao?: number | null;
  ano_modelo?: number | null;
  cor: string | null;
  chassi: string | null;
  renavam: string | null;
  tipo?: string | null;
  valor_fipe?: number | null;
  codigo_fipe?: string | null;
  rede_veiculos_veiculo_id?: string | null;
}

interface VeiculoEditDialogProps {
  open: boolean;
  onClose: () => void;
  veiculo: Veiculo | null;
}

export function VeiculoEditDialog({ open, onClose, veiculo }: VeiculoEditDialogProps) {
  const updateVeiculo = useUpdateVeiculo();
  const [isReconsultandoFipe, setIsReconsultandoFipe] = useState(false);

  const form = useForm<VeiculoEditFormData>({
    resolver: zodResolver(veiculoEditSchema),
    defaultValues: {
      cor: '',
      placa: '',
      chassi: '',
      renavam: '',
      valor_fipe: 0,
      codigo_fipe: '',
      tipo: 'carro',
      permitir_edicao_placa: false,
      permitir_edicao_chassi: false,
    },
  });

  // Atualizar form quando veículo mudar
  useEffect(() => {
    if (veiculo) {
      form.reset({
        cor: veiculo.cor || '',
        placa: veiculo.placa || '',
        chassi: veiculo.chassi || '',
        renavam: veiculo.renavam || '',
        valor_fipe: veiculo.valor_fipe || 0,
        codigo_fipe: veiculo.codigo_fipe || '',
        tipo: veiculo.tipo || 'carro',
        permitir_edicao_placa: false,
        permitir_edicao_chassi: false,
      });
    }
  }, [veiculo, form]);

  const permitirEdicaoPlaca = form.watch('permitir_edicao_placa');
  const permitirEdicaoChassi = form.watch('permitir_edicao_chassi');
  const temVinculoRedeVeiculos = !!veiculo?.rede_veiculos_veiculo_id;

  const handleSubmit = async (data: VeiculoEditFormData) => {
    if (!veiculo) return;

    try {
      // Montar apenas os campos que foram alterados
      const camposAlterados: Record<string, unknown> = {};

      if (data.cor !== veiculo.cor) {
        camposAlterados.cor = data.cor;
      }
      if (data.placa !== veiculo.placa && data.permitir_edicao_placa) {
        camposAlterados.placa = data.placa;
      }
      if (data.chassi !== veiculo.chassi && data.permitir_edicao_chassi) {
        camposAlterados.chassi = data.chassi;
      }
      if (data.renavam !== veiculo.renavam) {
        camposAlterados.renavam = data.renavam;
      }
      if (data.valor_fipe !== veiculo.valor_fipe) {
        camposAlterados.valor_fipe = data.valor_fipe;
      }
      if (data.codigo_fipe !== veiculo.codigo_fipe) {
        camposAlterados.codigo_fipe = data.codigo_fipe;
      }
      if (data.tipo !== veiculo.tipo) {
        camposAlterados.tipo = data.tipo;
      }

      if (Object.keys(camposAlterados).length === 0) {
        toast.info('Nenhuma alteração detectada');
        return;
      }

      await updateVeiculo.mutateAsync({
        id: veiculo.id,
        ...camposAlterados,
      });

      toast.success('Veículo atualizado com sucesso');
      onClose();
    } catch (error) {
      console.error('Erro ao atualizar veículo:', error);
      toast.error('Erro ao atualizar veículo');
    }
  };

  const handleReconsultarFipe = async () => {
    if (!veiculo) return;
    
    setIsReconsultandoFipe(true);
    try {
      // Aqui seria a chamada para reconsultar FIPE
      // Por enquanto, apenas simula
      toast.info('Funcionalidade de reconsulta FIPE será implementada');
    } catch (error) {
      toast.error('Erro ao reconsultar FIPE');
    } finally {
      setIsReconsultandoFipe(false);
    }
  };

  if (!veiculo) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Editar Veículo
          </DialogTitle>
          <DialogDescription>
            {veiculo.marca} {veiculo.modelo} • {veiculo.placa}
            {temVinculoRedeVeiculos && (
              <span className="ml-2 text-primary">
                (Sincronizado com Rede Veículos)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {temVinculoRedeVeiculos && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Este veículo está vinculado à plataforma Rede Veículos. 
              As alterações serão sincronizadas automaticamente.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Informações Básicas */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Dados Básicos</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a cor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CORES_VEICULO.map((cor) => (
                            <SelectItem key={cor} value={cor}>
                              {cor}
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
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TIPOS_VEICULO.map((tipo) => (
                            <SelectItem key={tipo.value} value={tipo.value}>
                              {tipo.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Separator />

            {/* Identificação - Campos Sensíveis */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Identificação</h4>
              
              {/* Placa */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Placa</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Permitir edição</span>
                    <FormField
                      control={form.control}
                      name="permitir_edicao_placa"
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="placa"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={!permitirEdicaoPlaca}
                          className="uppercase"
                          placeholder="ABC1D23"
                        />
                      </FormControl>
                      <FormDescription>
                        Editar apenas em caso de remarcação de placa
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Chassi */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Chassi</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Permitir edição</span>
                    <FormField
                      control={form.control}
                      name="permitir_edicao_chassi"
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="chassi"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={!permitirEdicaoChassi}
                          className="uppercase"
                          placeholder="9BWZZZ377VT004251"
                        />
                      </FormControl>
                      <FormDescription>
                        Editar apenas para correção de erro de digitação
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Renavam */}
              <FormField
                control={form.control}
                name="renavam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Renavam</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="00000000000" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Valor FIPE */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm text-muted-foreground">Tabela FIPE</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReconsultarFipe}
                  disabled={isReconsultandoFipe}
                >
                  {isReconsultandoFipe ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Reconsultar FIPE
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="codigo_fipe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código FIPE</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="001234-5" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valor_fipe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor FIPE (R$)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateVeiculo.isPending}>
                {updateVeiculo.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

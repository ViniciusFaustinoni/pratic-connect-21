import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Car, User, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SinistroCombobox } from './SinistroCombobox';

interface SinistroWithRelations {
  id: string;
  protocolo: string;
  tipo: string;
  status: string;
  associado_id: string;
  veiculo_id: string;
  tipo_dano?: string | null;
  valor_fipe?: number | null;
  valor_indenizacao?: number | null;
  associado: {
    id: string;
    nome: string;
  } | null;
  veiculo: {
    id: string;
    placa: string;
    marca: string | null;
    modelo: string | null;
    ano_fabricacao?: number | null;
    ano_modelo?: number | null;
  } | null;
}

interface NovaOSModalProps {
  open: boolean;
  onClose: () => void;
  sinistroId?: string;
}

const formSchema = z.object({
  oficina_id: z.string().min(1, 'Selecione uma oficina'),
  data_entrada: z.string().optional(),
  data_previsao: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export function NovaOSModal({ open, onClose, sinistroId }: NovaOSModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSinistro, setSelectedSinistro] = useState<SinistroWithRelations | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      oficina_id: '',
      data_entrada: format(new Date(), 'yyyy-MM-dd'),
      data_previsao: '',
      observacoes: '',
    },
  });

  // Buscar sinistro se sinistroId foi passado
  const { data: sinistroPreCarregado, isLoading: loadingSinistro } = useQuery({
    queryKey: ['sinistro-para-os', sinistroId],
    queryFn: async () => {
      if (!sinistroId) return null;
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          id,
          protocolo,
          tipo,
          status,
          associado_id,
          veiculo_id,
          tipo_dano,
          valor_fipe,
          valor_indenizacao,
          associado:associados(id, nome),
          veiculo:veiculos(id, placa, marca, modelo, ano_fabricacao, ano_modelo)
        `)
        .eq('id', sinistroId)
        .single();
      if (error) throw error;
      return data as SinistroWithRelations;
    },
    enabled: !!sinistroId,
  });

  // Buscar oficinas ativas
  const { data: oficinas = [] } = useQuery({
    queryKey: ['oficinas-ativas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('oficinas')
        .select('id, nome_fantasia, razao_social, cidade')
        .eq('status', 'ativo')
        .order('nome_fantasia');
      if (error) throw error;
      return data;
    },
  });

  // Setar sinistro pre-carregado quando carregar
  useEffect(() => {
    if (sinistroPreCarregado) {
      setSelectedSinistro(sinistroPreCarregado);
    }
  }, [sinistroPreCarregado]);

  // Resetar ao fechar
  useEffect(() => {
    if (!open) {
      form.reset();
      if (!sinistroId) {
        setSelectedSinistro(null);
      }
    }
  }, [open, sinistroId, form]);

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      if (!selectedSinistro) {
        throw new Error('Selecione um sinistro');
      }

      // O numero é gerado automaticamente por trigger no banco
      const { data, error } = await supabase
        .from('ordens_servico')
        .insert({
          numero: '', // Será sobrescrito pelo trigger gerar_numero_os
          sinistro_id: selectedSinistro.id,
          oficina_id: formData.oficina_id,
          veiculo_id: selectedSinistro.veiculo_id,
          associado_id: selectedSinistro.associado_id,
          data_entrada: formData.data_entrada || format(new Date(), 'yyyy-MM-dd'),
          data_previsao: formData.data_previsao || null,
          observacoes: formData.observacoes || null,
          status: 'aguardando_orcamento',
          criado_por: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar histórico
      await supabase.from('ordens_servico_historico').insert({
        ordem_servico_id: data.id,
        status_novo: 'aguardando_orcamento',
        usuario_id: user?.id,
        observacao: 'Ordem de serviço criada',
      });

      return data;
    },
    onSuccess: (data) => {
      toast.success(`OS ${data.numero} criada com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico-list'] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar ordem de serviço');
    },
  });

  const onSubmit = (data: FormData) => {
    if (!selectedSinistro) {
      toast.error('Selecione um sinistro');
      return;
    }
    
    // Validar se sinistro é Perda Total
    if (selectedSinistro.tipo_dano === 'perda_total') {
      toast.error('Não é possível criar OS para sinistros classificados como Perda Total. Este evento deve seguir para indenização.');
      return;
    }
    
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Serviço</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Sinistro Section */}
            {sinistroId ? (
              // Sinistro pré-carregado (readonly)
              loadingSinistro ? (
                <div className="p-4 bg-muted rounded-lg animate-pulse">
                  <div className="h-4 bg-muted-foreground/20 rounded w-1/2 mb-2" />
                  <div className="h-4 bg-muted-foreground/20 rounded w-3/4" />
                </div>
              ) : selectedSinistro ? (
                <SinistroInfoCard sinistro={selectedSinistro} />
              ) : null
            ) : (
              // Combobox para buscar sinistro
              <div className="space-y-2">
                <FormLabel>Sinistro *</FormLabel>
                <SinistroCombobox
                  value={selectedSinistro?.id}
                  onSelect={(sinistro) => setSelectedSinistro(sinistro)}
                />
                {selectedSinistro && (
                  <SinistroInfoCard sinistro={selectedSinistro} />
                )}
              </div>
            )}

            {/* Oficina */}
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
                      {oficinas.map((oficina) => (
                        <SelectItem key={oficina.id} value={oficina.id}>
                          {oficina.nome_fantasia || oficina.razao_social}
                          {oficina.cidade && (
                            <span className="text-muted-foreground ml-1">
                              - {oficina.cidade}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_entrada"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Entrada</FormLabel>
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
                    <FormLabel>Data Previsão</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Observações */}
            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações sobre a ordem de serviço..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando...' : 'Criar OS'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Componente interno para exibir dados do sinistro
function SinistroInfoCard({ sinistro }: { sinistro: SinistroWithRelations }) {
  const isPerdaTotal = sinistro.tipo_dano === 'perda_total';
  
  return (
    <div className={`p-4 rounded-lg space-y-3 ${isPerdaTotal ? 'bg-red-50 border border-red-200' : 'bg-muted'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${isPerdaTotal ? 'text-red-500' : 'text-orange-500'}`} />
          <span className="text-sm text-muted-foreground">Sinistro</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{sinistro.protocolo}</Badge>
          {sinistro.tipo_dano && (
            <Badge variant={isPerdaTotal ? 'destructive' : 'secondary'}>
              {isPerdaTotal ? 'Perda Total' : 'Dano Parcial'}
            </Badge>
          )}
        </div>
      </div>
      
      {isPerdaTotal && (
        <div className="flex items-start gap-2 p-2 bg-red-100 rounded text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>Este sinistro está classificado como Perda Total e não pode ter OS criada. Deve seguir para indenização.</span>
        </div>
      )}
      
      {sinistro.veiculo && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Veículo</span>
          </div>
          <span className="font-medium">
            {sinistro.veiculo.placa} - {sinistro.veiculo.marca} {sinistro.veiculo.modelo}
            {sinistro.veiculo.ano_modelo && ` ${sinistro.veiculo.ano_modelo}`}
          </span>
        </div>
      )}
      
      {sinistro.associado && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Associado</span>
          </div>
          <span>{sinistro.associado.nome}</span>
        </div>
      )}
    </div>
  );
}

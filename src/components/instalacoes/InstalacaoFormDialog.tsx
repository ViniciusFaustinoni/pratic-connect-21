import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAssociados, type AssociadoWithRelations } from '@/hooks/useAssociados';
import { useVeiculos } from '@/hooks/useVeiculos';
import { useCreateInstalacao, useUpdateInstalacao, useInstalacao, useRastreadoresEstoque } from '@/hooks/useInstalacoes';
import { useInstaladores } from '@/hooks/useRotas';
import { buscarCep } from '@/lib/cep';
import { PERIODO_LABELS } from '@/types/database';

const instalacaoSchema = z.object({
  associado_id: z.string().min(1, 'Selecione um associado'),
  veiculo_id: z.string().min(1, 'Selecione um veículo'),
  data_agendada: z.date({ required_error: 'Informe a data' }),
  periodo: z.enum(['manha', 'tarde', 'noite']),
  rastreador_id: z.string().optional().nullable(),
  instalador_id: z.string().optional().nullable(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  observacoes: z.string().optional(),
});

type InstalacaoFormData = z.infer<typeof instalacaoSchema>;

interface InstalacaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instalacaoId?: string;
}

export function InstalacaoFormDialog({ open, onOpenChange, instalacaoId }: InstalacaoFormDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const { data: instalacao, isLoading: loadingInstalacao } = useInstalacao(instalacaoId);
  const { data: associadosData, isLoading: loadingAssociados } = useAssociados();
  const associados = associadosData?.associados;
  const { data: veiculos, isLoading: loadingVeiculos } = useVeiculos();
  const { data: instaladores } = useInstaladores();
  const { data: rastreadores } = useRastreadoresEstoque();

  const createInstalacao = useCreateInstalacao();
  const updateInstalacao = useUpdateInstalacao();

  const form = useForm<InstalacaoFormData>({
    resolver: zodResolver(instalacaoSchema),
    defaultValues: {
      associado_id: '',
      veiculo_id: '',
      periodo: 'manha',
      rastreador_id: null,
      instalador_id: null,
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      observacoes: '',
    },
  });

  const selectedAssociadoId = form.watch('associado_id');

  // Filter vehicles by selected associado
  const veiculosFiltrados = veiculos?.filter(v => v.associado_id === selectedAssociadoId) || [];

  // Reset form when dialog opens/closes or instalacao changes
  useEffect(() => {
    if (open) {
      setStep(1);
      if (instalacao) {
        form.reset({
          associado_id: instalacao.associado_id,
          veiculo_id: instalacao.veiculo_id,
          data_agendada: new Date(instalacao.data_agendada),
          periodo: instalacao.periodo,
          rastreador_id: instalacao.rastreador_id || null,
          instalador_id: instalacao.instalador_id || null,
          cep: instalacao.cep || '',
          logradouro: instalacao.logradouro || '',
          numero: instalacao.numero || '',
          complemento: instalacao.complemento || '',
          bairro: instalacao.bairro || '',
          cidade: instalacao.cidade || '',
          uf: instalacao.uf || '',
          observacoes: instalacao.observacoes || '',
        });
      } else {
        form.reset({
          associado_id: '',
          veiculo_id: '',
          periodo: 'manha',
          rastreador_id: null,
          instalador_id: null,
          cep: '',
          logradouro: '',
          numero: '',
          complemento: '',
          bairro: '',
          cidade: '',
          uf: '',
          observacoes: '',
        });
      }
    }
  }, [open, instalacao, form]);

  // Preencher endereço do associado quando selecionado
  useEffect(() => {
    if (selectedAssociadoId && !instalacaoId) {
      const associado = associados?.find(a => a.id === selectedAssociadoId);
      if (associado) {
        form.setValue('cep', associado.cep || '');
        form.setValue('logradouro', associado.logradouro || '');
        form.setValue('numero', associado.numero || '');
        form.setValue('complemento', associado.complemento || '');
        form.setValue('bairro', associado.bairro || '');
        form.setValue('cidade', associado.cidade || '');
        form.setValue('uf', associado.uf || '');
      }
    }
  }, [selectedAssociadoId, associados, form, instalacaoId]);

  const handleBuscarCep = async () => {
    const cep = form.getValues('cep');
    if (!cep || cep.length < 8) return;

    setBuscandoCep(true);
    try {
      const endereco = await buscarCep(cep);
      if (endereco) {
        form.setValue('logradouro', endereco.logradouro);
        form.setValue('bairro', endereco.bairro);
        form.setValue('cidade', endereco.cidade);
        form.setValue('uf', endereco.uf);
      }
    } catch (error) {
      toast({
        title: 'Erro ao buscar CEP',
        description: 'Verifique o CEP informado',
        variant: 'destructive',
      });
    } finally {
      setBuscandoCep(false);
    }
  };

  const onSubmit = async (data: InstalacaoFormData) => {
    try {
      const payload = {
        associado_id: data.associado_id,
        veiculo_id: data.veiculo_id,
        data_agendada: format(data.data_agendada, 'yyyy-MM-dd'),
        periodo: data.periodo,
        rastreador_id: data.rastreador_id || null,
        instalador_id: data.instalador_id || null,
        cep: data.cep || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        complemento: data.complemento || null,
        bairro: data.bairro || null,
        cidade: data.cidade || null,
        uf: data.uf || null,
        observacoes: data.observacoes || null,
      };

      if (instalacaoId) {
        await updateInstalacao.mutateAsync({ id: instalacaoId, data: payload });
        toast({ title: 'Instalação atualizada com sucesso!' });
      } else {
        await createInstalacao.mutateAsync(payload);
        toast({ title: 'Instalação agendada com sucesso!' });
      }

      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erro ao salvar instalação',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const isSubmitting = createInstalacao.isPending || updateInstalacao.isPending;

  const canProceedStep1 = form.watch('associado_id') && form.watch('veiculo_id');
  const canProceedStep2 = form.watch('data_agendada');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {instalacaoId ? 'Editar Instalação' : 'Nova Instalação'}
          </DialogTitle>
        </DialogHeader>

        {loadingInstalacao ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Step indicators */}
              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={cn(
                      'flex-1 h-1 rounded-full transition-colors',
                      step >= s ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                ))}
              </div>

              {/* Step 1: Associado e Veículo */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Etapa 1 de 4: Associado e Veículo
                  </h3>

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
                            {loadingAssociados ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">
                                Carregando...
                              </div>
                            ) : (
                              associados?.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.nome} - {a.telefone}
                                </SelectItem>
                              ))
                            )}
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
                              <SelectValue placeholder={
                                !selectedAssociadoId 
                                  ? 'Selecione um associado primeiro' 
                                  : 'Selecione o veículo'
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loadingVeiculos ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">
                                Carregando...
                              </div>
                            ) : veiculosFiltrados.length === 0 ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">
                                Nenhum veículo encontrado
                              </div>
                            ) : (
                              veiculosFiltrados.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                  {v.placa} - {v.marca} {v.modelo} {v.ano_modelo}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button 
                      type="button" 
                      onClick={() => setStep(2)}
                      disabled={!canProceedStep1}
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Agendamento */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Etapa 2 de 4: Agendamento
                  </h3>

                  <FormField
                    control={form.control}
                    name="data_agendada"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data da Instalação *</FormLabel>
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
                              disabled={(date) => date < new Date()}
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
                    name="periodo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Período *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(PERIODO_LABELS).map(([value, label]) => (
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

                  <FormField
                    control={form.control}
                    name="instalador_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instalador</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o instalador (opcional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Nenhum</SelectItem>
                            {instaladores?.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.nome}
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
                    name="rastreador_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rastreador</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o rastreador (opcional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Nenhum</SelectItem>
                            {rastreadores?.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.codigo} - {r.numero_serie || r.imei}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      Voltar
                    </Button>
                    <Button 
                      type="button" 
                      onClick={() => setStep(3)}
                      disabled={!canProceedStep2}
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Endereço */}
              {step === 3 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Etapa 3 de 4: Endereço da Instalação
                  </h3>

                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name="cep"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>CEP</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input {...field} placeholder="00000-000" maxLength={9} />
                            </FormControl>
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={handleBuscarCep}
                              disabled={buscandoCep}
                            >
                              {buscandoCep ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="logradouro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logradouro</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Rua, Avenida, etc." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name="numero"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="123" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="complemento"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Complemento</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Apto, Bloco, etc." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="bairro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Bairro" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <FormField
                      control={form.control}
                      name="cidade"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Cidade" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="uf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>UF</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="UF" maxLength={2} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
                      Voltar
                    </Button>
                    <Button type="button" onClick={() => setStep(4)}>
                      Próximo
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Observações */}
              {step === 4 && (
                <div className="space-y-4">
                  <h3 className="font-medium text-sm text-muted-foreground">
                    Etapa 4 de 4: Observações
                  </h3>

                  <FormField
                    control={form.control}
                    name="observacoes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Informações adicionais sobre a instalação..."
                            rows={4}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setStep(3)}>
                      Voltar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {instalacaoId ? 'Salvar Alterações' : 'Agendar Instalação'}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

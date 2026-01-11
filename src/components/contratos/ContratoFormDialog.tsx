import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Search, User, Check, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CurrencyInput } from '@/components/inputs/MaskedInputs';
import { useAllLeads } from '@/hooks/useLeads';
import { usePlanos } from '@/hooks/usePlanos';
import { useCreateContrato } from '@/hooks/useContratos';
import { useCotacoesByLead } from '@/hooks/useCotacoesByLead';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  lead_id: z.string().min(1, 'Selecione um lead'),
  plano_id: z.string().min(1, 'Selecione um plano'),
  valor_adesao: z.number().min(0, 'Informe o valor de adesão'),
  valor_mensal: z.number().min(0, 'Informe o valor mensal'),
  dia_vencimento: z.number().min(1).max(28).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ContratoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContratoFormDialog({ open, onOpenChange }: ContratoFormDialogProps) {
  const [leadSearchOpen, setLeadSearchOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: leads } = useAllLeads();
  const { data: planos } = usePlanos();
  const createContrato = useCreateContrato();

  // Filter leads that can become contracts (not lost, not already won)
  const availableLeads = leads?.filter(l => 
    l.etapa !== 'perdido' && l.etapa !== 'ganho'
  ) || [];

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lead_id: '',
      plano_id: '',
      valor_adesao: 0,
      valor_mensal: 0,
      dia_vencimento: 10,
    },
  });

  const selectedLeadId = form.watch('lead_id');
  const selectedPlanoId = form.watch('plano_id');

  const selectedLead = availableLeads.find(l => l.id === selectedLeadId);
  const selectedPlano = planos?.find(p => p.id === selectedPlanoId);

  // Buscar cotações do lead selecionado
  const { data: cotacoesLead } = useCotacoesByLead(selectedLeadId || undefined);

  // Priorizar cotação: aceita > enviada > mais recente (não expirada)
  const cotacaoPrioritaria = useMemo(() => {
    if (!cotacoesLead?.length) return null;
    
    return cotacoesLead.find(c => c.status === 'aceita')
      || cotacoesLead.find(c => c.status === 'enviada')
      || cotacoesLead.find(c => c.status !== 'expirada')
      || null;
  }, [cotacoesLead]);

  // Auto-preencher valores quando encontrar cotação
  useEffect(() => {
    if (cotacaoPrioritaria) {
      if (cotacaoPrioritaria.plano_id) {
        form.setValue('plano_id', cotacaoPrioritaria.plano_id);
      }
      if (cotacaoPrioritaria.valor_total_mensal) {
        form.setValue('valor_mensal', Number(cotacaoPrioritaria.valor_total_mensal));
      }
      if (cotacaoPrioritaria.valor_adesao) {
        form.setValue('valor_adesao', Number(cotacaoPrioritaria.valor_adesao));
      }
    }
  }, [cotacaoPrioritaria, form]);

  // Update values when plano changes (se não tiver cotação)
  useEffect(() => {
    if (selectedPlano && !cotacaoPrioritaria) {
      form.setValue('valor_adesao', selectedPlano.valor_adesao);
    }
  }, [selectedPlano, cotacaoPrioritaria, form]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await createContrato.mutateAsync({
        lead_id: data.lead_id,
        plano_id: data.plano_id,
        valor_adesao: data.valor_adesao,
        valor_mensal: data.valor_mensal,
        dia_vencimento: data.dia_vencimento,
        data_inicio: new Date().toISOString().split('T')[0],
        status: 'rascunho',
        cotacao_id: cotacaoPrioritaria?.id || null,
      });

      toast.success('Contrato criado como rascunho');
      onOpenChange(false);
      form.reset();
    } catch (error) {
      toast.error('Erro ao criar contrato');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Contrato</DialogTitle>
          <DialogDescription>
            Crie um contrato manualmente selecionando um lead e plano
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Lead Selection */}
            <FormField
              control={form.control}
              name="lead_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Lead *</FormLabel>
                  <Popover open={leadSearchOpen} onOpenChange={setLeadSearchOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {selectedLead ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <span>{selectedLead.nome}</span>
                              <span className="text-xs text-muted-foreground">
                                ({selectedLead.telefone})
                              </span>
                            </div>
                          ) : (
                            "Selecione um lead..."
                          )}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nome ou telefone..." />
                        <CommandList>
                          <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
                          <CommandGroup>
                            {availableLeads.map((lead) => (
                              <CommandItem
                                key={lead.id}
                                value={`${lead.nome} ${lead.telefone}`}
                                onSelect={() => {
                                  form.setValue('lead_id', lead.id);
                                  setLeadSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    lead.id === field.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{lead.nome}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {lead.telefone}
                                    {lead.veiculo_marca && ` • ${lead.veiculo_marca} ${lead.veiculo_modelo || ''}`}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Lead Info Preview - com dados da cotação */}
            {selectedLead && (
              <div className="rounded-lg border p-3 bg-muted/50 text-sm space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Veículo:</span>
                    <p className="font-medium">
                      {cotacaoPrioritaria?.veiculo_marca 
                        ? `${cotacaoPrioritaria.veiculo_marca} ${cotacaoPrioritaria.veiculo_modelo || ''} ${selectedLead.veiculo_ano || ''}`
                        : selectedLead.veiculo_marca 
                          ? `${selectedLead.veiculo_marca} ${selectedLead.veiculo_modelo || ''} ${selectedLead.veiculo_ano || ''}`
                          : 'Não informado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">FIPE:</span>
                    <p className="font-medium">
                      {cotacaoPrioritaria?.valor_fipe 
                        ? formatCurrency(Number(cotacaoPrioritaria.valor_fipe))
                        : selectedLead.veiculo_fipe 
                          ? formatCurrency(selectedLead.veiculo_fipe)
                          : 'Não informado'}
                    </p>
                  </div>
                </div>
                
                {/* Indicador de cotação encontrada */}
                {cotacaoPrioritaria && (
                  <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileCheck className="h-3.5 w-3.5 text-green-500" />
                    <span>
                      Cotação <strong className="text-foreground">{cotacaoPrioritaria.numero}</strong> encontrada 
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-xs">
                        {cotacaoPrioritaria.status}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Plano Selection */}
            <FormField
              control={form.control}
              name="plano_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plano *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um plano" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {planos?.filter(p => p.ativo).map((plano) => (
                        <SelectItem key={plano.id} value={plano.id}>
                          {plano.nome} - Adesão: {formatCurrency(plano.valor_adesao)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Values */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="valor_adesao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Adesão *</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor_mensal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Mensal *</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Dia Vencimento */}
            <FormField
              control={form.control}
              name="dia_vencimento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia de Vencimento</FormLabel>
                  <Select 
                    onValueChange={(v) => field.onChange(parseInt(v))} 
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o dia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
                        <SelectItem key={dia} value={dia.toString()}>
                          Dia {dia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Rascunho
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
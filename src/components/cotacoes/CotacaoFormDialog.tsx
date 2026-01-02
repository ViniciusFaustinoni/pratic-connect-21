import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Calculator } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CurrencyInput } from '@/components/inputs/MaskedInputs';
import { cotacaoSchema, type CotacaoFormData } from '@/lib/validations';
import { useCreateCotacao } from '@/hooks/useCotacoes';
import { usePlanos, useTabelaPrecoByFipe } from '@/hooks/usePlanos';
import { useLead } from '@/hooks/useLeads';
import { toast } from 'sonner';

interface CotacaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
}

export function CotacaoFormDialog({ open, onOpenChange, leadId }: CotacaoFormDialogProps) {
  const createCotacao = useCreateCotacao();
  const { data: planos } = usePlanos();
  const { data: lead } = useLead(leadId);

  const form = useForm<CotacaoFormData>({
    resolver: zodResolver(cotacaoSchema),
    defaultValues: {
      lead_id: leadId || null,
      plano_id: '',
      valor_fipe: 0,
      valor_cota: 0,
      taxa_administrativa: 0,
      valor_rastreamento: 0,
      valor_adesao: 0,
      valor_total_mensal: 0,
      validade_dias: 7,
    },
  });

  const valorFipe = form.watch('valor_fipe');
  const planoId = form.watch('plano_id');
  const { data: tabelasPreco } = useTabelaPrecoByFipe(valorFipe);

  // Pre-fill from lead
  useEffect(() => {
    if (lead) {
      form.setValue('lead_id', lead.id);
      if (lead.veiculo_fipe) {
        form.setValue('valor_fipe', lead.veiculo_fipe);
      }
    }
  }, [lead, form]);

  // Calculate values when plano or valor_fipe changes
  useEffect(() => {
    if (planoId && tabelasPreco && tabelasPreco.length > 0) {
      const tabela = tabelasPreco.find(t => t.plano_id === planoId) || tabelasPreco[0];
      if (tabela) {
        form.setValue('valor_cota', tabela.valor_cota);
        form.setValue('taxa_administrativa', tabela.taxa_administrativa);
        form.setValue('valor_rastreamento', tabela.valor_rastreamento);
        form.setValue('valor_adesao', tabela.planos?.valor_adesao || 0);
        
        const total = tabela.valor_cota + tabela.taxa_administrativa + tabela.valor_rastreamento;
        form.setValue('valor_total_mensal', total);
      }
    }
  }, [planoId, tabelasPreco, form]);

  const valorCota = form.watch('valor_cota');
  const taxaAdmin = form.watch('taxa_administrativa');
  const valorRastreamento = form.watch('valor_rastreamento');
  const valorAdesao = form.watch('valor_adesao');
  const valorTotal = form.watch('valor_total_mensal');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const onSubmit = async (data: CotacaoFormData) => {
    try {
      await createCotacao.mutateAsync({
        lead_id: data.lead_id,
        plano_id: data.plano_id,
        valor_fipe: data.valor_fipe,
        valor_cota: data.valor_cota,
        taxa_administrativa: data.taxa_administrativa,
        valor_rastreamento: data.valor_rastreamento,
        valor_adesao: data.valor_adesao,
        valor_total_mensal: data.valor_total_mensal,
        validade_dias: data.validade_dias,
        status: 'rascunho',
      });
      toast.success('Cotação criada com sucesso!');
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao criar cotação');
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Cotação</DialogTitle>
          <DialogDescription>
            {lead ? `Cotação para ${lead.nome}` : 'Crie uma nova cotação'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Form */}
              <div className="space-y-4">
                {lead && (
                  <Card className="bg-muted/50">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">{lead.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.veiculo_marca} {lead.veiculo_modelo} {lead.veiculo_ano}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <FormField
                  control={form.control}
                  name="valor_fipe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor FIPE *</FormLabel>
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
                          {planos?.map((plano) => (
                            <SelectItem key={plano.id} value={plano.id}>
                              {plano.nome}
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
                  name="validade_dias"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Validade (dias)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={30}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right: Preview */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Calculator className="h-4 w-4" />
                    <span className="font-medium">Resumo da Cotação</span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor FIPE:</span>
                      <span>{formatCurrency(valorFipe)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cota mensal:</span>
                      <span>{formatCurrency(valorCota)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxa administrativa:</span>
                      <span>{formatCurrency(taxaAdmin)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rastreamento:</span>
                      <span>{formatCurrency(valorRastreamento)}</span>
                    </div>

                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-medium">
                        <span>Total Mensal:</span>
                        <span className="text-primary text-lg">{formatCurrency(valorTotal)}</span>
                      </div>
                    </div>

                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Adesão:</span>
                        <span>{formatCurrency(valorAdesao)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createCotacao.isPending}>
                {createCotacao.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Cotação
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

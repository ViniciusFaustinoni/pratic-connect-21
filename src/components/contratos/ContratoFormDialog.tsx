import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Search, User, Check, FileCheck, AlertTriangle, UserCheck, UserPlus } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { usePlanosUnificados } from '@/hooks/usePlanosUnificados';
import { PlanoCardSelecao } from '@/components/planos/PlanoCardSelecao';
import { useCreateContrato } from '@/hooks/useContratos';
import { useCotacoesByLead } from '@/hooks/useCotacoesByLead';
import { useVendedores } from '@/hooks/useVendedores';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  lead_id: z.string().optional().nullable(),
  plano_id: z.string().min(1, 'Selecione um plano'),
  valor_adesao: z.number().min(1, 'A taxa de filiação é obrigatória e deve ser maior que zero'),
  valor_adicional: z.number().min(0, 'Informe o valor adicional').optional(),
  dia_vencimento: z.number().min(1).max(28).optional(),
  vendedor_id: z.string().optional().nullable(),
  // Campos do cliente (quando não há lead selecionado)
  cliente_nome: z.string().optional(),
  cliente_email: z.string().email('Email inválido').optional().or(z.literal('')),
  cliente_telefone: z.string().optional(),
  cliente_cpf: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

// Dados pré-preenchidos vindos da cotação
export interface PrefilledCotacaoData {
  veiculo?: {
    placa?: string;
    marca?: string;
    modelo?: string;
    ano?: string;
    valorFipe?: number | null;
  };
  plano?: {
    id?: string;
    nome?: string;
    valorAdesao?: number;
    valorMensal?: number;
  };
  categoria?: string | null;
  regiao?: string;
  usoApp?: boolean;
}

interface ContratoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledData?: PrefilledCotacaoData | null;
}

export function ContratoFormDialog({ open, onOpenChange, prefilledData }: ContratoFormDialogProps) {
  const [leadSearchOpen, setLeadSearchOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  const { profile, isVendedor } = useAuth();
  const usuarioEhVendedor = isVendedor();

  const { data: leads } = useAllLeads();
  const { data: planos } = usePlanosUnificados();
  const createContrato = useCreateContrato();
  const { data: vendedores = [], isLoading: vendedoresLoading } = useVendedores();

  // Filter leads that can become contracts (not lost, not already won)
  const availableLeads = leads?.filter(l => 
    l.etapa !== 'perdido' && l.etapa !== 'ganho'
  ) || [];

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lead_id: '',
      plano_id: '',
      valor_adesao: 0, // Sempre inicia zerado - preenchimento manual obrigatório
      valor_adicional: 0,
      dia_vencimento: 10,
      vendedor_id: null,
      cliente_nome: '',
      cliente_email: '',
      cliente_telefone: '',
      cliente_cpf: '',
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

  // Auto-preencher APENAS o plano quando encontrar cotação (não preenche valores)
  useEffect(() => {
    if (cotacaoPrioritaria) {
      if (cotacaoPrioritaria.plano_id) {
        form.setValue('plano_id', cotacaoPrioritaria.plano_id);
      }
      // NÃO preenche valor_adesao - deve ser manual
    }
  }, [cotacaoPrioritaria, form]);

  // Valor adicional do formulário
  const valorAdicional = form.watch('valor_adicional') || 0;

  // Auto-preencher APENAS plano quando receber dados da cotação (prefilledData)
  useEffect(() => {
    if (open && prefilledData?.plano) {
      if (prefilledData.plano.id) {
        form.setValue('plano_id', prefilledData.plano.id);
      }
      // NÃO preenche valor_adesao - deve ser manual
    }
  }, [open, prefilledData, form]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Abre o popup de confirmação de adesão
  const onSubmit = (data: FormData) => {
    // Validação extra (redundante mas segura)
    if (data.valor_adesao <= 0) {
      toast.error('A taxa de filiação deve ser maior que zero!');
      return;
    }
    
    // Validação: precisa ter lead OU nome do cliente
    if (!data.lead_id && !data.cliente_nome?.trim()) {
      toast.error('Selecione um lead ou informe o nome do cliente');
      return;
    }
    
    // Guardar dados e abrir popup de confirmação
    setPendingFormData(data);
    setShowConfirmDialog(true);
  };

  // Handler quando confirmar no popup
  const handleConfirmSubmit = async () => {
    if (!pendingFormData) return;
    
    setShowConfirmDialog(false);
    setIsSubmitting(true);
    
    try {
      await createContrato.mutateAsync({
        lead_id: pendingFormData.lead_id || null,
        plano_id: pendingFormData.plano_id,
        valor_adesao: pendingFormData.valor_adesao,
        valor_mensal: valorAdicional, // Apenas o valor adicional - mensal virá do cálculo do plano
        dia_vencimento: pendingFormData.dia_vencimento,
        data_inicio: new Date().toISOString().split('T')[0],
        status: 'rascunho',
        cotacao_id: cotacaoPrioritaria?.id || null,
        vendedor_id: usuarioEhVendedor ? profile?.id : (pendingFormData.vendedor_id || null),
        // Campos para Termo de Afiliação (da cotação prioritária)
        codigo_fipe: cotacaoPrioritaria?.codigo_fipe || null,
        veiculo_combustivel: cotacaoPrioritaria?.veiculo_combustivel || null,
        veiculo_categoria: cotacaoPrioritaria?.categoria || cotacaoPrioritaria?.veiculo_categoria || null,
        uso_aplicativo: cotacaoPrioritaria?.uso_aplicativo || false,
        veiculo_marca: cotacaoPrioritaria?.veiculo_marca || selectedLead?.veiculo_marca || null,
        veiculo_modelo: cotacaoPrioritaria?.veiculo_modelo || selectedLead?.veiculo_modelo || null,
        veiculo_ano: cotacaoPrioritaria?.veiculo_ano || selectedLead?.veiculo_ano || null,
        veiculo_placa: cotacaoPrioritaria?.veiculo_placa || selectedLead?.veiculo_placa || null,
        veiculo_valor_fipe: cotacaoPrioritaria?.valor_fipe || selectedLead?.veiculo_fipe || null,
        veiculo_procedencia: cotacaoPrioritaria?.veiculo_procedencia || null,
        // Dados do cliente (quando não há lead)
        cliente_nome: pendingFormData.cliente_nome || selectedLead?.nome || null,
        cliente_email: pendingFormData.cliente_email || selectedLead?.email || null,
        cliente_telefone: pendingFormData.cliente_telefone || selectedLead?.telefone || null,
        cliente_cpf: pendingFormData.cliente_cpf || selectedLead?.cpf || null,
      });

      toast.success('Proposta criada como rascunho');
      onOpenChange(false);
      form.reset();
      setPendingFormData(null);
    } catch (error) {
      toast.error('Erro ao criar proposta');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Proposta</DialogTitle>
          <DialogDescription>
            Crie uma proposta manualmente selecionando um lead e plano
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Lead Selection (opcional) */}
            <FormField
              control={form.control}
              name="lead_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Lead (opcional)
                  </FormLabel>
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
                            "Selecione um lead existente..."
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
                            {/* Opção para limpar seleção */}
                            {field.value && (
                              <CommandItem
                                value="__clear__"
                                onSelect={() => {
                                  form.setValue('lead_id', '');
                                  setLeadSearchOpen(false);
                                }}
                                className="text-muted-foreground"
                              >
                                <span className="italic">Limpar seleção</span>
                              </CommandItem>
                            )}
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

            {/* Campos do cliente (quando não há lead selecionado) */}
            {!selectedLeadId && (
              <div className="rounded-lg border p-4 bg-muted/30 space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <UserPlus className="h-4 w-4 text-primary" />
                  <span>Dados do Cliente</span>
                  <span className="text-xs text-muted-foreground font-normal">(preencha se não houver lead)</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="cliente_nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Nome *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Nome do cliente" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cliente_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Email</FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            placeholder="email@exemplo.com" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cliente_telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Telefone</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="(00) 00000-0000" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="cliente_cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">CPF</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="000.000.000-00" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Consultor Responsável - Apenas para não-vendedores */}
            {!usuarioEhVendedor && (
              <FormField
                control={form.control}
                name="vendedor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-primary" />
                      Consultor Responsável
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === '_none' ? null : value)} 
                      value={field.value || '_none'}
                      disabled={vendedoresLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          {vendedoresLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SelectValue placeholder="Selecione um consultor" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">Não atribuído</SelectItem>
                        {vendedores.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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

                {/* Alerta se lead não tiver email */}
                {!selectedLead.email && (
                    <div className="pt-2 border-t border-amber-500/50 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium text-amber-500">Email não informado</p>
                        <p className="text-muted-foreground">
                          O email é obrigatório para enviar a proposta para assinatura. Edite o lead antes de criar a proposta.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Plano Selection - Visual Cards */}
            <FormField
              control={form.control}
              name="plano_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plano *</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-1">
                      {planos?.filter(p => p.ativo).map((plano) => (
                        <PlanoCardSelecao
                          key={plano.id}
                          plano={plano}
                          selecionado={field.value === plano.id}
                          onSelecionar={() => field.onChange(plano.id)}
                          compact
                          mostrarCoberturas
                        />
                      ))}
                    </div>
                  </FormControl>
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
                    <FormLabel>Taxa de Filiação *</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value}
                        onChange={field.onChange}
                        className={cn(
                          field.value <= 0 && "border-destructive bg-destructive/5"
                        )}
                      />
                    </FormControl>
                    {field.value <= 0 && (
                      <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                        <AlertTriangle className="h-3 w-3" />
                        A taxa de filiação não pode ser zero
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="valor_adicional"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Adicional</FormLabel>
                    <FormControl>
                      <CurrencyInput
                        value={field.value || 0}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground mt-1">
                      Opcional: valor extra além do plano
                    </p>
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
              <Button 
                type="submit" 
                disabled={isSubmitting || form.watch('valor_adesao') <= 0}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Rascunho
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Dialog de Confirmação de Valor de Adesão */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Taxa de Filiação</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Você está definindo a taxa de filiação como:</p>
                <div className="text-3xl font-bold text-center text-primary py-4 bg-primary/5 rounded-lg">
                  {formatCurrency(pendingFormData?.valor_adesao || 0)}
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Este valor será cobrado do associado. Confirma?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFormData(null)}>
              Revisar Valor
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit}>
              Confirmar e Criar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
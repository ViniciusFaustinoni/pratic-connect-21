import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Search, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CpfInput, TelefoneInput, PlacaInput, CurrencyInput } from '@/components/inputs/MaskedInputs';
import { leadSchema, type LeadFormData } from '@/lib/validations';
import { useCreateLead } from '@/hooks/useLeads';
import { useVendedores } from '@/hooks/useVendedores';
// Consultor removido - usar vendedor_id
import { ORIGEM_LABELS } from '@/types/database';
import { toast } from 'sonner';
import { useFipe } from '@/hooks/useFipe';
import { Badge } from '@/components/ui/badge';

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MARCAS = [
  'Volkswagen', 'Chevrolet', 'Fiat', 'Ford', 'Hyundai',
  'Toyota', 'Honda', 'Renault', 'Nissan', 'Jeep', 'Outra'
];

export function LeadFormDialog({ open, onOpenChange }: LeadFormDialogProps) {
  const [placaConsultada, setPlacaConsultada] = useState(false);
  const [marcaManual, setMarcaManual] = useState(false);
  const createLead = useCreateLead();
  const { data: vendedores = [] } = useVendedores();
  // Consultores removido - usar apenas vendedores
  const { loading: placaLoading, error: placaError, getByPlaca, clearError } = useFipe();
  
  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      nome: '',
      telefone: '',
      whatsapp: '',
      email: '',
      cpf: '',
      veiculo_marca: '',
      veiculo_modelo: '',
      veiculo_ano: null,
      veiculo_placa: '',
      veiculo_fipe: null,
      origem: 'telefone',
      vendedor_id: '',
      observacoes: '',
    },
  });

  // Consulta automática de placa via FIPE
  const handlePlacaLookup = async (placa: string) => {
    const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    if (placaLimpa.length !== 7) {
      setPlacaConsultada(false);
      return;
    }
    
    clearError();
    const result = await getByPlaca(placa);
    
    if (result.success && result.vehicleData) {
      const marcaFipe = result.vehicleData.marca || '';
      // Verifica se a marca está na lista, senão permite input manual
      if (MARCAS.includes(marcaFipe)) {
        form.setValue('veiculo_marca', marcaFipe);
        setMarcaManual(false);
      } else {
        form.setValue('veiculo_marca', marcaFipe);
        setMarcaManual(true);
      }
      
      form.setValue('veiculo_modelo', result.vehicleData.modelo || '');
      
      const anoStr = result.vehicleData.ano;
      const ano = anoStr ? parseInt(anoStr.split('/')[0]) : null;
      if (ano && !isNaN(ano)) {
        form.setValue('veiculo_ano', ano);
      }
      
      if (result.fipeData?.valor) {
        form.setValue('veiculo_fipe', result.fipeData.valor);
      }
      
      setPlacaConsultada(true);
      toast.success('Dados do veículo preenchidos automaticamente!');
    } else {
      setPlacaConsultada(false);
    }
  };

  const onSubmit = async (data: LeadFormData) => {
    try {
      await createLead.mutateAsync({
        nome: data.nome,
        telefone: data.telefone,
        email: data.email || null,
        cpf: data.cpf || null,
        veiculo_marca: data.veiculo_marca || null,
        veiculo_modelo: data.veiculo_modelo || null,
        veiculo_ano: data.veiculo_ano || null,
        veiculo_placa: data.veiculo_placa || null,
        veiculo_fipe: data.veiculo_fipe || null,
        origem: data.origem as 'site',
        vendedor_id: data.vendedor_id || null,
        // vendedor_id já está sendo passado acima
        observacoes: data.observacoes || null,
        etapa: 'novo',
      });
      toast.success('Lead criado com sucesso!');
      handleClose();
    } catch (error) {
      toast.error('Erro ao criar lead');
      console.error(error);
    }
  };

  const handleClose = () => {
    form.reset();
    setPlacaConsultada(false);
    setMarcaManual(false);
    clearError();
    onOpenChange(false);
  };

  const handleMarcaChange = (value: string) => {
    if (value === 'Outra') {
      setMarcaManual(true);
      form.setValue('veiculo_marca', '');
    } else {
      setMarcaManual(false);
      form.setValue('veiculo_marca', value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* SEÇÃO 1 - DADOS PESSOAIS */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2 uppercase tracking-wide">
                Dados Pessoais
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do cliente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <CpfInput value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <TelefoneInput value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp</FormLabel>
                      <FormControl>
                        <TelefoneInput value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SEÇÃO 2 - VEÍCULO */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2 uppercase tracking-wide">
                Veículo
              </h3>

              {/* Campo Placa com Consulta Automática */}
              <FormField
                control={form.control}
                name="veiculo_placa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      Placa
                      {placaConsultada && (
                        <Badge variant="secondary" className="text-xs font-normal">
                          <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                          FIPE consultada
                        </Badge>
                      )}
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <PlacaInput 
                          value={field.value || ''} 
                          onChange={(value) => {
                            field.onChange(value);
                            setPlacaConsultada(false);
                          }}
                          className="flex-1"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={placaLoading || !field.value || field.value.replace(/[^A-Za-z0-9]/g, '').length < 7}
                        onClick={() => handlePlacaLookup(field.value || '')}
                        title="Consultar placa na FIPE"
                      >
                        {placaLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {placaError && (
                      <p className="text-xs text-orange-500 mt-1">
                        {placaError} - Preencha manualmente
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="veiculo_marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca *</FormLabel>
                      {marcaManual || placaConsultada ? (
                        <FormControl>
                          <Input 
                            placeholder="Digite a marca" 
                            {...field} 
                            className={placaConsultada ? 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-700 dark:text-foreground' : ''}
                          />
                        </FormControl>
                      ) : (
                        <Select onValueChange={handleMarcaChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {MARCAS.map(marca => (
                              <SelectItem key={marca} value={marca}>{marca}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="veiculo_modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Civic, Corolla..." 
                          {...field} 
                          className={placaConsultada ? 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-700 dark:text-foreground' : ''}
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
                  name="veiculo_ano"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="2024" 
                          value={field.value ?? ''} 
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          className={placaConsultada ? 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-700 dark:text-foreground' : ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="veiculo_fipe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor FIPE</FormLabel>
                      <FormControl>
                        <CurrencyInput 
                          value={field.value ?? 0} 
                          onChange={field.onChange}
                          className={placaConsultada ? 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-700 dark:text-foreground' : ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* SEÇÃO 3 - ATRIBUIÇÃO */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground border-b pb-2 uppercase tracking-wide">
                Atribuição
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="origem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origem *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(ORIGEM_LABELS).map(([value, label]) => (
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
                  name="vendedor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendedor</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === '_none' ? null : value)} 
                        value={field.value || '_none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Não atribuído" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">Não atribuído</SelectItem>
                          {vendedores.map(v => (
                            <SelectItem key={v.id} value={v.user_id}>{v.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Campo consultor removido - usar apenas vendedor */}
              </div>

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Informações adicionais sobre o lead..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createLead.isPending}>
                {createLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Lead
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

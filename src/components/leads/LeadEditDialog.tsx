import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
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
import { useUpdateLead } from '@/hooks/useLeads';
import { ORIGEM_LABELS, ETAPA_LABELS, type Lead, type EtapaLead, type OrigemLead } from '@/types/database';
import { toast } from 'sonner';

interface LeadEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

import { ETAPAS_FUNIL } from '@/lib/lead-transitions';

const etapas = ETAPAS_FUNIL;

export function LeadEditDialog({ open, onOpenChange, lead }: LeadEditDialogProps) {
  const updateLead = useUpdateLead();

  const form = useForm<LeadFormData & { etapa: EtapaLead; motivo_perda?: string }>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      nome: '',
      telefone: '',
      email: '',
      cpf: '',
      veiculo_marca: '',
      veiculo_modelo: '',
      veiculo_ano: null,
      veiculo_placa: '',
      veiculo_fipe: null,
      origem: 'telefone',
      observacoes: '',
    },
  });

  // Reset form when lead changes
  useEffect(() => {
    if (lead) {
      form.reset({
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email || '',
        cpf: lead.cpf || '',
        veiculo_marca: lead.veiculo_marca || '',
        veiculo_modelo: lead.veiculo_modelo || '',
        veiculo_ano: lead.veiculo_ano || null,
        veiculo_placa: lead.veiculo_placa || '',
        veiculo_fipe: lead.veiculo_fipe || null,
        origem: lead.origem as OrigemLead,
        observacoes: lead.observacoes || '',
        etapa: lead.etapa,
        motivo_perda: lead.motivo_perda || '',
      });
    }
  }, [lead, form]);

  const onSubmit = async (data: LeadFormData & { etapa?: EtapaLead; motivo_perda?: string }) => {
    if (!lead) return;

    try {
      await updateLead.mutateAsync({
        id: lead.id,
        nome: data.nome,
        telefone: data.telefone,
        email: data.email || null,
        cpf: data.cpf || null,
        veiculo_marca: data.veiculo_marca || null,
        veiculo_modelo: data.veiculo_modelo || null,
        veiculo_ano: data.veiculo_ano || null,
        veiculo_placa: data.veiculo_placa || null,
        veiculo_fipe: data.veiculo_fipe || null,
        origem: data.origem as 'site', // Cast for Supabase compatibility
        observacoes: data.observacoes || null,
        etapa: data.etapa as 'novo', // Cast for Supabase compatibility
        motivo_perda: data.motivo_perda || null,
      });
      toast.success('Lead atualizado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao atualizar lead');
      console.error(error);
    }
  };

  const watchEtapa = form.watch('etapa');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
          <DialogDescription>Atualize as informações do lead</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Dados Pessoais */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Dados Pessoais</h4>
              
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

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@exemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Veículo */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Veículo</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="veiculo_marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input placeholder="Honda, Toyota..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="veiculo_modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="Civic, Corolla..." {...field} />
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
                      <FormLabel>Ano</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="2024"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="veiculo_placa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa</FormLabel>
                      <FormControl>
                        <PlacaInput value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="veiculo_fipe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor FIPE</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value ?? 0} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Origem e Etapa */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="origem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origem *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
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
                  name="etapa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Etapa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {etapas.map((etapa) => (
                            <SelectItem key={etapa} value={etapa}>
                              {ETAPA_LABELS[etapa]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {watchEtapa === 'perdido' && (
                <FormField
                  control={form.control}
                  name="motivo_perda"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo da Perda</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva o motivo da perda..."
                          className="resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Informações adicionais..."
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateLead.isPending}>
                {updateLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

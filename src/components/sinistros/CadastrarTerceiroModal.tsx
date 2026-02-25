import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CpfInput, TelefoneInput, PlacaInput } from '@/components/inputs/MaskedInputs';
import { validateCPF } from '@/lib/validations';
import { useCadastrarTerceiro } from '@/hooks/useTerceiros';
import { AlertTriangle, Loader2, Search } from 'lucide-react';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';

const schema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  cpf: z.string().min(14, 'CPF inválido').refine(validateCPF, 'CPF inválido'),
  telefone: z.string().min(14, 'Telefone inválido'),
  whatsapp: z.string().min(14, 'WhatsApp inválido'),
  email: z.string().email('E-mail inválido').or(z.literal('')).optional(),
  veiculo_placa: z.string().min(7, 'Placa inválida'),
  veiculo_marca: z.string().min(1, 'Marca é obrigatória'),
  veiculo_modelo: z.string().min(1, 'Modelo é obrigatório'),
  veiculo_ano: z.string().min(4, 'Ano é obrigatório'),
  veiculo_cor: z.string().min(1, 'Cor é obrigatória'),
  veiculo_fipe: z.number().optional(),
  culpa: z.enum(['associado_culpado', 'terceiro_culpado', 'compartilhada', 'a_definir']),
  parentesco: z.boolean(),
  parentesco_descricao: z.string().optional(),
  tipo_dano: z.enum(['veiculo', 'nao_veicular']),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistroId: string;
  placaAssociado?: string;
}

export function CadastrarTerceiroModal({ open, onOpenChange, sinistroId, placaAssociado }: Props) {
  const cadastrar = useCadastrarTerceiro();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: '',
      cpf: '',
      telefone: '',
      whatsapp: '',
      email: '',
      veiculo_placa: '',
      veiculo_marca: '',
      veiculo_modelo: '',
      veiculo_ano: '',
      veiculo_cor: '',
      culpa: 'a_definir',
      parentesco: false,
      parentesco_descricao: '',
      tipo_dano: 'veiculo',
      observacoes: '',
    },
  });

  const parentesco = form.watch('parentesco');
  const tipoDano = form.watch('tipo_dano');
  const culpa = form.watch('culpa');

  const onSubmit = async (values: FormData) => {
    // Validar placa diferente do associado
    if (placaAssociado) {
      const placaLimpa = values.veiculo_placa.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      const associadoLimpa = placaAssociado.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      if (placaLimpa === associadoLimpa) {
        form.setError('veiculo_placa', { message: 'Placa não pode ser igual à do associado' });
        return;
      }
    }

    await cadastrar.mutateAsync({
      sinistro_id: sinistroId,
      nome: values.nome,
      cpf: values.cpf,
      telefone: values.telefone,
      whatsapp: values.whatsapp,
      veiculo_placa: values.veiculo_placa,
      veiculo_marca: values.veiculo_marca,
      veiculo_modelo: values.veiculo_modelo,
      veiculo_ano: values.veiculo_ano,
      veiculo_cor: values.veiculo_cor,
      culpa: values.culpa,
      parentesco: values.parentesco,
      tipo_dano: values.tipo_dano,
      email: values.email || undefined,
      veiculo_fipe: values.veiculo_fipe || undefined,
      parentesco_descricao: values.parentesco ? values.parentesco_descricao : undefined,
      observacoes: values.observacoes || undefined,
    });

    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Terceiro Envolvido</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados Pessoais */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Dados Pessoais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cpf" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF *</FormLabel>
                    <FormControl><CpfInput value={field.value} onChange={field.onChange} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="telefone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl><TelefoneInput value={field.value} onChange={field.onChange} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="whatsapp" render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp *</FormLabel>
                    <FormControl><TelefoneInput value={field.value} onChange={field.onChange} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Dados do Veículo */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Dados do Veículo</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="veiculo_placa" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placa *</FormLabel>
                    <FormControl><PlacaInput value={field.value} onChange={field.onChange} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="veiculo_marca" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marca *</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: Volkswagen" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="veiculo_modelo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo *</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: Gol" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="veiculo_ano" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ano *</FormLabel>
                    <FormControl><Input {...field} placeholder="2023" maxLength={4} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="veiculo_cor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor *</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: Prata" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Culpa */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Relação de Culpa</h3>
              <FormField control={form.control} name="culpa" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 gap-3">
                      <Label className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 [&:has([data-state=checked])]:border-primary">
                        <RadioGroupItem value="associado_culpado" />
                        <span className="text-sm">Associado culpado</span>
                      </Label>
                      <Label className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 [&:has([data-state=checked])]:border-primary">
                        <RadioGroupItem value="terceiro_culpado" />
                        <span className="text-sm">Terceiro culpado</span>
                      </Label>
                      <Label className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 [&:has([data-state=checked])]:border-primary">
                        <RadioGroupItem value="compartilhada" />
                        <span className="text-sm">Culpa compartilhada</span>
                      </Label>
                      <Label className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50 [&:has([data-state=checked])]:border-primary">
                        <RadioGroupItem value="a_definir" />
                        <span className="text-sm">A definir</span>
                      </Label>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Tipo de Dano */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Tipo de Dano</h3>
              <FormField control={form.control} name="tipo_dano" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="veiculo" />
                        <span className="text-sm">Veículo automotor</span>
                      </Label>
                      <Label className="flex items-center gap-2 cursor-pointer">
                        <RadioGroupItem value="nao_veicular" />
                        <span className="text-sm">Não veicular</span>
                      </Label>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )} />
              {tipoDano === 'nao_veicular' && (
                <Card className="mt-2 border-red-300">
                  <CardContent className="p-3">
                    <p className="text-sm text-red-700 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Dano não veicular <strong>NÃO está coberto</strong> pelo plano (art. 11.8.4).
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Parentesco */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Relação com o Associado</h3>
              <div className="flex items-center gap-3">
                <FormField control={form.control} name="parentesco" render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Terceiro tem parentesco com o associado</FormLabel>
                  </FormItem>
                )} />
              </div>
              {parentesco && (
                <div className="mt-3 space-y-2">
                  <FormField control={form.control} name="parentesco_descricao" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Qual o parentesco?</FormLabel>
                      <FormControl><Input {...field} placeholder="Ex: cônjuge, filho, pai..." /></FormControl>
                    </FormItem>
                  )} />
                  <Card className="border-amber-300">
                    <CardContent className="p-3">
                      <p className="text-sm text-amber-700 flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        🔍 Análise Interna — Terceiro é familiar do associado
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Observações */}
            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea {...field} rows={3} /></FormControl>
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={cadastrar.isPending}>
                {cadastrar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Cadastrar Terceiro
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

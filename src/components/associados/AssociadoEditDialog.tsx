import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { useToast } from '@/hooks/use-toast';
import { CpfInput, TelefoneInput, CepInput } from '@/components/inputs/MaskedInputs';
import { usePlanos } from '@/hooks/usePlanos';
import { useUpdateAssociado } from '@/hooks/useAssociados';
import { buscarCep } from '@/lib/cep';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
];

const SEXO_OPTIONS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'outro', label: 'Outro' },
];

const ESTADO_CIVIL_OPTIONS = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
  { value: 'uniao_estavel', label: 'União Estável' },
];

const formSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  cpf: z.string().min(14, 'CPF inválido'),
  rg: z.string().optional(),
  data_nascimento: z.string().optional(),
  sexo: z.string().optional(),
  estado_civil: z.string().optional(),
  profissao: z.string().optional(),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(14, 'Telefone inválido'),
  telefone_secundario: z.string().optional(),
  whatsapp: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  plano_id: z.string().optional(),
  dia_vencimento: z.number().min(1).max(28).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AssociadoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associado: any;
  onSuccess?: () => void;
}

export function AssociadoEditDialog({ open, onOpenChange, associado, onSuccess }: AssociadoEditDialogProps) {
  const { toast } = useToast();
  const { data: planos } = usePlanos();
  const updateAssociado = useUpdateAssociado();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: '',
      cpf: '',
      rg: '',
      data_nascimento: '',
      sexo: '',
      estado_civil: '',
      profissao: '',
      email: '',
      telefone: '',
      telefone_secundario: '',
      whatsapp: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      plano_id: '',
      dia_vencimento: 10,
    },
  });

  const { watch, setValue, formState: { errors } } = form;

  useEffect(() => {
    if (associado && open) {
      form.reset({
        nome: associado.nome || '',
        cpf: associado.cpf || '',
        rg: associado.rg || '',
        data_nascimento: associado.data_nascimento || '',
        sexo: associado.sexo || '',
        estado_civil: associado.estado_civil || '',
        profissao: associado.profissao || '',
        email: associado.email || '',
        telefone: associado.telefone || '',
        telefone_secundario: associado.telefone_secundario || '',
        whatsapp: associado.whatsapp || '',
        cep: associado.cep || '',
        logradouro: associado.logradouro || '',
        numero: associado.numero || '',
        complemento: associado.complemento || '',
        bairro: associado.bairro || '',
        cidade: associado.cidade || '',
        uf: associado.uf || '',
        plano_id: associado.plano_id || '',
        dia_vencimento: associado.dia_vencimento || 10,
      });
    }
  }, [associado, open, form]);

  const handleBuscarCep = async (cep: string) => {
    try {
      const endereco = await buscarCep(cep);
      if (endereco) {
        setValue('logradouro', endereco.logradouro);
        setValue('bairro', endereco.bairro);
        setValue('cidade', endereco.cidade);
        setValue('uf', endereco.uf);
      }
    } catch {}
  };

  const handleSubmit = async (data: FormData) => {
    try {
      await updateAssociado.mutateAsync({
        id: associado.id,
        ...data,
        rg: data.rg || null,
        data_nascimento: data.data_nascimento || null,
        sexo: data.sexo || null,
        estado_civil: data.estado_civil || null,
        profissao: data.profissao || null,
        telefone_secundario: data.telefone_secundario || null,
        whatsapp: data.whatsapp || null,
        cep: data.cep || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        complemento: data.complemento || null,
        bairro: data.bairro || null,
        cidade: data.cidade || null,
        uf: data.uf || null,
        plano_id: data.plano_id || null,
        dia_vencimento: data.dia_vencimento || null,
      });

      toast({
        title: 'Dados atualizados!',
        description: 'As informações do associado foram salvas.',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message || 'Não foi possível salvar as alterações',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Associado</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <form id="edit-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Dados Pessoais */}
            <div>
              <h3 className="font-medium mb-3">Dados Pessoais</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="nome">Nome completo *</Label>
                  <Input id="nome" {...form.register('nome')} />
                  {errors.nome && <p className="text-sm text-destructive mt-1">{errors.nome.message}</p>}
                </div>
                
                <div>
                  <Label htmlFor="cpf">CPF *</Label>
                  <CpfInput value={watch('cpf')} onChange={(v) => setValue('cpf', v)} />
                  {errors.cpf && <p className="text-sm text-destructive mt-1">{errors.cpf.message}</p>}
                </div>
                
                <div>
                  <Label htmlFor="rg">RG</Label>
                  <Input id="rg" {...form.register('rg')} />
                </div>
                
                <div>
                  <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                  <Input id="data_nascimento" type="date" {...form.register('data_nascimento')} />
                </div>

                <div>
                  <Label htmlFor="sexo">Sexo</Label>
                  <Select value={watch('sexo') || ''} onValueChange={(v) => setValue('sexo', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEXO_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="estado_civil">Estado Civil</Label>
                  <Select value={watch('estado_civil') || ''} onValueChange={(v) => setValue('estado_civil', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADO_CIVIL_OPTIONS.map((e) => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="profissao">Profissão</Label>
                  <Input id="profissao" {...form.register('profissao')} />
                </div>
              </div>
            </div>

            {/* Contato */}
            <div>
              <h3 className="font-medium mb-3">Contato</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" {...form.register('email')} />
                  {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
                </div>
                
                <div>
                  <Label htmlFor="telefone">Telefone *</Label>
                  <TelefoneInput value={watch('telefone')} onChange={(v) => setValue('telefone', v)} />
                  {errors.telefone && <p className="text-sm text-destructive mt-1">{errors.telefone.message}</p>}
                </div>
                
                <div>
                  <Label htmlFor="telefone_secundario">Telefone Secundário</Label>
                  <TelefoneInput value={watch('telefone_secundario') || ''} onChange={(v) => setValue('telefone_secundario', v)} />
                </div>

                <div>
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <TelefoneInput value={watch('whatsapp') || ''} onChange={(v) => setValue('whatsapp', v)} />
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div>
              <h3 className="font-medium mb-3">Endereço</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cep">CEP</Label>
                  <CepInput
                    value={watch('cep') || ''}
                    onChange={(v) => setValue('cep', v)}
                    onCepComplete={handleBuscarCep}
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Input id="logradouro" {...form.register('logradouro')} />
                </div>
                
                <div>
                  <Label htmlFor="numero">Número</Label>
                  <Input id="numero" {...form.register('numero')} />
                </div>
                
                <div>
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input id="complemento" {...form.register('complemento')} />
                </div>
                
                <div>
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" {...form.register('bairro')} />
                </div>
                
                <div>
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" {...form.register('cidade')} />
                </div>
                
                <div>
                  <Label htmlFor="uf">Estado</Label>
                  <Select value={watch('uf') || ''} onValueChange={(v) => setValue('uf', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Associação */}
            <div>
              <h3 className="font-medium mb-3">Associação</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="plano_id">Plano</Label>
                  <Select value={watch('plano_id') || ''} onValueChange={(v) => setValue('plano_id', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {planos?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="dia_vencimento">Dia de Vencimento</Label>
                  <Input
                    id="dia_vencimento"
                    type="number"
                    min={1}
                    max={28}
                    {...form.register('dia_vencimento', { valueAsNumber: true })}
                  />
                </div>
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="edit-form" disabled={updateAssociado.isPending}>
            {updateAssociado.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

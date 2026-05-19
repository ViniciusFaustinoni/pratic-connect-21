import { useEffect, useState, useMemo } from 'react';
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
import {
  AssociadoEditConfirmDialog,
  type CampoAlterado,
} from './AssociadoEditConfirmDialog';

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

const CNH_CATEGORIA_OPTIONS = ['A', 'B', 'AB', 'C', 'D', 'E', 'AC', 'AD', 'AE'];

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
  cnh_numero: z.string().optional(),
  cnh_categoria: z.string().optional(),
  cnh_validade: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  plano_id: z.string().optional(),
  dia_vencimento: z.number().min(1).max(28).optional(),
  data_adesao: z.string().optional(),
  data_cadastro_sga: z.string().optional(),
  codigo_hinova: z.union([z.number(), z.nan()]).optional(),
});

type FormData = z.infer<typeof formSchema>;

// Labels amigáveis usadas no diff/histórico
const FIELD_LABELS: Record<keyof FormData, string> = {
  nome: 'Nome completo',
  cpf: 'CPF',
  rg: 'RG',
  data_nascimento: 'Data de nascimento',
  sexo: 'Sexo',
  estado_civil: 'Estado civil',
  profissao: 'Profissão',
  email: 'Email',
  telefone: 'Telefone',
  telefone_secundario: 'Telefone secundário',
  whatsapp: 'WhatsApp',
  cnh_numero: 'CNH (número)',
  cnh_categoria: 'CNH (categoria)',
  cnh_validade: 'CNH (validade)',
  cep: 'CEP',
  logradouro: 'Logradouro',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  uf: 'UF',
  plano_id: 'Plano',
  dia_vencimento: 'Dia de vencimento',
};

interface AssociadoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  associado: any;
  onSuccess?: () => void;
}

const normalizeValue = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  return String(v).trim();
};

export function AssociadoEditDialog({ open, onOpenChange, associado, onSuccess }: AssociadoEditDialogProps) {
  const { toast } = useToast();
  const { data: planos } = usePlanos();
  const updateAssociado = useUpdateAssociado();

  const [snapshot, setSnapshot] = useState<FormData | null>(null);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
      cnh_numero: '',
      cnh_categoria: '',
      cnh_validade: '',
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
      const initial: FormData = {
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
        cnh_numero: associado.cnh_numero || '',
        cnh_categoria: associado.cnh_categoria || '',
        cnh_validade: associado.cnh_validade || '',
        cep: associado.cep || '',
        logradouro: associado.logradouro || '',
        numero: associado.numero || '',
        complemento: associado.complemento || '',
        bairro: associado.bairro || '',
        cidade: associado.cidade || '',
        uf: associado.uf || '',
        plano_id: associado.plano_id || '',
        dia_vencimento: associado.dia_vencimento || 10,
      };
      form.reset(initial);
      setSnapshot(initial);
    }
    if (!open) {
      setSnapshot(null);
      setPendingData(null);
      setConfirmOpen(false);
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

  const computarAlteracoes = (atual: FormData): CampoAlterado[] => {
    if (!snapshot) return [];
    const planoLookup = (id?: string) => planos?.find((p) => p.id === id)?.nome || id || '';
    const formatValue = (campo: keyof FormData, raw: unknown): string => {
      if (campo === 'plano_id') return planoLookup(raw as string);
      return normalizeValue(raw);
    };

    const result: CampoAlterado[] = [];
    (Object.keys(FIELD_LABELS) as (keyof FormData)[]).forEach((campo) => {
      const antes = normalizeValue((snapshot as any)[campo]);
      const depois = normalizeValue((atual as any)[campo]);
      if (antes !== depois) {
        result.push({
          campo,
          label: FIELD_LABELS[campo],
          antes: formatValue(campo, (snapshot as any)[campo]),
          depois: formatValue(campo, (atual as any)[campo]),
        });
      }
    });
    return result;
  };

  const alteracoesPendentes = useMemo(
    () => (pendingData ? computarAlteracoes(pendingData) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pendingData, snapshot, planos]
  );

  const handleSubmit = (data: FormData) => {
    const alteracoes = computarAlteracoes(data);
    if (alteracoes.length === 0) {
      toast({
        title: 'Nenhuma alteração',
        description: 'Os dados estão iguais aos atuais.',
      });
      return;
    }
    setPendingData(data);
    setConfirmOpen(true);
  };

  const handleConfirm = async (motivo: string) => {
    if (!pendingData || !snapshot) return;
    const alteracoes = computarAlteracoes(pendingData);

    const dadosAnteriores: Record<string, unknown> = {};
    const updatesParciais: Record<string, unknown> = {};
    const labels: Record<string, string> = {};
    for (const a of alteracoes) {
      dadosAnteriores[a.campo] = (snapshot as any)[a.campo] ?? null;
      let valor: any = (pendingData as any)[a.campo];
      // Normaliza strings vazias → null para colunas opcionais
      if (typeof valor === 'string' && valor.trim() === '') valor = null;
      updatesParciais[a.campo] = valor;
      labels[a.campo] = a.label;
    }

    try {
      await updateAssociado.mutateAsync({
        id: associado.id,
        motivo,
        dadosAnteriores,
        camposAlteradosLabels: labels,
        ...(updatesParciais as any),
      });

      toast({
        title: 'Dados atualizados!',
        description: `${alteracoes.length} ${alteracoes.length === 1 ? 'campo alterado' : 'campos alterados'} e registrados no histórico.`,
      });
      setConfirmOpen(false);
      setPendingData(null);
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
    <>
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

            {/* CNH */}
            <div>
              <h3 className="font-medium mb-3">CNH</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="cnh_numero">Número</Label>
                  <Input id="cnh_numero" {...form.register('cnh_numero')} />
                </div>
                <div>
                  <Label htmlFor="cnh_categoria">Categoria</Label>
                  <Select value={watch('cnh_categoria') || ''} onValueChange={(v) => setValue('cnh_categoria', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CNH_CATEGORIA_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cnh_validade">Validade</Label>
                  <Input id="cnh_validade" type="date" {...form.register('cnh_validade')} />
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

    <AssociadoEditConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      alteracoes={alteracoesPendentes}
      isPending={updateAssociado.isPending}
      onConfirm={handleConfirm}
    />
    </>
  );
}

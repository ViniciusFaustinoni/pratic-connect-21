import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreatePeca } from '@/hooks/useAutoCenters';
import { CATALOGO_PECAS } from '@/lib/fornecedores-constants';
import { Loader2 } from 'lucide-react';

const SUPABASE_URL = 'https://iyxdgmukrrdkffraptsx.supabase.co';

interface FipeItem {
  codigo: string;
  nome: string;
}

const formSchema = z.object({
  tipo_peca: z.string().min(1, 'Selecione o tipo de peça'),
  marca_codigo: z.string().min(1, 'Selecione a marca'),
  modelo_codigo: z.string().min(1, 'Selecione o modelo'),
  ano_codigo: z.string().min(1, 'Selecione o ano'),
  valor: z.string().optional(),
  condicao: z.enum(['novo', 'usado']),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoCenterId: string;
}

async function fipeFetch(action: string, params: Record<string, string> = {}): Promise<FipeItem[]> {
  const searchParams = new URLSearchParams({ action, tipo: 'carros', ...params });
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fipe-lookup?${searchParams}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  if (action === 'modelos') return json.data.modelos;
  return json.data;
}

export function AutoCenterPecaFormDialog({ open, onOpenChange, autoCenterId }: Props) {
  const create = useCreatePeca();

  const [marcas, setMarcas] = useState<FipeItem[]>([]);
  const [modelos, setModelos] = useState<FipeItem[]>([]);
  const [anos, setAnos] = useState<FipeItem[]>([]);
  const [loadingMarcas, setLoadingMarcas] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [loadingAnos, setLoadingAnos] = useState(false);

  // Labels selecionadas (para salvar nome legível)
  const [marcaNome, setMarcaNome] = useState('');
  const [modeloNome, setModeloNome] = useState('');
  const [anoNome, setAnoNome] = useState('');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { tipo_peca: '', marca_codigo: '', modelo_codigo: '', ano_codigo: '', valor: '', condicao: 'novo' },
  });

  const marcaCodigo = form.watch('marca_codigo');
  const modeloCodigo = form.watch('modelo_codigo');

  // Carregar marcas ao abrir
  useEffect(() => {
    if (!open) return;
    setLoadingMarcas(true);
    fipeFetch('marcas').then(setMarcas).catch(() => setMarcas([])).finally(() => setLoadingMarcas(false));
  }, [open]);

  // Carregar modelos ao selecionar marca
  useEffect(() => {
    if (!marcaCodigo) { setModelos([]); return; }
    setLoadingModelos(true);
    form.setValue('modelo_codigo', '');
    form.setValue('ano_codigo', '');
    setAnos([]);
    fipeFetch('modelos', { marcaCodigo }).then(setModelos).catch(() => setModelos([])).finally(() => setLoadingModelos(false));
  }, [marcaCodigo]);

  // Carregar anos ao selecionar modelo
  useEffect(() => {
    if (!marcaCodigo || !modeloCodigo) { setAnos([]); return; }
    setLoadingAnos(true);
    form.setValue('ano_codigo', '');
    fipeFetch('anos', { marcaCodigo, modeloCodigo }).then(setAnos).catch(() => setAnos([])).finally(() => setLoadingAnos(false));
  }, [modeloCodigo]);

  const onSubmit = async (data: FormData) => {
    const nome = `${data.tipo_peca} - ${marcaNome} ${modeloNome} ${anoNome}`.trim();
    await create.mutateAsync({
      auto_center_id: autoCenterId,
      nome,
      valor: data.valor ? parseFloat(data.valor) : null,
      condicao: data.condicao,
      tipo_peca: data.tipo_peca,
      veiculo_marca: marcaNome,
      veiculo_modelo: modeloNome,
      veiculo_ano: anoNome,
    });
    onOpenChange(false);
    form.reset();
    setModelos([]);
    setAnos([]);
    setMarcaNome('');
    setModeloNome('');
    setAnoNome('');
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      form.reset();
      setModelos([]);
      setAnos([]);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Peça</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Tipo de Peça */}
            <FormField control={form.control} name="tipo_peca" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de Peça *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione a peça" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {CATALOGO_PECAS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Marca */}
            <FormField control={form.control} name="marca_codigo" render={({ field }) => (
              <FormItem>
                <FormLabel>Marca do Veículo *</FormLabel>
                <Select
                  onValueChange={(v) => {
                    field.onChange(v);
                    const m = marcas.find(x => x.codigo === v);
                    setMarcaNome(m?.nome || '');
                  }}
                  value={field.value}
                  disabled={loadingMarcas}
                >
                  <FormControl>
                    <SelectTrigger>
                      {loadingMarcas ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="Selecione a marca" />}
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {marcas.map(m => (
                      <SelectItem key={m.codigo} value={m.codigo}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Modelo */}
            <FormField control={form.control} name="modelo_codigo" render={({ field }) => (
              <FormItem>
                <FormLabel>Modelo *</FormLabel>
                <Select
                  onValueChange={(v) => {
                    field.onChange(v);
                    const m = modelos.find(x => x.codigo === v);
                    setModeloNome(m?.nome || '');
                  }}
                  value={field.value}
                  disabled={loadingModelos || !marcaCodigo}
                >
                  <FormControl>
                    <SelectTrigger>
                      {loadingModelos ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="Selecione o modelo" />}
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {modelos.map(m => (
                      <SelectItem key={m.codigo} value={m.codigo}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Ano */}
            <FormField control={form.control} name="ano_codigo" render={({ field }) => (
              <FormItem>
                <FormLabel>Ano *</FormLabel>
                <Select
                  onValueChange={(v) => {
                    field.onChange(v);
                    const a = anos.find(x => x.codigo === v);
                    setAnoNome(a?.nome || '');
                  }}
                  value={field.value}
                  disabled={loadingAnos || !modeloCodigo}
                >
                  <FormControl>
                    <SelectTrigger>
                      {loadingAnos ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder="Selecione o ano" />}
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {anos.map(a => (
                      <SelectItem key={a.codigo} value={a.codigo}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Valor + Condição */}
            <div className="grid gap-4 grid-cols-2">
              <FormField control={form.control} name="valor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl><Input {...field} type="number" step="0.01" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="condicao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Condição *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="usado">Usado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Adicionar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

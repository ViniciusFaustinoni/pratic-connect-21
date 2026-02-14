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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useCreatePeca } from '@/hooks/useAutoCenters';
import { CATALOGO_PECAS } from '@/lib/fornecedores-constants';
import { Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  const [openPeca, setOpenPeca] = useState(false);
  const [openMarca, setOpenMarca] = useState(false);
  const [openModelo, setOpenModelo] = useState(false);
  const [openAno, setOpenAno] = useState(false);

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
              <FormItem className="flex flex-col">
                <FormLabel>Tipo de Peça *</FormLabel>
                <Popover open={openPeca} onOpenChange={setOpenPeca}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" role="combobox" aria-expanded={openPeca} className="w-full justify-between font-normal">
                        {field.value || <span className="text-muted-foreground">Selecione a peça</span>}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar peça..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
                        <CommandGroup>
                          {CATALOGO_PECAS.map(p => (
                            <CommandItem key={p} value={p} onSelect={() => { field.onChange(p); setOpenPeca(false); }}>
                              <Check className={cn('mr-2 h-4 w-4', field.value === p ? 'opacity-100' : 'opacity-0')} />
                              {p}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />

            {/* Marca */}
            <FormField control={form.control} name="marca_codigo" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Marca do Veículo *</FormLabel>
                <Popover open={openMarca} onOpenChange={setOpenMarca}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" role="combobox" aria-expanded={openMarca} className="w-full justify-between font-normal" disabled={loadingMarcas}>
                        {loadingMarcas ? <Loader2 className="h-4 w-4 animate-spin" /> : (marcaNome || <span className="text-muted-foreground">Selecione a marca</span>)}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar marca..." />
                      <CommandList>
                        <CommandEmpty>Nenhuma marca encontrada.</CommandEmpty>
                        <CommandGroup>
                          {marcas.map(m => (
                            <CommandItem key={m.codigo} value={m.nome} onSelect={() => { field.onChange(m.codigo); setMarcaNome(m.nome); setOpenMarca(false); }}>
                              <Check className={cn('mr-2 h-4 w-4', field.value === m.codigo ? 'opacity-100' : 'opacity-0')} />
                              {m.nome}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />

            {/* Modelo */}
            <FormField control={form.control} name="modelo_codigo" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Modelo *</FormLabel>
                <Popover open={openModelo} onOpenChange={setOpenModelo}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" role="combobox" aria-expanded={openModelo} className="w-full justify-between font-normal" disabled={loadingModelos || !marcaCodigo}>
                        {loadingModelos ? <Loader2 className="h-4 w-4 animate-spin" /> : (modeloNome || <span className="text-muted-foreground">Selecione o modelo</span>)}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar modelo..." />
                      <CommandList>
                        <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                        <CommandGroup>
                          {modelos.map(m => (
                            <CommandItem key={m.codigo} value={m.nome} onSelect={() => { field.onChange(m.codigo); setModeloNome(m.nome); setOpenModelo(false); }}>
                              <Check className={cn('mr-2 h-4 w-4', field.value === m.codigo ? 'opacity-100' : 'opacity-0')} />
                              {m.nome}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />

            {/* Ano */}
            <FormField control={form.control} name="ano_codigo" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Ano *</FormLabel>
                <Popover open={openAno} onOpenChange={setOpenAno}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" role="combobox" aria-expanded={openAno} className="w-full justify-between font-normal" disabled={loadingAnos || !modeloCodigo}>
                        {loadingAnos ? <Loader2 className="h-4 w-4 animate-spin" /> : (anoNome || <span className="text-muted-foreground">Selecione o ano</span>)}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar ano..." />
                      <CommandList>
                        <CommandEmpty>Nenhum ano encontrado.</CommandEmpty>
                        <CommandGroup>
                          {anos.map(a => (
                            <CommandItem key={a.codigo} value={a.nome} onSelect={() => { field.onChange(a.codigo); setAnoNome(a.nome); setOpenAno(false); }}>
                              <Check className={cn('mr-2 h-4 w-4', field.value === a.codigo ? 'opacity-100' : 'opacity-0')} />
                              {a.nome}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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

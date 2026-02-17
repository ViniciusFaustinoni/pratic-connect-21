import { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CATALOGO_PECAS } from '@/lib/fornecedores-constants';
import { Loader2, Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo, useCallback } from 'react';

function PecaCombobox({ value, onSelect, open, onOpenChange, disabled }: {
  value: string;
  onSelect: (val: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!searchQuery) return [...CATALOGO_PECAS];
    const q = searchQuery.toLowerCase();
    return CATALOGO_PECAS.filter(p => p.toLowerCase().includes(q));
  }, [searchQuery]);

  const hasExactMatch = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return CATALOGO_PECAS.some(p => p.toLowerCase() === q);
  }, [searchQuery]);

  const handleSelect = useCallback((val: string) => {
    onSelect(val);
    setSearchQuery('');
    onOpenChange(false);
  }, [onSelect, onOpenChange]);

  return (
    <Popover open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSearchQuery(''); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal" disabled={disabled}>
          {value || <span className="text-muted-foreground">Selecione a peça</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar ou digitar peça..." value={searchQuery} onValueChange={setSearchQuery} />
          <CommandList>
            {filtered.length === 0 && !searchQuery.trim() && (
              <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
            )}
            {searchQuery.trim() && !hasExactMatch && (
              <CommandGroup heading="Valor personalizado">
                <CommandItem onSelect={() => handleSelect(searchQuery.trim())}>
                  <Plus className="mr-2 h-4 w-4" />
                  Usar: "{searchQuery.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={searchQuery ? 'Catálogo' : undefined}>
              {filtered.map(p => (
                <CommandItem key={p} value={p} onSelect={() => handleSelect(p)}>
                  <Check className={cn('mr-2 h-4 w-4', value === p ? 'opacity-100' : 'opacity-0')} />
                  {p}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const SUPABASE_URL = 'https://iyxdgmukrrdkffraptsx.supabase.co';

interface FipeItem {
  codigo: string;
  nome: string;
}

async function fipeFetch(action: string, params: Record<string, string> = {}): Promise<FipeItem[]> {
  const searchParams = new URLSearchParams({ action, tipo: 'carros', ...params });
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fipe-lookup?${searchParams}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  if (action === 'modelos') return json.data.modelos;
  return json.data;
}

export interface PecaSelectValues {
  tipoPeca: string;
  marcaCodigo: string;
  marcaNome: string;
  modeloCodigo: string;
  modeloNome: string;
  anoCodigo: string;
  anoNome: string;
}

interface PecaSelectFieldsProps {
  values: PecaSelectValues;
  onChange: (values: PecaSelectValues) => void;
  disabled?: boolean;
  active?: boolean;
  initialVeiculo?: { marca: string; modelo: string; ano_modelo: string | number };
}

export function PecaSelectFields({ values, onChange, disabled, active = true, initialVeiculo }: PecaSelectFieldsProps) {
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

  const autoMatchMarcaRef = useRef(false);
  const autoMatchModeloRef = useRef(false);
  const autoMatchAnoRef = useRef(false);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Load marcas
  useEffect(() => {
    if (!active) return;
    setLoadingMarcas(true);
    fipeFetch('marcas').then((data) => {
      setMarcas(data);
      // Auto-match marca from vehicle data
      if (initialVeiculo?.marca && !autoMatchMarcaRef.current && !valuesRef.current.marcaCodigo) {
        const needle = initialVeiculo.marca.toLowerCase();
        const match = data.find(m => m.nome.toLowerCase().includes(needle) || needle.includes(m.nome.toLowerCase()));
        if (match) {
          autoMatchMarcaRef.current = true;
          onChangeRef.current({ ...valuesRef.current, marcaCodigo: match.codigo, marcaNome: match.nome, modeloCodigo: '', modeloNome: '', anoCodigo: '', anoNome: '' });
        }
      }
    }).catch(() => setMarcas([])).finally(() => setLoadingMarcas(false));
  }, [active]);

  // Load modelos when marca changes
  useEffect(() => {
    if (!values.marcaCodigo) { setModelos([]); return; }
    setLoadingModelos(true);
    fipeFetch('modelos', { marcaCodigo: values.marcaCodigo }).then((data) => {
      setModelos(data);
      // Auto-match modelo
      if (initialVeiculo?.modelo && autoMatchMarcaRef.current && !autoMatchModeloRef.current && !valuesRef.current.modeloCodigo) {
        const needle = initialVeiculo.modelo.toLowerCase();
        const match = data.find(m => m.nome.toLowerCase().includes(needle) || needle.includes(m.nome.toLowerCase()));
        if (match) {
          autoMatchModeloRef.current = true;
          onChangeRef.current({ ...valuesRef.current, modeloCodigo: String(match.codigo), modeloNome: match.nome, anoCodigo: '', anoNome: '' });
        }
      }
    }).catch(() => setModelos([])).finally(() => setLoadingModelos(false));
  }, [values.marcaCodigo]);

  // Load anos when modelo changes
  useEffect(() => {
    if (!values.marcaCodigo || !values.modeloCodigo) { setAnos([]); return; }
    setLoadingAnos(true);
    fipeFetch('anos', { marcaCodigo: values.marcaCodigo, modeloCodigo: values.modeloCodigo }).then((data) => {
      setAnos(data);
      // Auto-match ano
      if (initialVeiculo?.ano_modelo && autoMatchModeloRef.current && !autoMatchAnoRef.current && !valuesRef.current.anoCodigo) {
        const anoStr = String(initialVeiculo.ano_modelo);
        const match = data.find(a => a.nome.includes(anoStr));
        if (match) {
          autoMatchAnoRef.current = true;
          onChangeRef.current({ ...valuesRef.current, anoCodigo: match.codigo, anoNome: match.nome });
        }
      }
    }).catch(() => setAnos([])).finally(() => setLoadingAnos(false));
  }, [values.modeloCodigo]);

  const update = (partial: Partial<PecaSelectValues>) => {
    onChange({ ...values, ...partial });
  };

  return (
    <div className="space-y-3">
      {/* Tipo de Peça */}
      <div className="space-y-1">
        <Label className="text-xs">Tipo de Peça *</Label>
        <PecaCombobox
          value={values.tipoPeca}
          onSelect={(val) => { update({ tipoPeca: val }); }}
          open={openPeca}
          onOpenChange={setOpenPeca}
          disabled={disabled}
        />
      </div>

      {/* Marca */}
      <div className="space-y-1">
        <Label className="text-xs">Marca do Veículo *</Label>
        <Popover open={openMarca} onOpenChange={setOpenMarca}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={openMarca} className="w-full justify-between font-normal" disabled={disabled || loadingMarcas}>
              {loadingMarcas ? <Loader2 className="h-4 w-4 animate-spin" /> : (values.marcaNome || <span className="text-muted-foreground">Selecione a marca</span>)}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar marca..." />
              <CommandList>
                <CommandEmpty>Nenhuma marca encontrada.</CommandEmpty>
                <CommandGroup>
                  {marcas.map(m => (
                    <CommandItem key={m.codigo} value={m.nome} onSelect={() => {
                      update({ marcaCodigo: m.codigo, marcaNome: m.nome, modeloCodigo: '', modeloNome: '', anoCodigo: '', anoNome: '' });
                      setOpenMarca(false);
                    }}>
                      <Check className={cn('mr-2 h-4 w-4', values.marcaCodigo === m.codigo ? 'opacity-100' : 'opacity-0')} />
                      {m.nome}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Modelo */}
      <div className="space-y-1">
        <Label className="text-xs">Modelo *</Label>
        <Popover open={openModelo} onOpenChange={setOpenModelo}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={openModelo} className="w-full justify-between font-normal" disabled={disabled || loadingModelos || !values.marcaCodigo}>
              {loadingModelos ? <Loader2 className="h-4 w-4 animate-spin" /> : (values.modeloNome || <span className="text-muted-foreground">Selecione o modelo</span>)}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar modelo..." />
              <CommandList>
                <CommandEmpty>Nenhum modelo encontrado.</CommandEmpty>
                <CommandGroup>
                  {modelos.map(m => (
                    <CommandItem key={m.codigo} value={m.nome} onSelect={() => {
                      update({ modeloCodigo: String(m.codigo), modeloNome: m.nome, anoCodigo: '', anoNome: '' });
                      setOpenModelo(false);
                    }}>
                      <Check className={cn('mr-2 h-4 w-4', values.modeloCodigo === String(m.codigo) ? 'opacity-100' : 'opacity-0')} />
                      {m.nome}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Ano */}
      <div className="space-y-1">
        <Label className="text-xs">Ano *</Label>
        <Popover open={openAno} onOpenChange={setOpenAno}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" aria-expanded={openAno} className="w-full justify-between font-normal" disabled={disabled || loadingAnos || !values.modeloCodigo}>
              {loadingAnos ? <Loader2 className="h-4 w-4 animate-spin" /> : (values.anoNome || <span className="text-muted-foreground">Selecione o ano</span>)}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar ano..." />
              <CommandList>
                <CommandEmpty>Nenhum ano encontrado.</CommandEmpty>
                <CommandGroup>
                  {anos.map(a => (
                    <CommandItem key={a.codigo} value={a.nome} onSelect={() => {
                      update({ anoCodigo: a.codigo, anoNome: a.nome });
                      setOpenAno(false);
                    }}>
                      <Check className={cn('mr-2 h-4 w-4', values.anoCodigo === a.codigo ? 'opacity-100' : 'opacity-0')} />
                      {a.nome}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

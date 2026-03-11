import { useState, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { Plus, Pencil, ToggleLeft, FileUp, AlertTriangle, Upload, X } from 'lucide-react';
import { format } from 'date-fns';
import { COMBUSTIVEIS_FALLBACK } from '@/data/combustiveis';

type ElegibilidadeRecord = {
  id: string;
  plano_id: string;
  linha_slug: string;
  marca: string;
  modelo: string;
  ano_min: number;
  ano_max: number | null;
  combustivel: string | null;
  status: string;
  observacao: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type PlanoOption = {
  id: string;
  nome: string;
  linha: string | null;
};

const STATUS_OPTIONS = [
  { value: 'aceito', label: 'Aceito' },
  { value: 'limitado', label: 'Limitado' },
  { value: 'negado', label: 'Negado' },
];

const COMBUSTIVEL_OPTIONS = [
  { value: 'qualquer', label: 'Qualquer' },
  ...COMBUSTIVEIS_FALLBACK,
];

const statusBadge = (status: string, observacao?: string | null) => {
  if (status === 'aceito') return <Badge className="bg-green-600 text-white hover:bg-green-700">Aceito</Badge>;
  if (status === 'negado') return <Badge variant="destructive">Negado</Badge>;
  if (status === 'limitado') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-yellow-500 text-white hover:bg-yellow-600 cursor-help">Limitado</Badge>
          </TooltipTrigger>
          <TooltipContent><p>{observacao || 'Sem observação'}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
};

// ─── Por Plano ───────────────────────────────────────────────
function TabPorPlano() {
  const queryClient = useQueryClient();
  const [selectedPlano, setSelectedPlano] = useState<string>('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ElegibilidadeRecord | null>(null);

  // form state
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anoMin, setAnoMin] = useState(2005);
  const [anoMax, setAnoMax] = useState<string>('');
  const [combustivel, setCombustivel] = useState('qualquer');
  const [status, setStatus] = useState('aceito');
  const [observacao, setObservacao] = useState('');

  const { data: planos } = useQuery({
    queryKey: ['planos-elegibilidade'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planos')
        .select('id, nome, linha')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as PlanoOption[];
    },
  });

  const selectedPlanoObj = planos?.find(p => p.id === selectedPlano);

  const { data: registros, isLoading } = useQuery({
    queryKey: ['elegibilidade', selectedPlano],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_elegibilidade_modelos')
        .select('*')
        .eq('plano_id', selectedPlano)
        .eq('is_active', true)
        .order('marca')
        .order('modelo');
      if (error) throw error;
      return data as ElegibilidadeRecord[];
    },
    enabled: !!selectedPlano,
  });

  const resetForm = () => {
    setMarca('');
    setModelo('');
    setAnoMin(2005);
    setAnoMax('');
    setCombustivel('qualquer');
    setStatus('aceito');
    setObservacao('');
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setSheetOpen(true);
  };

  const openEdit = (r: ElegibilidadeRecord) => {
    setEditing(r);
    setMarca(r.marca);
    setModelo(r.modelo);
    setAnoMin(r.ano_min);
    setAnoMax(r.ano_max != null ? String(r.ano_max) : '');
    setCombustivel(r.combustivel || 'qualquer');
    setStatus(r.status);
    setObservacao(r.observacao || '');
    setSheetOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!marca.trim() || !modelo.trim()) throw new Error('Marca e modelo são obrigatórios.');

      // duplicate check
      if (!editing) {
        const { data: dup } = await supabase
          .from('plano_elegibilidade_modelos')
          .select('id')
          .eq('plano_id', selectedPlano)
          .eq('marca', marca.trim())
          .eq('modelo', modelo.trim())
          .eq('ano_min', anoMin)
          .eq('combustivel', combustivel)
          .eq('is_active', true)
          .maybeSingle();
        if (dup) throw new Error('Já existe uma regra para este modelo com esses critérios.');
      }

      const payload = {
        plano_id: selectedPlano,
        linha_slug: selectedPlanoObj?.linha || '',
        marca: marca.trim(),
        modelo: modelo.trim(),
        ano_min: anoMin,
        ano_max: anoMax ? Number(anoMax) : null,
        combustivel,
        status,
        observacao: observacao.trim() || null,
      };

      if (editing) {
        const { error } = await supabase
          .from('plano_elegibilidade_modelos')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('plano_elegibilidade_modelos')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Modelo atualizado!' : 'Modelo adicionado!');
      queryClient.invalidateQueries({ queryKey: ['elegibilidade', selectedPlano] });
      queryClient.invalidateQueries({ queryKey: ['elegibilidade-resumo'] });
      setSheetOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('plano_elegibilidade_modelos')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Modelo desativado.');
      queryClient.invalidateQueries({ queryKey: ['elegibilidade', selectedPlano] });
      queryClient.invalidateQueries({ queryKey: ['elegibilidade-resumo'] });
    },
    onError: () => toast.error('Erro ao desativar.'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <div className="w-80">
          <Label>Plano</Label>
          <Select value={selectedPlano} onValueChange={setSelectedPlano}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um plano..." />
            </SelectTrigger>
            <SelectContent>
              {planos?.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    {p.nome}
                    {p.linha_slug && (
                      <Badge variant="outline" className="text-xs ml-1">{p.linha_slug}</Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedPlano && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar Modelo
          </Button>
        )}
      </div>

      {selectedPlano && registros && registros.length === 0 && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>Nenhum modelo configurado — este plano aceita qualquer veículo. Configure os modelos aceitos ou importe um PDF.</p>
        </div>
      )}

      {selectedPlano && registros && registros.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marca</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Ano Min</TableHead>
              <TableHead>Ano Max</TableHead>
              <TableHead>Combustível</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.marca}</TableCell>
                <TableCell>{r.modelo}</TableCell>
                <TableCell>{r.ano_min}</TableCell>
                <TableCell>{r.ano_max ?? 'Sem limite'}</TableCell>
                <TableCell>{r.combustivel === 'qualquer' ? 'Qualquer' : COMBUSTIVEIS_FALLBACK.find(c => c.value === r.combustivel)?.label || r.combustivel}</TableCell>
                <TableCell>{statusBadge(r.status, r.observacao)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deactivateMutation.mutate(r.id)}>
                      <ToggleLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {selectedPlano && isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {/* Sheet lateral */}
      <Sheet open={sheetOpen} onOpenChange={v => { if (!v) { setSheetOpen(false); resetForm(); } }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? 'Editar Modelo' : 'Adicionar Modelo'}</SheetTitle>
            <SheetDescription>Preencha os critérios de elegibilidade.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div>
              <Label>Marca *</Label>
              <Input value={marca} onChange={e => setMarca(e.target.value)} placeholder="Ex: Chevrolet" />
            </div>
            <div>
              <Label>Modelo *</Label>
              <Input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Ex: Onix" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ano Mínimo *</Label>
                <Input type="number" value={anoMin} onChange={e => setAnoMin(Number(e.target.value))} />
              </div>
              <div>
                <Label>Ano Máximo</Label>
                <Input type="number" value={anoMax} onChange={e => setAnoMax(e.target.value)} placeholder="Sem limite" />
              </div>
            </div>
            <div>
              <Label>Combustível</Label>
              <Select value={combustivel} onValueChange={setCombustivel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMBUSTIVEL_OPTIONS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex: Apenas versões Flex até 2023" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button variant="outline" onClick={() => { setSheetOpen(false); resetForm(); }}>Cancelar</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Importar PDF ────────────────────────────────────────────
function TabImportarPDF() {
  const [file, setFile] = useState<File | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const processar = () => {
    toast.info('Importação via PDF será habilitada em breve.');
  };

  return (
    <div className="space-y-6">
      {!file ? (
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <FileUp className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Arraste o PDF de elegibilidade ou clique para selecionar</p>
          <p className="text-sm text-muted-foreground mt-1">O PDF deve estar no formato padrão Praticcar</p>
        </div>
      ) : (
        <div className="rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={processar}><Upload className="h-4 w-4 mr-1" /> Processar PDF</Button>
            <Button variant="outline" onClick={() => setFile(null)}>Remover</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Resumo Global ───────────────────────────────────────────
function TabResumoGlobal() {
  const { data, isLoading } = useQuery({
    queryKey: ['elegibilidade-resumo'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_elegibilidade_resumo' as never);
      // Fallback: query manually if RPC not available
      if (error) {
        const { data: planos, error: pe } = await supabase
          .from('planos')
          .select('id, nome, linha_slug')
          .eq('ativo', true)
          .order('nome');
        if (pe) throw pe;

        const { data: elegAll, error: ee } = await supabase
          .from('plano_elegibilidade_modelos')
          .select('plano_id, status, is_active, updated_at')
          .eq('is_active', true);
        if (ee) throw ee;

        return (planos || []).map((p: any) => {
          const items = (elegAll || []).filter((e: any) => e.plano_id === p.id);
          const aceitos = items.filter((e: any) => e.status === 'aceito').length;
          const limitados = items.filter((e: any) => e.status === 'limitado').length;
          const negados = items.filter((e: any) => e.status === 'negado').length;
          const ultima = items.length > 0
            ? items.reduce((max: string, e: any) => e.updated_at > max ? e.updated_at : max, items[0].updated_at)
            : null;
          return {
            nome: p.nome,
            linha_slug: p.linha_slug,
            total: items.length,
            aceitos,
            limitados,
            negados,
            ultima_atualizacao: ultima,
          };
        });
      }
      return data as any[];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Plano</TableHead>
          <TableHead>Linha</TableHead>
          <TableHead className="text-center">Total</TableHead>
          <TableHead className="text-center">Aceitos</TableHead>
          <TableHead className="text-center">Limitados</TableHead>
          <TableHead className="text-center">Negados</TableHead>
          <TableHead>Última Atualização</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data?.map((row: any, i: number) => (
          <TableRow key={i} className={row.total === 0 ? 'bg-yellow-50' : ''}>
            <TableCell className="font-medium">{row.nome}</TableCell>
            <TableCell><Badge variant="outline">{row.linha_slug || '—'}</Badge></TableCell>
            <TableCell className="text-center">
              {row.total === 0
                ? <Badge className="bg-yellow-500 text-white hover:bg-yellow-600">Sem configuração</Badge>
                : row.total}
            </TableCell>
            <TableCell className="text-center">{row.aceitos}</TableCell>
            <TableCell className="text-center">{row.limitados}</TableCell>
            <TableCell className="text-center">{row.negados}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {row.ultima_atualizacao ? format(new Date(row.ultima_atualizacao), 'dd/MM/yyyy HH:mm') : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Componente Principal ────────────────────────────────────
export function ElegibilidadeVeiculos() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Elegibilidade de Veículos</h2>
        <p className="text-muted-foreground">Controle quais marcas, modelos e anos são aceitos por plano</p>
      </div>

      <Tabs defaultValue="por-plano">
        <TabsList>
          <TabsTrigger value="por-plano">Por Plano</TabsTrigger>
          <TabsTrigger value="importar-pdf">Importar PDF</TabsTrigger>
          <TabsTrigger value="resumo">Resumo Global</TabsTrigger>
        </TabsList>

        <TabsContent value="por-plano"><TabPorPlano /></TabsContent>
        <TabsContent value="importar-pdf"><TabImportarPDF /></TabsContent>
        <TabsContent value="resumo"><TabResumoGlobal /></TabsContent>
      </Tabs>
    </div>
  );
}

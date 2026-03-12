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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import { Plus, Pencil, ToggleLeft, AlertTriangle, Upload, X, Download, Loader2, CheckCircle2, FileSpreadsheet, Info } from 'lucide-react';
import { format } from 'date-fns';
import { COMBUSTIVEIS_FALLBACK } from '@/data/combustiveis';
import * as XLSX from 'xlsx';

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
                    {p.linha && (
                      <Badge variant="outline" className="text-xs ml-1">{p.linha}</Badge>
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
          <p>Nenhum modelo configurado — este plano aceita qualquer veículo. Configure os modelos aceitos ou importe uma planilha.</p>
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

// ─── Autodetecção de plano a partir do Excel ─────────────────
function detectarPlanoDoExcel(workbook: XLSX.WorkBook, planos: PlanoOption[]): PlanoOption | null {
  // Estratégia 1: aba "Metadados" com PLANO_NOME ou LINHA_SLUG
  const abaMetadados = workbook.SheetNames.find(
    n => n.trim().toLowerCase() === 'metadados'
  );

  if (abaMetadados) {
    const sheet = workbook.Sheets[abaMetadados];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    // Format: rows with CAMPO / VALOR columns
    const metaMap: Record<string, string> = {};
    for (const row of rows) {
      const keys = Object.keys(row);
      if (keys.length >= 2) {
        const campo = String(row[keys[0]]).trim().toUpperCase();
        const valor = String(row[keys[1]]).trim();
        metaMap[campo] = valor;
      }
    }

    // Try matching by PLANO_ID first
    if (metaMap['PLANO_ID']) {
      const match = planos.find(p => p.id === metaMap['PLANO_ID']);
      if (match) return match;
    }

    // Try matching by PLANO_NOME
    if (metaMap['PLANO_NOME']) {
      const nomeNorm = metaMap['PLANO_NOME'].toLowerCase();
      const match = planos.find(p => p.nome.toLowerCase() === nomeNorm);
      if (match) return match;
    }

    // Try matching by LINHA_SLUG
    if (metaMap['LINHA_SLUG']) {
      const slugNorm = metaMap['LINHA_SLUG'].toLowerCase();
      const match = planos.find(p => p.linha?.toLowerCase() === slugNorm);
      if (match) return match;
    }
  }

  return null;
}

// ─── Importar Planilha ──────────────────────────────────────
function TabImportarPlanilha({ onNavigateToPlano }: { onNavigateToPlano?: (planoId: string) => void }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [selectedPlano, setSelectedPlano] = useState<string>('');
  const [planoDetectado, setPlanoDetectado] = useState<PlanoOption | null>(null);
  const [modo, setModo] = useState<'adicionar' | 'substituir'>('adicionar');
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [erro, setErro] = useState<{ error: string; erros?: string[]; detalhe?: string } | null>(null);

  // Export state
  const [exportPlano, setExportPlano] = useState<string>('');
  const [exportando, setExportando] = useState(false);

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
  const exportPlanoObj = planos?.find(p => p.id === exportPlano);

  const onDrop = useCallback(async (accepted: File[]) => {
    if (accepted.length === 0) return;
    const f = accepted[0];
    setFile(f);
    setResultado(null);
    setErro(null);
    setPlanoDetectado(null);

    // Autodetecção de plano
    if (planos && planos.length > 0) {
      try {
        const buffer = await f.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const detected = detectarPlanoDoExcel(wb, planos);
        if (detected) {
          setPlanoDetectado(detected);
          setSelectedPlano(detected.id);
          toast.info(`Plano detectado automaticamente: ${detected.nome}`);
        }
      } catch {
        // Autodetecção falhou silenciosamente — seleção manual continua
      }
    }
  }, [planos]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const processar = async () => {
    if (!file || !selectedPlano || !selectedPlanoObj) return;
    setProcessando(true);
    setErro(null);
    setResultado(null);

    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      formData.append('plano_id', selectedPlano);
      formData.append('linha_slug', selectedPlanoObj.linha || '');
      formData.append('modo', modo);

      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/parse-elegibilidade-xlsx`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      const json = await res.json();

      if (!res.ok) {
        setErro(json);
      } else {
        setResultado(json);
        toast.success(`${json.total_importados} modelos importados!`);
        queryClient.invalidateQueries({ queryKey: ['elegibilidade', selectedPlano] });
        queryClient.invalidateQueries({ queryKey: ['elegibilidade-resumo'] });
        queryClient.invalidateQueries({ queryKey: ['plano_elegibilidade_modelos'] });
      }
    } catch (e: any) {
      setErro({ error: 'Erro de rede', detalhe: e.message });
    } finally {
      setProcessando(false);
    }
  };

  const baixarModelo = () => {
    // Aba Elegibilidade
    const dados = [
      { MARCA: 'CHEVROLET', MODELO: 'ONIX', ANO_MIN: 2018, ANO_MAX: '', COMBUSTIVEL: 'qualquer', STATUS: 'aceito', OBSERVACAO: '' },
      { MARCA: 'CHEVROLET', MODELO: 'MONTANA', ANO_MIN: 2005, ANO_MAX: 2023, COMBUSTIVEL: 'qualquer', STATUS: 'limitado', OBSERVACAO: 'Apenas até 2023' },
      { MARCA: 'VW', MODELO: 'GOLF', ANO_MIN: 2010, ANO_MAX: '', COMBUSTIVEL: 'flex', STATUS: 'limitado', OBSERVACAO: 'Somente versão Flex' },
      { MARCA: 'HYUNDAI', MODELO: 'HB20', ANO_MIN: 2015, ANO_MAX: '', COMBUSTIVEL: 'qualquer', STATUS: 'aceito', OBSERVACAO: '' },
      { MARCA: 'FIAT', MODELO: 'MOBI', ANO_MIN: 2017, ANO_MAX: '', COMBUSTIVEL: 'qualquer', STATUS: 'negado', OBSERVACAO: 'Modelo não coberto' },
    ];
    const ws = XLSX.utils.json_to_sheet(dados);
    ws['!cols'] = [
      { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
      { wch: 14 }, { wch: 10 }, { wch: 30 },
    ];

    // Aba Metadados (para autodetecção)
    const metaDados = [
      { CAMPO: 'PLANO_NOME', VALOR: '(nome do plano aqui)' },
      { CAMPO: 'LINHA_SLUG', VALOR: '(linha do plano aqui)' },
      { CAMPO: 'GERADO_EM', VALOR: format(new Date(), 'yyyy-MM-dd HH:mm') },
    ];
    const wsMeta = XLSX.utils.json_to_sheet(metaDados);
    wsMeta['!cols'] = [{ wch: 16 }, { wch: 30 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Elegibilidade');
    XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadados');
    XLSX.writeFile(wb, 'modelo_elegibilidade.xlsx');
    toast.success('Modelo baixado!');
  };

  const resetForm = () => {
    setFile(null);
    setResultado(null);
    setErro(null);
    setPlanoDetectado(null);
  };

  // --- Export Excel ---
  const exportarExcel = async () => {
    if (!exportPlano || !exportPlanoObj) return;
    setExportando(true);

    try {
      const { data: registros, error } = await supabase
        .from('plano_elegibilidade_modelos')
        .select('*')
        .eq('plano_id', exportPlano)
        .eq('is_active', true)
        .order('marca')
        .order('modelo');

      if (error) throw error;

      // Aba Elegibilidade
      const dados = (registros || []).map((r: any) => ({
        MARCA: r.marca,
        MODELO: r.modelo,
        ANO_MIN: r.ano_min,
        ANO_MAX: r.ano_max ?? '',
        COMBUSTIVEL: r.combustivel || 'qualquer',
        STATUS: r.status,
        OBSERVACAO: r.observacao || '',
      }));

      const ws = XLSX.utils.json_to_sheet(dados.length > 0 ? dados : [], { header: ['MARCA', 'MODELO', 'ANO_MIN', 'ANO_MAX', 'COMBUSTIVEL', 'STATUS', 'OBSERVACAO'] });
      ws['!cols'] = [
        { wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
        { wch: 14 }, { wch: 10 }, { wch: 30 },
      ];

      // Aba Metadados (para autodetecção na reimportação)
      const metaDados = [
        { CAMPO: 'PLANO_ID', VALOR: exportPlanoObj.id },
        { CAMPO: 'PLANO_NOME', VALOR: exportPlanoObj.nome },
        { CAMPO: 'LINHA_SLUG', VALOR: exportPlanoObj.linha || '' },
        { CAMPO: 'GERADO_EM', VALOR: format(new Date(), 'yyyy-MM-dd HH:mm') },
        { CAMPO: 'TOTAL_MODELOS', VALOR: String(registros?.length || 0) },
      ];
      const wsMeta = XLSX.utils.json_to_sheet(metaDados);
      wsMeta['!cols'] = [{ wch: 16 }, { wch: 40 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Elegibilidade');
      XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadados');

      const fileName = `elegibilidade_${(exportPlanoObj.linha || exportPlanoObj.nome).replace(/\s+/g, '_').toLowerCase()}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Planilha exportada com sucesso!');
    } catch (e: any) {
      toast.error(`Erro ao exportar: ${e.message}`);
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Seção de Importação ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Importar Planilha de Elegibilidade</h3>
          <Button variant="outline" size="sm" onClick={baixarModelo}>
            <Download className="h-4 w-4 mr-1" /> Baixar modelo Excel
          </Button>
        </div>

        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm">
            A planilha deve ter uma aba chamada <strong>"Elegibilidade"</strong> com as colunas: MARCA, MODELO, ANO_MIN, ANO_MAX, COMBUSTIVEL, STATUS, OBSERVACAO.
            {' '}Para autodetecção do plano, inclua uma aba <strong>"Metadados"</strong> com PLANO_NOME e/ou LINHA_SLUG.
          </AlertDescription>
        </Alert>

        {/* Dropzone — pode dropar ANTES de selecionar plano (autodetecção) */}
        {!resultado && !file && (
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">
              Arraste a planilha de elegibilidade ou clique para selecionar
            </p>
            <p className="text-sm text-muted-foreground mt-1">Formatos aceitos: .xlsx, .xls</p>
          </div>
        )}

        {/* Arquivo selecionado */}
        {!resultado && file && (
          <div className="space-y-4">
            <div className="rounded-lg border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {planoDetectado && (
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Plano detectado: {planoDetectado.nome}
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" onClick={resetForm} disabled={processando}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Para qual plano é esta planilha? *</Label>
                <Select value={selectedPlano} onValueChange={setSelectedPlano}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um plano..." />
                  </SelectTrigger>
                  <SelectContent>
                    {planos?.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          {p.nome}
                          {p.linha && <Badge variant="outline" className="text-xs ml-1">{p.linha}</Badge>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modo de importação</Label>
                <Select value={modo} onValueChange={(v: 'adicionar' | 'substituir') => setModo(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adicionar">Adicionar</SelectItem>
                    <SelectItem value="substituir">Substituir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {modo === 'substituir' && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
                  Atenção: todos os modelos atuais do plano serão desativados e substituídos pelos dados da planilha.
                </AlertDescription>
              </Alert>
            )}

            {erro && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">{erro.error}</p>
                  {erro.detalhe && <p className="text-sm mt-1">{erro.detalhe}</p>}
                  {erro.erros && (
                    <ul className="text-sm mt-2 space-y-0.5 list-disc pl-4">
                      {erro.erros.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button onClick={processar} disabled={processando || !selectedPlano}>
                {processando ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processando...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-1" /> Processar Planilha</>
                )}
              </Button>
              <Button variant="outline" onClick={resetForm} disabled={processando}>Remover</Button>
            </div>
          </div>
        )}

        {/* Resultado de sucesso */}
        {resultado && (
          <div className="space-y-4">
            <Alert className="border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                <strong>{resultado.total_importados}</strong> modelos importados para <strong>{selectedPlanoObj?.nome}</strong>
                {resultado.modo === 'substituir' && ' (registros anteriores desativados)'}
              </AlertDescription>
            </Alert>

            {resultado.registros && resultado.registros.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marca</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Ano Min</TableHead>
                    <TableHead>Ano Max</TableHead>
                    <TableHead>Combustível</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.registros.map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.marca}</TableCell>
                      <TableCell>{r.modelo}</TableCell>
                      <TableCell>{r.ano_min}</TableCell>
                      <TableCell>{r.ano_max ?? 'Sem limite'}</TableCell>
                      <TableCell>{r.combustivel}</TableCell>
                      <TableCell>{statusBadge(r.status, r.observacao)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex gap-2">
              {onNavigateToPlano && (
                <Button variant="outline" onClick={() => onNavigateToPlano(selectedPlano)}>
                  Ver no plano
                </Button>
              )}
              <Button variant="outline" onClick={() => { resetForm(); setFile(null); }}>
                Importar outra planilha
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Seção de Exportação ── */}
      <div className="border-t pt-6 space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Exportar Planilha de Elegibilidade</h3>
        <p className="text-sm text-muted-foreground">Gera um arquivo Excel com os dados atuais do plano, incluindo metadados para reimportação automática.</p>

        <div className="flex items-end gap-4">
          <div className="w-80">
            <Label>Plano</Label>
            <Select value={exportPlano} onValueChange={setExportPlano}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano..." />
              </SelectTrigger>
              <SelectContent>
                {planos?.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.nome}
                      {p.linha && <Badge variant="outline" className="text-xs ml-1">{p.linha}</Badge>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={exportarExcel} disabled={!exportPlano || exportando}>
            {exportando ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Gerando...</>
            ) : (
              <><Download className="h-4 w-4 mr-1" /> Exportar Planilha</>
            )}
          </Button>
        </div>
      </div>
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
          .select('id, nome, linha')
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
            linha: p.linha,
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
            <TableCell><Badge variant="outline">{row.linha || '—'}</Badge></TableCell>
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
  const [activeTab, setActiveTab] = useState('por-plano');

  const handleNavigateToPlano = useCallback((planoId: string) => {
    setActiveTab('por-plano');
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Elegibilidade de Veículos</h2>
        <p className="text-muted-foreground">Controle quais marcas, modelos e anos são aceitos por plano</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="por-plano">Por Plano</TabsTrigger>
          <TabsTrigger value="importar">Importar Planilha</TabsTrigger>
          <TabsTrigger value="resumo">Resumo Global</TabsTrigger>
        </TabsList>

        <TabsContent value="por-plano"><TabPorPlano /></TabsContent>
        <TabsContent value="importar"><TabImportarPlanilha onNavigateToPlano={handleNavigateToPlano} /></TabsContent>
        <TabsContent value="resumo"><TabResumoGlobal /></TabsContent>
      </Tabs>
    </div>
  );
}

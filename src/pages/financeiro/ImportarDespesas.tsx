import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresas } from '@/hooks/useEmpresas';
import { SOLICITACAO_CATEGORIAS } from '@/hooks/useSolicitacoesFinanceiras';

const sb = supabase as any;

// Campos de destino na tabela contas_pagar
const CAMPOS = [
  { key: 'fornecedor_nome', label: 'Fornecedor / Descrição', obrigatorio: true },
  { key: 'valor', label: 'Valor', obrigatorio: true },
  { key: 'data_vencimento', label: 'Data de vencimento', obrigatorio: true },
  { key: 'categoria', label: 'Categoria', obrigatorio: false },
  { key: 'data_pagamento', label: 'Data de pagamento', obrigatorio: false },
  { key: 'empresa', label: 'Empresa', obrigatorio: false },
  { key: 'fornecedor_documento', label: 'CPF/CNPJ', obrigatorio: false },
  { key: 'observacao', label: 'Observação', obrigatorio: false },
] as const;

const NAO_MAPEAR = '__none__';

const CATEGORIAS_VALIDAS = SOLICITACAO_CATEGORIAS.map((c) => c.value);

function parseValorBR(v: any): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/R\$|\s/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 -> 1234.56
  const n = parseFloat(s.replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function toISODate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function matchCategoria(v: any): string {
  const s = String(v ?? '').toLowerCase();
  const hit = CATEGORIAS_VALIDAS.find((c) => s.includes(c.replace('_', ' ')) || s.includes(c));
  return hit ?? 'outros';
}

type Etapa = 'upload' | 'mapear' | 'concluido';

export default function ImportarDespesas() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: empresas = [] } = useEmpresas();

  const [etapa, setEtapa] = useState<Etapa>('upload');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheetSel, setSheetSel] = useState('');
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null);
  const [rows, setRows] = useState<any[][]>([]);
  const [mapa, setMapa] = useState<Record<string, number>>({});
  const [statusPadrao, setStatusPadrao] = useState('pendente');
  const [pagoSeData, setPagoSeData] = useState(true);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: number; erro: number } | null>(null);

  const headers = rows[0] ?? [];
  const dados = rows.slice(1).filter((r) => r.some((c) => c != null && c !== ''));

  const carregarSheet = (workbook: XLSX.WorkBook, nome: string) => {
    const ws = workbook.Sheets[nome];
    const json = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false, defval: '' });
    setRows(json as any[][]);
    setMapa({});
  };

  const onFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array', cellDates: true });
      setWb(workbook);
      setSheets(workbook.SheetNames);
      setSheetSel(workbook.SheetNames[0]);
      setNomeArquivo(file.name);
      carregarSheet(workbook, workbook.SheetNames[0]);
      setEtapa('mapear');
    } catch (e) {
      console.error(e);
      toast.error('Não consegui ler o arquivo. Use .xlsx, .xls ou .csv');
    }
  };

  const empresaPorNome = (txt: any): string | null => {
    const s = String(txt ?? '').toLowerCase().trim();
    if (!s) return null;
    const e = empresas.find((emp) => s.includes(emp.nome.toLowerCase()) || emp.nome.toLowerCase().includes(s));
    return e?.id ?? null;
  };

  const preview = useMemo(() => {
    return dados.slice(0, 8).map((r) => montarRegistro(r));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, mapa, statusPadrao, pagoSeData]);

  function montarRegistro(r: any[]) {
    const get = (k: string) => (mapa[k] != null ? r[mapa[k]] : undefined);
    const valor = parseValorBR(get('valor'));
    const dataPag = toISODate(get('data_pagamento'));
    const status = (pagoSeData && dataPag) ? 'pago' : statusPadrao;
    return {
      fornecedor_nome: String(get('fornecedor_nome') ?? '').trim() || 'Sem descrição',
      fornecedor_documento: get('fornecedor_documento') ? String(get('fornecedor_documento')) : null,
      categoria: mapa['categoria'] != null ? matchCategoria(get('categoria')) : 'outros',
      subcategoria: mapa['categoria'] != null ? String(get('categoria') ?? '').slice(0, 100) : null,
      valor,
      valor_pago: status === 'pago' ? valor : 0,
      data_vencimento: toISODate(get('data_vencimento')),
      data_pagamento: dataPag,
      empresa_id: mapa['empresa'] != null ? empresaPorNome(get('empresa')) : null,
      observacao: get('observacao') ? String(get('observacao')) : 'Importado de planilha',
      status,
    };
  }

  const camposObrigatoriosOk = mapa['fornecedor_nome'] != null && mapa['valor'] != null && mapa['data_vencimento'] != null;

  const importar = async () => {
    if (!camposObrigatoriosOk) {
      toast.error('Mapeie ao menos Fornecedor, Valor e Vencimento');
      return;
    }
    setImportando(true);
    let ok = 0, erro = 0;
    try {
      const registros = dados
        .map(montarRegistro)
        .filter((r) => r.data_vencimento && r.valor > 0);

      for (let i = 0; i < registros.length; i += 200) {
        const lote = registros.slice(i, i + 200);
        const { error } = await sb.from('contas_pagar').insert(lote);
        if (error) { erro += lote.length; console.error(error); }
        else ok += lote.length;
      }
      setResultado({ ok, erro });
      setEtapa('concluido');
      if (ok > 0) toast.success(`${ok} despesas importadas!`);
      if (erro > 0) toast.error(`${erro} linhas com erro (veja o console)`);
    } finally {
      setImportando(false);
    }
  };

  const reset = () => {
    setEtapa('upload'); setRows([]); setMapa({}); setWb(null);
    setSheets([]); setResultado(null); setNomeArquivo('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Despesas</h1>
        <p className="text-muted-foreground">
          Suba o Excel/CSV do seu sistema de gestão e mapeie as colunas — gera lançamentos em Contas a Pagar
        </p>
      </div>

      {/* Upload */}
      {etapa === 'upload' && (
        <Card>
          <CardContent className="p-10 flex flex-col items-center gap-4 text-center">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Formatos aceitos: .xlsx, .xls, .csv</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
              className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Escolher arquivo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Mapeamento */}
      {etapa === 'mapear' && (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> {nomeArquivo}
                <Badge variant="secondary">{dados.length} linhas</Badge>
              </CardTitle>
              {sheets.length > 1 && (
                <Select value={sheetSel} onValueChange={(v) => { setSheetSel(v); if (wb) carregarSheet(wb, v); }}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sheets.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {CAMPOS.map((campo) => (
                  <div key={campo.key} className="flex items-center justify-between gap-3 rounded-md border p-2">
                    <span className="text-sm">
                      {campo.label} {campo.obrigatorio && <span className="text-destructive">*</span>}
                    </span>
                    <Select
                      value={mapa[campo.key] != null ? String(mapa[campo.key]) : NAO_MAPEAR}
                      onValueChange={(v) => setMapa((p) => {
                        const novo = { ...p };
                        if (v === NAO_MAPEAR) delete novo[campo.key];
                        else novo[campo.key] = Number(v);
                        return novo;
                      })}
                    >
                      <SelectTrigger className="w-52"><SelectValue placeholder="— coluna —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NAO_MAPEAR}>— não mapear —</SelectItem>
                        {headers.map((h: any, i: number) => (
                          <SelectItem key={i} value={String(i)}>{String(h || `Coluna ${i + 1}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Status padrão:</Label>
                  <Select value={statusPadrao} onValueChange={setStatusPadrao}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={pagoSeData} onCheckedChange={setPagoSeData} />
                  <Label className="text-sm">Marcar como pago quando houver data de pagamento</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {camposObrigatoriosOk && (
            <Card>
              <CardHeader><CardTitle className="text-base">Pré-visualização (8 primeiras)</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.fornecedor_nome}</TableCell>
                        <TableCell>{r.subcategoria || r.categoria}</TableCell>
                        <TableCell className="text-right">
                          {r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell>{r.data_vencimento ?? '—'}</TableCell>
                        <TableCell>{empresas.find((e) => e.id === r.empresa_id)?.nome ?? '—'}</TableCell>
                        <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={reset}><ArrowLeft className="mr-2 h-4 w-4" /> Trocar arquivo</Button>
            <Button onClick={importar} disabled={!camposObrigatoriosOk || importando}>
              {importando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Importar {dados.length} despesas
            </Button>
          </div>
        </>
      )}

      {/* Concluído */}
      {etapa === 'concluido' && resultado && (
        <Card>
          <CardContent className="p-10 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="text-lg font-semibold">{resultado.ok} despesas importadas com sucesso</p>
            {resultado.erro > 0 && <p className="text-destructive">{resultado.erro} linhas com erro</p>}
            <Button onClick={reset}>Importar outro arquivo</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

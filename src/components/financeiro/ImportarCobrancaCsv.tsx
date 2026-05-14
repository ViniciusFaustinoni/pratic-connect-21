import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Upload, FileText, Send, Check, X, Loader2, MessageCircle, AlertCircle, Phone, ArrowLeft, ClipboardPaste, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { parseCsvInadimplentes, type ParseResultado, type DestinatarioParsed } from '@/lib/cobranca/parseCsvInadimplentes';
import { baixarTemplateCobrancasXlsx } from '@/lib/cobranca/templateCobrancas';

async function lerArquivoComoCsv(file: File): Promise<string> {
  const nome = file.name.toLowerCase();
  if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error('Planilha vazia.');
    return XLSX.utils.sheet_to_csv(ws, { FS: ',' });
  }
  return await file.text();
}

const TEMPLATE_NOME = 'cobranca_inadimplencia_pratic';
const MAX_CSV_MB = 50;
const MAX_CSV_BYTES = MAX_CSV_MB * 1024 * 1024;

type Etapa = 'upload' | 'preview' | 'enviando' | 'concluido';

interface ResultadoEnvio {
  total: number;
  sucesso: number;
  erros: number;
  recuperados_count: number;
  recuperados_valor: number;
  reemitidos_count: number;
  reemitidos_valor: number;
  lote_id: string | null;
  detalhes: Array<{ matricula: string; nome: string; telefone: string; status: 'ok' | 'erro' | 'skip'; erro?: string; erro_codigo?: number | string }>;
}

interface PreviewReconciliacao {
  loading: boolean;
  loteAnteriorId: string | null;
  loteAnteriorNome: string | null;
  ausentes: number;
  ausentesValor: number;
  reemitidos: number;
  reemitidosValor: number;
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ImportarCobrancaCsv() {
  const [etapa, setEtapa] = useState<Etapa>('upload');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ParseResultado | null>(null);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [resultadoEnvio, setResultadoEnvio] = useState<ResultadoEnvio | null>(null);
  const [confirmAberto, setConfirmAberto] = useState(false);
  const [reconciliacao, setReconciliacao] = useState<PreviewReconciliacao | null>(null);
  const [textoColado, setTextoColado] = useState('');
  const [usarTemplateV2, setUsarTemplateV2] = useState(true);
  const cancelarRef = useRef(false);

  const reiniciar = useCallback(() => {
    setEtapa('upload');
    setArquivo(null);
    setResultado(null);
    setResultadoEnvio(null);
    setReconciliacao(null);
    setProgresso({ atual: 0, total: 0 });
    setTextoColado('');
    cancelarRef.current = false;
  }, []);

  // Preview de reconciliação client-side: mostra antes do disparo quantos
  // boletos da lista anterior NÃO estão nesta nova → serão marcados como recuperados.
  const carregarPreviewReconciliacao = useCallback(async (parsed: ParseResultado) => {
    setReconciliacao({ loading: true, loteAnteriorId: null, loteAnteriorNome: null, ausentes: 0, ausentesValor: 0, reemitidos: 0, reemitidosValor: 0 });
    try {
      const { data: lotes } = await supabase
        .from('cobranca_csv_lotes')
        .select('id, nome_arquivo')
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1);
      const loteAnterior = lotes?.[0];
      if (!loteAnterior) {
        setReconciliacao({ loading: false, loteAnteriorId: null, loteAnteriorNome: null, ausentes: 0, ausentesValor: 0, reemitidos: 0, reemitidosValor: 0 });
        return;
      }
      const novaLinhas = new Set(parsed.destinatarios.flatMap((d) => d.boletos.map((b) => (b.linha_digitavel || '').replace(/\D/g, ''))).filter(Boolean));
      const novaMatriculas = new Set(parsed.destinatarios.map((d) => (d.matricula || '').trim()).filter(Boolean));
      let ausentes = 0, ausentesValor = 0, reemitidos = 0, reemitidosValor = 0;
      let from = 0;
      while (true) {
        const { data: page } = await supabase
          .from('cobranca_csv_boletos')
          .select('matricula, linha_digitavel, valor')
          .eq('lote_id', loteAnterior.id)
          .in('status', ['pendente_envio', 'enviado'])
          .range(from, from + 999);
        if (!page || page.length === 0) break;
        for (const b of page) {
          const ld = (b.linha_digitavel || '').replace(/\D/g, '');
          if (novaLinhas.has(ld)) continue;
          if (novaMatriculas.has((b.matricula || '').trim())) {
            reemitidos++; reemitidosValor += Number(b.valor || 0);
          } else {
            ausentes++; ausentesValor += Number(b.valor || 0);
          }
        }
        if (page.length < 1000) break;
        from += 1000;
      }
      setReconciliacao({
        loading: false,
        loteAnteriorId: loteAnterior.id,
        loteAnteriorNome: loteAnterior.nome_arquivo,
        ausentes, ausentesValor, reemitidos, reemitidosValor,
      });
    } catch {
      setReconciliacao({ loading: false, loteAnteriorId: null, loteAnteriorNome: null, ausentes: 0, ausentesValor: 0, reemitidos: 0, reemitidosValor: 0 });
    }
  }, []);

  const processarTexto = useCallback((texto: string, nomeFonte: string) => {
    const r = parseCsvInadimplentes(texto);
    if (r.erros.length && r.destinatarios.length === 0) {
      toast.error(r.erros.join(' '));
      return false;
    }
    setResultado(r);
    setEtapa('preview');
    void carregarPreviewReconciliacao(r);
    return true;
  }, [carregarPreviewReconciliacao]);

  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > MAX_CSV_BYTES) {
      toast.error(`Arquivo maior que ${MAX_CSV_MB} MB.`);
      return;
    }
    setArquivo(f);
    try {
      const texto = await lerArquivoComoCsv(f);
      const ok = processarTexto(texto, f.name);
      if (!ok) setArquivo(null);
    } catch (e: any) {
      toast.error(`Erro ao ler arquivo: ${e.message}`);
      setArquivo(null);
    }
  }, [processarTexto]);

  const processarColado = useCallback(() => {
    const t = textoColado.trim();
    if (!t) {
      toast.error('Cole o conteúdo do CSV antes de processar.');
      return;
    }
    setArquivo(new File([t], 'colado.csv', { type: 'text/csv' }));
    const ok = processarTexto(t, 'colado.csv');
    if (!ok) setArquivo(null);
  }, [textoColado, processarTexto]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv', '.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
  });
  const dispararEnvio = useCallback(async () => {
    if (!resultado) return;
    const destinatariosValidos = resultado.destinatarios.filter((d) => d.telefones_validos.length > 0);
    if (destinatariosValidos.length === 0) {
      toast.error('Nenhum destinatário com WhatsApp válido.');
      return;
    }

    setConfirmAberto(false);
    setEtapa('enviando');
    cancelarRef.current = false;

    const detalhes: ResultadoEnvio['detalhes'] = [];
    let sucesso = 0;
    let erros = 0;
    let loteId: string | null = null;
    let recuperadosCount = 0;
    let recuperadosValor = 0;
    let reemitidosCount = 0;
    let reemitidosValor = 0;

    // Snapshot completo para reconciliação no servidor
    const todasLinhasDigitaveis = resultado.destinatarios.flatMap((d) =>
      d.boletos.map((b) => b.linha_digitavel),
    );
    const todasMatriculas = resultado.destinatarios.map((d) => d.matricula);

    // ===== FASE A: init do lote (rápido, sem disparo) — garante lote_id antes de qualquer envio =====
    try {
      const { data: initData, error: initErr } = await supabase.functions.invoke('disparar-cobranca-csv-meta', {
        body: {
          template_nome: TEMPLATE_NOME,
          template_v2: usarTemplateV2,
          init_only: true,
          is_first_chunk: true,
          nome_arquivo: arquivo?.name || 'cobranca.csv',
          // destinatarios é obrigatório no schema legado; passamos lista vazia mas init_only ignora a validação
          destinatarios: [],
          todas_linhas_digitaveis: todasLinhasDigitaveis,
          todas_matriculas: todasMatriculas,
          total_remessa: resultado.valor_total,
          total_associados_remessa: resultado.total_associados,
        },
      });
      if (initErr) throw new Error(initErr.message);
      if (!initData?.success || !initData?.lote_id) {
        throw new Error(initData?.error || 'Falha ao iniciar lote');
      }
      loteId = initData.lote_id;
      if (typeof initData.recuperados_count === 'number') recuperadosCount = initData.recuperados_count;
      if (typeof initData.recuperados_valor === 'number') recuperadosValor = initData.recuperados_valor;
      if (typeof initData.reemitidos_count === 'number') reemitidosCount = initData.reemitidos_count;
      if (typeof initData.reemitidos_valor === 'number') reemitidosValor = initData.reemitidos_valor;
    } catch (e: any) {
      toast.error(`Falha ao iniciar lote: ${e.message}`);
      setEtapa('preview');
      return;
    }

    // ===== FASE B: chunks de envio (idempotentes, sempre com lote_id) =====
    const CHUNK = 10; // chunks pequenos para evitar timeout do edge runtime
    const total = destinatariosValidos.length;
    setProgresso({ atual: 0, total });

    for (let i = 0; i < total; i += CHUNK) {
      if (cancelarRef.current) break;
      const slice = destinatariosValidos.slice(i, i + CHUNK);
      const isLast = i + CHUNK >= total;
      // Retry uma vez em caso de falha de rede / timeout (idempotência protege contra duplicidade)
      let tentativa = 0;
      let chunkOk = false;
      let ultimoErro = '';
      while (tentativa < 2 && !chunkOk) {
        tentativa++;
        try {
          const { data, error } = await supabase.functions.invoke('disparar-cobranca-csv-meta', {
            body: {
              template_nome: TEMPLATE_NOME,
              template_v2: usarTemplateV2,
              destinatarios: slice,
              is_first_chunk: false,
              is_last_chunk: isLast,
              lote_id: loteId,
              nome_arquivo: arquivo?.name || 'cobranca.csv',
            },
          });
          if (error) throw new Error(error.message);
          if (!data?.success) throw new Error(data?.error || 'Falha no servidor');
          sucesso += data.sucesso || 0;
          erros += data.erros || 0;
          if (Array.isArray(data.detalhes)) detalhes.push(...data.detalhes);
          chunkOk = true;
        } catch (e: any) {
          ultimoErro = e?.message || 'erro desconhecido';
          if (tentativa < 2) {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
      }
      if (!chunkOk) {
        for (const d of slice) {
          for (const t of d.telefones_validos) {
            detalhes.push({ matricula: d.matricula, nome: d.nome, telefone: t, status: 'erro', erro: ultimoErro });
            erros++;
          }
        }
      }
      setProgresso({ atual: Math.min(i + CHUNK, total), total });
    }

    setResultadoEnvio({
      total: detalhes.length,
      sucesso,
      erros,
      recuperados_count: recuperadosCount,
      recuperados_valor: recuperadosValor,
      reemitidos_count: reemitidosCount,
      reemitidos_valor: reemitidosValor,
      lote_id: loteId,
      detalhes,
    });
    setEtapa('concluido');
    if (erros === 0) toast.success(`Envio concluído: ${sucesso} mensagens enviadas.`);
    else toast.warning(`Envio finalizado: ${sucesso} ok, ${erros} com erro.`);
  }, [resultado, arquivo, usarTemplateV2]);

  // ====== ETAPA 1: UPLOAD ======
  if (etapa === 'upload') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" /> Importar CSV de Inadimplentes (SGA/Hinova)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => baixarTemplateCobrancasXlsx()}
              className="gap-2"
            >
              <Download className="h-4 w-4" /> Baixar template (.xlsx)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Aceita <strong>CSV, XLSX</strong> (formato Hinova/SGA) ou <strong>colar</strong> o conteúdo direto.
              Colunas: <strong>Nome, Matrícula</strong> (obrigatórias) · <strong>CPF, Placas, Telefone Celular, Telefone, Data Vencimento, Codigo de Barras, Valor, 2ª Via Boleto</strong> (opcionais).
              <em className="ml-1">Valor</em> sobrescreve a extração da linha digitável; <em>2ª Via Boleto</em> aceita URL crua ou tag <code className="text-xs">&lt;a href&gt;</code> do Hinova.
              O sistema agrupa boletos por associado e dispara via template Meta WhatsApp (link da 2ª via vai no botão dinâmico quando o template v2 estiver disponível).
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="arquivo">
            <TabsList>
              <TabsTrigger value="arquivo" className="gap-2"><Upload className="h-4 w-4" /> Arquivo</TabsTrigger>
              <TabsTrigger value="colar" className="gap-2"><ClipboardPaste className="h-4 w-4" /> Colar CSV</TabsTrigger>
            </TabsList>

            <TabsContent value="arquivo" className="mt-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-1">
                  {isDragActive ? 'Solte o arquivo aqui' : 'Arraste o CSV/XLSX ou clique para selecionar'}
                </p>
                <p className="text-sm text-muted-foreground">.csv, .xlsx ou .xls — máx {MAX_CSV_MB} MB</p>
              </div>
            </TabsContent>

            <TabsContent value="colar" className="mt-4 space-y-3">
              <Textarea
                value={textoColado}
                onChange={(e) => setTextoColado(e.target.value)}
                placeholder={'Nome,matricula,placas,telefone celular,telefone,Data Vencimento,Codigo de Barras\nFULANO,12345,ABC1D23,(21)99999-9999,(00)0000-00000,10/04/2025,34191.09123 ...'}
                className="min-h-[260px] font-mono text-xs"
              />
              <div className="flex justify-end">
                <Button onClick={processarColado} disabled={!textoColado.trim()} className="gap-2">
                  <FileText className="h-4 w-4" /> Processar conteúdo colado
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  // ====== ETAPA 2: PREVIEW ======
  if (etapa === 'preview' && resultado) {
    const destinatariosValidos = resultado.destinatarios.filter((d) => d.telefones_validos.length > 0);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={reiniciar}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Trocar arquivo
          </Button>
          <div className="text-sm text-muted-foreground">
            {arquivo?.name} • {(arquivo?.size || 0) / 1024 < 1024
              ? `${Math.round((arquivo?.size || 0) / 1024)} KB`
              : `${((arquivo?.size || 0) / 1024 / 1024).toFixed(1)} MB`}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <KpiCard label="Boletos no CSV" value={resultado.total_boletos} />
          <KpiCard label="Associados únicos" value={resultado.total_associados} />
          <KpiCard label="Com WhatsApp" value={resultado.com_whatsapp} accent="success" />
          <KpiCard label="Sem WhatsApp" value={resultado.sem_whatsapp} accent="warning" />
          <KpiCard label="Telefones a receber" value={resultado.total_telefones} accent="primary" />
          <KpiCard label="Valor total" valueText={formatBRL(resultado.valor_total)} accent="primary" />
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Ao confirmar, esta lista será comparada com a anterior. Boletos que não estiverem mais presentes
            serão marcados automaticamente como <strong>Recuperados</strong> (pagos) na aba
            Financeiro › Cobranças › Recuperados. Apenas os boletos desta nova lista receberão WhatsApp.
          </AlertDescription>
        </Alert>

        {/* Preview de reconciliação contra o lote anterior */}
        {reconciliacao && reconciliacao.loading && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Comparando com o lote anterior...</AlertDescription>
          </Alert>
        )}
        {reconciliacao && !reconciliacao.loading && reconciliacao.loteAnteriorId && (
          <Alert className="border-green-600/40 bg-green-600/5">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-1">
                <p>
                  Comparado com o último lote ativo (<code className="text-xs bg-muted px-1 rounded">{reconciliacao.loteAnteriorNome}</code>):
                </p>
                <ul className="list-disc pl-5 text-sm">
                  <li>
                    <strong className="text-green-600">{reconciliacao.ausentes} boleto(s)</strong> da lista anterior
                    NÃO estão nesta nova → serão marcados como <strong>recuperados</strong> ({formatBRL(reconciliacao.ausentesValor)}).
                  </li>
                  {reconciliacao.reemitidos > 0 && (
                    <li className="text-muted-foreground">
                      {reconciliacao.reemitidos} boleto(s) tiveram a linha digitável trocada (mesma matrícula → <em>reemitido</em>, {formatBRL(reconciliacao.reemitidosValor)}). Não contam como recuperação real.
                    </li>
                  )}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {reconciliacao && !reconciliacao.loading && !reconciliacao.loteAnteriorId && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum lote anterior encontrado — esta é a primeira importação. As próximas comparações serão feitas a partir deste lote.
            </AlertDescription>
          </Alert>
        )}

        {/* Tabela preview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pré-visualização dos destinatários</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Associado</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Telefones</TableHead>
                    <TableHead className="text-right">Boletos</TableHead>
                    <TableHead>Placas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.destinatarios.slice(0, 200).map((d) => (
                    <TableRow key={d.matricula} className={d.telefones_validos.length === 0 ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{d.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{d.matricula}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {d.telefones_validos.map((t) => (
                            <Badge key={t} variant="default" className="bg-green-600 gap-1">
                              <Phone className="h-3 w-3" /> {formatarFone(t)}
                            </Badge>
                          ))}
                          {d.telefones_validos.length === 0 && (
                            <Badge variant="outline" className="text-muted-foreground">Sem WhatsApp</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{d.boletos.length}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {Array.from(new Set(d.boletos.map((b) => b.placa).filter(Boolean))).join(', ') || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {resultado.destinatarios.length > 200 && (
                <div className="p-3 text-xs text-center text-muted-foreground border-t">
                  Mostrando 200 de {resultado.destinatarios.length}. Todos serão processados no envio.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Salvar no sistema (vínculo automático) */}
        <SalvarNoSistemaCard resultado={resultado} arquivo={arquivo} />

        {/* Botão disparar */}
        <Card className="bg-primary/5 border-primary/30">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Disparar WhatsApp em massa (opcional)
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                1 mensagem por associado agrupando todos os boletos.
                Template Meta: <code className="text-xs bg-muted px-1 py-0.5 rounded">{TEMPLATE_NOME}</code>
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => setConfirmAberto(true)}
              disabled={destinatariosValidos.length === 0}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Iniciar envio em massa
            </Button>
          </CardContent>
        </Card>

        <AlertDialog open={confirmAberto} onOpenChange={setConfirmAberto}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar envio em massa</AlertDialogTitle>
              <AlertDialogDescription>
                Serão disparadas <strong>{resultado.total_telefones} mensagens</strong> para{' '}
                <strong>{destinatariosValidos.length} associados</strong> via template Meta.
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={dispararEnvio}>Confirmar e disparar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ====== ETAPA 3: ENVIANDO ======
  if (etapa === 'enviando') {
    const pct = progresso.total > 0 ? (progresso.atual / progresso.total) * 100 : 0;
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-4">
          <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
          <div>
            <h3 className="font-semibold text-lg">Enviando mensagens...</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {progresso.atual} de {progresso.total} associados processados
            </p>
          </div>
          <Progress value={pct} className="max-w-md mx-auto" />
          <Button variant="outline" size="sm" onClick={() => { cancelarRef.current = true; }}>
            Cancelar após o lote atual
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ====== ETAPA 4: CONCLUIDO ======
  if (etapa === 'concluido' && resultadoEnvio) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Total" value={resultadoEnvio.total} />
          <KpiCard label="Enviadas" value={resultadoEnvio.sucesso} accent="success" />
          <KpiCard label="Com erro" value={resultadoEnvio.erros} accent="warning" />
          <KpiCard label="Recuperados" value={resultadoEnvio.recuperados_count} accent="primary" />
          <KpiCard label="Valor recuperado" valueText={formatBRL(resultadoEnvio.recuperados_valor)} accent="success" />
        </div>

        {resultadoEnvio.recuperados_count > 0 && (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>
              <strong>{resultadoEnvio.recuperados_count} boleto(s)</strong> da lista anterior não estavam nesta nova
              remessa e foram marcados como <strong>recuperados</strong> ({formatBRL(resultadoEnvio.recuperados_valor)}).
              Veja em <a href="/financeiro/cobrancas/recuperados" className="underline text-primary">Financeiro › Cobranças › Recuperados</a>.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalhes do envio</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Associado</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultadoEnvio.detalhes.map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{d.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{formatarFone(d.telefone)}</TableCell>
                      <TableCell>
                        {d.status === 'ok' ? (
                          <div className="space-y-1">
                            <Badge className="bg-green-600 gap-1"><Check className="h-3 w-3" /> Enviada</Badge>
                            {d.erro && <p className="text-xs text-amber-600 max-w-[320px] truncate" title={d.erro}>{d.erro}</p>}
                          </div>
                        ) : d.status === 'skip' ? (
                          <div className="space-y-1">
                            <Badge variant="secondary" className="gap-1">Ignorado</Badge>
                            {d.erro && <p className="text-xs text-muted-foreground max-w-[320px] truncate" title={d.erro}>{d.erro}</p>}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Erro {d.erro_codigo ? `#${d.erro_codigo}` : ''}</Badge>
                            {d.erro && <p className="text-xs text-destructive max-w-[320px] truncate" title={d.erro}>{d.erro}</p>}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Button onClick={reiniciar} className="gap-2">
          <Upload className="h-4 w-4" /> Importar outro CSV
        </Button>
      </div>
    );
  }

  return null;
}

function KpiCard({ label, value, valueText, accent }: { label: string; value?: number; valueText?: string; accent?: 'success' | 'warning' | 'primary' }) {
  const color =
    accent === 'success' ? 'text-green-600' :
    accent === 'warning' ? 'text-orange-500' :
    accent === 'primary' ? 'text-primary' : '';
  const display = valueText ?? (typeof value === 'number' ? value.toLocaleString('pt-BR') : '0');
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{display}</p>
      </CardContent>
    </Card>
  );
}

function formatarFone(t: string): string {
  // 5521988887777 → +55 (21) 98888-7777
  const m = t.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  if (!m) return t;
  return `+${m[1]} (${m[2]}) ${m[3]}-${m[4]}`;
}

function SalvarNoSistemaCard({ resultado, arquivo }: { resultado: ParseResultado; arquivo: File | null }) {
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });
  const [resumo, setResumo] = useState<{ matched: number; sem_match: number; gravados: number; ignoradosSemLinha: number; duplicados: number; lote_id: string | null } | null>(null);
  const [reconciliacao, setReconciliacao] = useState<{ pagas: number; pagas_valor: number; atualizadas: number; criadas: number; ignoradas_recente: number; sem_match: number } | null>(null);

  const salvar = useCallback(async () => {
    setSalvando(true);
    setResumo(null);
    setReconciliacao(null);
    const CHUNK = 200;
    const dests = resultado.destinatarios;
    let loteId: string | null = null;
    let matched = 0, semMatch = 0, gravados = 0, ignoradosSemLinha = 0, duplicados = 0;
    setProgresso({ atual: 0, total: dests.length });
    try {
      for (let i = 0; i < dests.length; i += CHUNK) {
        const slice = dests.slice(i, i + CHUNK);
        const isFirst = i === 0;
        const isLast = i + CHUNK >= dests.length;
        const { data, error } = await supabase.functions.invoke('importar-cobrancas-csv', {
          body: {
            destinatarios: slice,
            lote_id: loteId,
            is_first_chunk: isFirst,
            is_last_chunk: isLast,
            nome_arquivo: arquivo?.name || 'cobranca.csv',
            ...(isFirst ? {
              total_remessa_destinatarios: resultado.total_associados,
              total_remessa_boletos: resultado.total_boletos,
              total_remessa_valor: resultado.valor_total,
            } : {}),
          },
        });
        if (error || !data?.success) throw new Error(error?.message || data?.error || 'falha');
        if (data.lote_id) loteId = data.lote_id;
        matched += data.matched_associado || 0;
        semMatch += data.sem_match || 0;
        gravados += data.gravados || 0;
        ignoradosSemLinha += data.ignorados_sem_linha_digitavel || 0;
        duplicados += data.duplicados_ignorados || 0;
        if (data.reconciliacao) setReconciliacao(data.reconciliacao);
        setProgresso({ atual: Math.min(i + CHUNK, dests.length), total: dests.length });
      }
      setResumo({ matched, sem_match: semMatch, gravados, ignoradosSemLinha, duplicados, lote_id: loteId });
      toast.success(`${gravados} cobranças salvas (${matched} vinculadas${duplicados ? `, ${duplicados} duplicadas ignoradas` : ''}${ignoradosSemLinha ? `, ${ignoradosSemLinha} sem linha` : ''}).`);
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e.message}`);
    } finally {
      setSalvando(false);
    }
  }, [resultado, arquivo]);

  return (
    <Card className="bg-emerald-500/5 border-emerald-500/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600" />
              Salvar cobranças no sistema
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Vincula automaticamente cada linha a associados (matrícula/CPF) e veículos (placa).
              Salva em lote — funciona com arquivos grandes.
            </p>
          </div>
          <Button size="lg" onClick={salvar} disabled={salvando} className="gap-2">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {salvando ? 'Salvando...' : `Salvar ${resultado.total_boletos} cobranças`}
          </Button>
        </div>
        {salvando && (
          <div className="space-y-1">
            <Progress value={progresso.total > 0 ? (progresso.atual / progresso.total) * 100 : 0} />
            <p className="text-xs text-muted-foreground">{progresso.atual} de {progresso.total} associados</p>
          </div>
        )}
        {resumo && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <div className="rounded border bg-background p-2"><div className="text-xs text-muted-foreground">Gravadas</div><div className="font-semibold">{resumo.gravados}</div></div>
            <div className="rounded border bg-background p-2"><div className="text-xs text-emerald-600">Vinculadas</div><div className="font-semibold">{resumo.matched}</div></div>
            <div className="rounded border bg-background p-2"><div className="text-xs text-amber-600">Sem match</div><div className="font-semibold">{resumo.sem_match}</div></div>
            <div className="rounded border bg-background p-2"><div className="text-xs text-blue-600">Duplicadas ignoradas</div><div className="font-semibold">{resumo.duplicados}</div></div>
            <div className="rounded border bg-background p-2"><div className="text-xs text-orange-600">Sem linha digitável</div><div className="font-semibold">{resumo.ignoradosSemLinha}</div></div>
          </div>
        )}
        {reconciliacao && (
          <div className="space-y-2">
            <div className="text-sm font-semibold flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              Reconciliação automática contra cobranças do sistema
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div className="rounded border bg-background p-2"><div className="text-xs text-emerald-600">Marcadas como pagas</div><div className="font-semibold">{reconciliacao.pagas}</div><div className="text-xs text-muted-foreground">R$ {reconciliacao.pagas_valor.toFixed(2)}</div></div>
              <div className="rounded border bg-background p-2"><div className="text-xs text-blue-600">Atualizadas</div><div className="font-semibold">{reconciliacao.atualizadas}</div></div>
              <div className="rounded border bg-background p-2"><div className="text-xs text-purple-600">Criadas</div><div className="font-semibold">{reconciliacao.criadas}</div></div>
              <div className="rounded border bg-background p-2"><div className="text-xs text-amber-600">Sem match</div><div className="font-semibold">{reconciliacao.sem_match}</div></div>
              <div className="rounded border bg-background p-2"><div className="text-xs text-muted-foreground">Recentes (24h)</div><div className="font-semibold">{reconciliacao.ignoradas_recente}</div></div>
            </div>
            <p className="text-xs text-muted-foreground">
              Boletos que sumiram da nova listagem foram marcados como pagos. Os que continuam tiveram vencimento/valor sincronizados. Os novos foram inseridos.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

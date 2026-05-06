import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Send, Check, X, Loader2, MessageCircle, AlertCircle, Phone, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { parseCsvInadimplentes, type ParseResultado, type DestinatarioParsed } from '@/lib/cobranca/parseCsvInadimplentes';

const TEMPLATE_NOME = 'cobranca_inadimplencia_pratic';

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
  detalhes: Array<{ matricula: string; nome: string; telefone: string; status: 'ok' | 'erro'; erro?: string }>;
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
  const cancelarRef = useRef(false);

  const reiniciar = useCallback(() => {
    setEtapa('upload');
    setArquivo(null);
    setResultado(null);
    setResultadoEnvio(null);
    setReconciliacao(null);
    setProgresso({ atual: 0, total: 0 });
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

  const onDrop = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Arquivo maior que 5 MB.');
      return;
    }
    setArquivo(f);
    try {
      const texto = await f.text();
      const r = parseCsvInadimplentes(texto);
      if (r.erros.length && r.destinatarios.length === 0) {
        toast.error(r.erros.join(' '));
        setArquivo(null);
        return;
      }
      setResultado(r);
      setEtapa('preview');
      void carregarPreviewReconciliacao(r);
    } catch (e: any) {
      toast.error(`Erro ao ler CSV: ${e.message}`);
      setArquivo(null);
    }
  }, [carregarPreviewReconciliacao]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
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

    const CHUNK = 50;
    const total = destinatariosValidos.length;
    setProgresso({ atual: 0, total });

    for (let i = 0; i < total; i += CHUNK) {
      if (cancelarRef.current) break;
      const slice = destinatariosValidos.slice(i, i + CHUNK);
      const isFirst = i === 0;
      const isLast = i + CHUNK >= total;
      try {
        const { data, error } = await supabase.functions.invoke('disparar-cobranca-csv-meta', {
          body: {
            template_nome: TEMPLATE_NOME,
            destinatarios: slice,
            is_first_chunk: isFirst,
            is_last_chunk: isLast,
            lote_id: loteId,
            nome_arquivo: arquivo?.name || 'cobranca.csv',
            ...(isFirst
              ? {
                  todas_linhas_digitaveis: todasLinhasDigitaveis,
                  todas_matriculas: todasMatriculas,
                  total_remessa: resultado.valor_total,
                  total_associados_remessa: resultado.total_associados,
                }
              : {}),
          },
        });
        if (error) throw new Error(error.message);
        if (!data?.success) throw new Error(data?.error || 'Falha no servidor');
        sucesso += data.sucesso || 0;
        erros += data.erros || 0;
        if (data.lote_id) loteId = data.lote_id;
        if (typeof data.recuperados_count === 'number') recuperadosCount += data.recuperados_count;
        if (typeof data.recuperados_valor === 'number') recuperadosValor += data.recuperados_valor;
        if (typeof data.reemitidos_count === 'number') reemitidosCount += data.reemitidos_count;
        if (typeof data.reemitidos_valor === 'number') reemitidosValor += data.reemitidos_valor;
        if (Array.isArray(data.detalhes)) detalhes.push(...data.detalhes);
      } catch (e: any) {
        for (const d of slice) {
          for (const t of d.telefones_validos) {
            detalhes.push({ matricula: d.matricula, nome: d.nome, telefone: t, status: 'erro', erro: e.message });
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
  }, [resultado, arquivo]);

  // ====== ETAPA 1: UPLOAD ======
  if (etapa === 'upload') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Importar CSV de Inadimplentes (SGA/Hinova)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Envie o CSV exportado do SGA com as colunas: <strong>Nome, Matrícula, Placas,
              Telefone Celular, Telefone, Data Vencimento, Data Vencimento Original, Codigo de Barras</strong>.
              O sistema vai agrupar boletos por associado e disparar via template Meta WhatsApp.
            </AlertDescription>
          </Alert>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-1">
              {isDragActive ? 'Solte o arquivo aqui' : 'Arraste o CSV ou clique para selecionar'}
            </p>
            <p className="text-sm text-muted-foreground">Apenas .csv — máx 5 MB</p>
          </div>
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
                        {d.boletos.map((b) => b.placa).filter(Boolean).join(', ') || '—'}
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

        {/* Botão disparar */}
        <Card className="bg-primary/5 border-primary/30">
          <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Pronto para disparar
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Será enviada <strong>1 mensagem por associado</strong> agrupando todos os boletos.
                Associados com 2 celulares válidos receberão em ambos.
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
                          <Badge className="bg-green-600 gap-1"><Check className="h-3 w-3" /> Enviada</Badge>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" /> Erro</Badge>
                            {d.erro && <p className="text-xs text-destructive max-w-[300px] truncate" title={d.erro}>{d.erro}</p>}
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

import { useMemo, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Upload, Play, Save, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  FlaskConical, Library, BarChart3, Loader2, Trash2, Eye, FileText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const TIPOS = ['cnh', 'crlv', 'rg', 'comprovante_residencia', 'nota_fiscal', 'atpv', 'cnpj'];

const CAMPOS_POR_TIPO: Record<string, { key: string; label: string }[]> = {
  cnh: [
    { key: 'cpf', label: 'CPF' },
    { key: 'nome', label: 'Nome' },
    { key: 'rg', label: 'RG' },
    { key: 'data_nascimento', label: 'Data de Nascimento' },
    { key: 'numero_cnh', label: 'Número CNH' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'validade', label: 'Validade' },
  ],
  crlv: [
    { key: 'placa', label: 'Placa' },
    { key: 'renavam', label: 'Renavam' },
    { key: 'chassi', label: 'Chassi' },
    { key: 'marca', label: 'Marca' },
    { key: 'modelo', label: 'Modelo' },
    { key: 'ano_fabricacao', label: 'Ano Fabricação' },
    { key: 'ano_modelo', label: 'Ano Modelo' },
    { key: 'cor', label: 'Cor' },
    { key: 'combustivel', label: 'Combustível' },
    { key: 'cpf_proprietario', label: 'CPF Proprietário' },
    { key: 'nome_proprietario', label: 'Nome Proprietário' },
  ],
  rg: [
    { key: 'cpf', label: 'CPF' },
    { key: 'nome', label: 'Nome' },
    { key: 'rg', label: 'RG' },
    { key: 'data_nascimento', label: 'Data de Nascimento' },
  ],
  comprovante_residencia: [
    { key: 'nome', label: 'Nome' },
    { key: 'cep', label: 'CEP' },
    { key: 'endereco', label: 'Endereço' },
    { key: 'cidade', label: 'Cidade' },
    { key: 'uf', label: 'UF' },
  ],
  nota_fiscal: [
    { key: 'cnpj_emissor', label: 'CNPJ Emissor' },
    { key: 'numero', label: 'Número' },
    { key: 'data_emissao', label: 'Data Emissão' },
    { key: 'valor_total', label: 'Valor Total' },
  ],
  atpv: [
    { key: 'placa', label: 'Placa' },
    { key: 'chassi', label: 'Chassi' },
    { key: 'cpf_comprador', label: 'CPF Comprador' },
    { key: 'nome_comprador', label: 'Nome Comprador' },
  ],
  cnpj: [
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'razao_social', label: 'Razão Social' },
  ],
};

type FileMeta = { path: string; url: string; mime: string; bytes: number };
type TestCase = any;
type TestRun = any;

const normalize = (v: any) =>
  String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function compararCampos(esperado: Record<string, any>, obtido: Record<string, any>) {
  const comparacao: Record<string, { esperado: any; obtido: any; match: boolean }> = {};
  let total = 0;
  let hits = 0;
  for (const k of Object.keys(esperado || {})) {
    const ve = esperado[k];
    if (ve === undefined || ve === null || ve === '') continue;
    const vo = obtido?.[k];
    const match = normalize(ve) === normalize(vo) && normalize(ve) !== '';
    comparacao[k] = { esperado: ve, obtido: vo ?? '', match };
    total++;
    if (match) hits++;
  }
  return { comparacao, total, hits, score: total > 0 ? Math.round((hits / total) * 10000) / 100 : null };
}

export default function OcrTestesTab() {
  return (
    <Tabs defaultValue="executar" className="space-y-4">
      <TabsList>
        <TabsTrigger value="executar" className="gap-2">
          <FlaskConical className="h-4 w-4" /> Executar Teste
        </TabsTrigger>
        <TabsTrigger value="biblioteca" className="gap-2">
          <Library className="h-4 w-4" /> Biblioteca de Casos
        </TabsTrigger>
        <TabsTrigger value="metricas" className="gap-2">
          <BarChart3 className="h-4 w-4" /> Métricas
        </TabsTrigger>
      </TabsList>
      <TabsContent value="executar"><PainelExecutar /></TabsContent>
      <TabsContent value="biblioteca"><PainelBiblioteca /></TabsContent>
      <TabsContent value="metricas"><PainelMetricas /></TabsContent>
    </Tabs>
  );
}

// =====================================================
// PAINEL A — Executar teste ad-hoc ou caso salvo
// =====================================================
function PainelExecutar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [casoId, setCasoId] = useState<string>('novo');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<string>('cnh');
  const [arquivo, setArquivo] = useState<FileMeta | null>(null);
  const [expectativas, setExpectativas] = useState<Record<string, string>>({});
  const [resultado, setResultado] = useState<any>(null);
  const [executando, setExecutando] = useState(false);
  const [veredito, setVeredito] = useState<'aprovado' | 'parcial' | 'reprovado' | ''>('');
  const [anotacao, setAnotacao] = useState('');

  const { data: casos } = useQuery({
    queryKey: ['ocr-test-cases-list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ocr_test_cases').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const handleFileUpload = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const path = `ocr-tests/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('cotacoes-docs').upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      toast.error(`Erro no upload: ${error.message}`);
      return;
    }
    const { data: pub } = supabase.storage.from('cotacoes-docs').getPublicUrl(path);
    setArquivo({ path, url: pub.publicUrl, mime: file.type, bytes: file.size });
    if (!nome) setNome(file.name.replace(/\.[^.]+$/, ''));
    toast.success('Arquivo enviado.');
  };

  const handleSelectCaso = (id: string) => {
    setCasoId(id);
    setResultado(null);
    if (id === 'novo') {
      setNome(''); setTipo('cnh'); setArquivo(null); setExpectativas({});
      return;
    }
    const c = casos?.find((x: any) => x.id === id);
    if (c) {
      setNome(c.nome);
      setTipo(c.tipo_esperado);
      setArquivo({ path: c.arquivo_path, url: c.arquivo_url, mime: c.mime, bytes: c.bytes });
      setExpectativas(c.expectativas || {});
    }
  };

  const rodarOcr = async () => {
    if (!arquivo) { toast.error('Envie um arquivo.'); return; }
    setExecutando(true);
    setResultado(null);
    try {
      const dadosEsperados = Object.fromEntries(
        Object.entries(expectativas).filter(([, v]) => v && String(v).trim() !== '')
      );
      const { data, error } = await supabase.functions.invoke('document-ocr', {
        body: {
          url: arquivo.url,
          tipoEsperado: tipo,
          extrairDados: true,
          modoTeste: true,
          dadosEsperados,
        },
      });
      if (error) throw error;
      const cmp = compararCampos(dadosEsperados, data?.dados || {});
      setResultado({ ...data, comparacao_local: cmp });
    } catch (e: any) {
      toast.error(`Falha no OCR: ${e?.message ?? e}`);
    } finally {
      setExecutando(false);
    }
  };

  const salvarCaso = useMutation({
    mutationFn: async () => {
      if (!arquivo || !nome.trim()) throw new Error('Preencha nome e arquivo.');
      const payload = {
        nome: nome.trim(),
        tipo_esperado: tipo,
        arquivo_path: arquivo.path,
        arquivo_url: arquivo.url,
        mime: arquivo.mime,
        bytes: arquivo.bytes,
        expectativas,
        created_by: user?.id ?? null,
      };
      if (casoId !== 'novo') {
        const { error } = await (supabase as any).from('ocr_test_cases').update(payload).eq('id', casoId);
        if (error) throw error;
        return casoId;
      } else {
        const { data, error } = await (supabase as any).from('ocr_test_cases').insert(payload).select('id').single();
        if (error) throw error;
        setCasoId(data.id);
        return data.id;
      }
    },
    onSuccess: () => {
      toast.success('Caso salvo na biblioteca.');
      qc.invalidateQueries({ queryKey: ['ocr-test-cases-list'] });
      qc.invalidateQueries({ queryKey: ['ocr-test-cases-table'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const salvarRun = useMutation({
    mutationFn: async () => {
      if (!resultado) throw new Error('Execute o OCR primeiro.');
      if (!veredito) throw new Error('Escolha um veredito.');
      const cmp = resultado.comparacao_local;
      const { error } = await (supabase as any).from('ocr_test_runs').insert({
        executed_by: user?.id ?? null,
        test_case_id: casoId !== 'novo' ? casoId : null,
        ocr_log_id: resultado?.ocrLogId ?? null,
        provider: null,
        modelo: null,
        latency_ms: null,
        dados_extraidos: resultado?.dados ?? null,
        dados_esperados: Object.fromEntries(Object.entries(expectativas).filter(([, v]) => v)),
        comparacao: cmp.comparacao,
        score_geral: cmp.score,
        veredito,
        anotacao_humana: anotacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Veredito registrado.');
      setAnotacao(''); setVeredito('');
      qc.invalidateQueries({ queryKey: ['ocr-test-runs'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const campos = CAMPOS_POR_TIPO[tipo] || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Configuração do teste</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Caso</Label>
              <Select value={casoId} onValueChange={handleSelectCaso}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="novo">+ Novo teste</SelectItem>
                  {casos?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} ({c.tipo_esperado})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do caso</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: CNH-e Marcus 2026" />
            </div>
            <div>
              <Label>Tipo esperado</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v); setExpectativas({}); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Arquivo</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Enviar arquivo
              </Button>
              {arquivo && (
                <>
                  <Badge variant="outline" className="font-mono text-xs">{arquivo.path}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => window.open(arquivo.url, '_blank')}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Valores esperados (ground truth)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {campos.map((c) => (
                <div key={c.key}>
                  <Label className="text-xs text-muted-foreground">{c.label}</Label>
                  <Input
                    value={expectativas[c.key] ?? ''}
                    onChange={(e) => setExpectativas((s) => ({ ...s, [c.key]: e.target.value }))}
                    placeholder="(opcional)"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={rodarOcr} disabled={executando || !arquivo}>
              {executando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Rodar OCR
            </Button>
            <Button variant="outline" onClick={() => salvarCaso.mutate()} disabled={salvarCaso.isPending || !arquivo || !nome}>
              <Save className="h-4 w-4 mr-2" /> {casoId === 'novo' ? 'Salvar como caso' : 'Atualizar caso'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Resultado
              {resultado.comparacao_local?.score != null && (
                <Badge variant="outline" className={
                  resultado.comparacao_local.score >= 90 ? 'bg-success/10 text-success border-success/30' :
                  resultado.comparacao_local.score >= 50 ? 'bg-warning/10 text-warning border-warning/30' :
                  'bg-destructive/10 text-destructive border-destructive/30'
                }>
                  Score {resultado.comparacao_local.score}%
                </Badge>
              )}
              <Badge variant="outline">Detectado: {resultado.tipo_detectado ?? '-'}</Badge>
              <Badge variant="outline">Sugestão: {resultado.sugestao ?? '-'}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campo</TableHead>
                  <TableHead>Esperado</TableHead>
                  <TableHead>Obtido</TableHead>
                  <TableHead className="w-16 text-center">Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(resultado.comparacao_local?.comparacao || {}).map(([k, v]: any) => (
                  <TableRow key={k}>
                    <TableCell className="font-medium">{k}</TableCell>
                    <TableCell className="font-mono text-xs">{String(v.esperado ?? '')}</TableCell>
                    <TableCell className="font-mono text-xs">{String(v.obtido ?? '')}</TableCell>
                    <TableCell className="text-center">
                      {v.match
                        ? <CheckCircle2 className="h-4 w-4 text-success inline" />
                        : <XCircle className="h-4 w-4 text-destructive inline" />}
                    </TableCell>
                  </TableRow>
                ))}
                {Object.keys(resultado.comparacao_local?.comparacao || {}).length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem expectativas declaradas — informe ground truth para medir.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>

            <details className="border rounded p-3">
              <summary className="cursor-pointer font-medium">Dados extraídos completos (JSON)</summary>
              <pre className="text-xs mt-2 overflow-auto max-h-96">{JSON.stringify(resultado.dados, null, 2)}</pre>
            </details>

            <div className="border-t pt-4 space-y-3">
              <Label>Veredito humano</Label>
              <div className="flex gap-2">
                {(['aprovado', 'parcial', 'reprovado'] as const).map((v) => (
                  <Button
                    key={v}
                    variant={veredito === v ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setVeredito(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
              <Textarea
                placeholder="Anotação (o que falhou, hipótese de causa, sugestão de fix do prompt...)"
                value={anotacao}
                onChange={(e) => setAnotacao(e.target.value)}
                rows={3}
              />
              <Button onClick={() => salvarRun.mutate()} disabled={salvarRun.isPending || !veredito}>
                <Save className="h-4 w-4 mr-2" /> Registrar execução
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =====================================================
// PAINEL B — Biblioteca de casos
// =====================================================
function PainelBiblioteca() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const { data: casos, isLoading } = useQuery({
    queryKey: ['ocr-test-cases-table'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ocr_test_cases')
        .select('*, runs:ocr_test_runs(score_geral, veredito, created_at)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const toggleAtivo = async (id: string, ativo: boolean) => {
    await (supabase as any).from('ocr_test_cases').update({ ativo }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['ocr-test-cases-table'] });
  };

  const remover = async (id: string) => {
    if (!confirm('Remover caso?')) return;
    await (supabase as any).from('ocr_test_cases').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['ocr-test-cases-table'] });
  };

  const rodarTodos = async () => {
    const ativos = (casos || []).filter((c: any) => c.ativo);
    if (!ativos.length) { toast.error('Nenhum caso ativo.'); return; }
    setRunning(true);
    setProgress({ done: 0, total: ativos.length });
    let aprovados = 0;
    for (const c of ativos) {
      try {
        const dadosEsperados = c.expectativas || {};
        const { data } = await supabase.functions.invoke('document-ocr', {
          body: {
            url: c.arquivo_url,
            tipoEsperado: c.tipo_esperado,
            extrairDados: true,
            modoTeste: true,
            dadosEsperados,
          },
        });
        const cmp = compararCampos(dadosEsperados, data?.dados || {});
        const veredito = cmp.score == null ? 'pendente' : cmp.score >= 90 ? 'aprovado' : cmp.score >= 50 ? 'parcial' : 'reprovado';
        await (supabase as any).from('ocr_test_runs').insert({
          test_case_id: c.id,
          ocr_log_id: data?.ocrLogId ?? null,
          dados_extraidos: data?.dados ?? null,
          dados_esperados: dadosEsperados,
          comparacao: cmp.comparacao,
          score_geral: cmp.score,
          veredito,
        });
        if (veredito === 'aprovado') aprovados++;
      } catch (e) {
        console.error('Run falhou', c.nome, e);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
      await new Promise((r) => setTimeout(r, 400));
    }
    setRunning(false);
    toast.success(`Regression run: ${aprovados}/${ativos.length} aprovados`);
    qc.invalidateQueries({ queryKey: ['ocr-test-cases-table'] });
    qc.invalidateQueries({ queryKey: ['ocr-test-runs'] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Biblioteca de casos ({casos?.length ?? 0})</CardTitle>
          <Button onClick={rodarTodos} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            {running ? `Rodando ${progress.done}/${progress.total}` : 'Re-executar todos os ativos'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="text-center py-8 text-muted-foreground">Carregando...</div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Último score</TableHead>
                <TableHead className="text-center">Último veredito</TableHead>
                <TableHead className="text-center">Execuções</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(casos ?? []).map((c: any) => {
                const runs = (c.runs ?? []).slice().sort((a: any, b: any) =>
                  new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                const last = runs[0];
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell><Badge variant="outline">{c.tipo_esperado}</Badge></TableCell>
                    <TableCell className="text-center">{last?.score_geral != null ? `${last.score_geral}%` : '-'}</TableCell>
                    <TableCell className="text-center">
                      {last?.veredito && (
                        <Badge variant="outline" className={
                          last.veredito === 'aprovado' ? 'bg-success/10 text-success border-success/30' :
                          last.veredito === 'parcial' ? 'bg-warning/10 text-warning border-warning/30' :
                          'bg-destructive/10 text-destructive border-destructive/30'
                        }>{last.veredito}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{runs.length}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={c.ativo} onCheckedChange={(v) => toggleAtivo(c.id, v)} />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => window.open(c.arquivo_url, '_blank')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remover(c.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!casos?.length && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum caso salvo ainda. Use a aba "Executar Teste" para criar.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================
// PAINEL C — Métricas
// =====================================================
function PainelMetricas() {
  const qc = useQueryClient();
  const { data: runs } = useQuery({
    queryKey: ['ocr-test-runs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ocr_test_runs')
        .select('*, test_case:ocr_test_cases(nome, tipo_esperado)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: prodLogs } = useQuery({
    queryKey: ['ocr-prod-logs-recent-falhas'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ocr_execution_logs')
        .select('id, created_at, tipo_esperado, tipo_detectado, motivo, status, dados_extraidos, arquivo_url_hash, score_campos')
        .in('status', ['falha', 'revisar'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const list = runs || [];
    const byTipo: Record<string, { total: number; sumScore: number; aprov: number }> = {};
    const camposFalha: Record<string, { total: number; falhas: number }> = {};
    for (const r of list) {
      const tipo = r.test_case?.tipo_esperado || 'desconhecido';
      byTipo[tipo] ||= { total: 0, sumScore: 0, aprov: 0 };
      byTipo[tipo].total++;
      if (r.score_geral != null) byTipo[tipo].sumScore += Number(r.score_geral);
      if (r.veredito === 'aprovado') byTipo[tipo].aprov++;
      const cmp = r.comparacao || {};
      for (const [k, v] of Object.entries(cmp as any)) {
        const key = `${tipo}.${k}`;
        camposFalha[key] ||= { total: 0, falhas: 0 };
        camposFalha[key].total++;
        if (!(v as any).match) camposFalha[key].falhas++;
      }
    }
    const piores = Object.entries(camposFalha)
      .map(([k, v]) => ({ campo: k, taxa: v.total ? v.falhas / v.total : 0, ...v }))
      .filter((x) => x.total >= 2)
      .sort((a, b) => b.taxa - a.taxa)
      .slice(0, 10);
    return { byTipo, piores, total: list.length };
  }, [runs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Total de execuções</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Tipos cobertos</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{Object.keys(stats.byTipo).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Falhas recentes em produção</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{prodLogs?.length ?? 0}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Acurácia por tipo</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-center">Execuções</TableHead>
                <TableHead className="text-center">Score médio</TableHead>
                <TableHead className="text-center">% aprovados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(stats.byTipo).map(([tipo, v]) => (
                <TableRow key={tipo}>
                  <TableCell><Badge variant="outline">{tipo}</Badge></TableCell>
                  <TableCell className="text-center">{v.total}</TableCell>
                  <TableCell className="text-center">{v.total ? Math.round(v.sumScore / v.total) : 0}%</TableCell>
                  <TableCell className="text-center">{v.total ? Math.round((v.aprov / v.total) * 100) : 0}%</TableCell>
                </TableRow>
              ))}
              {!Object.keys(stats.byTipo).length && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem execuções ainda.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Campos com pior taxa de acerto</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo (tipo.campo)</TableHead>
                <TableHead className="text-center">Execuções</TableHead>
                <TableHead className="text-center">% falha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.piores.map((p) => (
                <TableRow key={p.campo}>
                  <TableCell className="font-mono">{p.campo}</TableCell>
                  <TableCell className="text-center">{p.total}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={
                      p.taxa >= 0.5 ? 'bg-destructive/10 text-destructive border-destructive/30' :
                      p.taxa >= 0.2 ? 'bg-warning/10 text-warning border-warning/30' :
                      'bg-success/10 text-success border-success/30'
                    }>{Math.round(p.taxa * 100)}%</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!stats.piores.length && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados suficientes.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Falhas recentes em produção</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Tipo esperado/detectado</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(prodLogs ?? []).map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{format(new Date(l.created_at), 'dd/MM HH:mm', { locale: ptBR })}</TableCell>
                  <TableCell className="text-xs">{l.tipo_esperado ?? '-'} → {l.tipo_detectado ?? '-'}</TableCell>
                  <TableCell className="text-xs max-w-md truncate" title={l.motivo}>{l.motivo ?? '-'}</TableCell>
                  <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                </TableRow>
              ))}
              {!prodLogs?.length && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem falhas recentes.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, AlertCircle, CheckCircle2, Link as LinkIcon, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface BoletoNorm {
  nosso_numero: string;
  tipo_boleto: string | null;
  situacao_boleto: string | null;
  status_interno: string;
  valor_boleto: number;
  valor_final: number;
  multa: number;
  mora: number;
  data_emissao: string | null;
  data_vencimento: string | null;
  data_vencimento_original: string | null;
  data_pagamento: string | null;
  linha_digitavel: string | null;
  link_boleto: string | null;
  pix: any;
}

interface ResultadoTeste {
  success: boolean;
  error?: string;
  reason?: string;
  retry?: boolean;
  not_found?: boolean;
  http_status?: number;
  hinova_http_status?: number;
  duracao_ms?: number;
  veiculo?: { id: string; placa: string; codigo_hinova_armazenado: number | null };
  associado?: { id: string; nome: string; codigo_hinova_armazenado: number | null };
  codigo_veiculo_utilizado?: number;
  codigo_associado_utilizado?: number;
  reconciliacao?: any;
  janela?: { dias: number; data_inicial: string; data_final: string };
  request_payload?: any;
  raw_response?: any;
  quantidade?: number;
  boletos_normalizados?: BoletoNorm[];
}

const fmtBRL = (n: number) =>
  (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusColor: Record<string, string> = {
  pago: 'border-green-500/30 text-green-700 bg-green-500/10',
  vencido: 'border-destructive/30 text-destructive bg-destructive/10',
  cancelado: 'border-muted-foreground/30 text-muted-foreground bg-muted',
  aguardando_pagamento: 'border-blue-500/30 text-blue-700 bg-blue-500/10',
};

export function TesteBoletoVeiculoHinova() {
  const [placa, setPlaca] = useState('');
  const [dias, setDias] = useState('90');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);

  async function executar() {
    const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (placaLimpa.length < 6) {
      toast.error('Informe uma placa válida');
      return;
    }
    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke('sga-testar-boletos-veiculo', {
        body: { placa: placaLimpa, dias: Number(dias) },
      });
      if (error) throw new Error(error.message);
      setResultado(data as ResultadoTeste);
      if ((data as ResultadoTeste).success) {
        toast.success(`Hinova retornou ${(data as ResultadoTeste).quantidade ?? 0} boleto(s)`);
      } else {
        toast.warning((data as ResultadoTeste).error || 'Sem sucesso');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao chamar função de teste');
    } finally {
      setLoading(false);
    }
  }

  const copy = (txt: string | null) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt).then(() => toast.success('Copiado'));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" /> Teste de Boletos por Veículo (Hinova)
          </CardTitle>
          <CardDescription>
            Consulta direta ao endpoint <code className="text-xs bg-muted px-1 py-0.5 rounded">POST /listar/boleto-associado-veiculo</code>.
            Não grava nada no banco — útil para validar antes de rodar o sync em massa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label htmlFor="placa-teste">Placa do veículo</Label>
              <Input
                id="placa-teste"
                placeholder="ABC1D23"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && executar()}
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5 w-32">
              <Label>Janela</Label>
              <Select value={dias} onValueChange={setDias} disabled={loading}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias (máx)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={executar} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Testar busca
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <>
          {/* Status / erro */}
          {!resultado.success && (
            <Alert variant={resultado.retry ? 'default' : 'destructive'}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {resultado.retry ? `Erro transitório (${resultado.reason})` : 'Falha na consulta'}
              </AlertTitle>
              <AlertDescription className="font-mono text-xs whitespace-pre-wrap">
                {resultado.error}
              </AlertDescription>
            </Alert>
          )}

          {resultado.success && (
            <Alert className="border-green-500/30 bg-green-500/5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-700">
                Sucesso — {resultado.quantidade} boleto(s) em {resultado.duracao_ms}ms
              </AlertTitle>
              <AlertDescription>
                HTTP {resultado.hinova_http_status} · Janela {resultado.janela?.data_inicial} → {resultado.janela?.data_final}
              </AlertDescription>
            </Alert>
          )}

          {/* Vínculos */}
          {(resultado.veiculo || resultado.associado) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Vínculos resolvidos</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Veículo</p>
                  <p className="font-mono">{resultado.veiculo?.placa}</p>
                  <p className="text-xs">
                    codigo_veiculo Hinova: <strong>{resultado.codigo_veiculo_utilizado ?? '—'}</strong>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Associado</p>
                  <p>{resultado.associado?.nome}</p>
                  <p className="text-xs">
                    codigo_associado Hinova: <strong>{resultado.codigo_associado_utilizado ?? '—'}</strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela normalizada */}
          {resultado.boletos_normalizados && resultado.boletos_normalizados.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Boletos retornados</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nosso nº</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Final</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Linha digitável</TableHead>
                      <TableHead>Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultado.boletos_normalizados.map((b) => (
                      <TableRow key={b.nosso_numero}>
                        <TableCell className="font-mono text-xs">{b.nosso_numero}</TableCell>
                        <TableCell className="text-xs">{b.tipo_boleto || '—'}</TableCell>
                        <TableCell className="text-xs">{b.data_vencimento || '—'}</TableCell>
                        <TableCell className="text-xs">{b.data_pagamento || '—'}</TableCell>
                        <TableCell className="text-right text-xs">{fmtBRL(b.valor_boleto)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtBRL(b.valor_final)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColor[b.status_interno] || ''}>
                            {b.situacao_boleto || b.status_interno}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {b.linha_digitavel ? (
                            <button
                              onClick={() => copy(b.linha_digitavel)}
                              className="text-xs font-mono hover:underline inline-flex items-center gap-1"
                            >
                              <Copy className="h-3 w-3" />
                              {b.linha_digitavel.slice(0, 14)}…
                            </button>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {b.link_boleto ? (
                            <a
                              href={b.link_boleto}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            >
                              <LinkIcon className="h-3 w-3" /> abrir
                            </a>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Request + Raw */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Request enviado</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-80">
                  {JSON.stringify(resultado.request_payload ?? {}, null, 2)}
                </pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Resposta crua da Hinova</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-80">
                  {JSON.stringify(resultado.raw_response ?? {}, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>

          {resultado.reconciliacao && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Reconciliação de códigos</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
                  {JSON.stringify(resultado.reconciliacao, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

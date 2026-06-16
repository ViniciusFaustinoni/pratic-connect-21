import { useState } from 'react';
import { Calculator, Lock, Send, Settings2, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useDistribuicaoParametros, useSalvarParametros, useDistribuicaoMes,
  useGerarDistribuicao, useFecharDistribuicao, enviarResumoDistribuicao,
  DistribuicaoParametros,
} from '@/hooks/useDistribuicaoLucro';
import { toast } from 'sonner';

const fmt = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FechamentoDistribuicao() {
  const agora = new Date();
  const [mesRef, setMesRef] = useState(
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`,
  );
  const [ano, mes] = mesRef.split('-').map(Number);

  const { data: params } = useDistribuicaoParametros();
  const { data: mesData, isLoading } = useDistribuicaoMes(ano, mes);
  const gerar = useGerarDistribuicao();
  const fechar = useFecharDistribuicao();
  const salvarParams = useSalvarParametros();

  const [showParams, setShowParams] = useState(false);
  const [formParams, setFormParams] = useState<DistribuicaoParametros | null>(null);
  const [enviando, setEnviando] = useState(false);

  const dist = mesData?.dist;
  const socios = mesData?.socios ?? [];
  const fechado = dist?.status === 'fechado';

  const handleCalcular = () => {
    if (!params) return;
    gerar.mutate({ ano, mes, parametros: params });
  };

  const handleEnviar = async () => {
    if (!dist) return;
    setEnviando(true);
    await enviarResumoDistribuicao(dist.id);
    toast.success('Resumo enviado aos sócios!');
    setEnviando(false);
  };

  const editarParams = () => {
    setFormParams(params ?? null);
    setShowParams(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fechamento & Distribuição de Lucro</h1>
          <p className="text-muted-foreground">
            Receita − Despesa = Lucro → reserva (Caixa) + distribuição aos sócios
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} className="w-40" />
          <Button variant="outline" size="icon" onClick={editarParams} title="Parâmetros">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Parâmetros (editor) */}
      {showParams && formParams && (
        <Card>
          <CardHeader><CardTitle className="text-base">Parâmetros da distribuição</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-5">
            <Param label="% Caixa (reserva)" value={formParams.percentual_caixa}
              onChange={(v) => setFormParams({ ...formParams, percentual_caixa: v })} />
            <Param label="DL mínimo (R$)" value={formParams.dl_minimo}
              onChange={(v) => setFormParams({ ...formParams, dl_minimo: v })} />
            <Param label="Pró-labore (R$)" value={formParams.pro_labore}
              onChange={(v) => setFormParams({ ...formParams, pro_labore: v })} />
            <Param label="Alíquota IR (%)" value={formParams.aliquota_ir}
              onChange={(v) => setFormParams({ ...formParams, aliquota_ir: v })} />
            <Param label="Nº de sócios" value={formParams.num_socios}
              onChange={(v) => setFormParams({ ...formParams, num_socios: v })} />
            <div className="md:col-span-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowParams(false)}>Cancelar</Button>
              <Button
                onClick={() => salvarParams.mutate(formParams, { onSuccess: () => setShowParams(false) })}
                disabled={salvarParams.isPending}
              >
                {salvarParams.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar parâmetros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {isLoading ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : !dist ? (
        <Card>
          <CardContent className="p-10 flex flex-col items-center gap-4 text-center">
            <p className="text-muted-foreground">Nenhuma distribuição calculada para {mesRef}.</p>
            <Button onClick={handleCalcular} disabled={gerar.isPending}>
              {gerar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
              Calcular distribuição do mês
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cabeçalho do resultado */}
          <div className="grid gap-4 md:grid-cols-4">
            <Kpi titulo="Receita" valor={fmt(dist.receita_total)} cor="text-green-600" />
            <Kpi titulo="Despesa" valor={fmt(dist.despesa_total)} cor="text-destructive" />
            <Kpi titulo="Lucro" valor={fmt(dist.lucro)} cor={dist.lucro >= 0 ? 'text-green-600' : 'text-destructive'} />
            <Kpi titulo={`Caixa (${Number(dist.percentual_caixa)}%)`} valor={fmt(dist.valor_caixa)} cor="text-blue-600" />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">
                Distribuição aos sócios
                {fechado && <Badge variant="default" className="ml-2">Fechado</Badge>}
                {!fechado && <Badge variant="secondary" className="ml-2">Rascunho</Badge>}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                Distribuível: <strong>{fmt(dist.valor_distribuivel)}</strong> · por sócio: <strong>{fmt(dist.valor_por_socio)}</strong>
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sócio</TableHead>
                    <TableHead className="text-right">Cota do lucro</TableHead>
                    <TableHead className="text-right">IR</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead className="text-right">Pró-labore</TableHead>
                    <TableHead className="text-right">DL mínimo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {socios.map((s) => (
                    <TableRow key={s.id ?? s.socio_nome}>
                      <TableCell className="font-medium">{s.socio_nome}</TableCell>
                      <TableCell className="text-right">{fmt(s.cota_lucro)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(s.ir_valor)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">{fmt(s.valor_liquido)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(s.pro_labore)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmt(s.dl_minimo)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="flex flex-wrap gap-2">
            {!fechado && (
              <Button variant="outline" onClick={handleCalcular} disabled={gerar.isPending}>
                {gerar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                Recalcular
              </Button>
            )}
            <Button onClick={handleEnviar} disabled={enviando}>
              {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Enviar resumo aos sócios (WhatsApp)
            </Button>
            {!fechado ? (
              <Button variant="secondary"
                onClick={() => fechar.mutate({ id: dist.id, ano, mes })}
                disabled={fechar.isPending}>
                <Lock className="mr-2 h-4 w-4" /> Fechar mês
              </Button>
            ) : (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Mês fechado em {dist.fechado_em ? new Date(dist.fechado_em).toLocaleDateString('pt-BR') : ''}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ titulo, valor, cor }: { titulo: string; valor: string; cor?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{titulo}</p>
        <p className={`text-2xl font-bold mt-1 ${cor ?? ''}`}>{valor}</p>
      </CardContent>
    </Card>
  );
}

function Param({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Input type="number" step="0.01" value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  );
}

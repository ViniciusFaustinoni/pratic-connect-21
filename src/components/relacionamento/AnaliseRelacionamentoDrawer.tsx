import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileSignature, User, Car, DollarSign, History, Upload, CheckCircle2, Loader2, ExternalLink,
} from 'lucide-react';
import { useAssociado } from '@/hooks/useAssociados';
import { useVeiculo } from '@/hooks/useVeiculos';
import { useCobrancas } from '@/hooks/useCobrancas';
import { useAssociadoHistoricoCompleto } from '@/hooks/useAssociadoHistoricoCompleto';
import { TimelineHistorico } from '@/components/cadastro/TimelineHistorico';
import {
  TIPO_CFG, STATUS_CFG,
  useAssumirAnalise, useResolverAnalise, uploadAnexoRelacionamento,
  type AnaliseRelacionamento,
} from '@/hooks/useAnalisesRelacionamento';

interface Props {
  analise: AnaliseRelacionamento | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmtMoney(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 text-sm py-1">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value ?? '—'}</div>
    </div>
  );
}

export default function AnaliseRelacionamentoDrawer({ analise, open, onOpenChange }: Props) {
  const [justificativa, setJustificativa] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'associado' | 'veiculo' | 'financeiro' | 'historico'>('associado');

  const assumir = useAssumirAnalise();
  const resolver = useResolverAnalise();

  // Lazy: só dispara fetch quando aba está ativa e drawer aberto
  const associadoQ = useAssociado(
    tab === 'associado' && open ? analise?.associado_id ?? undefined : undefined
  );
  const veiculoQ = useVeiculo(
    tab === 'veiculo' && open ? analise?.veiculo_id ?? undefined : undefined
  );
  const cobrancasQ = useCobrancas(
    tab === 'financeiro' && open && analise?.associado_id
      ? { associado_id: analise.associado_id }
      : undefined
  );
  const historicoQ = useAssociadoHistoricoCompleto(
    tab === 'historico' && open ? analise?.associado_id ?? undefined : undefined
  );

  useEffect(() => {
    if (analise) {
      setJustificativa(analise.justificativa || '');
      setFile(null);
      setTab('associado');
    }
  }, [analise?.id]);

  if (!analise) return null;

  const t = TIPO_CFG[analise.tipo];
  const s = STATUS_CFG[analise.status];
  const meta: any = analise.metadata || {};
  const isResolvido = analise.status === 'resolvido';

  const handleResolver = async () => {
    try {
      let url = analise.documento_comprobatorio_url;
      if (file) {
        setUploading(true);
        url = await uploadAnexoRelacionamento(analise.id, file);
        setUploading(false);
      }
      await resolver.mutateAsync({
        id: analise.id,
        justificativa,
        documentoUrl: url,
        associadoId: analise.associado_id,
        tipo: analise.tipo,
        placa: meta.placa || meta.placa_antiga,
      });
      onOpenChange(false);
    } catch (e) {
      setUploading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={t.cls}>{t.label}</Badge>
            <Badge className={s.cls}>{s.label}</Badge>
          </div>
          <SheetTitle className="text-xl">{meta.associado_nome || 'Associado'}</SheetTitle>
          <SheetDescription className="space-x-3 text-xs">
            <span>CPF: <span className="font-mono">{meta.associado_cpf || '—'}</span></span>
            <span>Placa: <span className="font-mono">{meta.placa || meta.placa_antiga || '—'}</span></span>
            {analise.termo_assinado_em && (
              <span>
                Termo assinado em{' '}
                {format(new Date(analise.termo_assinado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Documento assinado */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSignature className="h-4 w-4" /> Termo de cancelamento
              </div>
              {analise.termo_url ? (
                <a
                  href={analise.termo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Abrir documento assinado <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  URL do termo não disponível diretamente — consulte pelo histórico do associado/contrato.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Visualizações nativas (sem sair do setor) */}
          <Card>
            <CardContent className="p-3">
              <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="associado" className="text-xs">
                    <User className="h-3.5 w-3.5 mr-1" /> Associado
                  </TabsTrigger>
                  <TabsTrigger value="veiculo" className="text-xs" disabled={!analise.veiculo_id}>
                    <Car className="h-3.5 w-3.5 mr-1" /> Veículo
                  </TabsTrigger>
                  <TabsTrigger value="financeiro" className="text-xs">
                    <DollarSign className="h-3.5 w-3.5 mr-1" /> Financeiro
                  </TabsTrigger>
                  <TabsTrigger value="historico" className="text-xs">
                    <History className="h-3.5 w-3.5 mr-1" /> Histórico
                  </TabsTrigger>
                </TabsList>

                {/* ASSOCIADO */}
                <TabsContent value="associado" className="mt-3">
                  {associadoQ.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-5 w-1/3" />
                    </div>
                  ) : associadoQ.data ? (
                    <div className="divide-y divide-border">
                      <Row label="Nome" value={associadoQ.data.nome} />
                      <Row label="CPF" value={<span className="font-mono">{associadoQ.data.cpf}</span>} />
                      <Row label="Email" value={associadoQ.data.email} />
                      <Row label="Telefone" value={associadoQ.data.telefone} />
                      <Row label="Status" value={<Badge variant="outline">{associadoQ.data.status}</Badge>} />
                      <Row label="Cidade/UF" value={`${associadoQ.data.cidade || '—'} / ${(associadoQ.data as any).uf || '—'}`} />
                      <Row
                        label="Endereço"
                        value={[
                          (associadoQ.data as any).logradouro,
                          (associadoQ.data as any).numero,
                          (associadoQ.data as any).bairro,
                          (associadoQ.data as any).cep,
                        ].filter(Boolean).join(', ') || '—'}
                      />
                      <Row label="Plano" value={(associadoQ.data as any).planos?.nome} />
                      <Row label="Veículos" value={(associadoQ.data as any).veiculos?.length ?? 0} />
                      <Row
                        label="Adesão"
                        value={associadoQ.data.created_at
                          ? format(new Date(associadoQ.data.created_at), 'dd/MM/yyyy', { locale: ptBR })
                          : '—'}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Associado não encontrado.</p>
                  )}
                </TabsContent>

                {/* VEÍCULO */}
                <TabsContent value="veiculo" className="mt-3">
                  {!analise.veiculo_id ? (
                    <p className="text-xs text-muted-foreground">Esta análise não tem veículo vinculado.</p>
                  ) : veiculoQ.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-5 w-2/3" />
                    </div>
                  ) : veiculoQ.data ? (
                    <div className="divide-y divide-border">
                      <Row label="Placa" value={<span className="font-mono">{veiculoQ.data.placa}</span>} />
                      <Row label="Marca" value={veiculoQ.data.marca} />
                      <Row label="Modelo" value={veiculoQ.data.modelo} />
                      <Row label="Ano" value={`${veiculoQ.data.ano_fabricacao ?? '—'} / ${veiculoQ.data.ano_modelo ?? '—'}`} />
                      <Row label="Cor" value={veiculoQ.data.cor} />
                      <Row label="Chassi" value={<span className="font-mono text-xs">{veiculoQ.data.chassi}</span>} />
                      <Row label="RENAVAM" value={veiculoQ.data.renavam} />
                      <Row label="Combustível" value={veiculoQ.data.combustivel} />
                      <Row label="FIPE" value={fmtMoney(Number((veiculoQ.data as any).valor_fipe))} />
                      <Row label="Status" value={<Badge variant="outline">{veiculoQ.data.status}</Badge>} />
                      <Row label="Categoria" value={(veiculoQ.data as any).categoria} />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Veículo não encontrado.</p>
                  )}
                </TabsContent>

                {/* FINANCEIRO */}
                <TabsContent value="financeiro" className="mt-3">
                  {cobrancasQ.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : cobrancasQ.cobrancas && cobrancasQ.cobrancas.length > 0 ? (
                    <div className="space-y-2">
                      {cobrancasQ.estatisticas && (
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="rounded border p-2">
                            <div className="text-muted-foreground">Total</div>
                            <div className="font-semibold">{fmtMoney(cobrancasQ.estatisticas.valorTotal)}</div>
                          </div>
                          <div className="rounded border p-2">
                            <div className="text-muted-foreground">Recebido</div>
                            <div className="font-semibold text-emerald-600">{fmtMoney(cobrancasQ.estatisticas.valorRecebido)}</div>
                          </div>
                          <div className="rounded border p-2">
                            <div className="text-muted-foreground">Pendente</div>
                            <div className="font-semibold text-amber-600">{fmtMoney(cobrancasQ.estatisticas.valorPendente)}</div>
                          </div>
                        </div>
                      )}
                      <div className="max-h-96 overflow-y-auto divide-y divide-border rounded border">
                        {cobrancasQ.cobrancas.map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between px-3 py-2 text-xs">
                            <div className="min-w-0 pr-2">
                              <div className="font-medium truncate">{c.descricao || c.tipo}</div>
                              <div className="text-muted-foreground">
                                Venc: {c.data_vencimento ? format(new Date(c.data_vencimento), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                                {c.referencia_mes && c.referencia_ano && (
                                  <> · {String(c.referencia_mes).padStart(2, '0')}/{c.referencia_ano}</>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-semibold">{fmtMoney(Number(c.valor))}</div>
                              <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma cobrança encontrada para este associado.</p>
                  )}
                </TabsContent>

                {/* HISTÓRICO */}
                <TabsContent value="historico" className="mt-3">
                  <div className="max-h-[28rem] overflow-y-auto">
                    <TimelineHistorico
                      eventos={(historicoQ as any).data || []}
                      isLoading={(historicoQ as any).isLoading}
                      maxItems={50}
                      showFilters={false}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Separator />

          {/* Tratativa */}
          {isResolvido ? (
            <Card>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> Caso resolvido
                </div>
                <div className="text-xs text-muted-foreground">
                  Em{' '}
                  {analise.resolvido_em
                    ? format(new Date(analise.resolvido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : '—'}
                </div>
                <div>
                  <Label className="text-xs">Justificativa</Label>
                  <p className="text-sm whitespace-pre-wrap">{analise.justificativa || '—'}</p>
                </div>
                {analise.documento_comprobatorio_url && (
                  <div>
                    <Label className="text-xs">Documento comprobatório</Label>
                    <a
                      href={analise.documento_comprobatorio_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-sm text-primary hover:underline"
                    >
                      Abrir anexo
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-3 space-y-3">
                <div className="text-sm font-medium">Tratativa</div>
                {analise.status === 'pendente' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => assumir.mutate(analise.id)}
                    disabled={assumir.isPending}
                  >
                    {assumir.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Assumir caso
                  </Button>
                )}

                <div className="space-y-1">
                  <Label htmlFor="just">Justificativa (mín. 10 caracteres)</Label>
                  <Textarea
                    id="just"
                    rows={4}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Descreva o que foi tratado, valores, prazos, decisões..."
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="anexo">Documento comprobatório (opcional)</Label>
                  <Input
                    id="anexo"
                    type="file"
                    accept="image/*,application/pdf,audio/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file && (
                    <div className="text-xs text-muted-foreground">
                      <Upload className="inline h-3 w-3 mr-1" />
                      {file.name} ({Math.round(file.size / 1024)} KB)
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleResolver}
                  disabled={
                    resolver.isPending || uploading || justificativa.trim().length < 10
                  }
                >
                  {(resolver.isPending || uploading) && (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  )}
                  Marcar como resolvido
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

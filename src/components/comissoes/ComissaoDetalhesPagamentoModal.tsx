import { AlertTriangle, CheckCircle2, Download, GitBranch, ReceiptText } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useComissaoDetalhesPagamento } from '@/hooks/useComissaoDetalhesPagamento';
import { getComissaoStatusBadgeVariant, getComissaoStatusLabel, isComissaoAutoPagaAgenciaAdesaoDinheiro } from '@/lib/comissoes-filtros';

interface ComissaoDetalhesPagamentoModalProps {
  comissaoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmPayment?: (id: string) => void;
  confirming?: boolean;
  allowConfirm?: boolean;
  onDownloadReceipt?: (item: any) => void;
}

const formatMoney = (value: unknown) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));

const formatPercent = (value: unknown) => `${Number(value || 0).toFixed(2)}%`;

const getName = (item?: { nome?: string | null; full_name?: string | null; email?: string | null } | null) =>
  item?.nome || item?.full_name || item?.email || 'Não configurado';

const formatRuleValue = (tipo: string | null | undefined, valor: unknown) =>
  tipo === 'valor_fixo' ? formatMoney(valor) : formatPercent(valor);

const findSnapshotRules = (snapshot: any, parcelaNumero?: number | null, role?: string | null) => {
  const root = snapshot?.snapshot_grade || snapshot;
  const planos = root?.regrasPorPlano || root?.regras_por_plano || root?.planos || root?.regras || null;
  const buckets = Array.isArray(planos) ? planos : planos && typeof planos === 'object' ? Object.values(planos) : [];
  const parcelas = buckets.flatMap((bucket: any) => bucket?.parcelas || bucket?.regras || []);
  const parcela = parcelas.find((item: any) => Number(item?.numero_parcela || item?.parcela_numero || item?.numero) === Number(parcelaNumero));
  const perfis = parcela?.perfis || parcela?.niveis || parcela?.regras || [];
  if (Array.isArray(perfis) && perfis.length > 0) return perfis;
  const regra = snapshot?.regra_aplicada;
  return regra ? [regra] : role ? [{ role, nome_nivel: role, valor: snapshot?.valores?.percentual_aplicado, tipo_comissao: snapshot?.regra_aplicada?.tipo_comissao }] : [];
};

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{value || '—'}</div>
    </div>
  );
}

export function ComissaoDetalhesPagamentoModal({
  comissaoId,
  open,
  onOpenChange,
  onConfirmPayment,
  onDownloadReceipt,
  confirming,
  allowConfirm = false,
}: ComissaoDetalhesPagamentoModalProps) {
  const { data, isLoading, error } = useComissaoDetalhesPagamento(open ? comissaoId : null);
  const comissao = data?.comissao;
  const regra = data?.regra || comissao?.calculo_snapshot?.regra_aplicada;
  const regraValor = regra?.valor ?? comissao?.calculo_snapshot?.regra_aplicada?.valor ?? comissao?.percentual_aplicado;
  const tipoCalculo = comissao?.tipo_calculo || regra?.tipo_comissao;
  const snapshotRules = findSnapshotRules(data?.snapshot, comissao?.parcela_numero, comissao?.role_destinatario);
  const canConfirm = allowConfirm && comissaoId && comissao?.status !== 'paga';
  const pagamento = data?.pagamento;
  const autoPagaAgenciaAdesaoDinheiro = comissao ? isComissaoAutoPagaAgenciaAdesaoDinheiro(comissao) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da comissão</DialogTitle>
          <DialogDescription>Confira a regra aplicada, o snapshot da grade, a cadeia hierárquica e os valores antes de pagar.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Não foi possível carregar os detalhes</AlertTitle>
            <AlertDescription>{error instanceof Error ? error.message : 'Tente novamente.'}</AlertDescription>
          </Alert>
        ) : data && comissao ? (
          <div className="space-y-5">
            {data.possuiSnapshotCalculo ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Dados auditáveis encontrados</AlertTitle>
                <AlertDescription>Esta comissão possui snapshot próprio do cálculo gerado.</AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Auditoria reconstruída</AlertTitle>
                <AlertDescription>Esta comissão foi gerada antes do snapshot detalhado. Exibindo os vínculos e dados disponíveis.</AlertDescription>
              </Alert>
            )}

            {!data.possuiVinculosAuditoria && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Vínculos incompletos</AlertTitle>
                <AlertDescription>A comissão não possui todos os vínculos de grade, plano ou regra. Revise antes de marcar como paga.</AlertDescription>
              </Alert>
            )}

            {autoPagaAgenciaAdesaoDinheiro && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Comissão paga automaticamente</AlertTitle>
                <AlertDescription>Esta comissão foi marcada como paga automaticamente porque se trata de taxa de adesão recebida em dinheiro por agência.</AlertDescription>
              </Alert>
            )}

            <section className="grid gap-4 rounded-md border p-4 md:grid-cols-4">
              <DetailItem label="Destinatário" value={getName(data.destinatario)} />
              <DetailItem label="Perfil remunerado" value={comissao.nivel_nome || comissao.role_destinatario} />
              <DetailItem label="Status atual" value={<Badge variant={getComissaoStatusBadgeVariant(comissao)}>{getComissaoStatusLabel(comissao)}</Badge>} />
              <DetailItem label="Valor final" value={formatMoney(comissao.valor_total ?? comissao.valor_comissao)} />
              <DetailItem label="Contrato" value={data.contrato?.numero || data.contrato?.id} />
              <DetailItem label="Cobrança" value={data.cobranca?.id} />
              <DetailItem label="Plano vendido" value={data.plano?.nome || comissao.calculo_snapshot?.plano?.nome} />
              <DetailItem label="Grade utilizada" value={data.grade?.nome || comissao.calculo_snapshot?.grade?.nome} />
              <DetailItem label="Lançamento" value={pagamento?.id || 'Ainda não registrado'} />
              <DetailItem label="Data do pagamento" value={pagamento?.data_pagamento ? new Date(pagamento.data_pagamento).toLocaleDateString('pt-BR') : comissao.pago_em ? new Date(comissao.pago_em).toLocaleDateString('pt-BR') : '—'} />
            </section>

            <section className="space-y-3 rounded-md border p-4">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ReceiptText className="h-4 w-4" /> Regra aplicada
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <DetailItem label="Versão" value={data.gradeVersao?.versao ? `v${data.gradeVersao.versao}` : comissao.calculo_snapshot?.grade?.versao ? `v${comissao.calculo_snapshot.grade.versao}` : '—'} />
                <DetailItem label="Parcela resolvida" value={comissao.parcela_numero ? `${comissao.parcela_numero}ª parcela` : '—'} />
                <DetailItem label="Tipo de cálculo" value={tipoCalculo === 'valor_fixo' ? 'Valor fixo' : 'Percentual'} />
                <DetailItem label="Regra configurada" value={formatRuleValue(tipoCalculo, regraValor)} />
                <DetailItem label="Base de cálculo" value={formatMoney(comissao.valor_base)} />
                <DetailItem label="Valor calculado" value={formatMoney(comissao.valor_comissao)} />
                <DetailItem label="Valor total" value={formatMoney(comissao.valor_total)} />
                <DetailItem label="Regra" value={regra?.nome_nivel || regra?.role || comissao.role_destinatario} />
              </div>
            </section>

            <section className="space-y-3 rounded-md border p-4">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <GitBranch className="h-4 w-4" /> Cadeia hierárquica da venda
              </div>
              <div className="grid gap-4 md:grid-cols-5">
                <DetailItem label="Vendedor origem" value={getName(data.cadeia.vendedor)} />
                <DetailItem label="Supervisor" value={getName(data.cadeia.supervisor)} />
                <DetailItem label="Gerente" value={getName(data.cadeia.gerente)} />
                <DetailItem label="Agência" value={getName(data.cadeia.agencia)} />
                <DetailItem label="Destinatário desta comissão" value={getName(data.cadeia.destinatario)} />
              </div>
              <p className="text-xs text-muted-foreground">Esta comissão foi calculada pela grade do vendedor de origem. Supervisor, gerente e agência não usam suas próprias grades nesta venda.</p>
            </section>

            <section className="space-y-3 rounded-md border p-4">
              <div className="font-semibold text-foreground">Snapshot da grade no momento da geração</div>
              {!data.possuiSnapshotGrade && !data.possuiSnapshotCalculo && (
                <p className="text-sm text-muted-foreground">Snapshot antigo sem detalhamento por plano. Exibindo dados disponíveis da regra gravada.</p>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                <DetailItem label="Snapshot" value={data.gradeVersao?.versao ? `v${data.gradeVersao.versao} — ${data.grade?.nome || 'Grade'}` : data.grade?.nome || '—'} />
                <DetailItem label="Plano vendido" value={data.plano?.nome || comissao.calculo_snapshot?.plano?.nome} />
                <DetailItem label="Parcela" value={comissao.parcela_numero ? `${comissao.parcela_numero}ª parcela` : '—'} />
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Perfis configurados na parcela</div>
                {snapshotRules.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {snapshotRules.map((item: any, index: number) => (
                      <div key={`${item.role || item.nome_nivel || index}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span>{item.nome_nivel || item.role || 'Perfil'}</span>
                        <span className="font-medium">{formatRuleValue(item.tipo_comissao, item.valor ?? item.percentual_aplicado)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum perfil detalhado encontrado no snapshot.</p>
                )}
              </div>
            </section>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {comissao?.status === 'paga' && onDownloadReceipt && (
            <Button variant="outline" onClick={() => onDownloadReceipt(data?.recibo)}>
              <Download className="mr-2 h-4 w-4" /> Baixar recibo
            </Button>
          )}
          {canConfirm && (
            <Button disabled={confirming} onClick={() => comissaoId && onConfirmPayment?.(comissaoId)}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar pagamento
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

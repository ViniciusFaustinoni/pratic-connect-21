import {
  Car, CheckCircle, AlertTriangle, Clock, Shield, Receipt, TrendingUp,
  Calendar, CreditCard, FileText, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AssociadoSituacaoCard } from './AssociadoSituacaoCard';
import type { SituacaoAssociado } from '@/hooks/useAssociadoSituacao';

interface AssociadoResumoTabProps {
  stats: any;
  resumoFinanceiro: any;
  contrato: any;
  associado: any;
  historico: any[] | undefined;
  isLoadingHistorico: boolean;
  situacao?: SituacaoAssociado;
}

const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const formatCurrency = (v: number | null | undefined) =>
  v ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : 'R$ 0,00';

const formatDateTime = (d: string) =>
  new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const getIconeEvento = (tipo: string) => {
  const mapa: Record<string, typeof CheckCircle> = {
    'associado_criado': Shield, 'status_alterado': Clock, 'documento_aprovado': CheckCircle,
    'boleto_pago': CheckCircle, 'veiculo_adicionado': Car, 'instalacao_concluida': CheckCircle,
    'sinistro_aberto': AlertTriangle, 'contrato_assinado': FileText, 'ressalva_registrada': AlertTriangle,
  };
  return mapa[tipo] || Clock;
};

const getCorEvento = (tipo: string) => {
  if (['documento_aprovado', 'boleto_pago', 'instalacao_concluida', 'sinistro_encerrado', 'contrato_assinado', 'chamado_concluido'].includes(tipo)) return 'text-emerald-500';
  if (['documento_reprovado', 'boleto_cancelado', 'instalacao_cancelada'].includes(tipo)) return 'text-destructive';
  if (['sinistro_aberto', 'ressalva_registrada'].includes(tipo)) return 'text-amber-500';
  if (['associado_criado', 'status_alterado', 'veiculo_adicionado'].includes(tipo)) return 'text-primary';
  return 'text-muted-foreground';
};

const getTituloEvento = (tipo: string) => {
  const mapa: Record<string, string> = {
    'associado_criado': 'Cadastro realizado', 'status_alterado': 'Status alterado',
    'dados_atualizados': 'Dados atualizados', 'documento_enviado': 'Documento enviado',
    'documento_aprovado': 'Documento aprovado', 'documento_reprovado': 'Documento reprovado',
    'veiculo_adicionado': 'Veículo cadastrado', 'veiculo_removido': 'Veículo removido',
    'instalacao_agendada': 'Instalação agendada', 'instalacao_concluida': 'Instalação concluída',
    'boleto_gerado': 'Boleto gerado', 'boleto_pago': 'Pagamento confirmado',
    'contrato_assinado': 'Contrato assinado', 'observacao_adicionada': 'Observação',
    'chamado_aberto': 'Chamado aberto', 'chamado_concluido': 'Chamado finalizado',
    'sinistro_aberto': 'Sinistro aberto', 'sinistro_encerrado': 'Sinistro encerrado',
    'ressalva_registrada': 'Ressalva registrada',
  };
  return mapa[tipo] || tipo.replace(/_/g, ' ');
};

export function AssociadoResumoTab({
  stats, resumoFinanceiro, contrato, associado, historico, isLoadingHistorico,
}: AssociadoResumoTabProps) {
  const emAtraso = resumoFinanceiro?.emAtraso && resumoFinanceiro.emAtraso > 0;

  return (
    <div className="space-y-5">
      {/* Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          icon={Car}
          iconColor="text-primary"
          iconBg="bg-primary/10"
          value={stats?.veiculos || 0}
          label="Veículos"
        />
        <MetricCard
          icon={emAtraso ? AlertTriangle : CheckCircle}
          iconColor={emAtraso ? 'text-amber-600' : 'text-emerald-600'}
          iconBg={emAtraso ? 'bg-amber-500/10' : 'bg-emerald-500/10'}
          value={emAtraso ? `${resumoFinanceiro.emAtraso} atraso${resumoFinanceiro.emAtraso > 1 ? 's' : ''}` : 'Em dia'}
          label="Financeiro"
        />
        <MetricCard
          icon={AlertTriangle}
          iconColor="text-orange-500"
          iconBg="bg-orange-500/10"
          value={stats?.sinistros || 0}
          label="Sinistros"
        />
        <MetricCard
          icon={Calendar}
          iconColor="text-violet-500"
          iconBg="bg-violet-500/10"
          value={resumoFinanceiro?.proximaCobranca?.data_vencimento
            ? new Date(resumoFinanceiro.proximaCobranca.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            : '—'}
          label="Próx. Vencimento"
        />
      </div>

      {/* Info Grid */}
      <div className="grid sm:grid-cols-2 gap-3">
        {/* Plano & Contrato */}
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Plano & Contrato</span>
            </div>
            <InfoRow label="Plano" value={associado.planos?.nome || '—'} highlight />
            <InfoRow label="Mensalidade" value={contrato?.valor_mensal ? formatCurrency(contrato.valor_mensal) : '—'} />
            <InfoRow label="Dia vencimento" value={`Todo dia ${contrato?.dia_vencimento || associado.dia_vencimento || 15}`} />
            <InfoRow label="Início contrato" value={contrato?.data_inicio ? formatDate(contrato.data_inicio) : '—'} />
          </CardContent>
        </Card>

        {/* Próximos Vencimentos */}
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Vencimentos</span>
            </div>
            <InfoRow
              label="Mensalidade"
              value={resumoFinanceiro?.proximaCobranca?.data_vencimento
                ? formatDate(resumoFinanceiro.proximaCobranca.data_vencimento) : '—'}
            />
            <InfoRow label="CNH vence" value={contrato?.cliente_cnh_validade ? formatDate(contrato.cliente_cnh_validade) : 'Não informado'} />
            <InfoRow label="CRLV vence" value="Não informado" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Últimas Atividades</span>
          </div>
          {isLoadingHistorico ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : historico && historico.length > 0 ? (
            <div className="space-y-0">
              {historico.slice(0, 6).map((evento, i) => {
                const Icon = getIconeEvento(evento.tipo);
                const cor = getCorEvento(evento.tipo);
                const isLast = i === Math.min(historico.length, 6) - 1;
                return (
                  <div key={evento.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn('p-1.5 rounded-full bg-muted')}>
                        <Icon className={cn('h-3.5 w-3.5', cor)} />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-border min-h-[28px]" />}
                    </div>
                    <div className="pb-4 flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{getTituloEvento(evento.tipo)}</p>
                          <p className="text-xs text-muted-foreground truncate">{evento.descricao}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                          {formatDateTime(evento.data)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma atividade registrada
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Sub-components ---

function MetricCard({ icon: Icon, iconColor, iconBg, value, label }: {
  icon: any; iconColor: string; iconBg: string; value: string | number; label: string;
}) {
  return (
    <Card className="border-border/60 hover:border-border transition-colors">
      <CardContent className="p-3.5 flex items-center gap-3">
        <div className={cn('p-2 rounded-lg shrink-0', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight truncate">{value}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={cn('font-medium text-xs text-right truncate', highlight && 'text-primary font-semibold')}>{value}</span>
    </div>
  );
}

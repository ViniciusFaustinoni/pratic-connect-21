import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  Search,
  ShieldCheck,
  Inbox,
  Wrench,
} from 'lucide-react';
import {
  useInstalacoesAguardandoAprovacao,
  useAprovacaoMonitoramentoStats,
} from '@/hooks/useAprovacaoMonitoramento';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';

function getWaitColor(date: string | null) {
  if (!date) return 'border-l-border';
  const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
  if (hours > 48) return 'border-l-destructive';
  if (hours > 24) return 'border-l-warning';
  return 'border-l-success';
}

function getWaitTextColor(date: string | null) {
  if (!date) return 'text-muted-foreground';
  const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
  if (hours > 48) return 'text-destructive';
  if (hours > 24) return 'text-warning';
  return 'text-success';
}

export default function AprovacaoAssociadosMonitoramento() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: instalacoes, isLoading } = useInstalacoesAguardandoAprovacao();
  const { data: stats, isLoading: statsLoading } = useAprovacaoMonitoramentoStats();

  const filtradas = instalacoes?.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.associado?.nome?.toLowerCase().includes(q) ||
      s.associado?.cpf?.includes(search) ||
      s.veiculo?.placa?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Aprovação de Associados</h1>
          <p className="text-sm text-muted-foreground">
            Análise de instalações concluídas para ativação da Proteção 360
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        {statsLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl bg-muted" />)
        ) : (
          <>
            {[
              { label: 'Aguardando', value: stats?.aguardando || 0, icon: <Clock className="h-3.5 w-3.5" />, color: 'warning' },
              { label: 'Aprovados Hoje', value: stats?.aprovadosHoje || 0, icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'success' },
              { label: 'Reprovados Hoje', value: stats?.reprovadosHoje || 0, icon: <XCircle className="h-3.5 w-3.5" />, color: 'destructive' },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className={cn(
                  "rounded-xl border p-3 text-left",
                  `bg-${kpi.color}/10 border-${kpi.color}/30`
                )}
              >
                <div className={cn("flex items-center gap-1.5 mb-1", `text-${kpi.color}`)}>
                  {kpi.icon}
                  <span className="text-[10px] font-medium">{kpi.label}</span>
                </div>
                <p className={cn("text-xl font-bold", `text-${kpi.color}`)}>{kpi.value}</p>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar nome, CPF ou placa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-card border-border h-10 text-sm rounded-xl"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full bg-muted rounded-xl" />)}
        </div>
      ) : !filtradas || filtradas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground text-base">Nenhuma instalação pendente</p>
          <p className="text-sm mt-1">Todas as instalações foram analisadas. Bom trabalho! 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((servico: any) => (
            <div
              key={servico.id}
              className={cn(
                "group flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border transition-all cursor-pointer border-l-4",
                "hover:bg-accent/30 hover:shadow-sm hover:translate-x-1",
                getWaitColor(servico.concluido_em)
              )}
              onClick={() => navigate(`/monitoramento/aprovacao-associados/${servico.id}`)}
            >
              <UserAvatar
                name={servico.associado?.nome}
                size="sm"
                className="flex-shrink-0"
              />

              {/* Placa */}
              <div className="flex-shrink-0">
                <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-1 rounded-md">
                  {servico.veiculo?.placa || '---'}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {servico.associado?.nome || '---'}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">
                    {servico.veiculo?.marca} {servico.veiculo?.modelo} {servico.veiculo?.ano_modelo}
                  </span>
                  {servico.profissional?.nome && (
                    <>
                      <span className="text-border">•</span>
                      <div className="flex items-center gap-0.5">
                        <Wrench className="h-3 w-3" />
                        <span className="truncate">{servico.profissional.nome}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Status + Tempo */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px] px-1.5">
                  Aguardando
                </Badge>
                <span className={cn("text-[10px] font-semibold tabular-nums", getWaitTextColor(servico.concluido_em))}>
                  {servico.concluido_em
                    ? formatDistanceToNow(new Date(servico.concluido_em), { locale: ptBR, addSuffix: false })
                    : '---'}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); navigate(`/monitoramento/aprovacao-associados/${servico.id}`); }}
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                Analisar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

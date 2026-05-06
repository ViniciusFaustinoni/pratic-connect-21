import {
  Shield, ShieldAlert, ShieldCheck, ShieldOff, Clock, AlertTriangle,
  CheckCircle, UserCheck, Star, Truck, Car, Ban, Gift,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { SituacaoAssociado } from '@/hooks/useAssociadoSituacao';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR') : '—';

const STATUS_INADIMPLENCIA_CONFIG = {
  adimplente: { label: 'Adimplente', color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle },
  regularizacao_simples: { label: 'Inadimplente – Regularização simples', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock },
  revistoria_necessaria: { label: 'Inadimplente – Revistoria necessária', color: 'text-orange-600', bg: 'bg-orange-500/10', icon: AlertTriangle },
  nova_adesao_obrigatoria: { label: 'Inadimplente – Nova adesão obrigatória', color: 'text-destructive', bg: 'bg-destructive/10', icon: ShieldOff },
} as const;

interface Props {
  situacao: SituacaoAssociado;
  associado?: any;
  contrato?: any;
  resumoFinanceiro?: any;
}

export function AssociadoSituacaoCard({ situacao, associado, contrato, resumoFinanceiro }: Props) {
  if (situacao.isLoading) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  const inadConfig = STATUS_INADIMPLENCIA_CONFIG[situacao.statusInadimplencia];
  const InadIcon = inadConfig.icon;

  return (
    <div className="grid sm:grid-cols-2 gap-3 min-w-0">
      {/* Carência */}
      <Card className="border-border/60 min-w-0 overflow-hidden">
        <CardContent className="p-4 space-y-3 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Carência</span>
          </div>
          {situacao.carenciaIsenta ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 border-0">
                <CheckCircle className="h-3 w-3 mr-1" /> Isento
              </Badge>
              <span className="text-xs text-muted-foreground">
                {situacao.carenciaMotivoIsencao || 'Migração aprovada'}
              </span>
            </div>
          ) : situacao.carenciaFim ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {situacao.emCarencia ? (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-0">
                    <Clock className="h-3 w-3 mr-1" /> Em carência
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 border-0">
                    <CheckCircle className="h-3 w-3 mr-1" /> Carência concluída
                  </Badge>
                )}
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Início</span>
                <span className="font-medium">{formatDate(situacao.carenciaInicio)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Término</span>
                <span className="font-medium">{formatDate(situacao.carenciaFim)}</span>
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Carência não registrada</span>
          )}

          {/* Per-item carências */}
          {situacao.carenciasItens && situacao.carenciasItens.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Carências por item</p>
              {situacao.carenciasItens.map((item, idx) => {
                const Icon = item.tipo === 'cobertura' ? Shield : Gift;
                const tipoLabel = item.carenciaTipo === 'multiplicadora'
                  ? `Multiplicadora (${item.multiplicador || 2}x)`
                  : 'Liberação';
                return (
                  <div key={idx} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs rounded px-2 py-1.5 bg-muted/50">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Icon className="h-3 w-3 text-primary shrink-0" />
                      <span className="font-medium truncate">{item.nome}</span>
                      <span className="text-muted-foreground whitespace-nowrap">· {tipoLabel}</span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      {item.emCarencia ? (() => {
                        const hoje = new Date();
                        hoje.setHours(0, 0, 0, 0);
                        const fim = new Date(item.fim);
                        fim.setHours(0, 0, 0, 0);
                        const restantes = Math.max(0, Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
                        return <span className="text-amber-700 font-medium whitespace-nowrap">{restantes}d restantes</span>;
                      })() : (
                        <span className="text-muted-foreground whitespace-nowrap">{item.dias}d</span>
                      )}
                      <span className="text-muted-foreground whitespace-nowrap">até {formatDate(item.fim)}</span>
                      {item.emCarencia ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 border-0">
                          Em carência
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 border-0">
                          Concluída
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Situação Financeira / Coberturas */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Situação Financeira</span>
          </div>

          {/* Status financeiro — só mostra "Inadimplente" quando há cobrança vencida */}
          {situacao.statusInadimplencia !== 'adimplente' ? (
            <div className="flex items-center gap-2">
              <div className={cn('p-1.5 rounded-full', inadConfig.bg)}>
                <InadIcon className={cn('h-3.5 w-3.5', inadConfig.color)} />
              </div>
              <span className={cn('text-sm font-medium', inadConfig.color)}>{inadConfig.label}</span>
            </div>
          ) : situacao.veiculosSuspensosOutroMotivo.length > 0 ? (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-orange-500/10">
                <ShieldOff className="h-3.5 w-3.5 text-orange-600" />
              </div>
              <span className="text-sm font-medium text-orange-600">
                Em dia financeiramente — Cobertura suspensa
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-emerald-500/10">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-emerald-600">Adimplente</span>
            </div>
          )}

          {/* Per-vehicle inadimplência financeira */}
          {situacao.veiculosInadimplentes.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Veículos inadimplentes</p>
              {situacao.veiculosInadimplentes.map(v => (
                <div key={v.veiculoId} className="flex items-center justify-between text-xs bg-destructive/5 rounded px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <Car className="h-3 w-3 text-destructive" />
                    <span className="font-mono font-medium">{v.placa}</span>
                    <span className="text-muted-foreground">{v.marca} {v.modelo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-destructive font-medium">{v.diasAtraso}d</span>
                    <span className="text-destructive font-medium">{formatCurrency(v.totalDevido)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Per-vehicle suspensão por motivo NÃO financeiro */}
          {situacao.veiculosSuspensosOutroMotivo.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Veículos com cobertura suspensa</p>
              {situacao.veiculosSuspensosOutroMotivo.map(v => {
                const motivoLabel =
                  v.motivo === 'nao_instalacao' ? 'Instalação do rastreador não realizada no prazo'
                  : v.motivo === 'manual' ? 'Suspensão manual'
                  : (v.motivoDetalhe || 'Cobertura suspensa');
                return (
                  <div key={v.veiculoId} className="flex flex-col gap-1 text-xs bg-orange-500/5 rounded px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Car className="h-3 w-3 text-orange-600" />
                        <span className="font-mono font-medium">{v.placa}</span>
                        <span className="text-muted-foreground">{v.marca} {v.modelo}</span>
                      </div>
                      <span className="text-orange-600 font-medium whitespace-nowrap">{v.diasAtraso}d</span>
                    </div>
                    <span className="text-orange-700/90 dark:text-orange-300 text-[11px]">{motivoLabel}</span>
                  </div>
                );
              })}
            </div>
          )}

          {situacao.coberturasSuspensas && (
            <Badge variant="destructive" className="text-[10px]">
              <ShieldOff className="h-3 w-3 mr-1" /> Coberturas suspensas
            </Badge>
          )}

          {/* Plano & Contrato */}
          {associado && (
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Plano & Contrato</p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Plano</span>
                <span className="font-medium text-primary">{associado.planos?.nome || '—'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Mensalidade</span>
                <span className="font-medium">{contrato?.valor_mensal ? formatCurrency(contrato.valor_mensal) : '—'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Dia venc.</span>
                <span className="font-medium">Todo dia {contrato?.dia_vencimento || associado.dia_vencimento || 15}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Início contrato</span>
                <span className="font-medium">{contrato?.data_inicio ? formatDate(contrato.data_inicio) : '—'}</span>
              </div>
            </div>
          )}

          {/* Vencimentos */}
          <div className="space-y-1.5 pt-2 border-t border-border/40">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Vencimentos</p>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Mensalidade</span>
              <span className="font-medium">{resumoFinanceiro?.proximaCobranca?.data_vencimento ? formatDate(resumoFinanceiro.proximaCobranca.data_vencimento) : '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">CNH vence</span>
              <span className="font-medium">{associado?.cnh_validade ? formatDate(associado.cnh_validade) : contrato?.cliente_cnh_validade ? formatDate(contrato.cliente_cnh_validade) : 'Não informado'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">CRLV vence</span>
              <span className="font-medium">Não informado</span>
            </div>
          </div>

          {/* Consultor */}
          {situacao.consultorNome && (
            <div className="space-y-1.5 pt-2 border-t border-border/40">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Consultor</p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Nome</span>
                <span className="font-medium">{situacao.consultorNome}</span>
              </div>
              {situacao.consultorPontuacao !== null && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Pontuação</span>
                  <span className="font-medium flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-500" />
                    {situacao.consultorPontuacao} pts
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Benefícios adicionais suspensos */}
      {situacao.beneficiosAdicionaisSuspensos && (
        <Card className="border-amber-400/40 sm:col-span-2">
          <CardContent className="p-4">
            <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <Ban className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
                <strong>Benefícios adicionais suspensos</strong> — Há inadimplência em um dos veículos. 
                Benefícios como proteção de vidros, danos a terceiros e carro reserva ficam suspensos 
                em todos os veículos até que todos estejam em dia.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {/* Multa rastreador */}
      {situacao.pendenciaRastreador && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-4 w-4 text-destructive" />
              <span className="text-sm font-semibold text-destructive">Pendência de Rastreador</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Multa por não devolução</span>
              <span className="font-bold text-destructive">{formatCurrency(situacao.valorMultaRastreador)}</span>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

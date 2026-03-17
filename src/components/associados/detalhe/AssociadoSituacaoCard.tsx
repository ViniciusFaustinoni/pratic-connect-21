import {
  Shield, ShieldAlert, ShieldCheck, ShieldOff, Clock, AlertTriangle,
  CheckCircle, UserCheck, Star, Truck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
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
}

export function AssociadoSituacaoCard({ situacao }: Props) {
  if (situacao.isLoading) {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  const inadConfig = STATUS_INADIMPLENCIA_CONFIG[situacao.statusInadimplencia];
  const InadIcon = inadConfig.icon;

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {/* Carência */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
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
        </CardContent>
      </Card>

      {/* Inadimplência */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Situação Financeira</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-full', inadConfig.bg)}>
              <InadIcon className={cn('h-3.5 w-3.5', inadConfig.color)} />
            </div>
            <span className={cn('text-sm font-medium', inadConfig.color)}>{inadConfig.label}</span>
          </div>
          {situacao.diasAtraso > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Dias em atraso</span>
              <span className="font-medium text-destructive">{situacao.diasAtraso} dias</span>
            </div>
          )}
          {situacao.coberturasSuspensas && (
            <Badge variant="destructive" className="text-[10px]">
              <ShieldOff className="h-3 w-3 mr-1" /> Coberturas suspensas
            </Badge>
          )}
        </CardContent>
      </Card>

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

      {/* Consultor vinculado */}
      {situacao.consultorNome && (
        <Card className="border-border/60">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Consultor Vinculado</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium">{situacao.consultorNome}</span>
            </div>
            {situacao.consultorPontuacao !== null && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Pontuação gerada</span>
                <span className="font-medium flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-500" />
                  {situacao.consultorPontuacao} pts
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

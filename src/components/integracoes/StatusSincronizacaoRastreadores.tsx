import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, RefreshCw, Satellite, AlertTriangle, CheckCircle2, ArrowUpCircle } from 'lucide-react';
import {
  useRastreadoresSyncStatus,
  useRastreadoresSyncActions,
} from '@/hooks/useRastreadoresSyncStatus';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function pct(num: number, total: number) {
  if (!total) return 0;
  return Math.round((num / total) * 100);
}

interface PlatformBlockProps {
  nome: string;
  total: number;
  sincronizados: number;
  pendentes: number;
  falhas?: number;
  onSync: () => void;
  syncing: boolean;
  syncLabel: string;
}

function PlatformBlock({ nome, total, sincronizados, pendentes, falhas, onSync, syncing, syncLabel }: PlatformBlockProps) {
  const percent = pct(sincronizados, total);
  const temPendentes = pendentes > 0 || (falhas ?? 0) > 0;

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Satellite className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">{nome}</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {sincronizados.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} veículos enviados ({percent}%)
          </p>
        </div>
        {temPendentes ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {pendentes + (falhas || 0)} pendente(s)
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Em dia
          </Badge>
        )}
      </div>

      <Progress value={percent} className="h-2" />

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          Sincronizados: <strong className="text-foreground">{sincronizados.toLocaleString('pt-BR')}</strong>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" />
          Pendentes: <strong className="text-foreground">{pendentes.toLocaleString('pt-BR')}</strong>
        </span>
        {typeof falhas === 'number' && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
            Falhas: <strong className="text-foreground">{falhas.toLocaleString('pt-BR')}</strong>
          </span>
        )}
      </div>

      <Button
        size="sm"
        variant={temPendentes ? 'default' : 'outline'}
        className="w-full"
        onClick={onSync}
        disabled={syncing || total === 0}
      >
        {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
        {syncLabel}
      </Button>
    </div>
  );
}

export function StatusSincronizacaoRastreadores() {
  const { data, isLoading, refetch } = useRastreadoresSyncStatus();
  const { softruckBackfill, redeVeiculosBackfill, recriarSoftruck } = useRastreadoresSyncActions();

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando status de sincronização...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Satellite className="h-5 w-5 text-primary" />
            Sincronização de veículos com plataformas de rastreamento
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Veículos com rastreador instalado enviados para Softruck e Rede Veículos
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <PlatformBlock
            nome="Softruck"
            total={data.softruck.total}
            sincronizados={data.softruck.sincronizados}
            pendentes={data.softruck.pendentes}
            falhas={data.softruck.falhas}
            onSync={() => softruckBackfill.mutate({ limit: 50 })}
            syncing={softruckBackfill.isPending}
            syncLabel="Sincronizar pendentes (lote 50)"
          />
          <PlatformBlock
            nome="Rede Veículos"
            total={data.rede_veiculos.total}
            sincronizados={data.rede_veiculos.sincronizados}
            pendentes={data.rede_veiculos.pendentes}
            onSync={() => redeVeiculosBackfill.mutate({ limit: 30 })}
            syncing={redeVeiculosBackfill.isPending}
            syncLabel="Sincronizar pendentes (lote 30)"
          />
        </div>

        {/* Botões avançados */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button
            size="sm"
            variant="outline"
            onClick={() => softruckBackfill.mutate({ limit: 100, incluirFalhas: true })}
            disabled={softruckBackfill.isPending}
          >
            {softruckBackfill.isPending ? (
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-2" />
            )}
            Softruck: incluir falhas (lote 100)
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline">
                <ArrowUpCircle className="h-3 w-3 mr-2" />
                Migrar veículos da enterprise antiga
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Migrar veículos para a enterprise correta</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação localiza veículos criados na enterprise <strong>Pratic Master</strong> (em desuso),
                  recria cada um na enterprise correta (PraticCar) e <strong>deleta</strong> o registro antigo.
                  Use apenas se a sincronização anterior foi feita com o ID errado.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => recriarSoftruck.mutate({ dryRun: true })}>
                  Simular (dry run)
                </AlertDialogAction>
                <AlertDialogAction
                  onClick={() => recriarSoftruck.mutate({ dryRun: false, deletarAntigos: true })}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Confirmar migração
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Search, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRecusasInstalador, useContagemRecusasPendentes, type RecusaInstalador } from '@/hooks/useRecusasInstalador';
import { ResolverRecusaDialog } from '@/components/cadastro/ResolverRecusaDialog';

export default function RecusasInstalador() {
  const { data: recusas, isLoading } = useRecusasInstalador();
  const { data: pendentes } = useContagemRecusasPendentes();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'resolvido'>('pendente');
  const [dialogData, setDialogData] = useState<RecusaInstalador | null>(null);

  const filtradas = (recusas || []).filter((r) => {
    const isPendente = r.status === 'em_analise';
    if (filtroStatus === 'pendente' && !isPendente) return false;
    if (filtroStatus === 'resolvido' && isPendente) return false;

    if (busca) {
      const termo = busca.toLowerCase();
      return (
        r.associado_nome?.toLowerCase().includes(termo) ||
        r.veiculo_placa?.toLowerCase().includes(termo) ||
        r.instalador_nome?.toLowerCase().includes(termo)
      );
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 bg-muted" />
        <Skeleton className="h-64 w-full bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            Recusas do Instalador
          </h1>
          <p className="text-muted-foreground">
            Veículos negados pelo instalador em campo aguardando decisão
          </p>
        </div>
        {(pendentes ?? 0) > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1 self-start">
            {pendentes} pendente{pendentes !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, nome ou instalador..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['pendente', 'resolvido', 'todos'] as const).map((f) => (
            <Button
              key={f}
              variant={filtroStatus === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltroStatus(f)}
            >
              {f === 'pendente' ? 'Pendentes' : f === 'resolvido' ? 'Resolvidos' : 'Todos'}
            </Button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      {filtradas.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">Nenhuma recusa encontrada</p>
            <p className="text-muted-foreground mt-1">
              {filtroStatus === 'pendente'
                ? 'Não há veículos negados aguardando análise.'
                : 'Nenhum registro encontrado com os filtros atuais.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Instalador</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((r) => {
                  const isPendente = r.status === 'em_analise';
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {r.updated_at
                          ? format(new Date(r.updated_at), 'dd/MM/yy HH:mm', { locale: ptBR })
                          : '---'}
                      </TableCell>
                      <TableCell className="font-medium">{r.associado_nome || '---'}</TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold">{r.veiculo_placa || '---'}</span>
                        {r.veiculo_modelo && (
                          <span className="text-muted-foreground text-xs block">
                            {r.veiculo_marca} {r.veiculo_modelo}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{r.instalador_nome || '---'}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm" title={r.ressalvas_instalador || ''}>
                        {r.ressalvas_instalador || '---'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isPendente ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {isPendente ? 'Pendente Análise' : 'Resolvido'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isPendente && (
                          <Button size="sm" variant="outline" onClick={() => setDialogData(r)}>
                            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                            Analisar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      {dialogData && (
        <ResolverRecusaDialog
          open={!!dialogData}
          onOpenChange={(open) => !open && setDialogData(null)}
          servicoId={dialogData.id}
          veiculoId={dialogData.veiculo_id}
          associadoId={dialogData.associado_id}
          placa={dialogData.veiculo_placa || ''}
          motivo={dialogData.ressalvas_instalador}
          fotosRessalva={dialogData.fotos_ressalva}
        />
      )}
    </div>
  );
}

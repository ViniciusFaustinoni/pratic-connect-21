import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Server,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Radio,
  RefreshCw,
  Loader2,
  Satellite,
  Truck,
  Car,
  Wifi,
  Signal,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import {
  usePlataformasCompletas,
  useUpdatePlataforma,
  useDeletePlataforma,
  useRastreadoresPorPlataforma,
  type PlataformaCompleta,
} from '@/hooks/usePlataformasCRUD';
import { useTestarConexaoPlataforma, useSyncRastreadores } from '@/hooks/usePlataformasConfig';
import { PlataformaFormDialog } from './PlataformaFormDialog';
import { Skeleton } from '@/components/ui/skeleton';

const ICONE_MAP: Record<string, React.ReactNode> = {
  server: <Server className="h-5 w-5" />,
  satellite: <Satellite className="h-5 w-5" />,
  truck: <Truck className="h-5 w-5" />,
  car: <Car className="h-5 w-5" />,
  radio: <Radio className="h-5 w-5" />,
  wifi: <Wifi className="h-5 w-5" />,
  signal: <Signal className="h-5 w-5" />,
};

export function PlataformasConfigPanel() {
  const [showForm, setShowForm] = useState(false);
  const [editingPlataforma, setEditingPlataforma] = useState<PlataformaCompleta | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: plataformas, isLoading } = usePlataformasCompletas();
  const { data: contagem } = useRastreadoresPorPlataforma();
  const updateMutation = useUpdatePlataforma();
  const deleteMutation = useDeletePlataforma();
  const testarConexao = useTestarConexaoPlataforma();
  const syncRastreadores = useSyncRastreadores();

  const handleEdit = (plataforma: PlataformaCompleta) => {
    setEditingPlataforma(plataforma);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingPlataforma(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPlataforma(null);
  };

  const handleToggleAtiva = async (plataforma: PlataformaCompleta) => {
    await updateMutation.mutateAsync({
      id: plataforma.id,
      plataforma: plataforma.plataforma,
      nome_exibicao: plataforma.nome_exibicao,
      ativa: !plataforma.ativa,
    });
  };

  const handleDelete = async () => {
    if (deletingId) {
      await deleteMutation.mutateAsync(deletingId);
      setDeletingId(null);
    }
  };

  const handleTestarConexao = async (plataforma: PlataformaCompleta) => {
    setTestingId(plataforma.id);
    try {
      await testarConexao.mutateAsync(plataforma.plataforma);
    } finally {
      setTestingId(null);
    }
  };

  const handleSync = async (plataforma: PlataformaCompleta) => {
    setSyncingId(plataforma.id);
    try {
      await syncRastreadores.mutateAsync(plataforma.plataforma);
    } finally {
      setSyncingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Plataformas de Rastreamento</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as plataformas de rastreamento integradas ao sistema
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Plataforma
        </Button>
      </div>

      {/* Grid de Plataformas */}
      {plataformas && plataformas.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {plataformas.map((plataforma) => {
            const stats = contagem?.[plataforma.plataforma] || { total: 0, ativos: 0, online: 0 };
            const icone = ICONE_MAP[plataforma.icone || 'server'] || ICONE_MAP.server;

            return (
              <Card key={plataforma.id} className={!plataforma.ativa ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        {icone}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{plataforma.nome_exibicao}</CardTitle>
                        <CardDescription className="font-mono text-xs">
                          {plataforma.plataforma}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={plataforma.ativa ?? false}
                        onCheckedChange={() => handleToggleAtiva(plataforma)}
                        disabled={updateMutation.isPending}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(plataforma)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleTestarConexao(plataforma)}
                            disabled={testingId === plataforma.id}
                          >
                            {testingId === plataforma.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Radio className="mr-2 h-4 w-4" />
                            )}
                            Testar Conexão
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleSync(plataforma)}
                            disabled={syncingId === plataforma.id}
                          >
                            {syncingId === plataforma.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-2 h-4 w-4" />
                            )}
                            Sincronizar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeletingId(plataforma.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {plataforma.descricao && (
                    <p className="text-sm text-muted-foreground">{plataforma.descricao}</p>
                  )}

                  {/* Badges de Status */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={plataforma.ativa ? 'default' : 'secondary'}>
                      {plataforma.ativa ? 'Ativa' : 'Inativa'}
                    </Badge>
                    <Badge variant="outline">
                      {plataforma.ambiente_atual === 'producao' ? 'Produção' : 'Sandbox'}
                    </Badge>
                    <Badge variant="outline">{plataforma.auth_type || 'Sem auth'}</Badge>
                  </div>

                  {/* Funcionalidades */}
                  <div className="flex flex-wrap gap-1">
                    {plataforma.suporta_posicao_tempo_real && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />
                        Posição
                      </Badge>
                    )}
                    {plataforma.suporta_historico_trajeto && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />
                        Histórico
                      </Badge>
                    )}
                    {plataforma.suporta_bloqueio && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />
                        Bloqueio
                      </Badge>
                    )}
                    {plataforma.suporta_acionamento_roubo && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />
                        Roubo
                      </Badge>
                    )}
                    {plataforma.suporta_webhooks && (
                      <Badge variant="outline" className="text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />
                        Webhooks
                      </Badge>
                    )}
                  </div>

                  {/* Estatísticas */}
                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{stats.total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{stats.ativos}</p>
                      <p className="text-xs text-muted-foreground">Instalados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{stats.online}</p>
                      <p className="text-xs text-muted-foreground">Online</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma plataforma cadastrada</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Adicione sua primeira plataforma de rastreamento
            </p>
            <Button onClick={handleNew} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Nova Plataforma
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <PlataformaFormDialog
        open={showForm}
        onOpenChange={handleFormClose}
        plataforma={editingPlataforma}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plataforma</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta plataforma? Esta ação não pode ser desfeita.
              <br />
              <br />
              <strong>Atenção:</strong> Plataformas com rastreadores vinculados não podem ser
              excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

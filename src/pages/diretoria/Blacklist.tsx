import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, Search, Trash2, Eye, AlertTriangle, Car, User, UserX } from 'lucide-react';
import { useBlacklistVeiculos, useRemoverBlacklist } from '@/hooks/useBlacklist';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

const TIPO_LABELS: Record<string, string> = {
  vistoria_reprovada: 'Vistoria Reprovada',
  proposta_reprovada: 'Proposta Reprovada',
  associado_bloqueado: 'Associado Bloqueado',
};

export default function Blacklist() {
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [tab, setTab] = useState('ativos');
  const [detalhesId, setDetalhesId] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState<string | null>(null);
  const [reverterStatus, setReverterStatus] = useState(false);

  const { isDiretor, isDesenvolvedor, isAdminMaster } = usePermissions();
  const canManageBlacklist = isDiretor || isDesenvolvedor || isAdminMaster;
  const { data: blacklist, isLoading } = useBlacklistVeiculos(tab === 'ativos');
  const remover = useRemoverBlacklist();

  // Filtrar resultados
  const filtrados = (blacklist || []).filter((item) => {
    const matchBusca =
      !busca ||
      item.placa.toLowerCase().includes(busca.toLowerCase()) ||
      item.chassi?.toLowerCase().includes(busca.toLowerCase()) ||
      item.associado?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      item.associado?.cpf?.includes(busca);

    const matchTipo = filtroTipo === 'todos' || item.tipo_reprovacao === filtroTipo;

    return matchBusca && matchTipo;
  });

  const itemDetalhes = blacklist?.find((i) => i.id === detalhesId);
  const itemRemocao = blacklist?.find((i) => i.id === confirmarRemocao);

  const handleRemover = () => {
    if (confirmarRemocao) {
      remover.mutate({ id: confirmarRemocao, reverterVeiculo: reverterStatus }, {
        onSuccess: () => {
          setConfirmarRemocao(null);
          setReverterStatus(false);
        },
      });
    }
  };

  const handleOpenRemocao = (id: string) => {
    setConfirmarRemocao(id);
    setReverterStatus(false);
  };

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
          <Ban className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Blacklist de Veículos</h1>
          <p className="text-sm text-muted-foreground">
            Veículos reprovados que não podem ser associados novamente
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total na Blacklist</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {blacklist?.filter((i) => i.ativo).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vistoria Reprovada</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {blacklist?.filter((i) => i.ativo && i.tipo_reprovacao === 'vistoria_reprovada').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proposta Reprovada</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {blacklist?.filter((i) => i.ativo && i.tipo_reprovacao === 'proposta_reprovada').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Associado Bloqueado</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {blacklist?.filter((i) => i.ativo && i.tipo_reprovacao === 'associado_bloqueado').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs e Filtros */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TabsList>
            <TabsTrigger value="ativos">Ativos</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
          </TabsList>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar placa, chassi, nome..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 w-full md:w-64"
              />
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="vistoria_reprovada">Vistoria Reprovada</SelectItem>
                <SelectItem value="proposta_reprovada">Proposta Reprovada</SelectItem>
                <SelectItem value="associado_bloqueado">Associado Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="ativos" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Ban className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhum veículo na blacklist</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placa</TableHead>
                      <TableHead>Associado</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono font-medium">
                          {item.placa}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.associado?.nome || '---'}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.associado?.cpf || '---'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.tipo_reprovacao === 'vistoria_reprovada'
                                ? 'destructive'
                                : item.tipo_reprovacao === 'associado_bloqueado'
                                ? 'outline'
                                : 'secondary'
                            }
                            className={item.tipo_reprovacao === 'associado_bloqueado' ? 'border-orange-500 text-orange-600' : ''}
                          >
                            {TIPO_LABELS[item.tipo_reprovacao]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{item.motivo}</TableCell>
                        <TableCell>
                          {format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDetalhesId(item.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canManageBlacklist && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenRemocao(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtrados.filter((i) => !i.ativo).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Ban className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhum registro removido</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placa</TableHead>
                      <TableHead>Associado</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Adicionado em</TableHead>
                      <TableHead>Removido em</TableHead>
                      <TableHead>Removido por</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados
                      .filter((i) => !i.ativo)
                      .map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono font-medium">
                            {item.placa}
                          </TableCell>
                          <TableCell>{item.associado?.nome || '---'}</TableCell>
                          <TableCell className="max-w-xs truncate">{item.motivo}</TableCell>
                          <TableCell>
                            {format(new Date(item.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {item.removido_em
                              ? format(new Date(item.removido_em), "dd/MM/yyyy", { locale: ptBR })
                              : '---'}
                          </TableCell>
                          <TableCell>
                            {item.removido_por_profile?.nome || '---'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Detalhes */}
      <Dialog open={!!detalhesId} onOpenChange={() => setDetalhesId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Detalhes do Veículo
            </DialogTitle>
          </DialogHeader>
          {itemDetalhes && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Placa</p>
                  <p className="font-mono font-medium">{itemDetalhes.placa}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Chassi</p>
                  <p className="font-mono">{itemDetalhes.chassi || '---'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Associado</p>
                <p className="font-medium">{itemDetalhes.associado?.nome || '---'}</p>
                <p className="text-sm text-muted-foreground">{itemDetalhes.associado?.cpf}</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Tipo de Reprovação</p>
                <Badge
                  variant={
                    itemDetalhes.tipo_reprovacao === 'vistoria_reprovada'
                      ? 'destructive'
                      : itemDetalhes.tipo_reprovacao === 'associado_bloqueado'
                      ? 'outline'
                      : 'secondary'
                  }
                  className={itemDetalhes.tipo_reprovacao === 'associado_bloqueado' ? 'border-orange-500 text-orange-600' : ''}
                >
                  {TIPO_LABELS[itemDetalhes.tipo_reprovacao]}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Motivo</p>
                <p>{itemDetalhes.motivo}</p>
              </div>

              {itemDetalhes.justificativa && (
                <div>
                  <p className="text-sm text-muted-foreground">Justificativa</p>
                  <p className="text-sm">{itemDetalhes.justificativa}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Adicionado em</p>
                  <p>
                    {format(new Date(itemDetalhes.created_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Adicionado por</p>
                  <p>{itemDetalhes.adicionado_por_profile?.nome || '---'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Remoção */}
      <Dialog open={!!confirmarRemocao} onOpenChange={() => { setConfirmarRemocao(null); setReverterStatus(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirmar Remoção
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover este veículo da blacklist?
            </DialogDescription>
          </DialogHeader>

          {itemRemocao && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Placa: <span className="font-mono">{itemRemocao.placa}</span></p>
                {itemRemocao.associado?.nome && (
                  <p className="text-sm text-muted-foreground">Associado: {itemRemocao.associado.nome}</p>
                )}
              </div>

              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  id="reverter-status"
                  checked={reverterStatus}
                  onChange={(e) => setReverterStatus(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="reverter-status" className="cursor-pointer">
                  <p className="text-sm font-medium">Reverter status do veículo e associado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Se marcado, o veículo voltará para "Em Análise" e o associado para "Pendente de Vistoria", 
                    permitindo nova tentativa de contratação.
                  </p>
                </label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmarRemocao(null); setReverterStatus(false); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemover}
              disabled={remover.isPending}
            >
              {remover.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {reverterStatus ? 'Remover e Reverter' : 'Apenas Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

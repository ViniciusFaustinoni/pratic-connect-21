import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Plus, 
  Calendar, 
  MapPin, 
  Wrench, 
  RotateCcw,
  Loader2,
  Phone,
  Navigation,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  useInstalacoes,
  useInstalacoesMetricas,
  InstalacaoFilters as Filters,
  InstalacaoWithRelations,
} from '@/hooks/useInstalacoes';
import {
  InstalacaoFormDialog,
  InstalacaoDetailDrawer,
  InstalacaoFilters,
} from '@/components/instalacoes';
import { STATUS_INSTALACAO_LABELS, STATUS_INSTALACAO_COLORS, PERIODO_LABELS } from '@/types/database';

export default function Instalacoes() {
  const [filters, setFilters] = useState<Filters>({});
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [selectedInstalacaoId, setSelectedInstalacaoId] = useState<string | null>(null);
  const [editInstalacaoId, setEditInstalacaoId] = useState<string | undefined>(undefined);

  const { data: instalacoes, isLoading } = useInstalacoes(filters);
  const { data: metricas, isLoading: loadingMetricas } = useInstalacoesMetricas();

  const handleOpenDetail = (id: string) => {
    setSelectedInstalacaoId(id);
  };

  const handleEdit = () => {
    if (selectedInstalacaoId) {
      setEditInstalacaoId(selectedInstalacaoId);
      setSelectedInstalacaoId(null);
      setShowFormDialog(true);
    }
  };

  const handleNewInstalacao = () => {
    setEditInstalacaoId(undefined);
    setShowFormDialog(true);
  };

  const openWhatsApp = (instalacao: InstalacaoWithRelations) => {
    if (!instalacao.associados?.telefone) return;
    const phone = instalacao.associados.telefone.replace(/\D/g, '');
    const message = `Olá ${instalacao.associados.nome}! Somos da equipe de instalação de rastreadores.`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const openGoogleMaps = (instalacao: InstalacaoWithRelations) => {
    const address = [
      instalacao.logradouro,
      instalacao.numero,
      instalacao.bairro,
      instalacao.cidade,
      instalacao.uf,
    ].filter(Boolean).join(', ');
    
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Instalações</h1>
          <p className="text-muted-foreground">
            Gerencie os agendamentos de instalação de rastreadores
          </p>
        </div>
        <Button onClick={handleNewInstalacao}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Instalação
        </Button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendadas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetricas ? '-' : metricas?.agendadas || 0}
            </div>
            <p className="text-xs text-muted-foreground">Para os próximos 7 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Rota</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetricas ? '-' : metricas?.emRota || 0}
            </div>
            <p className="text-xs text-muted-foreground">Instaladores em campo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas Hoje</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetricas ? '-' : metricas?.concluidasHoje || 0}
            </div>
            <p className="text-xs text-muted-foreground">Instalações realizadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reagendadas</CardTitle>
            <RotateCcw className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetricas ? '-' : metricas?.reagendadas || 0}
            </div>
            <p className="text-xs text-muted-foreground">Pendentes de remarcação</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <InstalacaoFilters filters={filters} onFiltersChange={setFilters} />

      {/* Tabela de Instalações */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Instalações</CardTitle>
          <CardDescription>
            Todas as instalações agendadas e concluídas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !instalacoes || instalacoes.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <Wrench className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Nenhuma instalação</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {Object.keys(filters).length > 0 
                    ? 'Nenhuma instalação encontrada com os filtros aplicados'
                    : 'As instalações agendadas aparecerão aqui'
                  }
                </p>
                <Button className="mt-4" onClick={handleNewInstalacao}>
                  <Plus className="mr-2 h-4 w-4" />
                  Agendar Instalação
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Associado</TableHead>
                    <TableHead>Veículo</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Instalador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instalacoes.map((instalacao) => (
                    <TableRow key={instalacao.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(new Date(instalacao.data_agendada), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {PERIODO_LABELS[instalacao.periodo]}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{instalacao.associados?.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {instalacao.associados?.telefone}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded w-fit">
                            {instalacao.veiculos?.placa}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {instalacao.veiculos?.marca} {instalacao.veiculos?.modelo}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col max-w-[200px]">
                          <span className="text-sm truncate">
                            {instalacao.logradouro}
                            {instalacao.numero && `, ${instalacao.numero}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {instalacao.cidade}/{instalacao.uf}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {instalacao.profiles?.nome || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_INSTALACAO_COLORS[instalacao.status]}>
                          {STATUS_INSTALACAO_LABELS[instalacao.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              openWhatsApp(instalacao);
                            }}
                            title="WhatsApp"
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              openGoogleMaps(instalacao);
                            }}
                            title="Abrir no Maps"
                          >
                            <Navigation className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDetail(instalacao.id)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Formulário */}
      <InstalacaoFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        instalacaoId={editInstalacaoId}
      />

      {/* Drawer de Detalhes */}
      <InstalacaoDetailDrawer
        instalacaoId={selectedInstalacaoId}
        open={!!selectedInstalacaoId}
        onOpenChange={(open) => !open && setSelectedInstalacaoId(null)}
        onEdit={handleEdit}
      />
    </div>
  );
}

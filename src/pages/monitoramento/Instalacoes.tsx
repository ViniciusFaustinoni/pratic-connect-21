import { useState } from 'react';
import { format } from 'date-fns';
import { useFilasRealtime } from '@/hooks/useFilasRealtime';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  MapPin,
  Wrench,
  RotateCcw,
  Loader2,
  Phone,
  Navigation,
  Eye,
  ClipboardCheck,
  UserX,
  ExternalLink,
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
  InstalacaoDetailDrawer,
  InstalacaoFilters,
} from '@/components/instalacoes';
import { STATUS_INSTALACAO_LABELS, STATUS_INSTALACAO_COLORS, PERIODO_LABELS } from '@/types/database';
import { formatPlacaExibicao, isPlacaPlaceholder } from '@/lib/placa-utils';

export default function Instalacoes() {
  // Ativar realtime para atualizações automáticas
  useFilasRealtime();

  const [filters, setFilters] = useState<Filters>({});
  const [selectedInstalacaoId, setSelectedInstalacaoId] = useState<string | null>(null);

  const { data: instalacoesList, isLoading } = useInstalacoes(filters);
  const { data: metricas, isLoading: loadingMetricas } = useInstalacoesMetricas();
  
  // Normalizar os dados para sempre ser um array
  const instalacoes = Array.isArray(instalacoesList) 
    ? instalacoesList 
    : instalacoesList?.instalacoes || [];

  const handleOpenDetail = (id: string) => {
    setSelectedInstalacaoId(id);
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
            Acompanhe os agendamentos de instalação de rastreadores
          </p>
        </div>
      </div>

      {/* Cards de Métricas — agrupadas por fase */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pré-Execução</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetricas ? '-' : metricas?.preExecucao || 0}
            </div>
            <p className="text-xs text-muted-foreground">Agendada / Atribuída / Aguard. Prestador</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Campo</CardTitle>
            <MapPin className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetricas ? '-' : metricas?.emCampo || 0}
            </div>
            <p className="text-xs text-muted-foreground">Em rota / No local / Em andamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aguard. Análise</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetricas ? '-' : metricas?.aguardandoAnalise || 0}
            </div>
            <p className="text-xs text-muted-foreground">Laudos pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas Hoje</CardTitle>
            <Wrench className="h-4 w-4 text-green-600" />
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
            <CardTitle className="text-sm font-medium">Não Compareceu</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingMetricas ? '-' : metricas?.naoCompareceu || 0}
            </div>
            <p className="text-xs text-muted-foreground">Cliente faltou</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reagendadas</CardTitle>
            <RotateCcw className="h-4 w-4 text-orange-600" />
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
                    : 'As instalações agendadas aparecerão aqui automaticamente'
                  }
                </p>
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
                    <TableRow key={instalacao.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOpenDetail(instalacao.id)}>
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
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded w-fit">
                              {formatPlacaExibicao(instalacao.veiculos?.placa)}
                            </span>
                            {isPlacaPlaceholder(instalacao.veiculos?.placa) && (
                              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 rounded px-1.5 py-0.5">
                                0KM
                              </span>
                            )}
                          </div>
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
                        <div className="flex items-center gap-1">
                          {(instalacao as any).vistoriador_prestador_id && (
                            <ExternalLink className="h-3 w-3 text-amber-600" aria-label="Prestador externo" />
                          )}
                          <span>
                            {(instalacao as any).instalador?.nome || (instalacao as any).instalador_responsavel?.nome || (
                              <span className="text-muted-foreground">Não atribuído</span>
                            )}
                          </span>
                        </div>
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

      {/* Drawer de Detalhes */}
      <InstalacaoDetailDrawer
        instalacaoId={selectedInstalacaoId}
        open={!!selectedInstalacaoId}
        onOpenChange={(open) => !open && setSelectedInstalacaoId(null)}
      />
    </div>
  );
}

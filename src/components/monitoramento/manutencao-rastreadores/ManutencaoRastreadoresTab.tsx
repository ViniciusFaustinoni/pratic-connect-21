import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, AlertTriangle, Clock, CalendarCheck, CheckCircle2, PhoneCall, Loader2 } from 'lucide-react';
import { useManutencaoRastreadores, type VeiculoManutencao } from '@/hooks/useManutencaoRastreadores';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TratativaDrawer from './TratativaDrawer';

const statusConfig: Record<string, { label: string; variant: string; className: string }> = {
  sem_tratativa: { label: 'Aguardando contato', variant: 'secondary', className: 'bg-muted text-muted-foreground' },
  aguardando_contato: { label: 'Aguardando contato', variant: 'secondary', className: 'bg-muted text-muted-foreground' },
  em_tratativa: { label: 'Em tratativa', variant: 'outline', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  agendado: { label: 'Agendado', variant: 'outline', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  visita_realizada: { label: 'Visita realizada', variant: 'outline', className: 'bg-purple-100 text-purple-800 border-purple-300' },
  resolvido_sem_visita: { label: 'Resolvido s/ visita', variant: 'outline', className: 'bg-green-100 text-green-800 border-green-300' },
};

export default function ManutencaoRastreadoresTab() {
  const {
    veiculos,
    metricas,
    isLoading,
    busca,
    setBusca,
    filtroStatus,
    setFiltroStatus,
    iniciarTratativa,
  } = useManutencaoRastreadores();

  const [selectedVeiculo, setSelectedVeiculo] = useState<VeiculoManutencao | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleIniciarTratativa = async (v: VeiculoManutencao) => {
    await iniciarTratativa.mutateAsync(v);
    // After creating, we need the tratativaId — refetch will update it
    // For now open the drawer; the hook will pick up the new record
    setSelectedVeiculo({ ...v, status: 'aguardando_contato' });
    setDrawerOpen(true);
  };

  const handleContinuarTratativa = (v: VeiculoManutencao) => {
    setSelectedVeiculo(v);
    setDrawerOpen(true);
  };

  const cards = [
    { label: 'Aguardando contato', value: metricas.aguardandoContato, icon: PhoneCall, color: 'text-muted-foreground' },
    { label: 'Em tratativa', value: metricas.emTratativa, icon: Clock, color: 'text-yellow-600' },
    { label: 'Agendados', value: metricas.agendados, icon: CalendarCheck, color: 'text-blue-600' },
    { label: 'Concluídos hoje', value: metricas.concluidosHoje, icon: CheckCircle2, color: 'text-green-600' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Manutenção de Rastreadores</h2>
        <p className="text-sm text-muted-foreground">Veículos sem pontuar nos últimos 3 dias</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <card.icon className={`h-8 w-8 ${card.color}`} />
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou placa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="sem_tratativa">Aguardando contato</SelectItem>
            <SelectItem value="aguardando_contato">Contatado</SelectItem>
            <SelectItem value="em_tratativa">Em tratativa</SelectItem>
            <SelectItem value="agendado">Agendado</SelectItem>
            <SelectItem value="visita_realizada">Visita realizada</SelectItem>
            <SelectItem value="resolvido_sem_visita">Resolvido s/ visita</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : veiculos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhum veículo sem comunicação encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Associado</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Último ponto</TableHead>
                <TableHead className="text-center">Dias s/ pontuar</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {veiculos.map((v) => {
                const cfg = statusConfig[v.status] || statusConfig.sem_tratativa;
                const canInitiate = !v.temEventoAberto && !v.inadimplente && (v.status === 'sem_tratativa');
                const hasActiveTratativa = v.status !== 'sem_tratativa' && v.status !== 'resolvido_sem_visita' && v.status !== 'visita_realizada';
                const disabledReason = v.temEventoAberto
                  ? 'Veículo com evento em aberto'
                  : v.inadimplente
                  ? 'Associado inadimplente'
                  : null;

                return (
                  <TableRow key={v.veiculoId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {(v.temEventoAberto || v.inadimplente) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              </TooltipTrigger>
                              <TooltipContent>{disabledReason}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <span className="font-medium text-sm">{v.associadoNome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{v.placa}</TableCell>
                    <TableCell className="text-sm">{v.marca} {v.modelo}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {v.ultimaComunicacao
                        ? formatDistanceToNow(new Date(v.ultimaComunicacao), { addSuffix: true, locale: ptBR })
                        : 'Sem dados'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-bold ${v.diasSemPontuar >= 7 ? 'text-destructive' : v.diasSemPontuar >= 5 ? 'text-yellow-600' : ''}`}>
                        {v.diasSemPontuar}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cfg.className}>
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {v.status === 'sem_tratativa' ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  size="sm"
                                  disabled={!canInitiate || iniciarTratativa.isPending}
                                  onClick={() => handleIniciarTratativa(v)}
                                >
                                  Iniciar tratativa
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {disabledReason && (
                              <TooltipContent>{disabledReason}</TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      ) : hasActiveTratativa ? (
                        <Button size="sm" variant="outline" onClick={() => handleContinuarTratativa(v)}>
                          Continuar tratativa
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => handleContinuarTratativa(v)}>
                          Ver detalhes
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tratativa Drawer */}
      <TratativaDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        veiculo={selectedVeiculo}
      />
    </div>
  );
}
